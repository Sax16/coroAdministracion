# Diseño — Push notifications: slice de referencia `comunicado_publicado`

> Fecha: 2026-06-27 · Estado: aprobado, listo para plan de implementación.
> Origen: ítem #11 de la auditoría — la edge function `notificar-push` y el
> helper cliente `notificarPush` están escritos, pero (1) la función nunca se
> desplegó al proyecto (`supabase functions list` devuelve vacío) y (2) ninguna
> mutación de la app la invoca. Además, su bloque de auth solo verifica que
> exista un header `Authorization`, sin autorizar al que llama contra el grupo
> del evento — un agujero multi-tenant (spam de push + inyección de historial
> en grupos ajenos), ya que la función usa `service_role` internamente.

## Objetivo

Dejar push notifications funcionando **end-to-end para un evento de referencia**
(`comunicado_publicado`), con la edge function **endurecida** (autorización real
por grupo) y **desplegada**, fijando el molde que copiarán los otros 10 eventos.

## Decisiones tomadas

1. **Slice de referencia**, no big-bang: se cablea un solo evento
   (`comunicado_publicado`: destinatarios = todos los miembros activos del
   grupo, la lógica de destinatarios más simple) end-to-end. Los otros 10
   eventos se cablean después copiando el molde.
2. **Endurecer la seguridad ahora**, antes de desplegar: la función autoriza al
   llamante contra el grupo del evento, fail-closed.

## Componente 1 — Endurecer la autorización de la edge function

Archivo: `supabase/functions/notificar-push/index.ts`.

Reemplazar el bloque de auth actual (solo chequea presencia del header,
~líneas 121-129) por autorización real:

```ts
// 1. Validar el JWT del que llama y obtener su user id
const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
const { data: userData } = await supabaseAdmin.auth.getUser(jwt);
if (!userData?.user) return jsonResponse({ error: 'No autenticado' }, 401);

// 2. Autorizar contra el grupo del evento (regla por tipo). Fail-closed.
if (!(await autorizarEvento(userData.user.id, body))) {
  return jsonResponse({ error: 'No autorizado para este grupo' }, 403);
}
```

Nuevas funciones:

```ts
async function autorizarEvento(
  userId: string,
  req: NotificarPushRequest,
): Promise<boolean> {
  switch (req.tipo) {
    case 'comunicado_publicado':
      // Solo el admin del grupo publica comunicados (RLS "comunicados: insertar solo admin").
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

Notas:
- `supabaseAdmin.auth.getUser(jwt)` valida la firma del JWT y devuelve el
  usuario. Un request con solo la anon key (JWT rol `anon`, sin usuario) cae en
  `!userData?.user` → 401. La app, vía `supabase.functions.invoke`, adjunta el
  **access token del usuario**, así que `getUser` devuelve el usuario real.
- **Fail-closed:** los otros 10 tipos devuelven `false` → la función desplegada
  solo permite `comunicado_publicado`. Cada evento futuro agrega su rama en
  `autorizarEvento` (p. ej. servicio/ensayo creado/modificado/cancelado y
  asignación → admin del grupo; `solicitud_recibida` → el solicitante tiene una
  solicitud pendiente en ese grupo; `solicitud_aprobada/rechazada` → admin).
- La lógica existente de destinatarios (`resolverDestinatarios`), mensajes
  (`construirMensaje`) y envío a Expo **no se toca**.
- Limpieza menor: quitar el campo `notification_id: ''` del `data` del push
  (hoy es un no-op con comentario engañoso; nunca se completa).

## Componente 2 — Desplegar la función

`supabase functions deploy notificar-push` (login + link ya activos).
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase
automáticamente en las edge functions (secrets reservados) — no se configuran a
mano. `verify_jwt` queda en su default (on); la autorización real es la capa
`getUser` + `esAdminDe`.

## Componente 3 — Cablear la llamada (único punto en la app)

Archivo: `src/features/comunicados/api.ts`, función `crearComunicado`. Tras el
insert exitoso y antes de devolver `{ ok: true, ... }`:

```ts
void notificarPush('comunicado_publicado', {
  grupo_id: input.grupo_id,
  comunicado_id: data.id,
  titulo: input.titulo,
});
```

- **Best-effort (fire-and-forget):** `notificarPush` (de `@/lib/pushApi`) atrapa
  todo y devuelve `Result` sin lanzar, así que `void` no genera unhandled
  rejection y el alta del comunicado no se demora ni se revierte si el push
  falla. Push es secundario; el comunicado es lo principal.
- Corre en la app con la sesión del usuario, así que `functions.invoke` adjunta
  su JWT (lo que la función usa para autorizar).
- Este es el molde exacto que copiarán los otros eventos en sus `api.ts`.

## Manejo de errores

- Función: 401 si el JWT no resuelve a un usuario; 403 si no está autorizado
  para el grupo; 400 si falta `tipo`/`payload`; 500 con log en errores internos
  (comportamiento existente). El historial in-app (`notificaciones`) y el envío
  a Expo solo ocurren tras pasar la autorización.
- App: el fallo de push nunca afecta la mutación (best-effort).

## Verificación (con límite honesto)

- Deploy exitoso: `supabase functions list` muestra `notificar-push` `ACTIVE`.
- `pnpm typecheck` + `pnpm lint` limpios para el cambio cliente.
- Test de autorización en vivo (si se puede mintear un JWT de un usuario de
  prueba): invocar con `grupo_id` de un grupo del que NO es admin → **403**;
  con uno del que sí es admin → **200** con conteo de destinatarios. Si no se
  puede mintear el JWT desde el entorno, queda como verificación manual.
- **Entrega real del push (end-to-end):** requiere un **device físico con token
  Expo registrado** y depende de que `PushTokenRegistrar` esté registrando
  tokens (a confirmar). NO verificable desde el entorno de desarrollo del
  asistente. Prueba manual del usuario: publicar un comunicado → los miembros
  del grupo reciben el push y aparece en el historial `notificaciones`.

## Fuera de alcance

- Los otros 10 tipos de evento (servicio/ensayo creado/modificado/cancelado,
  solicitud recibida/aprobada/rechazada, asignación nueva): se cablean después
  sumando su rama en `autorizarEvento` + la llamada `notificarPush` en su
  `api.ts`. La función ya tiene destinatarios y mensajes para todos.
- Limpieza de tokens inválidos (`DeviceNotRegistered`, RF-086): sigue diferida a
  v0.2.0 (hoy solo se loguea).
- Refinar destinatarios de `ensayo_modificado/cancelado` (hoy caen a todos los
  miembros; `invitados_ensayo` permitiría acotar): v0.2.0.
- Rate-limiting de la función: no entra en el MVP.
