# 05 · Roadmap

> Plan de releases. Las fechas son orientativas; se ajustan al cerrar cada versión. Recalibrado al nuevo alcance multi-grupo. Última revisión: 2026-06-16 (post-RF-005, post-smoke-test-prep). Ver `CHANGELOG-AUDITORIA.md`.

## v0.1.0 — MVP 🎯 (objetivo: 8-10 semanas desde kickoff)

**Objetivo:** que un director real pueda crear su grupo, configurar su patrón semanal, asignar a los miembros de la semana, cerrar la asistencia post-servicio, y que los miembros reciban push + alarma local — todo en producción real, en App Store y Play Store.

**Scope confirmado por el Product Owner (2026-06-16):**
- App mono-coro (un coro real) por ahora — el modelo multi-grupo del backend
  se mantiene, pero el plan no apunta a SaaS multi-iglesia en v0.1.0.
- **No se incluyen:** foto de perfil, multi-idioma. El campo `telefono`
  en `perfiles` existe en DB pero no se expone en la UI del MVP.
- Idioma: español (es-419) único. La columna `locale` no existe en la app.

**Incluye:**

- [x] Documentación de visión, stack, requerimientos y modelo de datos
- [x] Bootstrap del proyecto Expo + TS + NativeWind + Supabase
- [x] Auth (email + password) con trigger de creación de `perfiles` (RF-001 a RF-005, RF-006)
- [x] RLS multi-tenant (helper functions + políticas en todas las tablas)
- [x] Crear grupo (RF-010) y Eliminar grupo (RF-012)
- [x] Editar datos del grupo (RF-011) — commit `81ff975`
- [x] Transferir Admin (RF-013)
- [x] Solicitudes de ingreso (aprobar / rechazar) (RF-020 a RF-023)
- [x] Listado de miembros + dar de baja lógica (RF-030 a RF-033)
- [x] Configurar patrón recurrente + generación automática de servicios (RF-040, RF-041, RF-044)
- [x] Excluir un servicio puntual (RF-042) — commit `b40e987`
- [x] Crear servicio excepcional (RF-043) — commit `08ba294`
- [x] Asignaciones semanales con roles múltiples por servicio (RF-050 a RF-053)
- [x] Pantalla "Mi semana" del miembro (RF-054, RF-055)
- [x] Push notifications (FCM/APNs) via Edge Function (RF-060 a RF-062, RF-065, RF-066)
- [x] Alarmas locales (categoría `alarm`, full-screen) programadas al ver "Mi semana" (RF-063, RF-064)
- [x] Permiso `SCHEDULE_EXACT_ALARM` para Android 12+
- [x] Ensayos: crear, asignar encargado (cierre de asistencia queda para v0.2.0; ver F-RF-075)
- [x] Comunicados: crear, listar, push (RF-080 a RF-084)
- [x] Cierre de asistencia de servicio (responsable o admin) (RF-090 a RF-093)
- [x] Justificaciones de miembros (texto libre) (RF-094 a RF-097)
- [x] Selector de grupo activo (multi-grupo) (RF-015)
- [x] Onboarding del primer admin (crear grupo) (RF-010)
- [ ] Publicación cerrada (TestFlight + Play Internal) para 3-5 grupos beta
- [ ] Publicación abierta en stores

> **Decisión sobre los 3 gaps:** cerrados antes de la beta cerrada.
> Commits: `81ff975` (RF-011), `b40e987` (RF-042), `08ba294` (RF-043).
> Ver [`07-progreso-implementacion.md`](./07-progreso-implementacion.md) §6
> para el detalle de cada uno.

**Criterio de "done" del MVP:**

1. TestFlight + Play Internal usados por 3+ grupos reales durante 2 semanas sin bugs críticos.
2. Flujo "asignación semanal" se hace en < 10 min por un director real.
3. La alarma local suena 1h antes del servicio en iOS y Android (verificado en al menos 2 dispositivos distintos).
4. No hay errores en producción durante 1 semana seguida.
5. RLS validada: un usuario de un grupo A **no puede** ver datos del grupo B por ningún endpoint.
6. Smoke test local ejecutado contra los 13 escenarios de [`08-smoke-test.md`](./08-smoke-test.md), 0 bugs blocker.

