# Changelog

Todos los cambios notables del proyecto se documentan acá. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es/1.1.0/), y este proyecto
adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> El roadmap está en [`docs/05-roadmap.md`](./docs/05-roadmap.md). Las
> decisiones técnicas detalladas y bitácora de implementación viven en
> [`docs/07-progreso-implementacion.md`](./docs/07-progreso-implementacion.md).

## [Unreleased]

### Added
- Migración inicial consolidada `20260614000000_initial_schema.sql` con el
  esquema completo: 14 tablas, RLS estricta, 4 helper functions multi-tenant,
  5 SECURITY DEFINER ops, 2 vistas y triggers de generación y mantenimiento.
- `supabase/scripts/reset_dev.sql` para resetear el dev DB (destructivo).
- Doc `docs/07-progreso-implementacion.md` con bitácora de implementación.
- `CHANGELOG.md` raíz con formato Keep a Changelog.
- Auth funcional: login, registro y sign-out contra Supabase. Cubre
  RF-001, RF-002 y RF-003 del MVP. Store de Zustand con hidratación al
  montar la app y suscripción a `onAuthStateChange`.
- Gestión de grupos: crear grupo (vía SECURITY DEFINER `crear_grupo()`),
  listado de mis grupos con rol, selector de grupo activo con persistencia
  en AsyncStorage. Cubre RF-010, RF-015 y RF-016.
- Patrón recurrente: pantalla para configurar días, horarios (con
  soporte para doble horario), offset de alarma y semanas a generar.
  Cubre RF-040, RF-041 (vía trigger de DB) y RF-044. Tipos, API y
  hooks de la feature.
- Asignaciones semanales: vista semanal con navegación lunes→domingo
  y 7 cards por día. Pantalla por servicio para asignar uno o varios
  roles (cantante/músico/limpieza) a un miembro, con soporte para
  múltiples roles simultáneos (RF-052) y edición granular (RF-053).
  Cubre RF-050, RF-051, RF-052, RF-053. Tipos, API y hooks de la
  feature.
- Componentes UI base: `Button` (variantes primary/secondary/danger) y
  `LabeledInput` con la paleta del proyecto (indigo + slate).
- Routing con Expo Router: grupos `(auth)` y `(app)` con guards de
  redirección según estado de auth.

### Changed
- `.env.example` actualizado a la nomenclatura actual de keys de Supabase
  (publishable / secret en vez de anon / service_role).
- `app/index.tsx` ya no hace ping de Supabase (eso era un smoke test del
  bootstrap). Ahora es el router que decide a dónde ir según auth.
- `app/_layout.tsx` ahora llama a `auth.hydrate()` al montar.
- `.gitignore` ignora `.mavis/` (runtime local de Mavis).

### Fixed
- Policy de INSERT en `public.perfiles` permite `auth.uid() IS NULL` para
  que el trigger `handle_new_user()` corra sin sesión de usuario. CRIT-1
  del doc 04, que la implementación previa tenía mal.
- `generar_servicios_desde_patron()` hace JOIN con `public.grupos` para
  obtener `zona_horaria` (en el doc 04 se referenciaba como
  `new.zona_horaria`, pero esa columna no existe en `patrones_recurrentes`).
- **Migración reescrita para ser idempotente** (F-04): enums con DO block
  sobre `pg_type`, constraints con DO block sobre `pg_constraint`, triggers
  y policies con `DROP IF EXISTS` antes, tablas e índices con
  `IF NOT EXISTS`. Ahora se puede reaplicar la migración y es compatible
  con `supabase db reset`.

## [0.1.0] — 2026-06-10 — Documentación base

### Added
- Documentación completa de producto: 7 documentos en `docs/` cubriendo
  visión y alcance, stack y arquitectura, requerimientos (RF-### y RNF-###),
  modelo de datos (14 tablas, ERD, RLS), roadmap (v0.1.0 → v2.0.0),
  convenciones de desarrollo y changelog de auditoría.
- Bootstrap del proyecto Expo SDK 56 con TypeScript strict, NativeWind v4,
  Expo Router, Zustand, TanStack Query y Supabase JS.
- Cliente de Supabase wireado con AsyncStorage y ping de conexión en
  `app/index.tsx`.
- Estructura de carpetas `src/features/`, `src/lib/`, `src/stores/`,
  `src/types/`, `supabase/migrations/`, `supabase/functions/`.

### Changed
- Decisión de usar `app.json` (no `app.config.ts`) por la plantilla default
  de Expo SDK 56. Documentado en `docs/02-stack-y-arquitectura.md` §1.1.

### Fixed
- 25 correcciones aplicadas tras la auditoría de la documentación del
  2026-06-10. Ver `docs/CHANGELOG-AUDITORIA.md` para el detalle completo.
