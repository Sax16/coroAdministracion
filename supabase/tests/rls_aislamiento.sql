-- =============================================================================
-- supabase/tests/rls_aislamiento.sql
-- =============================================================================
-- Suite de seguridad de RLS multi-tenant. Dos bloques:
--   A) AISLAMIENTO ENTRE GRUPOS — un usuario no ve ni toca datos de un grupo
--      al que no pertenece.
--   B) AISLAMIENTO INTRA-GRUPO — dentro del MISMO grupo, un `miembro` no-admin
--      no puede hacer lo reservado al `admin`, no puede escalar su rol, solo
--      gestiona lo propio (justificaciones), y el cierre de asistencia respeta
--      "admin o responsable del servicio".
--
-- Cómo correrlo:
--   - Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá; o
--   - psql "$DATABASE_URL" -f supabase/tests/rls_aislamiento.sql
--
-- Garantías de seguridad del test:
--   - Todo corre dentro de begin; ... rollback;  => NO persiste nada en la DB.
--   - Crea usuarios reales en auth.users (dispara handle_new_user -> perfiles)
--     y grupos vía crear_grupo(). Simula a cada uno con `set local role
--     authenticated` + request.jwt.claims (sub = su uuid). El rol authenticated
--     NO tiene BYPASSRLS, así que las policies se aplican como en la app real.
--
-- Cómo leer el resultado:
--   - Cada check emite un NOTICE OK / FAIL. Al final, un NOTICE de RESUMEN.
--   - Si hubo >=1 FAIL, lanza una excepción (error rojo) = agujero de RLS.
--   - Los controles positivos garantizan que el arnés aplica RLS como el
--     usuario (no como superusuario, que bypassea) — si fallan, los negativos
--     no prueban nada.
--
-- Mantenimiento (docs/06 §6): toda tabla/policy nueva suma su check acá.
-- =============================================================================

begin;

do $$
declare
  -- usuarios
  uid_a uuid := gen_random_uuid();   -- admin grupo A
  uid_b uuid := gen_random_uuid();   -- admin grupo B (ajeno)
  uid_m uuid := gen_random_uuid();   -- miembro de A (y responsable de servA)
  uid_n uuid := gen_random_uuid();   -- otro miembro de A (no responsable)
  claims_a text; claims_b text; claims_m text; claims_n text;

  gA uuid; gB uuid;                  -- grupos
  servA uuid; servB uuid;            -- servicios
  ugA uuid; ugB uuid; ugM uuid; ugN uuid;  -- membresías
  estadoId uuid;                     -- estado_asistencia de la asignación de M
  solId uuid;                        -- solicitud de B para unirse a A

  total int := 0;
  fallos int := 0;
  n int;
  r record;
