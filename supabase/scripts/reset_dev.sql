-- =============================================================================
-- ⚠️  SCRIPT DESTRUCTIVO — SOLO PARA DEV ⚠️
-- =============================================================================
-- Borra TODAS las tablas y enums del esquema de Coro Administración.
-- NO EJECUTAR EN PRODUCCIÓN NI EN STAGING.
--
-- Uso: cuando quieras resetear tu base de datos local de Supabase y volver
-- a aplicar la migración inicial limpia. El proyecto Supabase local se
-- levanta con `supabase db reset` (que ya llama a supabase/migrations/*),
-- pero si querés hacerlo a mano desde psql:
--
--   psql "$DATABASE_URL" -f supabase/scripts/reset_dev.sql
--   psql "$DATABASE_URL" -f supabase/migrations/20260614000000_initial_schema.sql
--
-- =============================================================================

-- Drop child tables first, then parents, then enums.
drop table if exists public.asistencias_ensayo      cascade;
drop table if exists public.invitados_ensayo        cascade;
drop table if exists public.estados_asistencia_servicio cascade;
drop table if exists public.asignaciones_servicio   cascade;
drop table if exists public.justificaciones_servicio cascade;
drop table if exists public.comunicados             cascade;
drop table if exists public.dispositivos            cascade;
drop table if exists public.ensayos                 cascade;
drop table if exists public.servicios               cascade;
drop table if exists public.patrones_recurrentes    cascade;
drop table if exists public.solicitudes_grupo       cascade;
drop table if exists public.usuarios_grupos         cascade;
drop table if exists public.grupos                  cascade;
drop table if exists public.perfiles                cascade;

drop type if exists public.estado_asistencia_ensayo_enum cascade;
drop type if exists public.estado_asistencia_enum         cascade;
drop type if exists public.estado_evento_enum             cascade;
drop type if exists public.estado_membresia_enum          cascade;
drop type if exists public.estado_solicitud_enum          cascade;
drop type if exists public.plataforma_enum                cascade;
drop type if exists public.rol_grupo_enum                 cascade;
drop type if exists public.rol_servicio_enum              cascade;
drop type if exists public.tipo_evento_enum               cascade;
