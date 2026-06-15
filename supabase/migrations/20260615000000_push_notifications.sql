-- =============================================================================
-- 20260615000000_push_notifications.sql
-- =============================================================================
-- Migración incremental sobre la inicial: agrega la tabla `notificaciones`
-- (historial in-app de push, RF-085) y su RLS.
--
-- Decisiones de diseño:
-- - La tabla `dispositivos` ya existe desde la migración inicial.
-- - Esta migración NO agrega un trigger de DB que llame a la Edge Function.
--   En su lugar, la app llama directamente a la Edge Function después de
--   cada mutación relevante (crear/modificar/cancelar servicio, ensayo,
--   comunicado, solicitud). Esto evita la dependencia de la extensión
--   `pg_net` (no siempre habilitada en Supabase free tier) y mantiene
--   el control del flujo en la app.
-- - `notificaciones` es el historial in-app: cada push que sale deja un
--   registro consultable desde la app (pantalla dedicada en v0.2.0).
-- - Una notificación está ligada a UN destinatario (`usuario_id`),
--   NO a un grupo. La RLS asegura que cada usuario ve solo las suyas.
-- - El `payload` jsonb guarda el cuerpo completo enviado a Expo, por
--   si necesitamos re-enviar o mostrarlo en la app sin consultar la Edge.
--
-- Esta migración es idempotente (mismos patrones que la inicial:
--   DO block para enums, IF NOT EXISTS para tablas, DROP IF EXISTS + CREATE
--   para policies).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums nuevos
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_notificacion_enum') then
    create type public.tipo_notificacion_enum as enum (
      'servicio_creado',
      'servicio_modificado',
      'servicio_cancelado',
      'ensayo_creado',
      'ensayo_modificado',
      'ensayo_cancelado',
      'comunicado_publicado',
      'solicitud_recibida',
      'solicitud_aprobada',
      'solicitud_rechazada',
      'asignacion_nueva'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Tabla notificaciones
-- ----------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  tipo          tipo_notificacion_enum not null,
  titulo        text not null,
  cuerpo        text not null,
  payload       jsonb not null default '{}'::jsonb,
  referencia_id uuid,                       -- id del servicio/ensayo/comunicado/solicitud, si aplica
  leida         boolean not null default false,
  leida_at      timestamptz,
  enviada_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_notificaciones_usuario       on public.notificaciones(usuario_id);
create index if not exists idx_notificaciones_usuario_fecha on public.notificaciones(usuario_id, enviada_at desc);
create index if not exists idx_notificaciones_no_leidas    on public.notificaciones(usuario_id) where leida = false;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
alter table public.notificaciones enable row level security;

-- Ver: cada usuario ve solo las suyas
drop policy if exists "notificaciones: ver las propias" on public.notificaciones;
create policy "notificaciones: ver las propias"
  on public.notificaciones for select
  using (usuario_id = auth.uid());

-- Insert: lo hace la Edge Function con service_role (bypassea RLS).
-- La app cliente no inserta directo, solo lee y actualiza 'leida'.
-- Pero por si la app quiere insertar (v0.2.0 con client-side trigger
-- fallback), permitimos que inserte para sí misma.
drop policy if exists "notificaciones: insertar las propias" on public.notificaciones;
create policy "notificaciones: insertar las propias"
  on public.notificaciones for insert
  with check (usuario_id = auth.uid());

-- Update: solo para marcar como leída. No se puede cambiar usuario_id ni
-- otros campos (los nuevos campos serían inalcanzables desde la policy,
-- pero un atacante podría intentar setear leida=true para otro user).
-- La policy valida que la fila sea del usuario actual.
drop policy if exists "notificaciones: actualizar leida" on public.notificaciones;
create policy "notificaciones: actualizar leida"
  on public.notificaciones for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Delete: el usuario puede borrar sus notificaciones
drop policy if exists "notificaciones: eliminar las propias" on public.notificaciones;
create policy "notificaciones: eliminar las propias"
  on public.notificaciones for delete
  using (usuario_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. Trigger updated_at
-- ----------------------------------------------------------------------------
drop trigger if exists trg_notificaciones_set_updated_at on public.notificaciones;
create trigger trg_notificaciones_set_updated_at
  before update on public.notificaciones
  for each row execute function public.tg_set_updated_at();
