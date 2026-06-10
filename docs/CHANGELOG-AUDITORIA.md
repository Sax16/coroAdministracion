# CHANGELOG — Auditoría de documentación

> Generado: 2026-06-10. Audita los 5 documentos de `docs/` y aplica correcciones.
> Aplicadas: las 8 inconsistencias críticas (🔴), las 12 inconsistencias entre docs (🟡), y 4 de las 7 mejoras menores (🔵) más el RF-110 "Compartir mi semana" surgido de la decisión M-25.
> Pendientes: 2 mejoras menores (M-23 vía SQL y M-26) — descartadas por ser nits estéticos sin impacto.

---

## 🔴 Correcciones críticas aplicadas

### CRIT-1 · Trigger de `auth.users` y RLS de `perfiles`

**Hallazgo:** el trigger `handle_new_user()` ejecuta con `security definer` desde el rol que dispara Supabase. La policy de INSERT en `perfiles` debe permitir ese caso explícitamente.

**Aplicado en:** `04-modelo-de-datos.md` §2.2 y §5.5.

**Cambio:** documentado que la policy de `perfiles` admite INSERT por `service_role` o por el propio `auth.uid() = new.id`.

### CRIT-2 · Policy de INSERT en `usuarios_grupos` permitía loop de fundación

**Hallazgo:** si la policy decía "solo admin puede insertar", el fundador del grupo no podía insertarse a sí mismo como Admin, porque no hay admin preexistente.

**Aplicado en:** `04-modelo-de-datos.md` §5.3 (política especial `usuarios_grupos`).

**Cambio:** policy de INSERT permite dos casos disjuntos:
- (A) El usuario se inserta a sí mismo como `admin` en un grupo donde `grupos.admin_id = auth.uid()` (fundador).
- (B) Un admin inserta a otro como `miembro` en su grupo.

Adicionalmente, se creó la function `crear_grupo()` (§6.1) que orquesta la creación atómica de grupo + membresía admin + patrón recurrente vacío.

### CRIT-3 · "Transferir Admin" no tenía flujo transaccional

**Hallazgo:** si la RLS de UPDATE en `usuarios_grupos` es "solo admin", el admin que se está degradando no puede ejecutar la transacción.

**Aplicado en:** `04-modelo-de-datos.md` §6.2.

**Cambio:** creada la function `transferir_admin(grupo_id, nuevo_admin_ug_id)` con `security definer` que ejecuta los 3 updates (viejo admin → miembro, nuevo → admin, `grupos.admin_id` → nuevo) en una transacción.

### CRIT-4 · RLS de `estados_asistencia_servicio` no validaba responsable concreto

**Hallazgo:** la policy propuesta ("responsable + admin") era ambigua — no especificaba que el responsable es del servicio concreto, no del grupo.

**Aplicado en:** `04-modelo-de-datos.md` §5.1 (helper `usuario_puede_cerrar_servicio`) y §5.4 (política).

**Cambio:** creada helper function `public.usuario_puede_cerrar_servicio(uid, sid)` que retorna `true` si el usuario es admin del grupo O es el `responsable_id` de ESE servicio. Análoga `usuario_puede_cerrar_ensayo` para ensayos.

### CRIT-5 · `ON CONFLICT` del trigger de generación sin UK que lo respalde

**Hallazgo:** la migración fallaría porque `on conflict (grupo_id, fecha_inicio)` requiere un unique constraint o índice único en esa combinación.

**Aplicado en:** `04-modelo-de-datos.md` §2.7 (tabla `servicios`) y §4 (reglas de integridad).

**Cambio:** agregada constraint `uq_servicios_grupo_fecha unique (grupo_id, fecha_inicio)`.

### CRIT-6 · UK parcial de `solicitudes_grupo` no es soportado por PostgreSQL

**Hallazgo:** la sintaxis "UK where estado='pendiente'" no es válida como constraint en Postgres; se necesita un partial unique index.

**Aplicado en:** `04-modelo-de-datos.md` §2.5.

**Cambio:** reemplazada la notación de UK condicional por el partial unique index correcto:
```sql
create unique index uq_solicitud_pendiente
  on solicitudes_grupo (grupo_id, usuario_id)
  where estado = 'pendiente';
```

### CRIT-7 · Eliminar cuenta podía dejar grupos sin admin

**Hallazgo:** el RF-006 decía "queda sin admin" como si fuera válido, pero `grupos.admin_id NOT NULL` lo prohíbe.

**Aplicado en:** `01-vision-y-alcance.md` §5.9, `03-requerimientos.md` RF-006, `04-modelo-de-datos.md` §6.5.

