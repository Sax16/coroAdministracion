# 05 · Roadmap

> Plan de releases. Las fechas son orientativas; se ajustan al cerrar cada versión. Recalibrado al nuevo alcance multi-grupo. Última revisión: 2026-06-10 (post-auditoría). Ver `CHANGELOG-AUDITORIA.md`.

## v0.1.0 — MVP 🎯 (objetivo: 8-10 semanas desde kickoff)

**Objetivo:** que un director real pueda crear su grupo, configurar su patrón semanal, asignar a los miembros de la semana, cerrar la asistencia post-servicio, y que los miembros reciban push + alarma local — todo en producción real, en App Store y Play Store.

**Incluye:**

- [x] Documentación de visión, stack, requerimientos y modelo de datos
- [ ] Bootstrap del proyecto Expo + TS + NativeWind + Supabase
- [ ] Auth (email + password) con trigger de creación de `perfiles`
- [ ] RLS multi-tenant (helper functions + políticas en todas las tablas)
- [ ] Crear / editar / eliminar grupo
- [ ] Transferir Admin
- [ ] Solicitudes de ingreso (aprobar / rechazar)
- [ ] Listado de miembros + dar de baja lógica
- [ ] Configurar patrón recurrente + generación automática de servicios
- [ ] Excluir servicio puntual
- [ ] Crear servicio excepcional
- [ ] Asignaciones semanales con roles múltiples por servicio
- [ ] Pantalla "Mi semana" del miembro
- [ ] Push notifications (FCM/APNs) via Edge Function
- [ ] Alarmas locales (categoría `alarm`, full-screen) programadas al ver "Mi semana"
- [ ] Permiso `SCHEDULE_EXACT_ALARM` para Android 12+
- [ ] Ensayos: crear, asignar encargado, cerrar asistencia
- [ ] Comunicados: crear, listar, push
- [ ] Cierre de asistencia de servicio (responsable o admin)
- [ ] Justificaciones de miembros (texto libre)
- [ ] Selector de grupo activo (multi-grupo)
- [ ] Onboarding del primer admin (crear grupo)
- [ ] Publicación cerrada (TestFlight + Play Internal) para 3-5 grupos beta
- [ ] Publicación abierta en stores

**Criterio de "done" del MVP:**

1. TestFlight + Play Internal usados por 3+ grupos reales durante 2 semanas sin bugs críticos.
2. Flujo "asignación semanal" se hace en < 10 min por un director real.
3. La alarma local suena 1h antes del servicio en iOS y Android (verificado en al menos 2 dispositivos distintos).
4. No hay errores en producción durante 1 semana seguida.
5. RLS validada: un usuario de un grupo A **no puede** ver datos del grupo B por ningún endpoint.

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
- Multi-idioma

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
| El director quiere muchas features extra que no están en MVP | Regla firme: se anotan en backlog, entran en v0.2.0+ si son razonables |
| Plan gratuito de Supabase se queda corto | Migración a Pro (~USD 25/mes) es trivial; documentado y presupuestado |

---

🎉 Documentación base completa. Volver a [README](../README.md).
