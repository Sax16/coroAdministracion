# Push slice `comunicado_publicado` · Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar push notifications funcionando end-to-end para `comunicado_publicado`, con la edge function `notificar-push` endurecida (autorización real por grupo) y desplegada, y la app invocándola al publicar un comunicado.

**Architecture:** La edge function (Deno) resuelve destinatarios, envía a Expo Push API y guarda historial in-app — ya está escrita. Se le agrega autorización: valida el JWT del llamante (`getUser`) y verifica que esté autorizado para el grupo del evento (fail-closed; para comunicado = admin del grupo). Luego se despliega. La app la invoca best-effort desde `crearComunicado` vía el helper existente `notificarPush`.

**Tech Stack:** Supabase Edge Functions (Deno), `supabase` CLI (login + link ya activos), Expo Push Service, React Native + TypeScript (cliente).

## Global Constraints

- **Package manager: `pnpm` siempre.** Nunca npm/yarn.
- **La edge function es Deno**, fuera de `pnpm typecheck` (tsconfig excluye `supabase/functions/**`). Su verificación es **deploy exitoso + invocación en vivo**, no typecheck. El cambio del cliente sí se valida con `pnpm typecheck` + `pnpm lint`.
- **Sin runner de tests** (Vitest es v0.2.0). Validación del cliente = `pnpm typecheck` + `pnpm lint`. Verificación de la función = deploy + `supabase functions invoke`. La **entrega real del push** se prueba en device (manual del usuario).
- **Fail-closed:** en `autorizarEvento`, todo tipo distinto de `comunicado_publicado` devuelve `false` (deshabilitado hasta cablearse).
- **Best-effort:** la llamada a push nunca revierte ni demora la mutación.
- Imports absolutos con alias `@/` → `src/`. Commits Conventional en español.
- Si un comando bash da "Operation not permitted" por sandbox, reintentar con dangerouslyDisableSandbox.

---

### Task 1: Endurecer la autorización de la edge function y desplegarla

**Files:**
- Modify: `supabase/functions/notificar-push/index.ts`

**Interfaces:**
- Produces (dentro del archivo): `autorizarEvento(userId: string, req: NotificarPushRequest): Promise<boolean>` y `esAdminDe(userId: string, grupoId: string): Promise<boolean>`.
- Consume: `supabaseAdmin` (cliente service_role ya definido en el archivo), tipos `NotificarPushRequest` ya definidos.

- [ ] **Step 1: Reordenar y endurecer el bloque de auth en el handler `serve(...)`**

Reemplazar TODO este bloque actual (desde el comentario `// Auth: la app manda...` hasta el `if (!body.tipo || !body.payload)` inclusive):

```ts
  // Auth: la app manda el anon key o service_role key. Si es anon key,
  // verificamos que la sesión sea válida. En la práctica, para MVP la
  // app manda con el cliente Supabase normal que adjunta anon key +
  // Authorization header. La función la dejamos abierta a usuarios
  // autenticados y validamos el grupo en la lógica de cada handler.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  let body: NotificarPushRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.tipo || !body.payload) {
    return jsonResponse({ error: 'Missing tipo or payload' }, 400);
  }
```

por:

```ts
  // 1. Parseo del body primero: la autorización depende de tipo + grupo.
  let body: NotificarPushRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!body.tipo || !body.payload) {
    return jsonResponse({ error: 'Missing tipo or payload' }, 400);
  }

  // 2. Auth: validar el JWT del llamante y autorizarlo contra el grupo del
  //    evento. La función usa service_role internamente (bypassa RLS), así que
  //    ESTA es la única barrera multi-tenant: sin ella cualquier autenticado
  //    podría spamear push o inyectar historial en grupos ajenos.
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: userData } = await supabaseAdmin.auth.getUser(jwt);
  if (!userData?.user) {
    return jsonResponse({ error: 'No autenticado' }, 401);
  }
  if (!(await autorizarEvento(userData.user.id, body))) {
    return jsonResponse({ error: 'No autorizado para este grupo' }, 403);
  }
```

- [ ] **Step 2: Agregar las funciones `autorizarEvento` y `esAdminDe`**

Insertar este bloque justo ANTES de la función `procesarEvento` (antes de la línea `async function procesarEvento(`):

```ts
// =============================================================================
// Autorización (multi-tenant): quién puede disparar cada evento
// =============================================================================

async function autorizarEvento(
  userId: string,
  req: NotificarPushRequest,
): Promise<boolean> {
  switch (req.tipo) {
    case 'comunicado_publicado':
      // Solo el admin del grupo publica comunicados
      // (RLS "comunicados: insertar solo admin").
      return await esAdminDe(userId, req.payload.grupo_id as string);
    default:
      // Resto de eventos: deshabilitados hasta que se cableen con su regla.
      return false;
  }
}

async function esAdminDe(userId: string, grupoId: string): Promise<boolean> {
  if (!grupoId) return false;
  const { data } = await supabaseAdmin
    .from('usuarios_grupos')
    .select('id')
    .eq('usuario_id', userId)
    .eq('grupo_id', grupoId)
    .eq('rol', 'admin')
    .eq('estado', 'activo')
    .maybeSingle();
  return !!data;
}

```

