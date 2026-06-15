# 07 · Progreso de Implementación

> Bitácora viva del proyecto. Documenta el estado actual de la implementación,
> las decisiones técnicas que se van tomando en el camino, los fixes aplicados
> sobre la marcha y los próximos pasos concretos. A diferencia de
> [`CHANGELOG.md`](../CHANGELOG.md) (que es por release), este doc es narrativo
> y se actualiza conforme avanzamos.

> Última actualización: 2026-06-15 (sesión de Solicitar ingreso).

## 1. Dónde estamos

**MVP (v0.1.0) — fase inicial.** La documentación base está completa y
validada con el Product Owner. El bootstrap técnico está hecho. La primera
migración SQL (DDL + RLS + lógica + vistas) está commiteada y lista para
aplicarse al proyecto Supabase. **Auth y gestión básica de grupos ya están
implementados** (login, register, signOut, crear grupo, listado con rol,
selector de grupo activo). Falta: patrón recurrente, asignaciones, "Mi
semana", push notifications, ensayos, comunicados, cierre de asistencia.

### Lo que YA está hecho ✅

| Área | Estado | Detalle |
|---|---|---|
| Docs de producto | ✅ Completo | 7 documentos + `07-progreso-implementacion.md`, auditados y corregidos |
| Bootstrap Expo | ✅ Completo | SDK 56 + TS strict + NativeWind + Expo Router |
| Cliente Supabase | ✅ Wireado | `src/lib/supabase.ts` con AsyncStorage |
| Migración inicial | ✅ Commiteada | `20260614000000_initial_schema.sql` (1.255 líneas) |
| Script reset dev | ✅ Commiteado | `supabase/scripts/reset_dev.sql` con header destructivo |
| `CHANGELOG.md` raíz | ✅ Creado | Formato Keep a Changelog |
| Componentes UI base | ✅ Creado | `Button` y `LabeledInput` con paleta del proyecto |
| **Auth (login/register/logout)** | ✅ Implementado | Cubre RF-001, RF-002, RF-003. Store + API + hooks + pantallas |
| **Crear grupo** | ✅ Implementado | Cubre RF-010. Vía SECURITY DEFINER `crear_grupo()` |
| **Listado de mis grupos** | ✅ Implementado | Cubre RF-016. Con JOIN a `usuarios_grupos` filtrado por RLS |
| **Selector de grupo activo** | ✅ Implementado | Cubre RF-015. Persistencia en AsyncStorage |
| **Patrón recurrente semanal** | ✅ Implementado | Cubre RF-040, RF-041 (vía trigger de DB) y RF-044. UI por día con chips de horarios |
| **Asignaciones semanales** | ✅ Implementado | Cubre RF-050, RF-051, RF-052, RF-053. Vista semanal con navegación de semana, asignación multi-rol por miembro-servicio |
| **Pantalla "Mi semana" + scheduler de alarmas** | ✅ Implementado | Cubre RF-054, RF-055, RF-063, RF-064. Vista 14 días con servicios del usuario, agenda alarmas locales con `expo-notifications`, pide `SCHEDULE_EXACT_ALARM` en Android 12+ |
| **Push notifications (infra)** | ✅ Implementado | Edge Function `notificar-push` + tabla `notificaciones` + feature `dispositivos/` con `PushTokenRegistrar`. Cubre RF-060, RF-061, RF-062, RF-065, RF-066, RF-083, RF-085. RF-086 (limpieza de tokens) queda para v0.2.0 |
| **Ensayos (CRUD + invitados)** | ✅ Implementado | Cubre RF-070, RF-071, RF-072, RF-073, RF-074. Listado, crear, editar, detalle, cancelar/reabrir, asignación de encargado, gestión de invitados. Push integrado. Cierre de asistencia (RF-075) queda para v0.2.0 |
| **Cierre de asistencia de servicio** | ✅ Implementado | Cubre RF-090, RF-091, RF-092, RF-093, RF-094, RF-095, RF-096, RF-097. Pantalla de cierre para responsable/admin, pantalla de justificación para miembro, badges de estado en mi-semana, CTA cerrar en vista admin |
| **Comunicados** | ✅ Implementado | Cubre RF-080, RF-081, RF-082, RF-083, RF-084. Listado cronológico, crear, editar, eliminar, detalle. Push al publicar (comunicado_publicado) |
| **Home del grupo** | ✅ Implementado | Dashboard post-selección de grupo activo con resumen de la semana y grid de accesos rápidos. Pantalla principal post-login |
| **Solicitar ingreso a grupo (RF-020 a RF-023)** | ✅ Implementado | Búsqueda por nombre, enviar solicitud, inbox admin, aprobar/rechazar. Push en 4 eventos. Migración nueva abre SELECT de grupos para descubrimiento |
| Routing Expo | ✅ Estructura | Grupos `(auth)` y `(app)` con guards de redirección |