begin
  claims_a := json_build_object('sub', uid_a::text, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', uid_b::text, 'role', 'authenticated')::text;
  claims_m := json_build_object('sub', uid_m::text, 'role', 'authenticated')::text;
  claims_n := json_build_object('sub', uid_n::text, 'role', 'authenticated')::text;

  raise notice '=============================================================';
  raise notice ' SUITE DE SEGURIDAD RLS — inicio';
  raise notice '=============================================================';

  -- ---------------------------------------------------------------------------
  -- SETUP (como superusuario: insertar en auth.users dispara handle_new_user)
  -- ---------------------------------------------------------------------------
  insert into auth.users
    (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
     created_at, updated_at, email_confirmed_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('nombre', u.nom, 'apellido', 'RLS'),
         now(), now(), now()
  from (values
    (uid_a, 'rls_test_a@example.test', 'Admin A'),
    (uid_b, 'rls_test_b@example.test', 'Admin B'),
    (uid_m, 'rls_test_m@example.test', 'Miembro M'),
    (uid_n, 'rls_test_n@example.test', 'Miembro N')
  ) as u(id, email, nom);

  -- A partir de acá actuamos como usuarios autenticados (RLS aplica).
  execute 'set local role authenticated';

  -- ----- Admin A: grupo A + datos + miembros M/N + responsable/asignación -----
  perform set_config('request.jwt.claims', claims_a, true);
  gA := public.crear_grupo('Grupo A (test RLS)');
  insert into public.servicios (grupo_id, tipo, fecha_inicio, estado)
    values (gA, 'servicio', now() + interval '2 days', 'programado') returning id into servA;
  insert into public.comunicados (grupo_id, titulo, descripcion) values (gA, 'Comunicado A', 'de A');
  insert into public.ensayos (grupo_id, titulo, fecha_inicio) values (gA, 'Ensayo A', now() + interval '1 day');

  select id into ugA from public.usuarios_grupos where usuario_id = uid_a and grupo_id = gA;
  insert into public.usuarios_grupos (usuario_id, grupo_id, rol, estado) values
    (uid_m, gA, 'miembro', 'activo'),
    (uid_n, gA, 'miembro', 'activo');
  select id into ugM from public.usuarios_grupos where usuario_id = uid_m and grupo_id = gA;
  select id into ugN from public.usuarios_grupos where usuario_id = uid_n and grupo_id = gA;

  -- M es el responsable de servA y está asignado (la asignación crea el estado).
  update public.servicios set responsable_id = uid_m where id = servA;
  insert into public.asignaciones_servicio (servicio_id, usuario_grupo_id, rol_servicio)
    values (servA, ugM, 'cantante');
  select eas.id into estadoId
    from public.estados_asistencia_servicio eas
    join public.asignaciones_servicio a on a.id = eas.asignacion_id
    where a.servicio_id = servA and a.usuario_grupo_id = ugM;

  -- ----- Admin B: grupo B + datos (ajeno a A) -----
  perform set_config('request.jwt.claims', claims_b, true);
  gB := public.crear_grupo('Grupo B (test RLS)');
  insert into public.servicios (grupo_id, tipo, fecha_inicio, estado)
    values (gB, 'servicio', now() + interval '2 days', 'programado') returning id into servB;
  insert into public.comunicados (grupo_id, titulo, descripcion) values (gB, 'Comunicado B', 'de B');
  insert into public.ensayos (grupo_id, titulo, fecha_inicio) values (gB, 'Ensayo B', now() + interval '1 day');
  select id into ugB from public.usuarios_grupos where usuario_id = uid_b and grupo_id = gB;
  insert into public.asignaciones_servicio (servicio_id, usuario_grupo_id, rol_servicio)
    values (servB, ugB, 'cantante');
  insert into public.dispositivos (usuario_id, expo_push_token) values (uid_b, 'ExponentPushToken[rls-test-B]');
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo)
    values (uid_b, 'comunicado_publicado', 'Notif B', 'privada de B');
  -- B solicita unirse a A (para el test de aprobar_solicitud por un no-admin).
  insert into public.solicitudes_grupo (grupo_id, usuario_id, estado)
    values (gA, uid_b, 'pendiente') returning id into solId;

  -- ===========================================================================
  -- BLOQUE A — AISLAMIENTO ENTRE GRUPOS  (actuamos como A contra datos de B)
  -- ===========================================================================
  perform set_config('request.jwt.claims', claims_a, true);

  -- A1) Controles positivos: A ve lo suyo (valida el arnés)
  total := total + 1;
  select count(*) into n from public.servicios where id = servA;
  if n = 1 then raise notice 'OK   [A·control+] A ve su propio servicio';
  else fallos := fallos + 1; raise notice 'FAIL [A·control+] A NO ve su servicio (n=%) — arnés mal configurado', n; end if;

  total := total + 1;
  select count(*) into n from public.usuarios_grupos where grupo_id = gA;
  if n >= 1 then raise notice 'OK   [A·control+] A ve las membresías de su grupo';
  else fallos := fallos + 1; raise notice 'FAIL [A·control+] A NO ve membresías de A (n=%)', n; end if;

  -- A2) Lectura: A no ve NADA del grupo B (esperado 0)
  for r in select * from (values
      ('servicios de B',                 format('select count(*) from public.servicios where grupo_id = %L', gB)),
      ('ensayos de B',                   format('select count(*) from public.ensayos where grupo_id = %L', gB)),
      ('comunicados de B',               format('select count(*) from public.comunicados where grupo_id = %L', gB)),
      ('membresías de B',                format('select count(*) from public.usuarios_grupos where grupo_id = %L', gB)),
      ('patrón de B',                    format('select count(*) from public.patrones_recurrentes where grupo_id = %L', gB)),
      ('asignaciones del servicio B',    format('select count(*) from public.asignaciones_servicio where servicio_id = %L', servB)),
      ('dispositivos de B (user-scope)', format('select count(*) from public.dispositivos where usuario_id = %L', uid_b)),
      ('notificaciones de B (user-scope)', format('select count(*) from public.notificaciones where usuario_id = %L', uid_b))
    ) as t(descripcion, q)
  loop
    total := total + 1; execute r.q into n;
    if n = 0 then raise notice 'OK   [A·lectura] A no ve %', r.descripcion;
    else fallos := fallos + 1; raise notice 'FAIL [A·lectura] A ve % (n=%) — FUGA ENTRE GRUPOS', r.descripcion, n; end if;
  end loop;

  -- Excepción intencional: descubrimiento de grupos (RF-020). A ve la FILA de B.
  total := total + 1;
  select count(*) into n from public.grupos where id = gB;
  if n = 1 then raise notice 'OK   [A·descubrir] A ve la fila de grupo B (intencional RF-020)';
  else fallos := fallos + 1; raise notice 'FAIL [A·descubrir] descubrimiento roto (n=%)', n; end if;

  -- A3) Escritura cruzada: INSERT lanza, UPDATE/DELETE afectan 0 filas
  total := total + 1;
  begin
    insert into public.servicios (grupo_id, tipo, fecha_inicio) values (gB, 'servicio', now() + interval '5 days');
    fallos := fallos + 1; raise notice 'FAIL [A·escritura] A insertó servicio en B';
  exception when others then raise notice 'OK   [A·escritura] A no pudo insertar en B (%)', sqlerrm; end;

  total := total + 1;
  update public.servicios set titulo = 'hack' where id = servB; get diagnostics n = row_count;
  if n = 0 then raise notice 'OK   [A·escritura] A no pudo MODIFICAR servicio de B (0 filas)';
  else fallos := fallos + 1; raise notice 'FAIL [A·escritura] A modificó % fila(s) de B', n; end if;

  total := total + 1;
  delete from public.servicios where id = servB; get diagnostics n = row_count;
  if n = 0 then raise notice 'OK   [A·escritura] A no pudo BORRAR servicio de B (0 filas)';
  else fallos := fallos + 1; raise notice 'FAIL [A·escritura] A borró % fila(s) de B', n; end if;

  -- A4) RPC privilegiadas: rechazan al ajeno
  total := total + 1;
  begin perform public.eliminar_grupo(gB);
    fallos := fallos + 1; raise notice 'FAIL [A·rpc] A ejecutó eliminar_grupo(B)';
  exception when others then raise notice 'OK   [A·rpc] eliminar_grupo(B) rechazado (%)', sqlerrm; end;

  total := total + 1;
  begin perform public.transferir_admin(gB, ugB);
    fallos := fallos + 1; raise notice 'FAIL [A·rpc] A ejecutó transferir_admin(B)';
  exception when others then raise notice 'OK   [A·rpc] transferir_admin(B) rechazado (%)', sqlerrm; end;

  -- ===========================================================================
  -- BLOQUE B — AISLAMIENTO INTRA-GRUPO  (M = miembro no-admin del grupo A)
  -- ===========================================================================
  perform set_config('request.jwt.claims', claims_m, true);

  -- B1) Controles positivos: el miembro SÍ ve los datos de su grupo
  for r in select * from (values
      ('servicios de su grupo',   format('select count(*) from public.servicios where grupo_id = %L', gA)),
      ('comunicados de su grupo', format('select count(*) from public.comunicados where grupo_id = %L', gA)),
      ('membresías de su grupo',  format('select count(*) from public.usuarios_grupos where grupo_id = %L', gA)),
      ('patrón de su grupo',      format('select count(*) from public.patrones_recurrentes where grupo_id = %L', gA))
    ) as t(descripcion, q)
  loop
    total := total + 1; execute r.q into n;
    if n >= 1 then raise notice 'OK   [M·control+] miembro ve %', r.descripcion;
    else fallos := fallos + 1; raise notice 'FAIL [M·control+] miembro NO ve % (n=%)', r.descripcion, n; end if;
  end loop;

  -- B2) Escritura reservada a admin: INSERT debe lanzar
  for r in select * from (values
      ('servicio en su grupo',   format('insert into public.servicios (grupo_id,tipo,fecha_inicio) values (%L,''servicio'',now()+interval ''9 days'')', gA)),
      ('comunicado en su grupo', format('insert into public.comunicados (grupo_id,titulo,descripcion) values (%L,''x'',''y'')', gA)),
      ('ensayo en su grupo',     format('insert into public.ensayos (grupo_id,titulo,fecha_inicio) values (%L,''x'',now()+interval ''9 days'')', gA)),
      ('asignación en su grupo', format('insert into public.asignaciones_servicio (servicio_id,usuario_grupo_id,rol_servicio) values (%L,%L,''musico'')', servA, ugN)),
      ('agregar un miembro',     format('insert into public.usuarios_grupos (usuario_id,grupo_id,rol,estado) values (%L,%L,''miembro'',''activo'')', uid_b, gA))
    ) as t(descripcion, q)
  loop
    total := total + 1;
    begin execute r.q;
      fallos := fallos + 1; raise notice 'FAIL [M·escritura] miembro pudo: %', r.descripcion;
    exception when others then raise notice 'OK   [M·escritura] miembro no pudo % (%)', r.descripcion, sqlerrm; end;
  end loop;

  -- B3) Escritura reservada a admin: UPDATE/DELETE afectan 0 filas
  --     (incluye el intento de ESCALADA DE PRIVILEGIOS: auto-promoverse a admin)
  for r in select * from (values
      ('modificar un servicio',    format('update public.servicios set titulo=''x'' where id=%L', servA)),
      ('borrar un servicio',       format('delete from public.servicios where id=%L', servA)),
      ('editar el grupo',          format('update public.grupos set nombre=''x'' where id=%L', gA)),
      ('editar el patrón',         format('update public.patrones_recurrentes set offset_alarma_min=999 where grupo_id=%L', gA)),
      ('AUTO-PROMOVERSE a admin',  format('update public.usuarios_grupos set rol=''admin'' where usuario_id=%L and grupo_id=%L', uid_m, gA))
    ) as t(descripcion, q)
  loop
    total := total + 1; execute r.q; get diagnostics n = row_count;
    if n = 0 then raise notice 'OK   [M·escritura] miembro no afectó filas al %', r.descripcion;
    else fallos := fallos + 1; raise notice 'FAIL [M·escritura] miembro afectó % fila(s) al % — RIESGO', n, r.descripcion; end if;
  end loop;

  -- B4) Self-scope de justificaciones: M gestiona la SUYA, no la de otro
  total := total + 1;
  begin
    insert into public.justificaciones_servicio (servicio_id, usuario_grupo_id, texto)
      values (servA, ugM, 'No puedo asistir');
    raise notice 'OK   [M·self] miembro pudo justificar lo SUYO';
  exception when others then
    fallos := fallos + 1; raise notice 'FAIL [M·self] miembro NO pudo justificar lo suyo (%)', sqlerrm;
  end;

  total := total + 1;
  begin
    insert into public.justificaciones_servicio (servicio_id, usuario_grupo_id, texto)
      values (servA, ugA, 'Justificando por el admin');
    fallos := fallos + 1; raise notice 'FAIL [M·self] miembro justificó EN NOMBRE de otro (ugA)';
  exception when others then
    raise notice 'OK   [M·self] miembro no pudo justificar por otro (%)', sqlerrm;
  end;

  -- B5) Cierre de asistencia (estados_asistencia): "admin o responsable"
  --     M es responsable de servA => PUEDE cerrar (1 fila).
  total := total + 1;
  update public.estados_asistencia_servicio set estado = 'no_asistio' where id = estadoId;
  get diagnostics n = row_count;
  if n = 1 then raise notice 'OK   [M·cierre] responsable pudo cerrar asistencia (1 fila)';
  else fallos := fallos + 1; raise notice 'FAIL [M·cierre] responsable no pudo cerrar (n=%)', n; end if;

  -- B6) RPC privilegiadas sobre su PROPIO grupo: el miembro es rechazado
  for r in select * from (values
      ('eliminar_grupo(A)',     format('select public.eliminar_grupo(%L)', gA)),
      ('transferir_admin(A)',   format('select public.transferir_admin(%L,%L)', gA, ugN)),
      ('aprobar_solicitud(A)',  format('select public.aprobar_solicitud(%L)', solId))
    ) as t(descripcion, q)
  loop
    total := total + 1;
    begin execute r.q;
      fallos := fallos + 1; raise notice 'FAIL [M·rpc] miembro ejecutó %', r.descripcion;
    exception when others then raise notice 'OK   [M·rpc] % rechazado para el miembro (%)', r.descripcion, sqlerrm; end;
  end loop;

  -- ===========================================================================
  -- BLOQUE B (cont.) — N = otro miembro, NO responsable de servA
  -- ===========================================================================
  perform set_config('request.jwt.claims', claims_n, true);

  -- N no es admin ni responsable => NO puede cerrar la asistencia (0 filas)
  total := total + 1;
  update public.estados_asistencia_servicio set estado = 'asistio' where id = estadoId;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK   [N·cierre] miembro no-responsable no pudo cerrar (0 filas)';
  else fallos := fallos + 1; raise notice 'FAIL [N·cierre] miembro no-responsable cerró % fila(s) — RIESGO', n; end if;

  -- ---------------------------------------------------------------------------
  -- RESUMEN
  -- ---------------------------------------------------------------------------
  raise notice '=============================================================';
  raise notice ' RESUMEN: % checks · % OK · % FALLOS', total, total - fallos, fallos;
  raise notice '=============================================================';

  if fallos > 0 then
    raise exception 'SEGURIDAD RLS: % de % checks FALLARON (ver NOTICEs arriba)', fallos, total;
  end if;
end $$;

-- Deshace TODO: usuarios, grupos y datos de prueba. La DB queda intacta.
rollback;
