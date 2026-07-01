# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

App móvil (Expo / React Native) para administrar un grupo de alabanza: multi-grupo,
servicios recurrentes semanales, asignaciones (cantante / músico / limpieza), ensayos,
comunicados, cierre de asistencia con justificaciones, y alarmas locales del celular.
Backend en **Supabase** (Postgres + Auth + Realtime + Edge Functions).

El idioma del proyecto es **español** (código documentado en español, commits en español,
UI en es-419). El README está desactualizado ("aún no hay código") — la fuente de verdad
del estado real es `docs/07-progreso-implementacion.md`.

## Comandos

```bash
pnpm start          # expo start (Metro dev server)
pnpm ios            # expo start --ios
pnpm android        # expo start --android
pnpm typecheck      # tsc --noEmit  (TS strict)
pnpm lint           # expo lint
```

- **`pnpm` SIEMPRE.** Nunca `npm` ni `yarn`. `pnpm-lock.yaml` es la única fuente de verdad.
  Si aparece un `package-lock.json`/`yarn.lock`, es un error: borrarlo y `pnpm install`.
- **No hay tests aún.** Vitest / RNTL / Maestro están planeados para v0.2.0; el MVP se
  valida con typecheck + lint + smoke test manual (`docs/08-smoke-test.md`).
- Migraciones/edge functions se operan con la CLI de `supabase` (proyecto ya linkeado en
  `supabase/.temp/`). `supabase/scripts/reset_dev.sql` es **destructivo**.

## Arquitectura

**Principio rector: "la app es un cliente de la base de datos".** Toda la lógica de negocio
crítica vive en Postgres (RLS, funciones `SECURITY DEFINER`, triggers, vistas). El cliente
solo orquesta UI y llamadas.

### Capas

- **`app/`** — rutas de Expo Router (file-based, **top-level**, no `src/app/`). Grupos:
  `(auth)/` (login/register) y `(app)/` (app autenticada). `typedRoutes` está activado.
  El root `app/_layout.tsx` monta `QueryClientProvider` + `SafeAreaProvider`, hidrata los
  stores de Zustand y llama `configureNotifications()` una vez.
- **`src/features/<dominio>/`** — feature-first, **no** por tipo de archivo. Cada feature
  tiene típicamente `api.ts` (llamadas a Supabase), `hooks.ts` (hooks de React), `types.ts`
  y opcionalmente `components/`. Dominios: `auth`, `grupos`, `servicios`, `asignaciones`,
  `asistencia`, `ensayos`, `comunicados`, `justificaciones`, `solicitudes`, `patron`,
  `mi-semana`, `dispositivos`.
- **`src/lib/`** — `supabase.ts` (cliente singleton), `notifications.ts` (push + alarmas),
  `result.ts` (tipo `Result<T>`), `dateTime.ts` (parseo/formateo local↔UTC), `pushApi.ts`.
- **`src/stores/`** — Zustand: `auth.ts` (sesión + `onAuthStateChange`) y `grupoActivo.ts`
  (grupo seleccionado, persistido en AsyncStorage).
- **`supabase/`** — `migrations/` (SQL versionado), `functions/` (edge functions),
  `seed.sql`.

### Patrones a respetar (no obvios, presentes en el código existente)

- **`Result<T>` en vez de excepciones.** Las funciones de `api.ts` devuelven
  `{ ok: true, data } | { ok: false, error }` (ver `src/lib/result.ts`). Atrapan errores
  internamente; no propagan throws. El hook decide qué hacer con el error.
- **Estado de servidor: migración en curso a TanStack Query.** La feature `grupos` ya está
  migrada (ver `src/lib/query.ts` `unwrap`, `src/lib/queryKeys.ts` `qk`, y `useMisGrupos`/
  `useCrearGrupo`/etc. con `useQuery`/`useMutation` + `invalidateQueries`). Es el **patrón
  objetivo**; las demás features todavía exponen hooks manuales que devuelven
  `{ accion, loading, error, clearError }` y se migran gradualmente copiando ese molde.
  Al migrar: las `api.ts` siguen devolviendo `Result<T>` y se envuelven con `unwrap` en la
  `queryFn`/`mutationFn`.
- **Refresco de listas: manual (no hay Realtime).** No existen suscripciones de Supabase
  Realtime (es v0.2.0); las listas se refrescan con `useFocusEffect` al volver de un editor,
  pull-to-refresh, e invalidación de queries tras mutaciones en lo ya migrado a TanStack Query.
