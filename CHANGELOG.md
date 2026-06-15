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
- Pantalla "Mi semana": vista del rango actual+próxima (14 días) con
  los servicios en los que el usuario actual está asignado, con
  soporte para agendar alarmas locales (RF-055, RF-063) usando
  `expo-notifications` y categoría custom `alarm`. Pide permiso
  `SCHEDULE_EXACT_ALARM` en Android 12+ (RF-064) y muestra banner
  con el estado de las alarmas agendadas. Cubre RF-054, RF-055,
  RF-063, RF-064. Tipos, API y hooks de la feature.
- Wrapper `src/lib/notifications.ts` sobre `expo-notifications` con
  handler global, canal Android categoría 'alarm' (importance HIGH),
  categoría iOS, `scheduleAlarm`, `cancelAllAlarms`,
  `cancelAlarmsDeServicio` y `pedirPermisosAlarma`.
- `src/lib/result.ts` con el tipo `Result<T>` compartido por todas
  las APIs de features (antes se duplicaba inline en cada api.ts).
- Root layout (`app/_layout.tsx`) ahora hidrata `grupoActivo` y
  configura notificaciones al montar la app.
- **Push notifications**: Edge Function `notificar-push` en Deno que
  recibe eventos de la app, resuelve destinatarios, lee tokens de
  `dispositivos` y manda a Expo Push API. Cubre RF-060, RF-061,
  RF-062, RF-065, RF-066, RF-083, RF-085 (parcial: la limpieza de
  tokens inválidos RF-086 queda para v0.2.0). Soporta 11 tipos de
  evento: servicio/ensayo creado/modificado/cancelado, comunicado,
  solicitud recibida/aprobada/rechazada, asignación nueva.
- Migración `20260615000000_push_notifications.sql` con tabla
  `notificaciones` (historial in-app), enum `tipo_notificacion_enum`
  y RLS por usuario.
- Feature `src/features/dispositivos/` con `types.ts`, `api.ts`
  (registrar/eliminar push token), `hooks.ts` y el componente
  `PushTokenRegistrar` (invisible) que se monta en `(app)/_layout.tsx`
  y se ocupa de registrar el push token post-auth y limpiarlo en
  sign-out.
- Utility `src/lib/pushApi.ts` con `notificarPush(tipo, payload)` que
  llama a la Edge Function desde la app.
- `tsconfig.json` excluye `supabase/functions/**/*` (la Edge Function
  corre en Deno, no en Node; Deno CLI la chequea con su propio config).
- **Ensayos**: feature completa con listado, crear, editar, cancelar,
  detalle, asignación de encargado, gestión de invitados. Cubre
  RF-070, RF-071, RF-072, RF-073, RF-074. El cierre de asistencia
  (RF-075) queda para v0.2.0. Llamadas a `notificarPush()` ya
  integradas para ensayo_creado, ensayo_modificado, ensayo_cancelado
  y asignacion_nueva (cuando se invita a un miembro).
- **Cierre de asistencia de servicio**: feature completa con
  pantalla de cierre para el responsable/admin, pantalla de
  justificación para el miembro, badges de estado en mi-semana,
  CTA "Cerrar" en la vista semanal admin. Cubre RF-090, RF-091,
  RF-092, RF-093, RF-094, RF-095, RF-096, RF-097. La RLS valida
  quién puede cerrar/reabrir (helper `usuario_puede_cerrar_servicio`)
  y quién puede auto-justificarse (policy por usuario_grupo_id).
- Componentes UI base: `Button` (variantes primary/secondary/danger) y
  `LabeledInput` con la paleta del proyecto (indigo + slate).
- Routing con Expo Router: grupos `(auth)` y `(app)` con guards de
  redirección según estado de auth.
- Index post-login ahora redirige a "Mi semana" del grupo activo si
  hay uno persistido, o a la lista de grupos si no. La lista de
  grupos pasa a "Mi semana" al tocar (antes iba a la vista admin de
  asignaciones).
- `app.json` con permisos Android de notificaciones
  (`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`,
  `RECEIVE_BOOT_COMPLETED`, `VIBRATE`) y plugin de `expo-notifications`.

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
