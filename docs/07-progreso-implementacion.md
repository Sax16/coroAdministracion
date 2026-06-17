# 07 · Progreso de Implementación

> Bitácora viva del proyecto. Documenta el estado actual de la implementación,
> las decisiones técnicas que se van tomando en el camino, los fixes aplicados
> sobre la marcha y los próximos pasos concretos. A diferencia de
> [`CHANGELOG.md`](../CHANGELOG.md) (que es por release), este doc es narrativo
> y se actualiza conforme avanzamos.

> Última actualización: 2026-06-16 (sesión de Smoke test prep + RF-005
> + reconciliación de gaps del MVP).

## 1. Dónde estamos

**MVP (v0.1.0) — fase de cierre.** Casi todas las features MUST y SHOULD
del MVP están implementadas y commiteadas. La validación estática pasa
limpia (typecheck, lint, doctor 21/21, export). El smoke test contra
flujos reales (TestFlight/Play Internal) está pendiente — el plan
ejecutable está en [`08-smoke-test.md`](./08-smoke-test.md).

**Decisión de scope del Product Owner (2026-06-16):**
- El proyecto es para un coro real concreto, no un SaaS multi-iglesia.
- **No se hacen** foto de perfil, multi-idioma, ni campo `telefono` en la
  UI del MVP. Los campos `foto_url` y `telefono` en `public.perfiles`
  existen en DB (se conservaron por si se reactivan en v0.2.0+), pero
  la app no los expone.
- Idioma único: español (es-419).

### Gaps del MUST identificados al cierre 🟧

Tres RF marcados como MUST en `03-requerimientos.md` no tienen UI
implementada. La DB ya soporta lo necesario en los 3 casos; falta solo
la capa de presentación.

| RF | Falta | Tamaño estimado | Decisión sugerida |
|---|---|---|---|
| **RF-011** Editar grupo (nombre, descripción) | Pantalla `grupos/[id]/editar.tsx` + función `editarGrupo` en `grupos/api.ts`. Trigger no hace falta, RLS ya permite UPDATE a admin | 1-2 horas | **Implementar antes de la beta** — es un agujero visible para el director |
| **RF-042** Excluir servicio puntual | UI para listar servicios futuros y marcarlos como `cancelado`. La DB ya tiene el estado en `estado_evento_enum` | 2-3 horas | **Implementar antes de la beta** — la app genera servicios automáticos, sin poder cancelar se vuelve molesto |
| **RF-043** Crear servicio excepcional | Form simple: título, fecha, hora. Insert directo a `servicios` con `patron_id = NULL` | 2-3 horas | **Decidir con el director.** El coro podría arreglarse con el patrón recurrente + excluir puntuales. Si se difiere, no bloquea el flujo crítico |

Estos 3 items **corrigen** el claim que se mantuvo en sesiones previas
("todo el MUST del MVP está hecho"). Es lo más exacto hasta hoy: las
features core funcionan, pero hay 3 huecos que conviene cerrar antes
de la beta cerrada. Ver §6 para el plan.

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
| **Eliminar cuenta (RF-006)** | ✅ Implementado | Doble barrera: pre-check en UI de grupos donde es admin (con CTAs transferir/eliminar) + tipeo literal de "ELIMINAR" + Alert.alert destructivo final. Pantallas `/(app)/perfil` y `/(app)/perfil/eliminar`. Limpia stores (grupo activo y sesión) tras éxito |
| **Transferir admin (RF-013) y Eliminar grupo (RF-012)** | ✅ Implementado | Pantallas `/(app)/grupos/[id]/transferir-admin` y `/(app)/grupos/[id]/eliminar` con doble confirmación. Accesos admin en home del grupo. La pantalla de transferir-admin detecta `?origen=eliminar-cuenta` para volver al flujo correcto |
| **Editar perfil (RF-005)** | ✅ Implementado | Edición de nombre y apellido desde `/(app)/perfil/editar`. Update directo a `public.perfiles` filtrado por RLS (policy "perfiles: actualizar el propio"). `useFocusEffect` en el screen padre para re-fetchar silenciosamente al volver del editor (sin flash de spinner). Foto y teléfono quedan para v0.2.0 (requieren Storage + image picker) |
| **Smoke test prep (v0.1.0)** | ✅ Validación estática completa | `expo-doctor` 21/21, `expo export --platform all` compila los 3 bundles (iOS 4.7MB, Android 4.9MB, Web 1.8MB), typecheck + lint limpios. Fixes de peer deps aplicadas (commit `b9d1a96`). Plan de smoke test ejecutable en [`08-smoke-test.md`](./08-smoke-test.md) |
| Routing Expo | ✅ Estructura | Grupos `(auth)` y `(app)` con guards de redirección |