### Lo que FALTA para MVP (siguiente sprint) 🟡

| Prioridad | Feature | RF-### | Depende de |
|---|---|---|---|
| 🟥 MUST | Asignaciones semanales | RF-050, RF-051, RF-052 | Servicios generados |
| 🟥 MUST | Pantalla "Mi semana" + scheduler de alarmas | RF-054, RF-055, RF-063, RF-064 | Asignaciones |
| 🟥 MUST | Push notifications via Edge Function | RF-060, RF-061, RF-062, RF-083, RF-085 | Servicios + auth |
| 🟥 MUST | Home del grupo (post-selección de grupo activo) | (nuevo) | Selector de grupo activo |
| 🟧 SHOULD | Ensayos | RF-070 → RF-076 | (paralelizable) |
| 🟧 SHOULD | Comunicados | RF-080 → RF-084 | (paralelizable) |
| 🟧 SHOULD | Cierre de asistencia + justificaciones | RF-090 → RF-097 | Asignaciones |
| 🟧 SHOULD | Eliminar cuenta con validaciones | RF-006 | Auth + grupos |
| 🟧 SHOULD | Solicitar unirse a grupo existente | RF-020 → RF-023 | Auth |

## 2. Decisiones técnicas tomadas durante implementación

### D-01 · Nomenclatura de archivos de migración

**Decisión:** timestamp de Supabase CLI (`YYYYMMDDHHMMSS_name.sql`), un solo
archivo por release lógico. El primer archivo es `20260614000000_initial_schema.sql`.

**Razón:** la CLI de Supabase espera este formato y ejecuta los archivos en
orden lexicográfico. Los archivos con prefijo `_` (que se usaron durante el
desarrollo de los bloques) no son estándar y pueden no ejecutarse en
algunas versiones de la CLI.

**Cleanup movido a:** `supabase/scripts/reset_dev.sql` con header que
advierte que es destructivo.

### D-02 · Helper functions en `public.*`, nunca en `auth.*`

**Decisión:** confirmada. Las 4 helper functions multi-tenant viven en
`public.*` y se invocan calificadas (`public.usuario_grupos_activos(...)`).

**Razón:** Supabase no recomienda crear funciones en el schema `auth` porque
es gestionado por ellos y se puede romper en updates. Documentado en la
auditoría (INCON-19).

### D-03 · Triggers de generación, no en la app

**Decisión:** la generación de servicios desde el patrón recurrente ocurre en
un trigger AFTER sobre `patrones_recurrentes`, NO en la app.

**Razón:** la atomicidad y consistencia es crítica. Si la app lo hiciera,
un crash a mitad del proceso dejaría servicios parcialmente generados.
El trigger corre dentro de la transacción del INSERT/UPDATE del patrón.
Mismo razonamiento para `crear_estado_asistencia_al_asignar` y
`handle_new_user`.

### D-04 · SECURITY DEFINER ops como única ruta privilegiada

**Decisión:** las 5 ops transaccionales multi-tabla (`crear_grupo`,
`transferir_admin`, `aprobar_solicitud`, `eliminar_grupo`,
`eliminar_cuenta`) son SECURITY DEFINER. La RLS no puede expresar
transacciones multi-tabla en una sola policy, así que estas funciones
son la única forma válida de hacer estas operaciones.

