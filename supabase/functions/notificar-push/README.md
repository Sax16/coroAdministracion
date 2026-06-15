# Edge Function: `notificar-push`

Recibe eventos de la app y manda push notifications a los destinatarios
correctos usando Expo Push Service.

## Tipos de evento soportados

| Tipo                   | Destinatarios                          | Uso típico |
|------------------------|----------------------------------------|------------|
| `servicio_creado`      | Todos los miembros activos del grupo   | Admin configuró patrón que generó servicios, o servicio excepcional |
| `servicio_modificado`  | Asignados al servicio                  | Admin cambió fecha, hora o lugar de un servicio |
| `servicio_cancelado`   | Asignados al servicio                  | Admin excluyó un servicio puntual (RF-042) |
| `ensayo_creado`        | Todos los miembros activos del grupo   | Admin creó un ensayo (RF-070) |
| `ensayo_modificado`    | Miembros del grupo                     | Admin editó un ensayo (RF-072) |
| `ensayo_cancelado`     | Miembros del grupo                     | Admin canceló un ensayo (RF-073) |
| `comunicado_publicado` | Todos los miembros activos del grupo   | Admin publicó un comunicado (RF-080, RF-083) |
| `solicitud_recibida`   | Todos los admins del grupo             | Nuevo usuario pidió unirse (RF-020, RF-065) |
| `solicitud_aprobada`   | El solicitante                         | Admin aprobó (RF-022, RF-066) |
| `solicitud_rechazada`  | El solicitante                         | Admin rechazó (RF-066) |
| `asignacion_nueva`     | El usuario recién asignado             | Admin asignó un miembro a un servicio (extra, no en RF) |

## Body esperado

```json
{
  "tipo": "servicio_creado",
  "payload": {
    "grupo_id": "uuid",
    "servicio_id": "uuid",
    "titulo": "Servicio dominical",
    "fecha_inicio": "2026-06-21T19:00:00-05:00",
    "lugar": "Iglesia San Pedro"
  }
}
```

`payload` puede traer cualquier campo extra. La función solo lee los que
necesita según `tipo` y los guarda en `notificaciones.payload` para
referencia futura.

## Desarrollo local

```bash
# Inicia Supabase local con la función montada
supabase functions serve notificar-push --env-file ./supabase/.env.local

# Probar con curl
curl -X POST http://localhost:54321/functions/v1/notificar-push \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "servicio_creado",
    "payload": {
      "grupo_id": "00000000-0000-0000-0000-000000000000",
      "servicio_id": "00000000-0000-0000-0000-000000000000",
      "titulo": "Servicio de prueba",
      "fecha_inicio": "2026-06-21T19:00:00-05:00",
      "lugar": "Iglesia"
    }
  }'
```

## Deploy

```bash
# Deploy a Supabase
supabase functions deploy notificar-push

# Setear secrets si hace falta (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
# ya están disponibles automáticamente en el runtime de Supabase)
```

## Llamar desde la app

La app usa `notificarPush()` de `src/lib/pushApi.ts`, que internamente
llama a esta función con el cliente Supabase + anon key + Authorization
header del usuario actual.

```ts
import { notificarPush } from '@/lib/pushApi';

await notificarPush('servicio_creado', {
  grupo_id: grupo.id,
  servicio_id: servicio.id,
  titulo: servicio.titulo,
  fecha_inicio: servicio.fecha_inicio,
  lugar: servicio.lugar,
});
```

## Notas

- **Auth**: la función usa `SUPABASE_SERVICE_ROLE_KEY` para bypassear RLS
  y leer destinatarios + tokens + escribir historial. No se valida
  quién llama — se asume que la app es el único caller. En v0.2.0 se
  puede agregar validación del JWT.
- **Historial**: cada push deja una fila en `notificaciones` por
  destinatario. La pantalla de historial in-app es v0.2.0; por ahora
  solo se persiste.
- **Tokens inválidos**: si Expo devuelve `DeviceNotRegistered`, se
  loguea. La limpieza efectiva de tokens muertos es RF-086 (SHOULD),
  programado para v0.2.0 con un job batch.
- **Rate limit**: Expo Push API acepta hasta 100 mensajes por request;
  la función los manda en chunks automáticamente.
- **Errores**: si la llamada a Expo falla, se loguea y se cuenta como
  error. La mutación original de la app (insertar el servicio, etc.) NO
  se revierte — push es best-effort. Si la app necesita garantía de
  envío, debería esperar la respuesta de esta función.