- **Acceso a datos: dos caminos.**
  - CRUD directo a tablas (`supabase.from('servicios').insert/update/...`) **cuando la RLS
    sola basta** para autorizar (la policy ya exige admin del grupo).
  - `supabase.rpc(...)` para **operaciones privilegiadas / transaccionales multi-tabla**,
    implementadas como funciones `SECURITY DEFINER` en `public.`: `crear_grupo`,
    `transferir_admin`, `eliminar_grupo`, `eliminar_cuenta`, `aprobar_solicitud`.
- **Imports absolutos con alias `@/` → `src/`.** Evitar barrel files (`index.ts` que
  re-exporta todo).

### Multi-tenant y RLS (crítico)

- Toda tabla con datos de grupo tiene `grupo_id` y **RLS estricta**. Un usuario nunca puede
  ver datos de un grupo al que no pertenece.
- Helper functions de autorización viven en `public.` (nunca en `auth.`):
  `usuario_grupos_activos(uid)`, `usuario_es_admin_de(uid, gid)`,
  `usuario_puede_cerrar_servicio(uid, sid)`, `usuario_puede_cerrar_ensayo(uid, eid)`.
- Patrón de policy: `using (grupo_id in (select public.usuario_grupos_activos(auth.uid())))`.
- **Las vistas deben crearse con `WITH (security_invoker = true)`** (Postgres 15+) — si no,
  corren como el owner y filtran datos entre grupos (ver
  `20260617000000_vistas_security_invoker.sql`). Vistas: `v_mi_semana`, `v_asistencia_servicio`.
- Al crear cualquier tabla/vista nueva: añadir `grupo_id` + RLS desde el primer commit.

### Notificaciones (híbrido)

Dos capas independientes (ver `docs/02-stack-y-arquitectura.md` §5 y `src/lib/notifications.ts`):
1. **Push estándar** (FCM/APNs vía `expo-notifications`) — disparada desde el server cuando
   ocurre un evento relevante. Edge function `notificar-push`.
2. **Alarma local** (categoría `alarm`, sonido custom, full-screen) — se **agenda al renderizar
   "Mi semana"** con `scheduleAlarm()`. La agenda el SO, no consume batería. Android 12+ exige
   pedir `SCHEDULE_EXACT_ALARM` (`pedirPermisosAlarma()`) al primer acceso.

## Modelo de datos

14 tablas en `public.` (definición completa en `docs/04-modelo-de-datos.md`, migración inicial
`supabase/migrations/20260614000000_initial_schema.sql`): `perfiles`, `grupos`,
`usuarios_grupos`, `solicitudes_grupo`, `patrones_recurrentes`, `servicios`,
`asignaciones_servicio`, `estados_asistencia_servicio`, `justificaciones_servicio`, `ensayos`,
`invitados_ensayo`, `asistencias_ensayo`, `comunicados`, `dispositivos`, `notificaciones`.

Conceptos de dominio:
- **Roles de sistema** en el grupo: `Admin` (uno, transferible) y `Miembro` (N).
- **Roles de servicio** (asignaciones): `cantante`, `musico`, `limpieza` — un miembro puede
  tener varios en el mismo servicio. La limpieza **no** es un área aparte.
- **Patrón recurrente**: el Admin lo configura una vez; un trigger de DB genera los servicios
  de las próximas N semanas (`ON CONFLICT (grupo_id, fecha_inicio) DO NOTHING`). **No existe
  `patron_id` en `servicios`** — servicios del patrón y excepcionales son filas idénticas; la
  distinción es convencional (gana el del patrón si colisiona la fecha/hora).
- **3 tipos de evento**: `servicio` (con cierre de asistencia + justificación), `ensayo`
  (lista de asistencia), `comunicado` (sin asistencia).
- Las fechas se guardan como `timestamptz` UTC; el cliente convierte a/desde hora local con
  los helpers de `src/lib/dateTime.ts`.

## Convenciones

- **Commits**: Conventional Commits en **español** (`feat(servicios): ...`, `fix(rls): ...`,
  `docs:`, `chore:`). Branches: `feat/<RF>`, `fix/<...>`, `docs/<...>`, `chore/<...>`.
- Los requerimientos son trazables por código **RF-###** / **RNF-###** (ver
  `docs/03-requerimientos.md`); referenciarlos en commits y comentarios cuando aplique.
- Naming: componentes `PascalCase`, hooks `useX` camelCase, tipos `PascalCase`, constantes
  globales `UPPER_SNAKE_CASE`.
- Variables de cliente con prefijo `EXPO_PUBLIC_` (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`). `.env` está en `.gitignore`; `.env.example` es la plantilla.
- Estilos con NativeWind v4 (Tailwind). Paleta: primario indigo-600 (`#4F46E5`), acento
  amber-500. Iconos `lucide-react-native`.