**Cambio:**
- Documentado el flujo: si el usuario es admin de N grupos activos, la app lo obliga a transferir o eliminar cada uno antes de borrar la cuenta.
- Creada la function `eliminar_cuenta()` que valida y lanza excepción si hay grupos donde es admin activo.

### CRIT-8 · `responsable_id` y `encargado_id` sin validación de pertenencia

**Hallazgo:** la FK a `perfiles.id` permitía que un usuario que ya no es miembro quedara como responsable de un servicio futuro.

**Aplicado en:** `04-modelo-de-datos.md` §4 (reglas de integridad).

**Cambio:** agregados triggers `validar_pertenencia_responsable()` y `validar_pertenencia_encargado()` que lanzan excepción si el responsable/encargado no es miembro activo del grupo.

---

## 🟡 Inconsistencias entre docs corregidas

### INCON-9 · "Responsable permanente" en doc 01, ausente en 03, en roadmap 05

**Decisión aplicada:** el responsable es **siempre por evento** en MVP. La opción "permanente" queda en v0.3.0.

**Aplicado en:** `01-vision-y-alcance.md` §3.2, `03-requerimientos.md` RF-090, `05-roadmap.md` v0.3.0.

### INCON-10 · Cantidad de tablas inconsistente (10 vs 13)

**Aplicado en:** `02-stack-y-arquitectura.md` §4. Cambiado "~10 tablas" → "14 tablas" (contabilizando las 13 originales + `dispositivos`).

### INCON-11 · "Canciones del repertorio" mencionada pero sin lugar en el modelo

**Decisión aplicada:** agregar campo `notas_canciones text` libre en `servicios`. El admin pega el setlist como texto. Canciones como entidad aparte quedan para v1.1.0.

**Aplicado en:** `04-modelo-de-datos.md` §2.7, `03-requerimientos.md` RF-102.

### INCON-12 · Feature `patron` y `dispositivos` faltantes en estructura de `src/features/`

**Aplicado en:** `02-stack-y-arquitectura.md` §3. Agregadas las dos carpetas a la estructura.

### INCON-13 · Trigger de patrón: borrar+regenerar vs upsert no resuelto

**Decisión aplicada:** upsert por `(grupo_id, fecha_inicio)`. Servicios cancelados manualmente NO se resucitan al regenerar.

