# 🎵 CoroAdministración

App móvil para administrar un grupo de alabanza: **multi-grupo**, con servicios recurrentes semanales, asignaciones flexibles (cantantes / músicos / limpieza intercambiables), ensayos, comunicados, cierre de asistencia post-servicio con justificaciones, y alarmas reales de celular que **no consumen batería extra**.

> **Estado:** MVP (v0.1.0) en fase de cierre. Las features MUST/SHOULD están implementadas y commiteadas; la validación estática (typecheck, lint) pasa limpia. Pendiente: smoke test contra flujos reales (TestFlight / Play Internal). El estado vivo y detallado está en [`docs/07-progreso-implementacion.md`](./docs/07-progreso-implementacion.md).

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
| 6 | [Convenciones de desarrollo](./docs/06-convenciones-desarrollo.md) | Package manager (pnpm), commits, branches, RLS, env vars, checklist de PR |
| 7 | [Progreso de implementación](./docs/07-progreso-implementacion.md) | Bitácora viva: estado real, decisiones sobre la marcha, gaps y próximos pasos |
| 8 | [Smoke test](./docs/08-smoke-test.md) | Plan de pruebas manuales de los flujos críticos antes de release |
| — | [Changelog auditoría](./docs/CHANGELOG-AUDITORIA.md) | Detalle de las 25 correcciones aplicadas tras la auditoría del 2026-06-10 |

> Para trabajar en el código, ver también [`CLAUDE.md`](./CLAUDE.md) (arquitectura, patrones y convenciones operativas).

## Conceptos clave del producto

- **Grupo de alabanza**: la unidad organizativa. Cualquier usuario puede crear uno o solicitar unirse.
- **Roles de sistema en el grupo**: `Admin` (uno, transferible) y `Miembro` (N).
- **Roles de servicio** (asignaciones): `cantante`, `musico`, `limpieza`. Un mismo miembro puede tener varios en el mismo servicio. La limpieza NO es un área separada.
- **Patrón recurrente**: el Admin lo configura una vez (ej. Mar-Sáb 19:00, Dom 10:00 y 18:00) y el sistema genera los servicios de las próximas N semanas. Puede excluir servicios puntuales.
- **3 tipos de evento**: `servicio` (con cierre de asistencia + justificación), `ensayo` (con lista de asistencia), `comunicado` (sin asistencia).
- **Cierre de asistencia de servicio**: el Responsable designado marca quién fue, los miembros que no fueron pueden justificar en texto libre, el estado final es visible para todos (visualización pasiva, sin chat ni comentarios).
- **Alarma real de celular**: categoría `alarm`, sonido custom, full-screen, programada al ver "Mi semana". Cero impacto en batería (la agenda el SO, no la app).

## Estructura del repo

```
coroAdministracion/
├── README.md          ← este archivo
├── CLAUDE.md          ← guía de arquitectura y convenciones para devs
├── docs/              ← documentación de producto y diseño
├── app/               ← Expo Router (rutas = archivos): (auth)/ y (app)/
├── src/
│   ├── features/      ← lógica por dominio (api.ts, hooks.ts, types.ts, components/)
│   ├── components/    ← UI compartido
│   ├── lib/           ← supabase client, notifications, result, dateTime
│   ├── stores/        ← zustand (auth, grupoActivo)
│   └── types/
├── supabase/          ← migraciones SQL, edge functions, seed
└── assets/
```

## Cómo desarrollar

Requisitos: Node, **pnpm** (obligatorio — nunca `npm` ni `yarn`), y un `.env` (copiar de
[`.env.example`](./.env.example) con las credenciales de Supabase).

```bash
pnpm install        # instalar dependencias
pnpm start          # levantar el dev server (expo start)
pnpm ios            # abrir en iOS Simulator
pnpm android        # abrir en Android Emulator
pnpm typecheck      # tsc --noEmit (TS strict)
pnpm lint           # expo lint
```

> Las pruebas automatizadas (Vitest / RNTL / Maestro) llegan en v0.2.0. En el MVP la
> validación es typecheck + lint + el [smoke test manual](./docs/08-smoke-test.md).

### Convenciones

- **Branches:** `feat/<código>`, `fix/<código>`, `docs/<tema>`, `chore/<tema>` (ej. `feat/RF-040`)
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) en español (`feat:`, `fix:`, `docs:`, `chore:`)
- **PRs:** revisión del Admin del grupo antes de merge
- Detalle completo en [`docs/06-convenciones-desarrollo.md`](./docs/06-convenciones-desarrollo.md)

## Licencia

Privado, todos los derechos reservados al director del grupo musical.
