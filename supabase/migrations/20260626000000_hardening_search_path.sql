-- =============================================================================
-- 20260626000000_hardening_search_path.sql
-- =============================================================================
-- Endurecimiento de seguridad: fija `search_path = ''` (vacío) en TODAS las
-- funciones de `public.` y califica con esquema cualquier referencia a objetos.
--
-- Por qué (riesgo real):
-- Una función `SECURITY DEFINER` corre con los privilegios de su owner pero,
-- por defecto, con el `search_path` del *caller*. Un usuario podría anteponer
-- un esquema propio (p. ej. `set search_path = evil, public`) y hacer que una
-- referencia SIN calificar como `from servicios` resuelva a `evil.servicios`,
-- ejecutando código bajo los privilegios del owner. Es el patrón clásico de
-- escalación por "schema pollution" que advierte el linter de Supabase
-- (`function_search_path_mutable`).
--
-- Mitigación:
-- - `set search_path = ''` deja el `search_path` vacío y fijo: la función
--   ignora el del caller. `pg_catalog` sigue implícito (now(), exists(),
--   jsonb_*, etc. siguen disponibles), pero todo objeto de `public`/`auth`
--   DEBE ir calificado.
-- - Las funciones cuyo cuerpo ya calificaba todo se endurecen con un simple
--   `ALTER FUNCTION ... SET search_path = ''` (cambio mínimo, sin reescribir
--   el cuerpo).
-- - Las 4 funciones que referenciaban tablas sin calificar se recrean con el
--   cuerpo calificado (mismo comportamiento, preservando SECURITY DEFINER
--   donde aplica). Eran:
--     * usuario_puede_cerrar_servicio  ->  from servicios   (definer)
--     * usuario_puede_cerrar_ensayo    ->  from ensayos     (definer)
--     * generar_servicios_desde_patron ->  insert into servicios            (invoker)
--     * crear_estado_asistencia_al_asignar -> insert into estados_asistencia (invoker)
--
-- Sin cambios de comportamiento ni de firma: solo se pinea el search_path y se
-- califican referencias. Idempotente (ALTER ... SET y CREATE OR REPLACE).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Funciones ya calificadas: solo pinear search_path (cambio mínimo)
-- ----------------------------------------------------------------------------

-- Helpers multi-tenant (SECURITY DEFINER)
alter function public.usuario_grupos_activos(uuid)        set search_path = '';
alter function public.usuario_es_admin_de(uuid, uuid)     set search_path = '';

-- Operaciones privilegiadas (SECURITY DEFINER)
alter function public.crear_grupo(text, text)             set search_path = '';
alter function public.transferir_admin(uuid, uuid)        set search_path = '';
alter function public.aprobar_solicitud(uuid)             set search_path = '';
alter function public.eliminar_grupo(uuid)                set search_path = '';
alter function public.eliminar_cuenta()                   set search_path = '';

-- Trigger de Auth (SECURITY DEFINER)
alter function public.handle_new_user()                   set search_path = '';

-- Trigger genérico de updated_at (SECURITY INVOKER, sin referencias a tablas)
alter function public.tg_set_updated_at()                 set search_path = '';

-- ----------------------------------------------------------------------------
-- 2. Funciones con referencias sin calificar: recrear con esquema explícito
-- ----------------------------------------------------------------------------

-- 2.1 usuario_puede_cerrar_servicio: `servicios` -> `public.servicios`
create or replace function public.usuario_puede_cerrar_servicio(uid uuid, sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.servicios s
    where s.id = sid
      and (
        public.usuario_es_admin_de(uid, s.grupo_id)
        or s.responsable_id = uid
      )
  );
$$;

-- 2.2 usuario_puede_cerrar_ensayo: `ensayos` -> `public.ensayos`
create or replace function public.usuario_puede_cerrar_ensayo(uid uuid, eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ensayos e
    where e.id = eid
      and (
        public.usuario_es_admin_de(uid, e.grupo_id)
        or e.encargado_id = uid
      )
  );
$$;

-- 2.3 generar_servicios_desde_patron: `insert into servicios` -> `public.servicios`
--     (SECURITY INVOKER: corre como el admin que inserta/edita el patrón;
--      la RLS de `servicios` sigue aplicando.)
create or replace function public.generar_servicios_desde_patron()
returns trigger
language plpgsql
set search_path = ''
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

        insert into public.servicios (grupo_id, tipo, fecha_inicio, estado)
        values (new.grupo_id, 'servicio', fecha_hora, 'programado')
        on conflict (grupo_id, fecha_inicio) do nothing;
      end loop;
    end loop;
  end loop;

  return new;
end;
$$;

-- 2.4 crear_estado_asistencia_al_asignar:
--     `insert into estados_asistencia_servicio` -> `public.estados_asistencia_servicio`
--     (SECURITY INVOKER.)
create or replace function public.crear_estado_asistencia_al_asignar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.estados_asistencia_servicio (asignacion_id, estado, set_by)
  values (new.id, 'asistio', null);
  return new;
end;
$$;