### Lo que FALTA para MVP (gaps MUST antes de beta) 🟧

| Prioridad | Feature | RF-### | Decisión |
|---|---|---|---|
| 🟥 MUST | Editar datos del grupo (nombre, descripción) | RF-011 | Implementar antes de beta |
| 🟥 MUST | Excluir servicio puntual | RF-042 | Implementar antes de beta |
| 🟧 SHOULD | Crear servicio excepcional | RF-043 | Decidir con PO; diferrable a v0.2.0 |

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
| **Eliminar cuenta (RF-006)** | ✅ Implementado | Doble barrera: pre-check en UI de grupos donde es admin (con CTAs transferir/eliminar) + tipeo literal de "ELIMINAR" + Alert.alert destructivo final. Pantallas `/(app)/perfil` y `/(app)/perfil/eliminar`. Limpia stores (grupo activo y sesión) tras éxito |
| **Transferir admin (RF-013) y Eliminar grupo (RF-012)** | ✅ Implementado | Pantallas `/(app)/grupos/[id]/transferir-admin` y `/(app)/grupos/[id]/eliminar` con doble confirmación. Accesos admin en home del grupo. La pantalla de transferir-admin detecta `?origen=eliminar-cuenta` para volver al flujo correcto |
| **Editar perfil (RF-005)** | ✅ Implementado | Edición de nombre y apellido desde `/(app)/perfil/editar`. Update directo a `public.perfiles` filtrado por RLS (policy "perfiles: actualizar el propio"). `useFocusEffect` en el screen padre para re-fetchar silenciosamente al volver del editor (sin flash de spinner). Foto y teléfono quedan para v0.2.0 (requieren Storage + image picker) |
| **Smoke test prep (v0.1.0)** | ✅ Validación estática completa | `expo-doctor` 21/21, `expo export --platform all` compila los 3 bundles (iOS 4.7MB, Android 4.9MB, Web 1.8MB), typecheck + lint limpios. Fixes de peer deps aplicadas (commit `b9d1a96`). Plan de smoke test ejecutable en [`08-smoke-test.md`](./08-smoke-test.md) |
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
| ✅ DONE | Eliminar cuenta con validaciones | RF-006 | Auth + grupos |
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

### D-06 · Doble barrera en acciones destructivas (RNF-014)

**Decisión:** las 3 acciones destructivas del MVP (eliminar cuenta,
eliminar grupo, transferir admin) siguen el mismo patrón de doble
barrera:

1. **Pre-check de dependencias en UI** cuando aplica (RF-006: si el
   usuario es admin de grupos activos, los lista con CTAs inline para
   resolverlos antes de habilitar el botón).
2. **Tipeo literal** de la palabra `ELIMINAR` (o el verbo equivalente)
   en un input, case-insensitive, antes de habilitar el botón.
3. **`Alert.alert` final** con botón destructivo (`style: 'destructive'`)
   en iOS para la última confirmación.

