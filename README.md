# 🎵 CoroAdministración

App móvil para administrar un grupo de alabanza: **multi-grupo**, con servicios recurrentes semanales, asignaciones flexibles (cantantes / músicos / limpieza intercambiables), ensayos, comunicados, cierre de asistencia post-servicio con justificaciones, y alarmas reales de celular que **no consumen batería extra**.

> **Estado:** fase de diseño. Aún no hay código. La documentación de base está completa y validada con el Product Owner.

## Stack

- **React Native + Expo + TypeScript** (app móvil, iOS + Android)
- **NativeWind** (estilos tipo Tailwind)
- **Supabase** (Auth + Postgres + Realtime + Storage + Edge Functions)
- **EAS** (CI / build / submit a stores)
- **Híbrido inteligente** de notificaciones: **push estándar** (FCM/APNs) + **alarmas locales** (categoría `alarm`, sonido custom, full-screen) programadas al ver la asignación

## Documentación

Toda la documentación de producto y diseño vive en [`docs/`](./docs/):

| # | Documento | Contenido |
|---|-----------|-----------|
| 1 | [Visión y alcance](./docs/01-vision-y-alcance.md) | El problema, la solución, multi-grupo, 3 tipos de evento, workflow de asistencia, out of scope |
| 2 | [Stack y arquitectura](./docs/02-stack-y-arquitectura.md) | Decisiones técnicas, multi-tenant con RLS, híbrido de notificaciones, estructura de carpetas |
| 3 | [Requerimientos](./docs/03-requerimientos.md) | RF-### y RNF-### trazables, historias de usuario, out of scope |
| 4 | [Modelo de datos](./docs/04-modelo-de-datos.md) | ERD, 14 tablas multi-tenant, RLS, operaciones privilegiadas, triggers, vistas, decisiones |
| 5 | [Roadmap](./docs/05-roadmap.md) | v0.1.0 → v2.0.0, criterios de "done", riesgos |
| 6 | [Changelog auditoría](./docs/CHANGELOG-AUDITORIA.md) | Detalle de las 20 correcciones aplicadas (8 críticas + 12 inconsistencias) tras la auditoría del 2026-06-10 |

## Conceptos clave del producto

- **Grupo de alabanza**: la unidad organizativa. Cualquier usuario puede crear uno o solicitar unirse.
- **Roles de sistema en el grupo**: `Admin` (uno, transferible) y `Miembro` (N).
- **Roles de servicio** (asignaciones): `cantante`, `musico`, `limpieza`. Un mismo miembro puede tener varios en el mismo servicio. La limpieza NO es un área separada.
- **Patrón recurrente**: el Admin lo configura una vez (ej. Mar-Sáb 19:00, Dom 10:00 y 18:00) y el sistema genera los servicios de las próximas N semanas. Puede excluir servicios puntuales.
- **3 tipos de evento**: `servicio` (con cierre de asistencia + justificación), `ensayo` (con lista de asistencia), `comunicado` (sin asistencia).
- **Cierre de asistencia de servicio**: el Responsable designado marca quién fue, los miembros que no fueron pueden justificar en texto libre, el estado final es visible para todos (visualización pasiva, sin chat ni comentarios).
- **Alarma real de celular**: categoría `alarm`, sonido custom, full-screen, programada al ver "Mi semana". Cero impacto en batería (la agenda el SO, no la app).

## Estructura del repo (planificada)

```
coroAdministracion/
├── README.md          ← este archivo
├── docs/              ← documentación
├── app/               ← Expo Router (próximamente)
├── src/               ← features, lib, stores, types
├── supabase/          ← migraciones SQL, edge functions, seed
└── assets/
```

## Próximos pasos inmediatos

1. Crear el proyecto Expo (`npx create-expo-app` con TypeScript).
2. Crear el proyecto Supabase (al menos el entorno `dev`).
3. Implementar el esquema SQL del documento `04-modelo-de-datos.md` como primera migración.
4. Implementar las RLS y las helper functions de multi-tenant.
5. Empezar con auth + crear grupo + selector de grupo activo.

## Cómo contribuir / desarrollar

> Por definir cuando arranque el código. Convenciones planeadas:

- **Branches:** `feature/<código>` o `fix/<código>` (ej. `feature/RF-040`)
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`)
- **PRs:** revisión del Admin del grupo antes de merge

## Licencia

Privado, todos los derechos reservados al director del grupo musical.