## v0.2.0 — Calidad y robustez (post-MVP, +3-4 semanas)

- Tests: unit + integration para flujos críticos
- Sentry / logging para errores en producción
- CI: GitHub Actions (lint + typecheck + tests + build EAS preview)
- Manejo de errores amigable en UI (toasts, retry, estados de carga)
- Pull-to-refresh en todas las listas
- Búsqueda y filtros completos en listados (miembros, ensayos, comunicados)
- Push de "responsable, te falta cerrar la asistencia" (las 12h después del servicio)
- Push al Admin cuando alguien justifica inasistencia
- Limpieza de tokens de push inválidos (RF-086)

## v0.3.0 — Roles intermedios y multi-admin (+4-6 semanas)

- Múltiples Admins por grupo
- **Responsable permanente del grupo** (no por evento)
- Roles: `admin_general`, `admin_asistente`
- Permisos configurables por rol
- Logs de auditoría (quién hizo qué, cuándo)

## v0.4.0 — Reportes y métricas (+3-4 semanas)

- Dashboard del Admin: % de asistencia por miembro últimos 3 meses
- Servicios con más inasistencias
- Ranking de participación
- Exportar historial a CSV

## v1.0.0 — Versión 1.0 pública (+4-6 semanas)

- Onboarding pulido (tooltips, vacíos amistosos)
- Landing page pública
- Términos y condiciones + política de privacidad
- Plan gratuito con límite, plan pago con features extra (futuro SaaS)
- Migración a Supabase Pro si se superan los límites del plan gratuito
- Changelog público

## v1.1.0 — Repertorio de canciones (+4-6 semanas)

- CRUD de canciones
- Asignar canciones a servicios
- Canciones asignadas a un ensayo
- Subir PDFs / links a partituras
- Audio de referencia

## v1.2.0 — Integraciones (+3-4 semanas)

- Google Calendar / Apple Calendar (sync de eventos)
- WhatsApp Business API (opcional, para grupos que aún lo usan)
- Spotify / YouTube embebido para audio de canciones

## v2.0.0 — Plataformas adicionales (+6-8 semanas)

- Expo Web (versión navegador)
- Tablet layout optimizado
- Widgets de iOS / Android (próximo servicio en la home del celular)

## Ideas en backlog (sin fecha)

- Tesorería / aportes / cuotas
- Chat entre miembros
- Comentarios en asignaciones
- Grabación de audio del ensayo desde la app
- Modo offline completo
- App para Apple Watch
- Reconocimiento de voz para confirmar asistencia
- Sincronización entre dos iglesias (mismo director, varios grupos coordinados)

## Decisiones de release

- **Cadencia:** corta al inicio (cada 1-2 semanas), más espaciada al estabilizarse.
- **Versionado:** SemVer. `0.x.y` mientras estamos en pre-1.0. `1.0.0` cuando esté lista para escalar como producto.
- **Changelog:** mantenido en `CHANGELOG.md` raíz, autogenerado desde commits (Conventional Commits).

## Riesgos del roadmap

| Riesgo | Mitigación |
|---|---|
| MVP se estira por scope creep | `01-vision-y-alcance.md` se re-valida al inicio de cada release. Regla: si una feature no está en RF-###, no entra. |
| Apple Developer / Google Play cuentas no listas | Tarea #1 del kickoff, antes de tocar código |
| Costos de stores los asume el grupo | Documentado y acordado con el director desde v0.1.0 |
| Push notifications requieren backend para tokens | Edge Function o trigger en Supabase antes del release |
| Alarmas locales no suenan en ciertos Android (Xiaomi) | Documentado; se recomienda a usuarios "agregar a apps protegidas". No bloquea release. |
| RLS mal configurada filtra datos entre grupos | Tests específicos de seguridad automatizados antes de cada release |
| El director quiere muchas features extra que no están en MVP | Regla firme: se anotan en backlog, entran en v0.2.0+ si son razonables. Para esta v0.1.0 el director confirmó que **no** se hacen foto de perfil ni multi-idioma |
| Plan gratuito de Supabase se queda corto | Migración a Pro (~USD 25/mes) es trivial; documentado y presupuestado |

---

🎉 Documentación base completa. Volver a [README](../README.md).
