-- =============================================================================
-- Coro Administración — Initial Schema
-- Timestamp: 2026-06-14
-- Migración completa: DDL + RLS + Triggers de generación + Vistas + SECURITY DEFINER ops.
-- Generado a partir de docs/04-modelo-de-datos.md
-- Cobertura: 14 tablas, multi-tenant estricto, 4 helper functions, 5 SECURITY DEFINER
-- ops, 2 vistas, triggers de generación y mantenimiento.
--
-- IDEMPOTENTE: puede aplicarse múltiples veces sin error. Esto es compatible
-- con `supabase db reset` (que borra todo y reaplica las migraciones).
-- Patrones usados:
--   * Enums: DO block con check de pg_type (PostgreSQL no soporta
--     CREATE TYPE IF NOT EXISTS).
--   * Tablas: CREATE TABLE IF NOT EXISTS.
--   * Constraints (CHECK, FK, UK): DO block con check de pg_constraint.
--   * Índices: CREATE INDEX IF NOT EXISTS.
--   * Triggers: DROP TRIGGER IF EXISTS antes de CREATE.
--   * Policies: DROP POLICY IF EXISTS antes de CREATE.
--   * Functions: CREATE OR REPLACE.
--   * Views: CREATE OR REPLACE.
--   * ALTER TABLE ... ENABLE ROW LEVEL SECURITY: idempotente nativo.
--
-- Para resetear el dev DB y volver a aplicar limpio:
--   supabase db reset
-- O manualmente:
--   psql "$DATABASE_URL" -f supabase/scripts/reset_dev.sql
--   psql "$DATABASE_URL" -f supabase/migrations/20260614000000_initial_schema.sql
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIÓN
-- =============================================================================
create extension if not exists "pgcrypto";


-- =============================================================================
-- 2. ENUMS (idempotentes vía DO block)
-- =============================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'rol_grupo_enum') then
    create type rol_grupo_enum as enum ('admin', 'miembro');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_membresia_enum') then
    create type estado_membresia_enum as enum ('activo', 'inactivo');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_solicitud_enum') then
    create type estado_solicitud_enum as enum ('pendiente', 'aprobada', 'rechazada');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_evento_enum') then
    create type tipo_evento_enum as enum ('servicio', 'ensayo', 'comunicado');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_evento_enum') then
    create type estado_evento_enum as enum ('programado', 'cancelado', 'realizado');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'rol_servicio_enum') then
    create type rol_servicio_enum as enum ('cantante', 'musico', 'limpieza');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_asistencia_enum') then
    create type estado_asistencia_enum as enum ('asistio', 'no_asistio', 'justificado');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_asistencia_ensayo_enum') then
    create type estado_asistencia_ensayo_enum as enum ('asistio', 'no_asistio');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'plataforma_enum') then
    create type plataforma_enum as enum ('ios', 'android');
  end if;
end $$;


-- =============================================================================
-- 3. TABLAS
-- =============================================================================

-- 3.1 perfiles: 1:1 con auth.users (datos personales, sin grupo_id)
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  apellido    text not null,
  email       text not null unique,
  telefono    text,
  foto_url    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3.2 grupos
create table if not exists public.grupos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  admin_id      uuid not null references public.perfiles(id),
  zona_horaria  text not null default 'America/Lima',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);

-- 3.3 usuarios_grupos: pertenencia + rol + estado
create table if not exists public.usuarios_grupos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.perfiles(id) on delete cascade,
  grupo_id      uuid not null references public.grupos(id) on delete cascade,
  rol           rol_grupo_enum not null,
  estado        estado_membresia_enum not null,
  fecha_ingreso date not null default current_date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (usuario_id, grupo_id)
);

-- 3.4 solicitudes_grupo
create table if not exists public.solicitudes_grupo (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references public.grupos(id) on delete cascade,
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  mensaje        text,
  estado         estado_solicitud_enum not null,
  respondida_por uuid references public.perfiles(id),
  created_at     timestamptz default now(),
  respondida_at  timestamptz
);

-- 3.5 patrones_recurrentes: 1:1 con grupos
create table if not exists public.patrones_recurrentes (
  id                uuid primary key default gen_random_uuid(),
  grupo_id          uuid not null unique references public.grupos(id) on delete cascade,
  configuracion     jsonb not null,
  offset_alarma_min integer not null default 60,
  semanas_generadas integer not null default 4,
  updated_at        timestamptz default now()
);

