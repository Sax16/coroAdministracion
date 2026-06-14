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

### Changed
- `.env.example` actualizado a la nomenclatura actual de keys de Supabase
  (publishable / secret en vez de anon / service_role).

### Fixed
- (Ninguno todavía en este release)

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
