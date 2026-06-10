# src/features/

Carpetas por dominio del producto. La lógica de cada feature vive dentro de su carpeta
respectiva, no suelta en `src/`. Convención por feature (ver `docs/02-stack-y-arquitectura.md` §3):

```
features/<dominio>/
├── api.ts            ← queries / mutations de Supabase tipadas
├── hooks.ts          ← hooks de React Query + hooks de UI
├── components/       ← componentes específicos de esta feature
├── types.ts          ← tipos locales (los globales van a src/types/)
└── store.ts          ← solo si la feature necesita estado de UI propio (Zustand)
```

## Features incluidas (v0.1.0)

- `auth/` — sign-in, sign-up, sign-out, sesión actual
- `grupos/` — CRUD de grupos, selector de grupo activo
- `miembros/` — alta/baja de miembros, roles (admin/miembro)
- `servicios/` — servicios recurrentes generados desde el patrón
- `asignaciones/` — asignaciones por servicio (cantante / músico / limpieza)
- `ensayos/` — ensayos con lista de asistencia
- `comunicados/` — anuncios de una sola vía
- `justificaciones/` — texto libre cuando un miembro no asiste
- `solicitudes/` — solicitud de ingreso a un grupo
- `patron/` — configuración del patrón recurrente (RF-040)
- `dispositivos/` — registro de Expo push tokens
- `notificaciones/` — listado y marcado de leído

## Estado

Cada subcarpeta está vacía excepto por un `.gitkeep`. La implementación arranca
en el siguiente milestone del roadmap (v0.1.0 — ver `docs/05-roadmap.md`).