-- 3.6 servicios
create table if not exists public.servicios (
  id                     uuid primary key default gen_random_uuid(),
  grupo_id               uuid not null references public.grupos(id) on delete cascade,
  tipo                   tipo_evento_enum not null,
  titulo                 text,
  fecha_inicio           timestamptz not null,
  fecha_fin              timestamptz,
  lugar                  text,
  descripcion            text,
  notas_canciones        text,
  estado                 estado_evento_enum not null default 'programado',
  responsable_id         uuid references public.perfiles(id),
  asistencia_cerrada     boolean not null default false,
  asistencia_cerrada_at  timestamptz,
  asistencia_cerrada_por uuid references public.perfiles(id),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- 3.7 asignaciones_servicio
create table if not exists public.asignaciones_servicio (
  id               uuid primary key default gen_random_uuid(),
  servicio_id      uuid not null references public.servicios(id) on delete cascade,
  usuario_grupo_id uuid not null references public.usuarios_grupos(id) on delete cascade,
  rol_servicio     rol_servicio_enum not null,
  created_at       timestamptz default now(),
  unique (servicio_id, usuario_grupo_id, rol_servicio)
);

-- 3.8 estados_asistencia_servicio (1:1 con asignaciones, creada al asignar)
create table if not exists public.estados_asistencia_servicio (
  id            uuid primary key default gen_random_uuid(),
  asignacion_id uuid not null unique references public.asignaciones_servicio(id) on delete cascade,
  estado        estado_asistencia_enum not null default 'asistio',
  set_by        uuid references public.perfiles(id),
  updated_at    timestamptz default now()
);

-- 3.9 justificaciones_servicio
create table if not exists public.justificaciones_servicio (
  id               uuid primary key default gen_random_uuid(),
  servicio_id      uuid not null references public.servicios(id) on delete cascade,
  usuario_grupo_id uuid not null references public.usuarios_grupos(id) on delete cascade,
  texto            text not null,
  created_at       timestamptz default now(),
  unique (servicio_id, usuario_grupo_id)
);

-- 3.10 ensayos
create table if not exists public.ensayos (
  id                     uuid primary key default gen_random_uuid(),
  grupo_id               uuid not null references public.grupos(id) on delete cascade,
  titulo                 text not null,
  fecha_inicio           timestamptz not null,
  fecha_fin              timestamptz,
  lugar                  text,
  descripcion            text,
  tema                   text,
  estado                 estado_evento_enum not null default 'programado',
  encargado_id           uuid references public.perfiles(id),
  asistencia_cerrada     boolean not null default false,
  asistencia_cerrada_at  timestamptz,
  asistencia_cerrada_por uuid references public.perfiles(id),
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- 3.11 invitados_ensayo
create table if not exists public.invitados_ensayo (
  id               uuid primary key default gen_random_uuid(),
  ensayo_id        uuid not null references public.ensayos(id) on delete cascade,
  usuario_grupo_id uuid not null references public.usuarios_grupos(id) on delete cascade,
  created_at       timestamptz default now(),
  unique (ensayo_id, usuario_grupo_id)
);

-- 3.12 asistencias_ensayo
create table if not exists public.asistencias_ensayo (
  id             uuid primary key default gen_random_uuid(),
  invitacion_id  uuid not null unique references public.invitados_ensayo(id) on delete cascade,
  estado         estado_asistencia_ensayo_enum not null,
  set_by         uuid references public.perfiles(id),
  updated_at     timestamptz default now()
);

-- 3.13 comunicados
create table if not exists public.comunicados (
  id           uuid primary key default gen_random_uuid(),
  grupo_id     uuid not null references public.grupos(id) on delete cascade,
  titulo       text not null,
  descripcion  text not null,
  fecha_inicio timestamptz,
  lugar        text,
  created_at   timestamptz default now()
);

-- 3.14 dispositivos (por usuario, no por grupo)
create table if not exists public.dispositivos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.perfiles(id) on delete cascade,
  expo_push_token  text not null unique,
  plataforma       plataforma_enum,
  app_version      text,
  last_seen_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);


-- =============================================================================
-- 4. CONSTRAINTS, CHECKS, UNIQUE KEYS
-- (Idempotente vía DO block con check de pg_constraint)
-- =============================================================================

-- 4.1 Checks de fechas
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_serv_fechas') then
    alter table public.servicios
      add constraint chk_serv_fechas
      check (fecha_fin is null or fecha_fin >= fecha_inicio);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_ens_fechas') then
    alter table public.ensayos
      add constraint chk_ens_fechas
      check (fecha_fin is null or fecha_fin >= fecha_inicio);
  end if;
end $$;

-- 4.2 Checks de patrón recurrente
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_offset_pos') then
    alter table public.patrones_recurrentes
      add constraint chk_offset_pos
      check (offset_alarma_min >= 0);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_semanas_pos') then
    alter table public.patrones_recurrentes
      add constraint chk_semanas_pos
      check (semanas_generadas between 1 and 26);
  end if;
end $$;

-- 4.3 UK sobre servicios (necesario para ON CONFLICT del trigger de generación)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'uq_servicios_grupo_fecha') then
    alter table public.servicios
      add constraint uq_servicios_grupo_fecha
      unique (grupo_id, fecha_inicio);
  end if;
end $$;

-- 4.4 Partial unique index sobre solicitudes_grupo pendientes
-- (PostgreSQL no soporta UK parciales como constraint; usamos partial unique index.
--  create unique index if not exists es soportado nativamente.)
create unique index if not exists uq_solicitud_pendiente
  on public.solicitudes_grupo (grupo_id, usuario_id)
  where estado = 'pendiente';


-- =============================================================================
-- 5. ÍNDICES DE PERFORMANCE
-- =============================================================================

-- usuarios_grupos
create index if not exists idx_usuarios_grupos_usuario on public.usuarios_grupos(usuario_id);
create index if not exists idx_usuarios_grupos_grupo   on public.usuarios_grupos(grupo_id);
create index if not exists idx_usuarios_grupos_activos on public.usuarios_grupos(grupo_id) where estado = 'activo';

-- servicios
create index if not exists idx_servicios_grupo_fecha on public.servicios(grupo_id, fecha_inicio);
create index if not exists idx_servicios_estado      on public.servicios(estado) where estado = 'programado';

-- asignaciones
create index if not exists idx_asignaciones_servicio    on public.asignaciones_servicio(servicio_id);
create index if not exists idx_asignaciones_ug          on public.asignaciones_servicio(usuario_grupo_id);
create index if not exists idx_asignaciones_ug_servicio on public.asignaciones_servicio(usuario_grupo_id, servicio_id);

