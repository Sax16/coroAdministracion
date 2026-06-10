# 02 · Stack Tecnológico y Arquitectura

> Decisiones técnicas de la v0.1.0. Se revisan al cerrar cada versión mayor. Última revisión: 2026-06-10 (post-auditoría). Ver `CHANGELOG-AUDITORIA.md` para el detalle de cambios.

## 1. Resumen del stack

| Capa               | Tecnología                          | Por qué                                                                 |
|--------------------|--------------------------------------|-------------------------------------------------------------------------|
| App móvil          | **React Native + Expo (SDK estable)** | Un solo código iOS + Android, EAS Build, OTA updates                    |
| Lenguaje           | **TypeScript** (modo `strict`)       | Type safety, autocompletado, menos bugs                                 |
| Estilos            | **NativeWind v4** (Tailwind para RN) | Reutiliza conocimiento de Tailwind, theming consistente                  |
| Navegación         | **Expo Router** (file-based)         | Rutas como archivos, deep linking gratis, similar a Next.js             |
| Estado global      | **Zustand** + **TanStack Query**     | Zustand para UI state, TanStack Query para cache de server state        |
| Backend            | **Supabase**                         | Postgres + Auth + Realtime + Storage + Edge Functions en un solo servicio |
| Base de datos      | **PostgreSQL** (vía Supabase)        | Relacional, robusto, RLS multi-tenant estricto                          |
| Autenticación      | **Supabase Auth**                    | Email/password, RLS integrada, tokens JWT                               |
| Push notifications | **expo-notifications** (FCM/APNs)    | Estándar, robusto                                                       |
| Alarmas locales    | **expo-notifications scheduling**    | Categoría `alarm`, full-screen, sonido custom — sin consumir batería   |
| CI / Build         | **EAS (Expo Application Services)**  | Build en la nube, submit a stores                                       |
| Versionado        | **Git + GitHub**                     | Estándar                                                                |
| Gestión de proyecto| **GitHub Projects**                  | Cercano al código, sin herramienta extra                                |

> **Descartado explícitamente:** Firebase (queremos SQL real, no NoSQL), Redux (overkill), un backend Node propio (Supabase cubre todo gratis para este tamaño), Expo Web (no entra en MVP), Flutter (TS nos da más productividad en este equipo).

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                     MOBILE APP (Expo)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Pantallas   │  │  Componentes │  │  Hooks / Stores  │  │
│  │  (Expo       │→ │  (NativeWind │← │  (Zustand +      │  │
│  │   Router)    │  │   + UI lib)  │  │   TanStack Query)│  │
│  └──────┬───────┘  └──────────────┘  └────────┬─────────┘  │
│         │                                     │             │
│         │        ┌────────────────────────────┘             │
│         ↓        ↓                                          │
│  ┌──────────────────────────────────────────┐              │
│  │         Capa de datos (src/lib)           │              │
│  │  - supabaseClient (singleton)            │              │
│  │  - queries tipadas por tabla             │              │
│  │  - realtime subscriptions                │              │
│  │  - scheduler de alarmas locales          │              │
│  └─────────────────┬────────────────────────┘              │
└────────────────────┼────────────────────────────────────────┘
                     │ HTTPS / WSS
                     ↓
         ┌───────────────────────┐
         │      SUPABASE         │
         │  ┌─────────────────┐  │
         │  │   Auth (JWT)    │  │
         │  │   Postgres+RLS  │  │
         │  │   Realtime      │  │
         │  │   Storage       │  │
         │  │   Edge Funcs    │  │
         │  └─────────────────┘  │
         └───────────────────────┘
                     ↑
                     │ FCM / APNs
                     ↓
         ┌───────────────────────┐
         │  Sistema Operativo    │
         │  (alarma nativa)      │
         └───────────────────────┘
