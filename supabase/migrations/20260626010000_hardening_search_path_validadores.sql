-- =============================================================================
-- 20260626010000_hardening_search_path_validadores.sql
-- =============================================================================
-- Continuación de 20260626000000_hardening_search_path.sql.
--
-- Esa migración endureció las funciones que se ubicaron grepando por
-- `security definer`. La verificación posterior (listar TODAS las funciones de
-- `public` vía pg_proc) reveló 2 triggers de integridad SECURITY INVOKER que
-- habían quedado sin `search_path` pineado y que referencian `usuarios_grupos`
-- sin calificar el esquema:
--   * validar_pertenencia_responsable  (trg en public.servicios)
--   * validar_pertenencia_encargado    (trg en public.ensayos)
--
-- Aunque corren como el usuario invocante (no como owner), el linter de
-- Supabase (`function_search_path_mutable`) las marca igual, y con un
-- search_path mutable la referencia `from usuarios_grupos` es ambigua.
-- Se recrean con `set search_path = ''` y `public.usuarios_grupos`.
-- Mismo cuerpo y comportamiento; los triggers existentes siguen vinculados
-- (CREATE OR REPLACE conserva la función, no toca los triggers).
--
-- NOTA sobre `validar_admin_es_miembro`: esa función aparece en la DB hosted
-- pero NO está en ninguna migración del repo (drift). El enfoque de
-- constraint-trigger para validar la membresía del admin se descartó
-- explícitamente (ver 20260614000000_initial_schema.sql, sección 8, comentario
-- ~líneas 950-965). Su limpieza/endurecimiento se trata aparte (requiere
-- inspeccionar su definición real en la DB antes de decidir DROP vs. recrear).
-- =============================================================================

-- 1. Responsable de servicio debe ser miembro activo del grupo.
create or replace function public.validar_pertenencia_responsable()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.responsable_id is not null and not exists (
    select 1 from public.usuarios_grupos
    where usuario_id = new.responsable_id
      and grupo_id = new.grupo_id
      and estado = 'activo'
  ) then
    raise exception 'El responsable debe ser un miembro activo del grupo';
  end if;
  return new;
end;
$$;

-- 2. Encargado de ensayo debe ser miembro activo del grupo.
create or replace function public.validar_pertenencia_encargado()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.encargado_id is not null and not exists (
    select 1 from public.usuarios_grupos
    where usuario_id = new.encargado_id
      and grupo_id = new.grupo_id
      and estado = 'activo'
  ) then
    raise exception 'El encargado debe ser un miembro activo del grupo';
  end if;
  return new;
end;
$$;