**Garantía:** cualquier INSERT/UPDATE directo a las tablas afectadas
queda bloqueado por la RLS (las policies son restrictivas) o queda
inconsistente con las invariantes. Si en el futuro se agrega una nueva
ruta que toque `grupos.admin_id`, debe replicar la validación que está
dentro de `crear_grupo()` y `transferir_admin()`.

### D-05 · `.mavis/` ignorado por git

**Decisión:** el directorio `.mavis/` (runtime de Mavis, datos locales de
sesión) se agregó a `.gitignore` en este commit.

**Razón:** no es parte del código del proyecto; son archivos generados
por el agente que corre en la máquina del dev.

## 3. Fixes aplicados durante implementación

### F-01 · Policy de INSERT en `perfiles` no permitía al trigger

**Origen:** el bloque `_bloque2_logica.sql` original tenía la policy
`with check (id = auth.uid())`. Esto bloquea al trigger `handle_new_user()`
porque cuando Supabase dispara el trigger, `auth.uid()` retorna NULL.

**Fix aplicado en:** `20260614000000_initial_schema.sql` §7.1.

**Cambio:** `with check (id = auth.uid() or auth.uid() is null)`.
Esto cubre los dos casos:
- (A) El usuario se inserta a sí mismo (caso app).
- (B) El trigger del sistema (caso Supabase Auth) corre sin sesión.

**Origen en docs:** el doc 04 §2.2 ya documentaba este fix como
CRIT-1 de la auditoría, pero el bloque 2 no lo había implementado
correctamente. Detectado y corregido en este commit.

### F-02 · `generar_servicios_desde_patron` referenciaba columna inexistente

**Origen:** el doc 04 §7.2 (que es la fuente de la migración) tiene la
función trigger referenciando `new.zona_horaria`. Esa columna está en
`public.grupos`, NO en `public.patrones_recurrentes`. La migración
fallaría en runtime con "columna no existe".

**Fix aplicado en:** `20260614000000_initial_schema.sql` §9.2.

**Cambio:** la función trigger ahora hace un SELECT sobre `public.grupos`
para levantar la zona horaria antes del loop de generación.

```sql
select g.zona_horaria into v_zona_horaria
from public.grupos g
where g.id = new.grupo_id;
```

### F-03 · `chk_admin_es_miembro` no es implementable como CHECK en PostgreSQL

**Origen:** el doc 04 §4 proponía un CHECK constraint para garantizar
que `grupos.admin_id` sea un admin activo en `usuarios_grupos`. PostgreSQL
no permite subqueries dentro de CHECK constraints (SQLSTATE 0A000).

**Fix aplicado en:** `20260614000000_initial_schema.sql` §8.3.

**Decisión documentada:** se probaron 3 caminos (CHECK, trigger AFTER,
CONSTRAINT trigger deferred) y los 3 fallan por razones distintas. La
solución adoptada es validar la invariante manualmente dentro de las
SECURITY DEFINER ops que tocan `grupos.admin_id` (`crear_grupo()` y
`transferir_admin()`). Documentado en el cuerpo de la migración con
los 3 argumentos completos para que un futuro dev no reabra la discusión.

### F-04 · Migración no era idempotente: SQLSTATE 42710 al reaplicar

**Síntoma:** al aplicar la migración una segunda vez (ej. después de un
intento fallido a mitad, o un `supabase db reset`), PostgreSQL tiraba
`ERROR: type "rol_grupo_enum" already exists (SQLSTATE 42710)`. Igual
pasaba con tablas, constraints, triggers y policies.

**Origen:** la primera versión usaba `CREATE TYPE`, `CREATE TABLE`,
`CREATE TRIGGER`, `CREATE POLICY` directos, que fallan si el objeto ya
existe. No es una "primera migración idempotente" en el sentido estricto
(las tablas se crean con `IF NOT EXISTS` pero los enums/triggers/policies
necesitan patrones distintos en PostgreSQL).