-- ensayos
create index if not exists idx_ensayos_grupo_fecha on public.ensayos(grupo_id, fecha_inicio);
create index if not exists idx_invitados_ensayo    on public.invitados_ensayo(ensayo_id);

-- comunicados
create index if not exists idx_comunicados_grupo_fecha        on public.comunicados(grupo_id, created_at desc);
create index if not exists idx_comunicados_grupo_fecha_inicio on public.comunicados(grupo_id, fecha_inicio);

-- justificaciones
create index if not exists idx_justificaciones_servicio    on public.justificaciones_servicio(servicio_id);
create index if not exists idx_justificaciones_servicio_ug on public.justificaciones_servicio(servicio_id, usuario_grupo_id);

-- dispositivos
create index if not exists idx_dispositivos_usuario on public.dispositivos(usuario_id);


-- =============================================================================
-- 6. HELPER FUNCTIONS (núcleo multi-tenant)
-- Lenguaje SQL, security definer, stable.
-- =============================================================================

-- 6.1 Devuelve los grupo_id donde el usuario es miembro activo.
create or replace function public.usuario_grupos_activos(uid uuid)
returns setof uuid
language sql
stable
security definer
as $$
  select grupo_id
  from public.usuarios_grupos
  where usuario_id = uid
    and estado = 'activo';
$$;

-- 6.2 Devuelve true si el usuario es admin activo del grupo.
create or replace function public.usuario_es_admin_de(uid uuid, gid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.usuarios_grupos
    where usuario_id = uid
      and grupo_id = gid
      and rol = 'admin'
      and estado = 'activo'
  );
$$;

-- 6.3 Devuelve true si el usuario es admin del grupo O responsable del servicio concreto.
create or replace function public.usuario_puede_cerrar_servicio(uid uuid, sid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from servicios s
    where s.id = sid
      and (
        public.usuario_es_admin_de(uid, s.grupo_id)
        or s.responsable_id = uid
      )
  );
$$;

-- 6.4 Análoga para ensayos.
create or replace function public.usuario_puede_cerrar_ensayo(uid uuid, eid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from ensayos e
    where e.id = eid
      and (
        public.usuario_es_admin_de(uid, e.grupo_id)
        or e.encargado_id = uid
      )
  );
$$;


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- Multi-tenant estricto: cada tabla con datos de un grupo se filtra por
-- membresía activa del usuario actual. Las únicas rutas que escapan a RLS
-- son las SECURITY DEFINER ops de la sección 10.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 perfiles (sin grupo_id; es a nivel usuario)
-- ----------------------------------------------------------------------------
alter table public.perfiles enable row level security;

drop policy if exists "perfiles: ver el propio" on public.perfiles;
create policy "perfiles: ver el propio"
  on public.perfiles for select
  using (id = auth.uid());

drop policy if exists "perfiles: insertar el propio o trigger" on public.perfiles;
create policy "perfiles: insertar el propio o trigger"
  on public.perfiles for insert
  with check (id = auth.uid() or auth.uid() is null);

drop policy if exists "perfiles: actualizar el propio" on public.perfiles;
create policy "perfiles: actualizar el propio"
  on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- DELETE: solo service_role (no creamos policy; RLS bloquea todo lo demás).

-- ----------------------------------------------------------------------------
-- 7.2 grupos
-- ----------------------------------------------------------------------------
alter table public.grupos enable row level security;