```

### Principios arquitectónicos

1. **La app es un cliente de la base de datos.** Toda lógica de negocio crítica vive en Postgres (vistas, funciones, triggers, RLS).
2. **Multi-tenant con RLS estricta.** Cada fila de cualquier tabla tiene `grupo_id` (o se llega a él transitivamente). Las políticas de RLS filtran por `grupo_id` del usuario actual. **No hay forma de que un usuario vea datos de un grupo al que no pertenece.**
3. **Tipado end-to-end.** Tipos generados desde el esquema de Supabase (`supabase gen types`) hacia TypeScript.
4. **Feature-first en el código.** Estructura por dominio (`/features/grupos`, `/features/servicios`, `/features/asignaciones`), no por tipo de archivo.
5. **Offline-friendly (caché, no modo offline completo).** TanStack Query maneja caché en disco; las suscripciones realtime rehidratan al volver online. La app no es usable sin internet en MVP.

## 3. Estructura de carpetas propuesta

```
coroAdministracion/
├── app/                          # Expo Router
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── _layout.tsx
│   ├── (app)/
│   │   ├── _layout.tsx
│   │   ├── grupos/               # selector de grupo activo
│   │   ├── grupos/[id]/          # home del grupo
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # dashboard del grupo
│   │   │   ├── miembros/
│   │   │   ├── servicios/        # servicios de la semana
│   │   │   ├── ensayos/
│   │   │   ├── comunicados/
│   │   │   ├── patron/           # configurar patrón recurrente
│   │   │   └── configuracion/
│   │   └── perfil.tsx
│   └── _layout.tsx
├── src/
│   ├── features/                 # lógica por dominio
│   │   ├── auth/
│   │   ├── grupos/
│   │   ├── miembros/
│   │   ├── servicios/
│   │   │   ├── api.ts
│   │   │   ├── hooks.ts
│   │   │   ├── components/
│   │   │   └── types.ts
│   │   ├── asignaciones/
│   │   ├── ensayos/
│   │   ├── comunicados/
│   │   ├── justificaciones/
│   │   ├── solicitudes/          # solicitud de ingreso a grupo
│   │   ├── patron/               # configuración del patrón recurrente
│   │   ├── dispositivos/         # registro de Expo push tokens
│   │   └── notificaciones/
│   ├── components/               # UI compartido
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── notifications.ts      # push + alarmas locales
│   │   └── scheduler.ts          # programación de alarmas
│   ├── stores/                   # zustand
│   │   ├── auth.ts
│   │   └── grupoActivo.ts
│   └── types/                    # tipos generados + manuales
├── supabase/
│   ├── migrations/               # migraciones SQL versionadas
│   ├── functions/                # edge functions
│   └── seed.sql
├── assets/
├── app.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 4. Supabase: lo que usaremos

- **Auth**: email/password.
- **Postgres**: 14 tablas (ver `04-modelo-de-datos.md`). Todas con `grupo_id` o accesibles vía FK transitiva, excepto `perfiles` y `dispositivos` que son a nivel de usuario.
- **RLS** (Row Level Security): políticas estrictas en TODAS las tablas. Helper functions en `public.` (no en `auth.`). Patrón: `using (grupo_id in (select public.usuario_grupos_activos(auth.uid())))`.
- **Realtime**: subscripción a `servicios`, `asignaciones_servicio`, `ensayos`, `comunicados`, `justificaciones` para que la lista se actualice sola.
- **Edge Functions**: en MVP se usan **solo** para disparar push notifications cuando se crea/modifica/cancela un servicio/ensayo/comunicado. La lógica de push personalizada lee tokens de la tabla `dispositivos`.
- **Storage**: para fotos de perfil (1 bucket `avatars`, RLS por usuario).

## 5. Notificaciones y alarmas (híbrido inteligente)

Este es uno de los puntos sensibles del producto, así que va por separado.

### 5.1 Las dos capas

| Capa | Cuándo se dispara | Mecanismo | Configurable |
|---|---|---|---|
| **Push estándar** (FCM/APNs) | Cuando el server detecta un evento relevante (servicio creado/modificado/cancelado, ensayo creado, comunicado publicado, solicitud recibida). | El SO muestra la notificación estándar. | El Admin no configura nada. |
| **Alarma local** (categoría `alarm`) | Cuando el usuario **abre la app y ve su asignación** (pantalla "Mi semana"). | El SO agenda la alarma y la dispara a la hora indicada, **sin que la app esté corriendo**, con sonido custom, vibración fuerte y full-screen. | El Admin define el **offset en minutos** en el patrón recurrente (default: 60 min antes). |

### 5.2 Por qué este diseño y no otro

Evaluamos 4 opciones:

| Opción | Veredicto |
|---|---|
| Solo push normal | Insuficiente: el usuario puede ignorar la push y se pierde el aviso. |
| Loop en background con `setInterval` | **Descartado**: consume batería y Doze en Android lo mata. |
| Librería comunitaria tipo despertador real | **Descartado**: requiere foreground service, bugs en OEMs (Samsung, Xiaomi), complejidad innecesaria. |
| Híbrido push + alarma local al ver la app | **Adoptado**: el SO agenda la alarma, la app no corre en background, sonido real aunque el celular esté en silencio. |

