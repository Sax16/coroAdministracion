/**
 * Tipos de la feature dispositivos (push tokens).
 *
 * Cubre RF-085: al primer login (y en cada apertura posterior), la app
 * registra el `expo_push_token` del dispositivo en la tabla
 * `public.dispositivos`.
 *
 * La tabla está en `public.dispositivos` y NO tiene `grupo_id` (es por
 * usuario, no por grupo). Un usuario recibe push de todos los grupos
 * donde es miembro activo. La RLS filtra por `usuario_id = auth.uid()`.
 */

export type Plataforma = 'ios' | 'android';

export interface Dispositivo {
  id: string;
  usuario_id: string;
  expo_push_token: string;
  plataforma: Plataforma | null;
  app_version: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}