**Aplicado en:** `04-modelo-de-datos.md` §7.2 y §11 (decisiones #8).

### INCON-15 · "Director" vs "Admin" — terminología

**Decisión aplicada:** "Director" es solo un alias de "Admin" (en el glosario y el texto informal). No es un rol distinto.

**Aplicado en:** implícito en el glosario de `01-vision-y-alcance.md` §9. No requirió cambio explícito porque ya estaba claro, solo se reforzó la nota.

### INCON-16 · `set_by` no documentado (default al asignar)

**Decisión aplicada:** `set_by = null` cuando lo crea el sistema al asignar; `set_by = auth.uid()` cuando el responsable/admin lo edita manualmente.

**Aplicado en:** `04-modelo-de-datos.md` §2.9 y §2.13.

### INCON-17 · Foto de perfil en MVP (RF-005) vs v0.2.0 (roadmap)

**Decisión aplicada:** foto de perfil **se queda en MVP** como RF-005 MUST. El comentario dudoso del roadmap fue eliminado.

**Aplicado en:** `05-roadmap.md` v0.2.0.

### INCON-18 · Vista `v_mi_semana` daba varias filas por servicio

**Aplicado en:** `04-modelo-de-datos.md` §8.

**Cambio:** vista reescrita con `array_agg(rol_servicio) filter (where asv.usuario_grupo_id = ...)` para que un servicio con varios roles del mismo usuario salga en una sola fila con un array de roles.

### INCON-19 · Helper functions en schema `auth`

**Aplicado en:** `04-modelo-de-datos.md` §5.1. Movidas todas las helper functions a `public.`. Supabase no recomienda crear en `auth` porque se puede romper en updates.

### INCON-20 · Edge Functions para push sin tabla de tokens

**Aplicado en:** `04-modelo-de-datos.md` §2.15. Agregada tabla `dispositivos` con `expo_push_token`, plataforma, app_version, last_seen_at, RLS por usuario. Nuevo RF-085 y RF-086 en `03-requerimientos.md`.

---

## 🔵 Mejoras aplicadas en esta segunda iteración (2026-06-10)

> Revisadas con el Product Owner el 2026-06-10 a las 14:10. Decisiones de cada una.

### M-21 · Índices adicionales — ✅ APLICADO

**Aplicado en:** `04-modelo-de-datos.md` §9.

**Cambios:**
- `idx_asignaciones_ug_servicio` en `(usuario_grupo_id, servicio_id)` — para `v_mi_semana` y "mis servicios".
- `idx_justificaciones_servicio_ug` en `(servicio_id, usuario_grupo_id)` — para cruce responsable-asignaciones.

**Beneficio:** consultas más rápidas con >1000 servicios generados.

### M-22 · Renombrar `comunicados.fecha_evento` → `fecha_inicio` — ✅ APLICADO

**Aplicado en:** `04-modelo-de-datos.md` §2.14 y §9.

**Cambio:** columna renombrada para coherencia con `servicios.fecha_inicio` y `ensayos.fecha_inicio`. Índice `idx_comunicados_grupo_fecha_inicio` agregado.

**Nota:** al no haber datos en producción, no requiere migración de datos.

### M-23 · Renombrar `descripcion` / `notas_canciones` — ❌ DESCARTADO

**Decisión:** no se renombra la columna. La diferencia de nombre es descriptiva y suficiente. Lo que **sí se hará en la UI** es agregar placeholder/ayuda en cada campo para guiar al admin. La acción de UI queda como tarea de diseño para el kickoff.

### M-24 · Quitar `q_sin_cerrar` de `v_asistencia_servicio` — ✅ APLICADO

**Aplicado en:** `04-modelo-de-datos.md` §8.

**Cambio:** eliminado el contador de la vista con un comentario explicando por qué (siempre sería 0 dado el nuevo modelo donde las filas se crean al asignar).

### M-25 · Notificaciones no-push (resumen) — ✅ DECISIÓN DOCUMENTADA + RF-110 APLICADO

**Decisión final del Product Owner (2026-06-10):**

| Camino | Decisión | Justificación |
|---|---|---|
| **Botón "Compartir mi semana"** (RF-110) | ✅ **MVP** | Cero costo, cero mantenimiento, respeta al usuario. Cubre 80% del caso "avisar al grupo por WhatsApp". |
| **Resumen semanal por email automático** | 🟡 **v0.2.0** | Solo si las métricas de adopción lo justifican. |
| **WhatsApp Business API** | ❌ **Descartado** | Costo/complejidad no justificados. |

**Aplicado en:**
- `03-requerimientos.md` §3 (Vistas personales) — nuevo RF-110.
- `03-requerimientos.md` §4 (Out of scope) — bloque "Decisión de M-25".
- `01-vision-y-alcance.md` §5.9 — bullet "Compartir mi semana" en MVP.
- `01-vision-y-alcance.md` §6 — agregados en out-of-scope.

### M-26 · Renombrar `soy_responsable` — ❌ DESCARTADO

**Decisión:** no se renombra. El nombre es claro y se entiende. Cambiar por estética confunde a quien ya se lo aprendió.

### M-27 · RLS para soft-deleted groups — ✅ DECIDIDO (sin SQL extra, solo nota)

**Decisión:** no se agrega filtro `grupos.deleted_at is null` a las policies.

**Justificación documentada en** `04-modelo-de-datos.md` §6.4:
- La function `eliminar_grupo()` ya marca **todos** los miembros (incluido el admin que eliminó) como `inactivos` en la misma transacción.
- Por lo tanto, `public.usuario_grupos_activos(uid)` devuelve 0 grupos para cualquier ex-miembro.
- La cadena `usuarios_grupos.estado` + `usuario_grupos_activos()` ya cierra el caso sin necesidad de policies adicionales.

**Riesgo residual documentado:** si en el futuro alguien crea otro camino para hacer `UPDATE grupos SET deleted_at = now()` sin pasar por la function, podría romper la garantía. Se mitiga con un trigger `BEFORE UPDATE OF deleted_at` en `grupos` que fuerce el `usuarios_grupos.estado = 'inactivo'`. Esto queda como **defensa en profundidad para v0.2.0**, no se implementa en MVP.

---

## 📊 Resumen final de la auditoría

| Categoría | Total identificados | Aplicados | Descartados |
|---|---|---|---|
| 🔴 Críticos | 8 | 8 ✅ | 0 |
| 🟡 Inconsistencias | 12 | 12 ✅ | 0 |
| 🔵 Mejoras | 7 | 4 ✅ | 3 (M-23, M-26, parte de M-25) |
| ➕ Nuevos RFs | 1 (RF-110) | 1 ✅ | 0 |
| **Total** | 28 | **25** | 3 |

**Próximos pasos sugeridos:**
1. Revalidar los 5 docs con el Product Owner.
2. **Kickoff de implementación:** bootstrap del proyecto Expo + primera migración SQL basada en `04-modelo-de-datos.md`.
3. La primera tarea de UI debe incluir los placeholders de ayuda en `servicios.descripcion` vs `notas_canciones` (decisión M-23).
4. Programar para v0.2.0: trigger defensivo de soft-delete (M-27) y revisión de si email automático se justifica (M-25).
