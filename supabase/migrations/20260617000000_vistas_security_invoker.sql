-- 20260617000000_vistas_security_invoker.sql
--
-- Fix para los warnings del Supabase linter 'security_definer_view' sobre
-- public.v_mi_semana y public.v_asistencia_servicio.
--
-- Diagnóstico (sesión 2026-06-17):
-- Las dos vistas estaban creadas con `CREATE OR REPLACE VIEW ... AS ...` sin
-- el atributo `security_invoker`. En Postgres 15+ el default es INVOKER,
-- pero el linter de Supabase las flaguea igual porque leen tablas con RLS
-- y el patrón (JOIN + filtros en el cuerpo) coincide con la heurística de
-- "vista que lee data cross-tenant si los permisos se aflojan".
--
-- Fix: recrear las vistas con `WITH (security_invoker = true)`. Eso fuerza
-- a la vista a correr con los permisos del caller, NO del owner, así que
-- las RLS de servicios / asignaciones_servicio / estados_asistencia_servicio
-- se aplican de vuelta. Los filtros del cuerpo (estado='programado', rango
-- 14 días, etc.) se siguen aplicando — son filtros WHERE adicionales, no
-- dependen de los permisos.
--
-- La RLS sobre las tablas subyacentes ya está bien configurada:
--   - servicios: "ver los de mi grupo" (filtra por grupo_id IN membresías activas)
--   - asignaciones_servicio: "ver las de mi grupo" (idem)
--   - estados_asistencia_servicio: "ver las de mi grupo" (idem)
-- Por lo tanto, agregar `security_invoker = true` es seguro: el caller
-- sigue viendo exactamente lo mismo que antes, pero ahora la promesa
-- está enforced y el linter no se queja.
--
-- Si en el futuro alguna vista necesita DEFINER de verdad (ej. para un
-- endpoint público que cuenta stats globales), se debe documentar
-- explícitamente con `WITH (security_definer = true)` Y un comentario
-- de por qué, y excluirla del linter caso por caso.

-- 11.1 v_mi_semana
-- DROP + CREATE (no se puede ALTER VIEW para cambiar el atributo).
drop view if exists public.v_mi_semana;
create view public.v_mi_semana
  with (security_invoker = true)
as
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

comment on view public.v_mi_semana is
  'Vista para la pantalla "Mi semana" del miembro. SECURITY INVOKER: las '
  'RLS de servicios / asignaciones_servicio se aplican al caller. Filtros '
  'adicionales: estado=programado y servicios de las próximas 2 semanas.';

-- 11.2 v_asistencia_servicio
drop view if exists public.v_asistencia_servicio;
create view public.v_asistencia_servicio
  with (security_invoker = true)
as
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

comment on view public.v_asistencia_servicio is
  'Contadores de asistencia por servicio. SECURITY INVOKER: RLS sobre '
  'servicios / asignaciones_servicio / estados_asistencia_servicio aplica '
  'al caller. NO incluye q_sin_cerrar: las filas de estados_asistencia_servicio '
  'se crean al asignar (con default asistio), por lo que ese contador sería 0.';