drop policy if exists "grupos: ver los de mi grupo" on public.grupos;
create policy "grupos: ver los de mi grupo"
  on public.grupos for select
  using (id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "grupos: insertar autenticado" on public.grupos;
create policy "grupos: insertar autenticado"
  on public.grupos for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "grupos: actualizar solo admin" on public.grupos;
create policy "grupos: actualizar solo admin"
  on public.grupos for update
  using (public.usuario_es_admin_de(auth.uid(), id))
  with check (public.usuario_es_admin_de(auth.uid(), id));

drop policy if exists "grupos: eliminar solo admin (soft)" on public.grupos;
create policy "grupos: eliminar solo admin (soft)"
  on public.grupos for delete
  using (public.usuario_es_admin_de(auth.uid(), id));

-- ----------------------------------------------------------------------------
-- 7.3 usuarios_grupos (caso especial del fundador)
-- ----------------------------------------------------------------------------
alter table public.usuarios_grupos enable row level security;

drop policy if exists "ug: ver los de mi grupo" on public.usuarios_grupos;
create policy "ug: ver los de mi grupo"
  on public.usuarios_grupos for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "ug: insertar fundador o admin" on public.usuarios_grupos;
create policy "ug: insertar fundador o admin"
  on public.usuarios_grupos for insert
  with check (
    (
      usuario_id = auth.uid()
      and rol = 'admin'
      and exists (
        select 1 from grupos g
        where g.id = grupo_id
          and g.admin_id = auth.uid()
          and g.deleted_at is null
      )
    )
    or
    (
      rol = 'miembro'
      and public.usuario_es_admin_de(auth.uid(), grupo_id)
    )
  );

drop policy if exists "ug: actualizar solo admin" on public.usuarios_grupos;
create policy "ug: actualizar solo admin"
  on public.usuarios_grupos for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "ug: eliminar solo admin" on public.usuarios_grupos;
create policy "ug: eliminar solo admin"
  on public.usuarios_grupos for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.4 solicitudes_grupo
-- ----------------------------------------------------------------------------
alter table public.solicitudes_grupo enable row level security;

drop policy if exists "solicitudes: ver las de mi grupo o las mias" on public.solicitudes_grupo;
create policy "solicitudes: ver las de mi grupo o las mias"
  on public.solicitudes_grupo for select
  using (
    public.usuario_es_admin_de(auth.uid(), grupo_id)
    or usuario_id = auth.uid()
  );

drop policy if exists "solicitudes: crear solo para mi mismo" on public.solicitudes_grupo;
create policy "solicitudes: crear solo para mi mismo"
  on public.solicitudes_grupo for insert
  with check (usuario_id = auth.uid());

drop policy if exists "solicitudes: actualizar solo admin" on public.solicitudes_grupo;
create policy "solicitudes: actualizar solo admin"
  on public.solicitudes_grupo for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "solicitudes: eliminar solo admin" on public.solicitudes_grupo;
create policy "solicitudes: eliminar solo admin"
  on public.solicitudes_grupo for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.5 patrones_recurrentes
-- ----------------------------------------------------------------------------
alter table public.patrones_recurrentes enable row level security;

drop policy if exists "patrones: ver los de mi grupo" on public.patrones_recurrentes;
create policy "patrones: ver los de mi grupo"
  on public.patrones_recurrentes for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "patrones: insertar solo admin" on public.patrones_recurrentes;
create policy "patrones: insertar solo admin"
  on public.patrones_recurrentes for insert
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "patrones: actualizar solo admin" on public.patrones_recurrentes;
create policy "patrones: actualizar solo admin"
  on public.patrones_recurrentes for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "patrones: eliminar solo admin" on public.patrones_recurrentes;
create policy "patrones: eliminar solo admin"
  on public.patrones_recurrentes for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.6 servicios
-- ----------------------------------------------------------------------------
alter table public.servicios enable row level security;

drop policy if exists "servicios: ver los de mi grupo" on public.servicios;
create policy "servicios: ver los de mi grupo"
  on public.servicios for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "servicios: insertar solo admin" on public.servicios;
create policy "servicios: insertar solo admin"
  on public.servicios for insert
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "servicios: actualizar solo admin" on public.servicios;
create policy "servicios: actualizar solo admin"
  on public.servicios for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "servicios: eliminar solo admin (soft)" on public.servicios;
create policy "servicios: eliminar solo admin (soft)"
  on public.servicios for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.7 asignaciones_servicio
-- ----------------------------------------------------------------------------
alter table public.asignaciones_servicio enable row level security;

drop policy if exists "asignaciones: ver las de mi grupo" on public.asignaciones_servicio;
create policy "asignaciones: ver las de mi grupo"
  on public.asignaciones_servicio for select
  using (servicio_id in (
    select id from servicios
    where grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

drop policy if exists "asignaciones: insertar solo admin" on public.asignaciones_servicio;
create policy "asignaciones: insertar solo admin"
  on public.asignaciones_servicio for insert
  with check (servicio_id in (
    select id from servicios
    where grupo_id in (select public.usuario_grupos_activos(auth.uid()))
      and public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

drop policy if exists "asignaciones: actualizar solo admin" on public.asignaciones_servicio;
create policy "asignaciones: actualizar solo admin"
  on public.asignaciones_servicio for update
  using (servicio_id in (
    select id from servicios
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ))
  with check (servicio_id in (
    select id from servicios
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

drop policy if exists "asignaciones: eliminar solo admin" on public.asignaciones_servicio;
create policy "asignaciones: eliminar solo admin"
  on public.asignaciones_servicio for delete
  using (servicio_id in (
    select id from servicios
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

-- ----------------------------------------------------------------------------
-- 7.8 justificaciones_servicio (self-managed: cada miembro ve/edita las suyas)
-- ----------------------------------------------------------------------------
alter table public.justificaciones_servicio enable row level security;

drop policy if exists "justificaciones: ver las de mi grupo" on public.justificaciones_servicio;
create policy "justificaciones: ver las de mi grupo"
  on public.justificaciones_servicio for select
  using (servicio_id in (
    select id from servicios
    where grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

drop policy if exists "justificaciones: insertar solo para mi mismo" on public.justificaciones_servicio;
create policy "justificaciones: insertar solo para mi mismo"
  on public.justificaciones_servicio for insert
  with check (
    usuario_grupo_id in (
      select id from usuarios_grupos
      where usuario_id = auth.uid()
        and estado = 'activo'
    )
  );

drop policy if exists "justificaciones: actualizar solo para mi mismo" on public.justificaciones_servicio;
create policy "justificaciones: actualizar solo para mi mismo"
  on public.justificaciones_servicio for update
  using (
    usuario_grupo_id in (
      select id from usuarios_grupos
      where usuario_id = auth.uid()
        and estado = 'activo'
    )
  )
  with check (
    usuario_grupo_id in (
      select id from usuarios_grupos
      where usuario_id = auth.uid()
        and estado = 'activo'
    )
  );

drop policy if exists "justificaciones: eliminar solo para mi mismo" on public.justificaciones_servicio;
create policy "justificaciones: eliminar solo para mi mismo"
  on public.justificaciones_servicio for delete
  using (
    usuario_grupo_id in (
      select id from usuarios_grupos
      where usuario_id = auth.uid()
        and estado = 'activo'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.9 estados_asistencia_servicio (responsable+admin del servicio concreto)
-- ----------------------------------------------------------------------------
alter table public.estados_asistencia_servicio enable row level security;

drop policy if exists "eas: ver los de mi grupo" on public.estados_asistencia_servicio;
create policy "eas: ver los de mi grupo"
  on public.estados_asistencia_servicio for select
  using (asignacion_id in (
    select asv.id from asignaciones_servicio asv
    join servicios s on s.id = asv.servicio_id
    where s.grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

drop policy if exists "eas: insertar admin o responsable del servicio" on public.estados_asistencia_servicio;
create policy "eas: insertar admin o responsable del servicio"
  on public.estados_asistencia_servicio for insert
  with check (public.usuario_puede_cerrar_servicio(auth.uid(), (
    select servicio_id from asignaciones_servicio where id = asignacion_id
  )));

drop policy if exists "eas: actualizar admin o responsable del servicio" on public.estados_asistencia_servicio;
create policy "eas: actualizar admin o responsable del servicio"
  on public.estados_asistencia_servicio for update
  using (public.usuario_puede_cerrar_servicio(auth.uid(), (
    select servicio_id from asignaciones_servicio where id = asignacion_id
  )))
  with check (public.usuario_puede_cerrar_servicio(auth.uid(), (
    select servicio_id from asignaciones_servicio where id = asignacion_id
  )));

drop policy if exists "eas: eliminar solo admin del grupo" on public.estados_asistencia_servicio;
create policy "eas: eliminar solo admin del grupo"
  on public.estados_asistencia_servicio for delete
  using (asignacion_id in (
    select asv.id from asignaciones_servicio asv
    join servicios s on s.id = asv.servicio_id
    where public.usuario_es_admin_de(auth.uid(), s.grupo_id)
  ));

-- ----------------------------------------------------------------------------
-- 7.10 ensayos
-- ----------------------------------------------------------------------------
alter table public.ensayos enable row level security;

drop policy if exists "ensayos: ver los de mi grupo" on public.ensayos;
create policy "ensayos: ver los de mi grupo"
  on public.ensayos for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "ensayos: insertar solo admin" on public.ensayos;
create policy "ensayos: insertar solo admin"
  on public.ensayos for insert
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "ensayos: actualizar solo admin" on public.ensayos;
create policy "ensayos: actualizar solo admin"
  on public.ensayos for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "ensayos: eliminar solo admin (soft)" on public.ensayos;
create policy "ensayos: eliminar solo admin (soft)"
  on public.ensayos for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.11 invitados_ensayo
-- ----------------------------------------------------------------------------
alter table public.invitados_ensayo enable row level security;

drop policy if exists "invitados: ver los de mi grupo" on public.invitados_ensayo;
create policy "invitados: ver los de mi grupo"
  on public.invitados_ensayo for select
  using (ensayo_id in (
    select id from ensayos
    where grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

drop policy if exists "invitados: insertar solo admin" on public.invitados_ensayo;
create policy "invitados: insertar solo admin"
  on public.invitados_ensayo for insert
  with check (ensayo_id in (
    select id from ensayos
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

drop policy if exists "invitados: actualizar solo admin" on public.invitados_ensayo;
create policy "invitados: actualizar solo admin"
  on public.invitados_ensayo for update
  using (ensayo_id in (
    select id from ensayos
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ))
  with check (ensayo_id in (
    select id from ensayos
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

drop policy if exists "invitados: eliminar solo admin" on public.invitados_ensayo;
create policy "invitados: eliminar solo admin"
  on public.invitados_ensayo for delete
  using (ensayo_id in (
    select id from ensayos
    where public.usuario_es_admin_de(auth.uid(), grupo_id)
  ));

-- ----------------------------------------------------------------------------
-- 7.12 asistencias_ensayo (encargado+admin del ensayo concreto)
-- ----------------------------------------------------------------------------
alter table public.asistencias_ensayo enable row level security;

drop policy if exists "asistencias_ens: ver las de mi grupo" on public.asistencias_ensayo;
create policy "asistencias_ens: ver las de mi grupo"
  on public.asistencias_ensayo for select
  using (invitacion_id in (
    select ie.id from invitados_ensayo ie
    join ensayos e on e.id = ie.ensayo_id
    where e.grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

drop policy if exists "asistencias_ens: insertar admin o encargado del ensayo" on public.asistencias_ensayo;
create policy "asistencias_ens: insertar admin o encargado del ensayo"
  on public.asistencias_ensayo for insert
  with check (public.usuario_puede_cerrar_ensayo(auth.uid(), (
    select ensayo_id from invitados_ensayo where id = invitacion_id
  )));

drop policy if exists "asistencias_ens: actualizar admin o encargado del ensayo" on public.asistencias_ensayo;
create policy "asistencias_ens: actualizar admin o encargado del ensayo"
  on public.asistencias_ensayo for update
  using (public.usuario_puede_cerrar_ensayo(auth.uid(), (
    select ensayo_id from invitados_ensayo where id = invitacion_id
  )))
  with check (public.usuario_puede_cerrar_ensayo(auth.uid(), (
    select ensayo_id from invitados_ensayo where id = invitacion_id
  )));

drop policy if exists "asistencias_ens: eliminar solo admin del grupo" on public.asistencias_ensayo;
create policy "asistencias_ens: eliminar solo admin del grupo"
  on public.asistencias_ensayo for delete
  using (invitacion_id in (
    select ie.id from invitados_ensayo ie
    join ensayos e on e.id = ie.ensayo_id
    where public.usuario_es_admin_de(auth.uid(), e.grupo_id)
  ));

-- ----------------------------------------------------------------------------
-- 7.13 comunicados
-- ----------------------------------------------------------------------------
alter table public.comunicados enable row level security;

drop policy if exists "comunicados: ver los de mi grupo" on public.comunicados;
create policy "comunicados: ver los de mi grupo"
  on public.comunicados for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

drop policy if exists "comunicados: insertar solo admin" on public.comunicados;
create policy "comunicados: insertar solo admin"
  on public.comunicados for insert
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "comunicados: actualizar solo admin" on public.comunicados;
create policy "comunicados: actualizar solo admin"
  on public.comunicados for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id))
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

drop policy if exists "comunicados: eliminar solo admin" on public.comunicados;
create policy "comunicados: eliminar solo admin"
  on public.comunicados for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- ----------------------------------------------------------------------------
-- 7.14 dispositivos (por usuario, sin grupo_id)
-- ----------------------------------------------------------------------------
alter table public.dispositivos enable row level security;

drop policy if exists "dispositivos: ver los propios" on public.dispositivos;
create policy "dispositivos: ver los propios"
  on public.dispositivos for select
  using (usuario_id = auth.uid());

drop policy if exists "dispositivos: insertar los propios" on public.dispositivos;
create policy "dispositivos: insertar los propios"
  on public.dispositivos for insert
  with check (usuario_id = auth.uid());

drop policy if exists "dispositivos: actualizar los propios" on public.dispositivos;
create policy "dispositivos: actualizar los propios"
  on public.dispositivos for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "dispositivos: eliminar los propios" on public.dispositivos;
create policy "dispositivos: eliminar los propios"
  on public.dispositivos for delete
  using (usuario_id = auth.uid());


-- =============================================================================
-- 8. TRIGGERS DE INTEGRIDAD (BEFORE)
-- Garantizan invariantes que la RLS no puede expresar.
-- (Idempotente: drop trigger if exists antes de cada create.)
-- =============================================================================

-- 8.1 Responsable de servicio debe ser miembro activo del grupo.
create or replace function public.validar_pertenencia_responsable()
returns trigger language plpgsql as $$
begin
  if new.responsable_id is not null and not exists (
    select 1 from usuarios_grupos
    where usuario_id = new.responsable_id
      and grupo_id = new.grupo_id
      and estado = 'activo'
  ) then
    raise exception 'El responsable debe ser un miembro activo del grupo';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_servicios_validar_responsable on public.servicios;
create trigger trg_servicios_validar_responsable
  before insert or update of responsable_id, grupo_id on public.servicios
  for each row execute function public.validar_pertenencia_responsable();

-- 8.2 Encargado de ensayo debe ser miembro activo del grupo.
create or replace function public.validar_pertenencia_encargado()
returns trigger language plpgsql as $$
begin
  if new.encargado_id is not null and not exists (
    select 1 from usuarios_grupos
    where usuario_id = new.encargado_id
      and grupo_id = new.grupo_id
      and estado = 'activo'
  ) then
    raise exception 'El encargado debe ser un miembro activo del grupo';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensayos_validar_encargado on public.ensayos;
create trigger trg_ensayos_validar_encargado
  before insert or update of encargado_id, grupo_id on public.ensayos
  for each row execute function public.validar_pertenencia_encargado();

-- 8.3 NOTA sobre chk_admin_es_miembro
-- La invariante "grupos.admin_id es un admin activo en usuarios_grupos" NO
-- se enforcea con un trigger sobre la tabla grupos. Análisis:
--   * CHECK constraint: PostgreSQL no permite subqueries en CHECK
--     (SQLSTATE 0A000).
--   * Trigger AFTER sobre grupos: crear_grupo() hace INSERT grupos y luego
--     INSERT usuarios_grupos en statements separados; el trigger se
--     dispararía al final del primer statement, cuando la fila de
--     usuarios_grupos aún no existe.
--   * CONSTRAINT trigger deferred: se valida al COMMIT, pero tg_op siempre
--     reporta 'INSERT' y cualquier DELETE legítimo (eliminar_cuenta,
--     cleanup) lo rompe.
-- Las únicas 2 rutas que tocan grupos.admin_id son las SECURITY DEFINER
-- ops crear_grupo() y transferir_admin(), y AMBAS validan manualmente que
-- exista la fila admin en usuarios_grupos antes de modificar grupos. Si en
-- el futuro se agrega una nueva ruta, debe replicar esa validación.


-- =============================================================================
-- 9. TRIGGERS DE GENERACIÓN Y MANTENIMIENTO
-- =============================================================================

-- 9.1 handle_new_user: crea fila en perfiles al registrarse en auth.users.
-- Necesario para que Auth funcione end-to-end. La policy de INSERT en
-- perfiles permite auth.uid() IS NULL para que el trigger (que corre
-- sin sesión de usuario) pase la RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.perfiles (id, email, nombre, apellido)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 9.2 generar_servicios_desde_patron: materializa los servicios del patrón
-- recurrente en N semanas. Upsert por (grupo_id, fecha_inicio): los
-- servicios cancelados manualmente NO se resucitan al regenerar.
-- FIX aplicado respecto al doc: la zona_horaria está en public.grupos, no
-- en public.patrones_recurrentes, así que hacemos JOIN dentro del trigger.
create or replace function public.generar_servicios_desde_patron()
returns trigger
language plpgsql
as $$
declare
  v_zona_horaria text;
  dia_key        text;
  dia_int        int;
  horarios       jsonb;
  horario        jsonb;
  hora_str       text;
  fecha_calculada date;
  fecha_hora     timestamptz;
  i              int;
begin
  select g.zona_horaria into v_zona_horaria
  from public.grupos g
  where g.id = new.grupo_id;

  for dia_key, horarios in
    select key, value
    from jsonb_each(new.configuracion->'dias')
  loop
    dia_int := dia_key::int;
    for horario in select * from jsonb_array_elements(horarios)
    loop
      hora_str := horario->>'hora';
      for i in 0..(new.semanas_generadas - 1) loop
        fecha_calculada := (
          current_date
          + ((7 - extract(dow from current_date)::int + dia_int) % 7)
          + (i * 7)
        )::date;

        fecha_hora := (fecha_calculada::text || ' ' || hora_str)::timestamp
                       at time zone v_zona_horaria;

        if fecha_hora < now() then
          continue;
        end if;

        insert into servicios (grupo_id, tipo, fecha_inicio, estado)
        values (new.grupo_id, 'servicio', fecha_hora, 'programado')
        on conflict (grupo_id, fecha_inicio) do nothing;
      end loop;
    end loop;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_patron_generar_servicios on public.patrones_recurrentes;
create trigger trg_patron_generar_servicios
  after insert or update of configuracion, semanas_generadas on public.patrones_recurrentes
  for each row execute function public.generar_servicios_desde_patron();

-- 9.3 crear_estado_asistencia_al_asignar: al crear una asignación, crea
-- automáticamente su fila de estado con default 'asistio'. Esto cumple
-- la decisión de diseño: estados_asistencia_servicio se crea al asignar
-- (no al cerrar asistencia), simplificando queries y vistas.
create or replace function public.crear_estado_asistencia_al_asignar()
returns trigger
language plpgsql
as $$
begin
  insert into estados_asistencia_servicio (asignacion_id, estado, set_by)
  values (new.id, 'asistio', null);
  return new;
end;
$$;

drop trigger if exists trg_asignacion_crear_estado on public.asignaciones_servicio;
create trigger trg_asignacion_crear_estado
  after insert on public.asignaciones_servicio
  for each row execute function public.crear_estado_asistencia_al_asignar();

-- 9.4 tg_set_updated_at: función genérica que actualiza updated_at en cada
-- UPDATE. Se vincula con triggers por tabla.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Triggers de updated_at por tabla
drop trigger if exists trg_perfiles_set_updated_at on public.perfiles;
create trigger trg_perfiles_set_updated_at
  before update on public.perfiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_grupos_set_updated_at on public.grupos;
create trigger trg_grupos_set_updated_at
  before update on public.grupos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_usuarios_grupos_set_updated_at on public.usuarios_grupos;
create trigger trg_usuarios_grupos_set_updated_at
  before update on public.usuarios_grupos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_patrones_recurrentes_set_updated_at on public.patrones_recurrentes;
create trigger trg_patrones_recurrentes_set_updated_at
  before update on public.patrones_recurrentes
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_servicios_set_updated_at on public.servicios;
create trigger trg_servicios_set_updated_at
  before update on public.servicios
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_ensayos_set_updated_at on public.ensayos;
create trigger trg_ensayos_set_updated_at
  before update on public.ensayos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_dispositivos_set_updated_at on public.dispositivos;
create trigger trg_dispositivos_set_updated_at
  before update on public.dispositivos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_estados_asistencia_set_updated_at on public.estados_asistencia_servicio;
create trigger trg_estados_asistencia_set_updated_at
  before update on public.estados_asistencia_servicio
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_asistencias_ensayo_set_updated_at on public.asistencias_ensayo;
create trigger trg_asistencias_ensayo_set_updated_at
  before update on public.asistencias_ensayo
  for each row execute function public.tg_set_updated_at();


-- =============================================================================
-- 10. OPERACIONES PRIVILEGIADAS (SECURITY DEFINER)
-- Lógica transaccional multi-tabla que la RLS no puede expresar en una policy.
-- =============================================================================

-- 10.1 crear_grupo: crea grupo, asigna admin y crea patrón vacío.
create or replace function public.crear_grupo(
  p_nombre text,
  p_descripcion text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_grupo_id uuid;
begin
  insert into public.grupos (nombre, descripcion, admin_id)
  values (p_nombre, p_descripcion, auth.uid())
  returning id into v_grupo_id;

  insert into public.usuarios_grupos (usuario_id, grupo_id, rol, estado)
  values (auth.uid(), v_grupo_id, 'admin', 'activo');

  insert into public.patrones_recurrentes (grupo_id, configuracion)
  values (v_grupo_id, '{"dias": {"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}}'::jsonb);

  if not exists (
    select 1 from public.usuarios_grupos ug
    where ug.usuario_id = auth.uid()
      and ug.grupo_id = v_grupo_id
      and ug.rol = 'admin'
      and ug.estado = 'activo'
  ) then
    raise exception 'Error interno: la membresía admin no se creó correctamente';
  end if;

  return v_grupo_id;
end;
$$;

grant execute on function public.crear_grupo(text, text) to authenticated;

-- 10.2 transferir_admin: transición atómica de admin.
create or replace function public.transferir_admin(
  p_grupo_id uuid,
  p_nuevo_admin_usuario_grupo_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_admin_actual    uuid;
  v_nuevo_usuario_id uuid;
begin
  if not public.usuario_es_admin_de(auth.uid(), p_grupo_id) then
    raise exception 'Solo el admin actual puede transferir el rol';
  end if;

  select usuario_id into v_nuevo_usuario_id
  from public.usuarios_grupos
  where id = p_nuevo_admin_usuario_grupo_id
    and grupo_id = p_grupo_id
    and estado = 'activo';

  if v_nuevo_usuario_id is null then
    raise exception 'El nuevo admin debe ser un miembro activo del grupo';
  end if;

  if v_nuevo_usuario_id = auth.uid() then
    raise exception 'Ya eres el admin de este grupo';
  end if;

  v_admin_actual := auth.uid();

  update public.usuarios_grupos
    set rol = 'miembro', updated_at = now()
    where usuario_id = v_admin_actual and grupo_id = p_grupo_id;

  update public.usuarios_grupos
    set rol = 'admin', updated_at = now()
    where id = p_nuevo_admin_usuario_grupo_id;

  update public.grupos
    set admin_id = v_nuevo_usuario_id, updated_at = now()
    where id = p_grupo_id;
end;
$$;

grant execute on function public.transferir_admin(uuid, uuid) to authenticated;

-- 10.3 aprobar_solicitud: inserta miembro y marca solicitud aprobada.
create or replace function public.aprobar_solicitud(p_solicitud_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_solicitud record;
begin
  select * into v_solicitud
  from public.solicitudes_grupo
  where id = p_solicitud_id
    and estado = 'pendiente'
  for update;

  if v_solicitud.id is null then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  if not public.usuario_es_admin_de(auth.uid(), v_solicitud.grupo_id) then
    raise exception 'Solo el admin puede aprobar solicitudes';
  end if;

  insert into public.usuarios_grupos (usuario_id, grupo_id, rol, estado)
  values (v_solicitud.usuario_id, v_solicitud.grupo_id, 'miembro', 'activo');

  update public.solicitudes_grupo
    set estado = 'aprobada',
        respondida_por = auth.uid(),
        respondida_at = now()
    where id = p_solicitud_id;
end;
$$;

grant execute on function public.aprobar_solicitud(uuid) to authenticated;

-- 10.4 eliminar_grupo: soft delete con cascade de membresías a inactivo.
-- (Cierra la visibilidad: usuarios_grupos_activos devuelve 0 para todos.)
create or replace function public.eliminar_grupo(p_grupo_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.usuario_es_admin_de(auth.uid(), p_grupo_id) then
    raise exception 'Solo el admin puede eliminar el grupo';
  end if;

  update public.grupos
    set deleted_at = now(), updated_at = now()
    where id = p_grupo_id;

  update public.usuarios_grupos
    set estado = 'inactivo', updated_at = now()
    where grupo_id = p_grupo_id;
end;
$$;

grant execute on function public.eliminar_grupo(uuid) to authenticated;

-- 10.5 eliminar_cuenta: requiere no ser admin de ningún grupo vivo.
create or replace function public.eliminar_cuenta()
returns void
language plpgsql
security definer
as $$
declare
  v_grupos_admin record;
begin
  for v_grupos_admin in
    select g.id, g.nombre
    from public.grupos g
    where g.admin_id = auth.uid()
      and g.deleted_at is null
  loop
    raise exception 'Debes transferir o eliminar el grupo "%" antes de eliminar tu cuenta',
      v_grupos_admin.nombre;
  end loop;

  update public.usuarios_grupos
    set estado = 'inactivo', updated_at = now()
    where usuario_id = auth.uid();

  delete from public.perfiles where id = auth.uid();
end;
$$;

grant execute on function public.eliminar_cuenta() to authenticated;


-- =============================================================================
-- 11. VISTAS
-- =============================================================================

-- 11.1 v_mi_semana: pantalla principal del miembro. Agrupa los roles de
-- servicio por servicio en un array. Una fila por servicio, 14 días adelante.
create or replace view public.v_mi_semana as
select
  s.id              as servicio_id,
  s.grupo_id,
  s.titulo,
  s.fecha_inicio,
  s.fecha_fin,
  s.lugar,
  s.estado,
  auth.uid() = s.responsable_id as soy_responsable,
  coalesce(
    array_agg(asv.rol_servicio::text) filter (where asv.usuario_grupo_id = (
      select id from usuarios_grupos
      where usuario_id = auth.uid() and grupo_id = s.grupo_id
    )),
    '{}'::text[]
  ) as mis_roles
from servicios s
left join asignaciones_servicio asv on asv.servicio_id = s.id
where s.estado = 'programado'
  and s.fecha_inicio >= now()
  and s.fecha_inicio <  now() + interval '14 days'
group by s.id;

-- 11.2 v_asistencia_servicio: contadores de asistencia por servicio.
-- NO incluye q_sin_cerrar: las filas de estados_asistencia_servicio se crean
-- al asignar (con default 'asistio'), por lo que ese contador siempre sería 0.
create or replace view public.v_asistencia_servicio as
select
  s.id   as servicio_id,
  count(*) filter (where eas.estado = 'asistio')     as q_asistio,
  count(*) filter (where eas.estado = 'no_asistio')   as q_no_asistio,
  count(*) filter (where eas.estado = 'justificado')  as q_justificado,
  s.asistencia_cerrada
from servicios s
left join asignaciones_servicio asv on asv.servicio_id = s.id
left join estados_asistencia_servicio eas on eas.asignacion_id = asv.id
group by s.id;


-- =============================================================================
-- 12. STUBS (para v0.2.0)
-- =============================================================================

-- 12.1 notificar_evento: stub. La implementación real (v0.2.0) disparará
-- la Edge Function de push notification cuando se cree/modifique/cancele
-- un servicio, ensayo o comunicado. Por ahora solo dejamos la función
-- documentada para que se sepa que existirá.
-- create or replace function public.notificar_evento() returns trigger
-- language plpgsql as $$
-- begin
--   -- TODO v0.2.0: enqueue job para Edge Function notificar-push
--   return new;
-- end;
-- $$;
