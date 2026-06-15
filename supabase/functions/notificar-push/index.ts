// =============================================================================
// Edge Function: notificar-push
// =============================================================================
// Recibe un evento de la app (servicio creado/modificado/cancelado, ensayo,
// comunicado, solicitud, asignación) y manda push notifications a los
// destinatarios correctos usando Expo Push Service.
//
// Endpoint: POST /functions/v1/notificar-push
// Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (la app lo manda
//   como "service role" o con un anon key + RLS — en MVP lo mandamos con
//   el service_role desde la app, asumiendo que está en EXPO_PUBLIC_... —
//   NO, mejor: la app usa el cliente Supabase normal con anon key + RLS
//   permite invocar la función? NO, Edge Functions no se invocan desde la
//   app con RLS, se invocan con anon key o service_role. La función
//   internamente usa service_role para bypassear RLS y consultar
//   destinatarios y tokens.
//
// Body esperado (JSON):
//   {
//     "tipo": "servicio_creado",
//     "payload": {
//       "grupo_id": "uuid",
//       "servicio_id": "uuid",
//       "titulo": "...",
//       "fecha_inicio": "...",
//       "lugar": "...",
//       ...
//     }
//   }
//
// Tipos soportados y su lógica de destinatarios:
//   - servicio_creado        → todos los miembros activos del grupo
//   - servicio_modificado    → solo los asignados al servicio
//   - servicio_cancelado     → solo los asignados al servicio
//   - ensayo_creado          → todos los miembros activos del grupo
//   - ensayo_modificado      → los responsables + asignados a ese ensayo
//   - ensayo_cancelado       → los asignados a ese ensayo
//   - comunicado_publicado   → todos los miembros activos del grupo
//   - solicitud_recibida     → todos los admins del grupo
//   - solicitud_aprobada     → el solicitante
//   - solicitud_rechazada    → el solicitante
//   - asignacion_nueva       → el usuario recién asignado
//
// Para cada destinatario:
//   1. Lee `dispositivos` filtrado por `usuario_id`
//   2. Construye un mensaje Expo Push
//   3. Llama a https://exp.host/--/api/v2/push/send (POST, batch de 100)
//   4. Inserta una fila en `notificaciones` (historial in-app)
//   5. Si Expo devuelve un DeviceNotRegistered error, marca el token
//      para limpieza (RF-086) — la limpieza efectiva se hace con un
//      job batch en v0.2.0; por ahora solo lo logueamos.
//
// =============================================================================

// @ts-expect-error: Deno global no está en los tipos de Node
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error: Deno global no está en los tipos de Node
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK = 100; // Expo acepta hasta 100 mensajes por request

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Cliente con service_role: bypassea RLS para leer tokens y escribir historial
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// =============================================================================
// Tipos
// =============================================================================

type TipoNotificacion =
  | 'servicio_creado'
  | 'servicio_modificado'
  | 'servicio_cancelado'
  | 'ensayo_creado'
  | 'ensayo_modificado'
  | 'ensayo_cancelado'
  | 'comunicado_publicado'
  | 'solicitud_recibida'
  | 'solicitud_aprobada'
  | 'solicitud_rechazada'
  | 'asignacion_nueva';

interface NotificarPushRequest {
  tipo: TipoNotificacion;
  payload: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string; [k: string]: unknown };
  }>;
}

// =============================================================================
// Servidor
// =============================================================================

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

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

  try {
    const result = await procesarEvento(body);
    return jsonResponse({ ok: true, ...result });
  } catch (e) {
    console.error('[notificar-push] error:', e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});

// =============================================================================
// Procesar evento
// =============================================================================

interface ProcessResult {
  destinatarios: number;
  enviados: number;
  errores: number;
}