**Razón:** RNF-014 pide "doble confirmación con resumen" para
destructivas. La triple barrera de arriba es lo más cercano que se
puede hacer en mobile sin friccionar al usuario. El tipeo literal es
el patrón estándar (lo usa Google, GitHub en borrar repos, etc.) y
es razonablemente seguro: requiere intención activa.

**Aplicable a:** `app/(app)/perfil/eliminar.tsx`,
`app/(app)/grupos/[id]/eliminar.tsx`. Transferir admin usa solo
Alert.alert porque es destructivo pero reversible (se puede
re-transferir).

### D-07 · Limpiar stores locales tras eliminar cuenta

**Decisión:** `useEliminarCuenta` limpia `useGrupoActivoStore.clear()`
**antes** de `useAuthStore.signOut()`.

**Razón:** el `_layout` de `(app)` reacciona a `user=null` y reemplaza
la ruta a `/login`. Si limpiáramos el grupo activo después del signOut,
el `_layout` ya habría navegado a login y la promesa del `setGrupo(null)`
quedaría flotando — el store persistido en AsyncStorage quedaría
apuntando al grupo "viejo", que un próximo login podría re-hidratar.

**Garantía:** `clear()` borra tanto el store en memoria como la
persistencia en AsyncStorage, así que el próximo login (con una cuenta
nueva) parte con `grupo=null`.

## 3. Fixes aplicados durante implementación

### D-08 · Peer deps de NativeWind y lucide deben ser deps directas

**Decisión:** `react-native-css-interop` (peer de `nativewind@4`) y
`react-native-svg` (peer de `lucide-react-native`) son deps **directas**
del proyecto, no se confía en que aparezcan como transitivas.

**Origen:** durante el smoke test prep, `expo export` falló con
"Unable to resolve react-native-css-interop/jsx-runtime". El módulo
estaba en `node_modules/.pnpm/...` (lo traía `nativewind`), pero pnpm
no lo exponía en el top-level y Metro no podía resolverlo desde el
transform de Babel. En dev con Expo Go esto "funcionaba" porque Expo
Go resuelve transitivos, pero un build standalone (TestFlight/Play
Internal) hubiera crasheado al primer render.

**Razón:** Metro busca módulos en `node_modules` (top-level). pnpm con
symlinks por defecto NO expone transitivos en el top-level para evitar
"phantom dependencies" — pero eso rompe imports directos desde Babel/JSX
runtime. La forma estándar de resolverlo es agregar la dep transitiva
como directa.

**Aplicable a:** cualquier dep que se importe en un archivo generado
por Babel (JSX runtime, plugin runtime, etc.) y que no esté en
`dependencies` directo. El doctor de Expo lo marca como
"Check dependencies for packages that should not be installed directly"
solo cuando es al revés; este caso es el inverso y se detecta
corriendo `expo export`.

## 3. Fixes aplicados durante implementación

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

- ✅ ~~Migración inicial consolidada + script reset~~ (commiteado)
- ✅ ~~Documentación de progreso~~ (este doc + CHANGELOG raíz)
- ✅ ~~Auth completo (login + register + signOut + recuperar + eliminar + editar perfil)~~ (commiteado)
- ✅ ~~Crear grupo + eliminar grupo + transferir admin + patrón recurrente + asignaciones + ensayos + comunicados + solicitudes + cierre asistencia + justificaciones + home~~ (commiteado)
- ✅ ~~Push infra (Edge Function + `dispositivos` + feature)~~ (commiteado)
- ✅ ~~Smoke test prep estático (doctor 21/21 + export 3 plataformas)~~ (commiteado en `b9d1a96`)
- ✅ ~~Editar perfil propio (RF-005)~~ (commiteado en `4367fc4`)

### Antes de beta (gaps MUST detectados)

- 🟥 **Cerrar 3 gaps MUST antes de TestFlight/Play Internal:**
  - RF-011 Editar grupo (1-2h, RLS ya permite)
  - RF-042 Excluir servicio puntual (2-3h, enum `cancelado` ya existe)
  - RF-043 Crear servicio excepcional (2-3h, **decidir con PO**)