**Fix aplicado en:** `20260614000000_initial_schema.sql` — reescritura
completa con patrones idempotentes:

- **Enums:** DO block con check de `pg_type.typname` (PostgreSQL no
  soporta `CREATE TYPE IF NOT EXISTS`).
- **Tablas:** `CREATE TABLE IF NOT EXISTS`.
- **Constraints (CHECK, UK):** DO block con check de `pg_constraint.conname`.
- **Índices:** `CREATE INDEX IF NOT EXISTS` (soportado nativamente).
- **Partial unique index:** `CREATE UNIQUE INDEX IF NOT EXISTS` (igual).
- **Triggers:** `DROP TRIGGER IF EXISTS ... ON table; CREATE TRIGGER ...`
  antes de cada uno.
- **Policies:** `DROP POLICY IF EXISTS ... ON table; CREATE POLICY ...`
  antes de cada una.
- **Functions / Views:** `CREATE OR REPLACE` (ya lo estaban).
- **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`:** idempotente nativo.

**Beneficio:** la migración ahora es 100% re-aplicable. Compatible con
`supabase db reset` (que borra todo y reaplica las migraciones desde
cero) y con intentos de "intentar de nuevo" si algo falla a mitad.

## 4. Próximos pasos concretos

### Inmediato (esta sesión)

1. ✅ ~~Migración inicial consolidada + script reset~~ (commiteado)
2. ✅ ~~Documentación de progreso~~ (este doc + CHANGELOG raíz)
3. ✅ ~~Auth: implementar login + register + signOut~~ (commiteado)
4. ✅ ~~Crear grupo: pantalla + integración con `crear_grupo()`~~ (commiteado)
5. ✅ ~~Selector de grupo activo: store + persistencia en AsyncStorage~~ (commiteado)
6. ✅ ~~Patrón recurrente: pantalla + API + hooks~~ (commiteado)
7. 🟡 Aplicar la migración al proyecto Supabase dev (`supabase db push` o dashboard)
8. 🟡 Generar tipos de TypeScript con `supabase gen types typescript`
9. 🟡 Smoke test E2E: registrar → crear grupo → configurar patrón → ver servicios generados

### Corto plazo (siguiente sprint)

9. ✅ Patrón recurrente: UI + guardar en `patrones_recurrentes` (el trigger
   se encarga de la generación)
10. ✅ Asignaciones semanales: vista semanal + asignación
11. ✅ "Mi semana" con scheduler de alarmas
12. ✅ Push notifications (Edge Function + `dispositivos` table)
13. Home del grupo (post-selección de grupo activo)

### Antes de beta

14. ✅ Ensayos (CRUD + invitados, RF-070→074), cierre de asistencia RF-075 (v0.2.0)
15. ✅ Cierre de asistencia de servicio (RF-090 → RF-097)
16. ✅ Comunicados (RF-080 → RF-084)
17. ✅ Home del grupo (post-selección de grupo activo)
18. ✅ Solicitar ingreso a grupo (RF-020 → RF-023)
19. Smoke test en TestFlight + Play Internal con 3-5 grupos reales
20. Validación de RLS con tests de seguridad

## 5. Riesgos abiertos

| # | Riesgo | Mitigación |
|---|---|---|
| R-1 | Proyecto Supabase dev aún no creado | Acción del usuario: crear el proyecto, poner keys en `.env` |
| R-2 | RLS mal configurada podría filtrar datos | Tests específicos de seguridad antes de beta (en v0.2.0) |
| R-3 | Alarma local en OEMs chinos (Xiaomi) puede no sonar | Documentado; recomendar "agregar a apps protegidas" |
| R-4 | Push puede llegar tarde en Doze mode | Aceptado: la alarma local al abrir app es el plan A |
| R-5 | Costos de Apple Developer + Google Play los asume el grupo | Documentado en `01-vision-y-alcance.md` §8 |