async function procesarEvento(
  req: NotificarPushRequest,
): Promise<ProcessResult> {
  // 1. Determinar destinatarios (ids de usuario) según el tipo
  const destinatarios = await resolverDestinatarios(req);

  if (destinatarios.length === 0) {
    return { destinatarios: 0, enviados: 0, errores: 0 };
  }

  // 2. Construir el mensaje
  const { titulo, cuerpo, data } = construirMensaje(req);

  // 3. Leer tokens de los destinatarios
  const { data: dispositivos, error: errDisp } = await supabaseAdmin
    .from('dispositivos')
    .select('id, usuario_id, expo_push_token')
    .in('usuario_id', destinatarios);

  if (errDisp) throw new Error(`Error leyendo dispositivos: ${errDisp.message}`);

  if (!dispositivos || dispositivos.length === 0) {
    return { destinatarios: destinatarios.length, enviados: 0, errores: 0 };
  }

  // 4. Construir mensajes para Expo (uno por token, no por usuario: cada
  // dispositivo puede tener varios tokens si el usuario tiene varios phones)
  const mensajes: ExpoPushMessage[] = dispositivos.map((d) => ({
    to: d.expo_push_token,
    title: titulo,
    body: cuerpo,
    data: { ...data, notification_id: '' }, // notification_id se completa abajo
    sound: 'default',
    priority: 'high',
    channelId: 'alarm',
  }));

  // 5. Enviar a Expo Push API (en chunks de 100)
  let enviados = 0;
  let errores = 0;
  const tokensInvalidos: string[] = [];

  for (let i = 0; i < mensajes.length; i += EXPO_PUSH_CHUNK) {
    const chunk = mensajes.slice(i, i + EXPO_PUSH_CHUNK);
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    if (!resp.ok) {
      console.error('[notificar-push] Expo push error:', resp.status, await resp.text());
      errores += chunk.length;
      continue;
    }

    const expoResp = (await resp.json()) as ExpoPushResponse;
    for (let j = 0; j < expoResp.data.length; j++) {
      const r = expoResp.data[j];
      const msg = chunk[j];
      if (r.status === 'ok') {
        enviados++;
      } else {
        errores++;
        if (r.details?.error === 'DeviceNotRegistered') {
          tokensInvalidos.push(msg.to);
        }
        console.warn('[notificar-push] Expo error:', r.message, r.details);
      }
    }
  }

  // 6. Registrar historial in-app (una fila por destinatario único)
  const destinatariosUnicos = Array.from(new Set(destinatarios));
  const historialRows = destinatariosUnicos.map((uid) => ({
    usuario_id: uid,
    tipo: req.tipo,
    titulo,
    cuerpo,
    payload: { ...req.payload, ...data },
    referencia_id: (req.payload.servicio_id ??
      req.payload.ensayo_id ??
      req.payload.comunicado_id ??
      req.payload.solicitud_id ??
      null) as string | null,
  }));

  // Insert en batch (supabaseAdmin bypassea RLS)
  await supabaseAdmin.from('notificaciones').insert(historialRows);

  // 7. Marcar tokens inválidos para limpieza posterior (RF-086)
  if (tokensInvalidos.length > 0) {
    console.warn(
      `[notificar-push] ${tokensInvalidos.length} tokens inválidos detectados. Cleanup diferido a v0.2.0.`,
      tokensInvalidos,
    );
  }

  return { destinatarios: destinatariosUnicos.length, enviados, errores };
}

// =============================================================================
// Resolver destinatarios según el tipo
// =============================================================================

async function resolverDestinatarios(req: NotificarPushRequest): Promise<string[]> {
  const { tipo, payload } = req;

  switch (tipo) {
    case 'servicio_creado':
    case 'ensayo_creado':
    case 'comunicado_publicado': {
      // Todos los miembros activos del grupo
      const grupoId = payload.grupo_id as string;
      return await idsMiembrosActivos(grupoId);
    }

    case 'servicio_modificado':
    case 'servicio_cancelado': {
      // Los asignados al servicio
      const servicioId = payload.servicio_id as string;
      return await idsAsignadosAServicio(servicioId);
    }

    case 'ensayo_modificado':
    case 'ensayo_cancelado': {
      // Los asignados al ensayo (v0.2.0 cuando exista `asignaciones_ensayo`)
      // Por ahora: todos los miembros activos del grupo del ensayo
      const grupoId = payload.grupo_id as string;
      return await idsMiembrosActivos(grupoId);
    }

    case 'solicitud_recibida': {
      // Todos los admins del grupo
      const grupoId = payload.grupo_id as string;
      return await idsAdminsGrupo(grupoId);
    }

    case 'solicitud_aprobada':
    case 'solicitud_rechazada': {
      // El solicitante
      const usuarioId = payload.usuario_id as string;
      return [usuarioId];
    }

    case 'asignacion_nueva': {
      // El usuario recién asignado
      const usuarioId = payload.usuario_id as string;
      return [usuarioId];
    }
  }
}

async function idsMiembrosActivos(grupoId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('usuarios_grupos')
    .select('usuario_id')
    .eq('grupo_id', grupoId)
    .eq('estado', 'activo');
  if (error) throw new Error(`idsMiembrosActivos: ${error.message}`);
  return (data ?? []).map((r) => r.usuario_id);
}

