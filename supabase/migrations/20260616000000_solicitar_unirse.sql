-- =============================================================================
-- 20260616000000_solicitar_unirse.sql
-- =============================================================================
-- Migración incremental: habilita el RF-020 (solicitar unirse a grupo
-- existente).
--
-- Cambio:
-- La policy original de SELECT en `public.grupos` solo dejaba ver los
-- grupos de los que el usuario es miembro activo. Para que un usuario
-- pueda BUSCAR y DESCUBRIR grupos existentes a los que NO pertenece
-- (RF-020), necesitamos abrir la lectura a todos los autenticados para
-- grupos activos (no soft-deleted).
--
-- Decisión de seguridad:
-- - Cualquier autenticado puede SELECT de `grupos` siempre que
--   `deleted_at IS NULL` (no soft-deleted). Esto le da visibilidad
--   para descubrir y solicitar ingreso.
-- - Los grupos soft-deleted siguen invisibles.
-- - La app, en la pantalla de búsqueda, SOLO proyecta campos seguros
--   (id, nombre, descripcion) — no expone admin_id, zona_horaria u
--   otros datos sensibles. Pero como la RLS filtra a nivel de fila
--   y no de columna, la app DEBE ser cuidadosa de no seleccionar
--   otras columnas en esa vista.
-- - El INSERT en `grupos` (RF-010) sigue siendo "solo autenticado",
--   no se abrió.
-- - El UPDATE/DELETE sigue siendo "solo admin del grupo".
--
-- Esta migración es idempotente.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Refinar la policy de SELECT en `public.grupos`
-- ----------------------------------------------------------------------------
drop policy if exists "grupos: ver los de mi grupo" on public.grupos;
create policy "grupos: ver los activos para descubrir y gestionar"
  on public.grupos for select
  using (
    -- Caso 1: miembro activo del grupo (puede ver detalle completo)
    id in (select public.usuario_grupos_activos(auth.uid()))
    -- Caso 2: cualquier autenticado puede listar grupos activos
    -- (no soft-deleted) para descubrir y solicitar ingreso
    or (
      auth.role() = 'authenticated'
      and deleted_at is null
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Grant explícito a la función aprobar_solicitud (por si no estaba)
-- ----------------------------------------------------------------------------
-- La migración inicial ya otorga el grant, pero lo re-afirmamos
-- idempotentemente.
grant execute on function public.aprobar_solicitud(uuid) to authenticated;