- 🟧 Smoke test E2E: ejecutar los 13 escenarios de `08-smoke-test.md`
  (requiere simulador iOS o emulador Android, o Expo Go en dispositivo físico)
- 🟧 Rotar `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` del `.env` dev
  (estos se filtraron en un output de Bash de esta sesión; documentar
  como riesgo R-6)

### Post-beta / v0.2.0

- Validación de RLS con tests automatizados de seguridad
- Sentry / logging en producción
- CI con GitHub Actions (lint + typecheck + tests + build EAS preview)
- Toasts / retry / pull-to-refresh consistentes
- Foto de perfil, `telefono` en UI (campos ya existen en DB)
- Multi-idioma (descartado por PO; ver §"Decisión de scope" arriba)

## 5. Riesgos abiertos

| # | Riesgo | Mitigación |
|---|---|---|
| R-1 | Proyecto Supabase dev aún no creado | Resuelto — proyecto `pgtdkyoyosxybnrlfuwa` activo |
| R-2 | RLS mal configurada podría filtrar datos | Tests específicos de seguridad antes de beta (en v0.2.0) |
| R-3 | Alarma local en OEMs chinos (Xiaomi) puede no sonar | Documentado; recomendar "agregar a apps protegidas" |
| R-4 | Push puede llegar tarde en Doze mode | Aceptado: la alarma local al abrir app es el plan A |
| R-5 | Costos de Apple Developer + Google Play los asume el grupo | Documentado en `01-vision-y-alcance.md` §8 |
| R-6 | `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` del `.env` dev se filtraron en output de Bash (sesión 2026-06-16) | Rotar ambas credenciales desde el dashboard de Supabase antes de la beta |
| R-7 | Tooling nativo (Xcode full, JDK, Android Studio) no instalado en el entorno de dev | Bloqueante solo para builds nativos; Expo Go cubre el smoke test |
| R-8 | 3 RF MUST sin UI (RF-011, RF-042, RF-043) detectados al cierre del MVP | Ver §6 — plan de cierre antes de beta |

## 6. Plan de cierre de gaps del MVP

Los 3 gaps MUST pendientes son chicos individualmente pero juntos definen
si la v0.1.0 está lista para TestFlight. Plan tentativo:

### Sprint sugerido (~1 semana)

1. **RF-011 Editar grupo** (1-2h)
   - Crear `app/(app)/grupos/[id]/editar.tsx` (form nombre + descripción)
   - Agregar `editarGrupo` a `grupos/api.ts` (UPDATE directo a `grupos`,
     filtrado por RLS admin)
   - Agregar `useEditarGrupo` a `grupos/hooks.ts`
   - Botón "Editar" en el home del grupo (solo visible para admin)

2. **RF-042 Excluir servicio puntual** (2-3h)
   - Crear `app/(app)/grupos/[id]/servicios/[servicioId]/cancelar.tsx`
     o acción inline en la lista de servicios
   - UPDATE directo a `servicios.estado = 'cancelado'`
   - Push opcional a asignados (puede ser v0.2.0)
   - El servicio cancelado NO se re-genera por el trigger (decisión
     documentada en la migración, F-04 complementario)

3. **RF-043 Crear servicio excepcional** (2-3h, **decidir con PO primero**)
   - Crear `app/(app)/grupos/[id]/servicios/crear.tsx`
   - Form: título, fecha, hora, descripción
   - INSERT a `servicios` con `patron_id = NULL` (es la marca de "excepcional")
   - RLS ya permite insert a admin del grupo
   - **Si el director dice que el coro no necesita servicios
     excepcionales** (ej. solo usa el patrón + excluye puntuales),
     se difiere a v0.2.0 con nota en CHANGELOG.

**Cierre total:** 1-2 sprints chicos, todos chicos individualmente.