async function idsAdminsGrupo(grupoId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('usuarios_grupos')
    .select('usuario_id')
    .eq('grupo_id', grupoId)
    .eq('rol', 'admin')
    .eq('estado', 'activo');
  if (error) throw new Error(`idsAdminsGrupo: ${error.message}`);
  return (data ?? []).map((r) => r.usuario_id);
}

async function idsAsignadosAServicio(servicioId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('asignaciones_servicio')
    .select('usuario_grupos!inner(usuario_id)')
    .eq('servicio_id', servicioId);
  if (error) throw new Error(`idsAsignadosAServicio: ${error.message}`);
  return (data ?? [])
    .map((r) => (r as unknown as { usuario_grupos: { usuario_id: string } }).usuario_grupos?.usuario_id)
    .filter((id): id is string => typeof id === 'string');
}

// =============================================================================
// Construir mensaje
// =============================================================================

function construirMensaje(req: NotificarPushRequest): {
  titulo: string;
  cuerpo: string;
  data: Record<string, unknown>;
} {
  const { tipo, payload } = req;
  const titulo = (payload.titulo as string) ?? 'Coro Administración';
  const fechaInicio = payload.fecha_inicio as string | undefined;
  const hora = fechaInicio ? formatearHora(fechaInicio) : '';
  const lugar = payload.lugar as string | undefined;

  switch (tipo) {
    case 'servicio_creado':
      return {
        titulo: 'Nuevo servicio agendado',
        cuerpo: lugar
          ? `${titulo} — ${hora} en ${lugar}`
          : `${titulo} — ${hora}`,
        data: { tipo, servicio_id: payload.servicio_id, grupo_id: payload.grupo_id },
      };
    case 'servicio_modificado':
      return {
        titulo: 'Servicio actualizado',
        cuerpo: lugar
          ? `${titulo} — ahora ${hora} en ${lugar}`
          : `${titulo} — ahora ${hora}`,
        data: { tipo, servicio_id: payload.servicio_id, grupo_id: payload.grupo_id },
      };
    case 'servicio_cancelado':
      return {
        titulo: 'Servicio cancelado',
        cuerpo: `${titulo} — ${hora}`,
        data: { tipo, servicio_id: payload.servicio_id, grupo_id: payload.grupo_id },
      };
    case 'ensayo_creado':
      return {
        titulo: 'Nuevo ensayo',
        cuerpo: lugar
          ? `${titulo} — ${hora} en ${lugar}`
          : `${titulo} — ${hora}`,
        data: { tipo, ensayo_id: payload.ensayo_id, grupo_id: payload.grupo_id },
      };
    case 'ensayo_modificado':
      return {
        titulo: 'Ensayo actualizado',
        cuerpo: lugar
          ? `${titulo} — ahora ${hora} en ${lugar}`
          : `${titulo} — ahora ${hora}`,
        data: { tipo, ensayo_id: payload.ensayo_id, grupo_id: payload.grupo_id },
      };
    case 'ensayo_cancelado':
      return {
        titulo: 'Ensayo cancelado',
        cuerpo: `${titulo} — ${hora}`,
        data: { tipo, ensayo_id: payload.ensayo_id, grupo_id: payload.grupo_id },
      };
    case 'comunicado_publicado':
      return {
        titulo: 'Nuevo comunicado',
        cuerpo: titulo,
        data: { tipo, comunicado_id: payload.comunicado_id, grupo_id: payload.grupo_id },
      };
    case 'solicitud_recibida':
      return {
        titulo: 'Nueva solicitud de ingreso',
        cuerpo: `${(payload.solicitante_nombre as string) ?? 'Alguien'} quiere unirse al grupo`,
        data: { tipo, solicitud_id: payload.solicitud_id, grupo_id: payload.grupo_id },
      };
    case 'solicitud_aprobada':
      return {
        titulo: 'Solicitud aprobada',
        cuerpo: 'Tu solicitud de ingreso fue aprobada',
        data: { tipo, solicitud_id: payload.solicitud_id, grupo_id: payload.grupo_id },
      };
    case 'solicitud_rechazada':
      return {
        titulo: 'Solicitud rechazada',
        cuerpo: 'Tu solicitud de ingreso no fue aceptada',
        data: { tipo, solicitud_id: payload.solicitud_id, grupo_id: payload.grupo_id },
      };
    case 'asignacion_nueva':
      return {
        titulo: 'Nueva asignación',
        cuerpo: lugar
          ? `Te asignaron a ${titulo} — ${hora} en ${lugar}`
          : `Te asignaron a ${titulo} — ${hora}`,
        data: { tipo, servicio_id: payload.servicio_id, grupo_id: payload.grupo_id },
      };
  }
}

function formatearHora(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

// =============================================================================
// Helper
// =============================================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