### 5.3 Costo en batería

**Cero impacto medible.** La alarma local la agenda el sistema operativo (igual que una app de reloj o despertador nativo). La app no tiene código en background, no hay `setInterval`, no hay foreground services. Solo se programa al renderizar la pantalla "Mi semana" (que el usuario visita voluntariamente).

### 5.4 Caso edge: usuario que no abre la app

Si el usuario nunca abre la app entre que recibe la asignación y el servicio, **no sonará la alarma local**, pero **sí le llegará la push estándar**. No se queda sin aviso, solo no será "alarma de despertador". Aceptable para MVP.

### 5.5 Implementación técnica

```ts
// Pseudo-código en src/lib/notifications.ts
import * as Notifications from 'expo-notifications';

Notifications.setNotificationCategoryAsync('alarm', [
  { identifier: 'open', buttonTitle: 'Abrir app' },
]);

// Al renderizar la pantalla "Mi semana":
async function scheduleAlarmForService(asignacion: Asignacion) {
  const fechaAlarma = new Date(
    asignacion.servicio.fecha_inicio.getTime() - offsetMinutos * 60_000
  );
  if (fechaAlarma <= new Date()) return; // ya pasó

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Servicio en 1 hora',
      body: `${asignacion.servicio.titulo} — ${lugar}`,
      sound: 'alarm.wav',        // archivo local
      interruptionLevel: 'timeSensitive', // iOS
      categoryIdentifier: 'alarm',
    },
    trigger: { date: fechaAlarma },
  });
}
```

Para Android se requiere el permiso `SCHEDULE_EXACT_ALARM` (Android 12+). Pedirlo explícitamente al usuario la primera vez que entra a la pantalla "Mi semana".

## 6. Theming y diseño

- **NativeWind** + una capa de tokens (`theme/colors.ts`, `theme/spacing.ts`).
- Paleta inicial sugerida (a validar):
  - Primario: indigo-600
  - Acento: amber-500
  - Neutros: slate-*
- Tipografías: `Inter` (cargada vía `expo-font`).
- Iconos: `lucide-react-native` (coherente con estilo "outline" moderno).

## 7. Entornos

| Entorno     | Para qué                              | Cómo se levanta                       |
|-------------|---------------------------------------|---------------------------------------|
| `local`     | Desarrollo en máquina del dev         | `npx expo start`                     |
| `staging`   | Builds de prueba pre-producción       | EAS Build perfil `staging`            |
| `production`| Lo que ven los usuarios               | EAS Build + Submit a stores          |

Cada entorno apunta a un **proyecto Supabase distinto** (`dev`, `staging`, `prod`).

## 8. Pruebas

- **Unit**: Vitest (funciones puras, hooks).
- **Integration**: React Native Testing Library.
- **E2E**: Maestro (flujos críticos: crear grupo, asignar servicio, cerrar asistencia).
- **Smoke test manual** en TestFlight y Play Internal antes de cada release.

> Las pruebas E2E y unitarias arrancan en v0.2.0. En MVP se prioriza velocidad de entrega.

## 9. Riesgos técnicos identificados

| Riesgo | Mitigación |
|---|---|
| Push notifications en iOS requieren cuenta Apple Developer paga (USD 99/año) | Asumido en el costo, documentado en `01-vision-y-alcance.md` |
| OTA updates de Expo no aplican cambios nativos | Para features con módulos nativos, release normal vía stores |
| Límite del plan gratuito de Supabase | Monitorear uso; migrar a plan Pro (~USD 25/mes) si el grupo crece a >50 activos |
| RLS mal configurada filtra datos entre grupos | Tests específicos de seguridad antes de cada release. Todas las tablas con RLS desde el día 1. |
| Android 12+: permiso `SCHEDULE_EXACT_ALARM` debe pedirse explícitamente | Flujo de onboarding al primer acceso a "Mi semana". |
| Algunos OEMs (Xiaomi, Huawei) matan apps en background | Aceptado: si matan la app, la alarma local **sigue funcionando** (es del SO, no de la app). La app solo la agenda. |
| Push puede llegar tarde en Doze mode de Android | Aceptado: llega con minutos de retraso en el peor caso. La alarma local al abrir la app es el plan A. |
| Costos de stores los asume el grupo | Documentado y acordado con el director desde v0.1.0 |

---

➡️ Siguiente: [03 · Requerimientos](./03-requerimientos.md)