- [ ] **Step 3: Limpiar el `notification_id` no-op en el mensaje de push**

En la construcción de `mensajes` (dentro de `procesarEvento`), reemplazar:

```ts
    data: { ...data, notification_id: '' }, // notification_id se completa abajo
```

por:

```ts
    data,
```

- [ ] **Step 4: Desplegar la función**

Run: `supabase functions deploy notificar-push`
Expected: termina con "Deployed Functions on project ..." sin error.

- [ ] **Step 5: Verificar que quedó desplegada y ACTIVE**

Run: `supabase functions list`
Expected: una fila con `NAME = notificar-push` y `STATUS = ACTIVE`.

- [ ] **Step 6: Verificar la barrera de auth (sin usuario → 401)**

Run:
```bash
supabase functions invoke notificar-push \
  --body '{"tipo":"comunicado_publicado","payload":{"grupo_id":"00000000-0000-0000-0000-000000000000"}}'
```
Expected: la respuesta es **401 "No autenticado"**. (El CLI invoca con la anon key, cuyo JWT no resuelve a un usuario, así que `getUser` devuelve `user: null` → 401. Esto confirma que la barrera está activa; antes del endurecimiento este request habría pasado la validación de header.)

Verificación MANUAL (no automatizable acá, requiere un access token de usuario real):
- Con el JWT de un usuario que **sí es admin** de un grupo → `comunicado_publicado` con ese `grupo_id` devuelve **200** con conteo de destinatarios.
- Con el JWT de un usuario que **no es admin** de ese grupo → **403**.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/notificar-push/index.ts
git commit -m "feat(push): autorizar la edge function por grupo y desplegarla

Valida el JWT del llamante (getUser) y verifica que esté autorizado para
el grupo del evento (comunicado_publicado -> admin; resto fail-closed).
Cierra el agujero multi-tenant (spam de push / inyección de historial en
grupos ajenos). Limpia el notification_id no-op. Función desplegada."
```

---

### Task 2: Invocar `notificarPush` al publicar un comunicado

**Files:**
- Modify: `src/features/comunicados/api.ts`

**Interfaces:**
- Consume: `notificarPush(tipo: TipoNotificacion, payload: Record<string, unknown>): Promise<Result<NotificarPushResult>>` de `@/lib/pushApi` (ya existe; no lanza, best-effort).
- Contexto: `crearComunicado(input: CrearComunicadoInput): Promise<Result<{ id: string }>>` hace `insert` en `comunicados` con `.select('id').single()` y devuelve `{ ok: true, data: { id: data.id } }`. `input` tiene `grupo_id`, `titulo`, `descripcion`, `fecha_inicio`, `lugar`.

- [ ] **Step 1: Importar `notificarPush`**

Agregar a los imports de `src/features/comunicados/api.ts` (junto a los otros imports de `@/lib`):

```ts
import { notificarPush } from '@/lib/pushApi';
```

- [ ] **Step 2: Disparar el push tras el insert exitoso en `crearComunicado`**

En `crearComunicado`, reemplazar la línea de retorno de éxito:

```ts
    if (error) return { ok: false, error: mapSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
```

por:

```ts
    if (error) return { ok: false, error: mapSupabaseError(error) };

    // Push best-effort: no bloquea ni revierte el alta si falla (notificarPush
    // atrapa todo y devuelve Result). Este es el molde para el resto de eventos.
    void notificarPush('comunicado_publicado', {
      grupo_id: input.grupo_id,
      comunicado_id: data.id,
      titulo: input.titulo,
    });

    return { ok: true, data: { id: data.id } };
```

- [ ] **Step 3: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ambos pasan sin errores (salida vacía de `tsc`).

- [ ] **Step 4: Smoke manual (device, del usuario)**

Con un build en device físico donde `PushTokenRegistrar` haya registrado el token Expo del usuario: como admin, publicar un comunicado en un grupo con otros miembros → los miembros reciben el push "Nuevo comunicado" y aparece una fila en `notificaciones` para cada uno. (No verificable desde el entorno del asistente.)

- [ ] **Step 5: Commit**

```bash
git add src/features/comunicados/api.ts
git commit -m "feat(comunicados): disparar push al publicar un comunicado

Cablea notificarPush('comunicado_publicado', ...) best-effort en
crearComunicado tras el insert exitoso. Molde para el resto de eventos."
```

---

## Notas de cierre

- **Fuera de alcance** (se cablean después con este mismo molde): los otros 10 tipos de evento (servicio/ensayo creado/modificado/cancelado, solicitud recibida/aprobada/rechazada, asignación nueva). Cada uno suma su rama en `autorizarEvento` (con su regla: admin del grupo para la mayoría; el solicitante con solicitud pendiente para `solicitud_recibida`) + la llamada `notificarPush` en su `api.ts`.
- **Precondición del smoke end-to-end:** que `PushTokenRegistrar` esté registrando tokens Expo (dispositivos). Si no, el push no se entrega aunque la función responda 200. Verificarlo por separado si el smoke no llega.
- Cleanup de tokens inválidos (RF-086) y refinamiento de destinatarios de ensayo siguen diferidos a v0.2.0.
