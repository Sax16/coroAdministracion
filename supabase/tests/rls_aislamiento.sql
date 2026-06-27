-- =============================================================================
-- supabase/tests/rls_aislamiento.sql
-- =============================================================================
-- Suite de aislamiento multi-tenant (RLS). Verifica el invariante central del
-- proyecto: "un usuario NUNCA puede ver ni tocar datos de un grupo al que no
-- pertenece" (docs/02 §2, docs/04 §5-6).
--
-- Cómo correrlo:
--   - Pegá TODO este archivo en el SQL Editor de Supabase y ejecutá; o
--   - psql "$DATABASE_URL" -f supabase/tests/rls_aislamiento.sql
--
-- Garantías de seguridad del test:
--   - Todo corre dentro de begin; ... rollback;  => NO persiste nada en la DB
--     (ni los usuarios de prueba ni los grupos). Es seguro correrlo contra dev.
--   - Crea 2 usuarios reales en auth.users (dispara el trigger handle_new_user
--     que crea sus perfiles) y 2 grupos vía la RPC crear_grupo().
--   - Simula a cada usuario con `set local role authenticated` +
--     `request.jwt.claims` (sub = su uuid). El rol `authenticated` NO tiene
--     BYPASSRLS, así que las policies se aplican igual que para la app real.
--
-- Cómo leer el resultado:
--   - Cada check emite un NOTICE con prefijo OK / FAIL.
--   - Al final, un NOTICE de RESUMEN. Si hubo >=1 FAIL, lanza una excepción
--     (la verás como error rojo) — eso significa un agujero de RLS a corregir.
--   - Los controles positivos (A ve lo suyo) garantizan que el arnés realmente
--     está aplicando RLS como el usuario y no como superusuario (que bypassea).
--
-- Mantenimiento: agregá un check por cada tabla/policy nueva (regla de docs/06
-- §6: toda tabla con grupo_id nace con RLS y con su test de aislamiento).
-- =============================================================================

begin;

do $$
declare
  uid_a uuid := gen_random_uuid();
  uid_b uuid := gen_random_uuid();
  claims_a text;
  claims_b text;

  gA uuid;  gB uuid;          -- grupos
  servA uuid; servB uuid;     -- servicios
  ugB uuid;                   -- membresía de B en gB (para asignaciones / RPC)

  total int := 0;
  fallos int := 0;
  n int;

  r record;
begin
  claims_a := json_build_object('sub', uid_a::text, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', uid_b::text, 'role', 'authenticated')::text;

  raise notice '=============================================================';
  raise notice ' SUITE DE AISLAMIENTO RLS — inicio';
  raise notice '=============================================================';

  -- ---------------------------------------------------------------------------
  -- SETUP (como superusuario: insertar en auth.users dispara handle_new_user)
  -- ---------------------------------------------------------------------------
  insert into auth.users
    (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
     created_at, updated_at, email_confirmed_at)
  values
    ('00000000-0000-0000-0000-000000000000', uid_a, 'authenticated', 'authenticated',
     'rls_test_a@example.test',
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('nombre', 'Usuario A', 'apellido', 'RLS'),
     now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', uid_b, 'authenticated', 'authenticated',
     'rls_test_b@example.test',
     '{"provider":"email","providers":["email"]}'::jsonb,
     jsonb_build_object('nombre', 'Usuario B', 'apellido', 'RLS'),
     now(), now(), now());

  -- A partir de acá actuamos como usuarios autenticados (RLS aplica).
  execute 'set local role authenticated';

  -- ----- Usuario A: crea grupo A + datos -----
  perform set_config('request.jwt.claims', claims_a, true);
  gA := public.crear_grupo('Grupo A (test RLS)');
  insert into public.servicios (grupo_id, tipo, fecha_inicio, estado)
    values (gA, 'servicio', now() + interval '2 days', 'programado')
    returning id into servA;
  insert into public.comunicados (grupo_id, titulo, descripcion)
    values (gA, 'Comunicado A', 'solo grupo A');
  insert into public.ensayos (grupo_id, titulo, fecha_inicio)
    values (gA, 'Ensayo A', now() + interval '1 day');

  -- ----- Usuario B: crea grupo B + datos -----
  perform set_config('request.jwt.claims', claims_b, true);
  gB := public.crear_grupo('Grupo B (test RLS)');
  insert into public.servicios (grupo_id, tipo, fecha_inicio, estado)
    values (gB, 'servicio', now() + interval '2 days', 'programado')
    returning id into servB;
  insert into public.comunicados (grupo_id, titulo, descripcion)
    values (gB, 'Comunicado B', 'solo grupo B');
  insert into public.ensayos (grupo_id, titulo, fecha_inicio)
    values (gB, 'Ensayo B', now() + interval '1 day');

  select id into ugB
    from public.usuarios_grupos
    where usuario_id = uid_b and grupo_id = gB;
  insert into public.asignaciones_servicio (servicio_id, usuario_grupo_id, rol_servicio)
    values (servB, ugB, 'cantante');
  insert into public.dispositivos (usuario_id, expo_push_token)
    values (uid_b, 'ExponentPushToken[rls-test-B]');
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo)
    values (uid_b, 'comunicado_publicado', 'Notif B', 'privada de B');

  -- ===========================================================================
  -- A PARTIR DE ACÁ: actuamos como Usuario A e intentamos alcanzar datos de B
  -- ===========================================================================
  perform set_config('request.jwt.claims', claims_a, true);

  -- ---------------------------------------------------------------------------
  -- 1) CONTROLES POSITIVOS — A debe ver lo SUYO (valida que el arnés aplica
  --    RLS como A; si esto falla, los checks negativos no prueban nada).
  -- ---------------------------------------------------------------------------
  total := total + 1;
  select count(*) into n from public.servicios where id = servA;
  if n = 1 then raise notice 'OK   [control+] A ve su propio servicio';
  else fallos := fallos + 1; raise notice 'FAIL [control+] A NO ve su propio servicio (n=%) — arnés mal configurado', n; end if;

  total := total + 1;
  select count(*) into n from public.usuarios_grupos where grupo_id = gA;
  if n >= 1 then raise notice 'OK   [control+] A ve su membresía en grupo A';
  else fallos := fallos + 1; raise notice 'FAIL [control+] A NO ve su membresía en A (n=%)', n; end if;

  -- ---------------------------------------------------------------------------
  -- 2) AISLAMIENTO DE LECTURA — A NO debe ver NADA del grupo B (esperado: 0)
  -- ---------------------------------------------------------------------------
  for r in
    select * from (values
      ('servicios de B',                 format('select count(*) from public.servicios where grupo_id = %L', gB)),
      ('ensayos de B',                   format('select count(*) from public.ensayos where grupo_id = %L', gB)),
      ('comunicados de B',               format('select count(*) from public.comunicados where grupo_id = %L', gB)),
      ('membresías (usuarios_grupos) B', format('select count(*) from public.usuarios_grupos where grupo_id = %L', gB)),
      ('patrón recurrente de B',         format('select count(*) from public.patrones_recurrentes where grupo_id = %L', gB)),
      ('asignaciones del servicio B',    format('select count(*) from public.asignaciones_servicio where servicio_id = %L', servB)),
      ('dispositivos de B (user-scope)', format('select count(*) from public.dispositivos where usuario_id = %L', uid_b)),
      ('notificaciones de B (user-scope)', format('select count(*) from public.notificaciones where usuario_id = %L', uid_b))
    ) as t(descripcion, q)
  loop
    total := total + 1;
    execute r.q into n;
    if n = 0 then raise notice 'OK   [lectura] A no ve %', r.descripcion;
    else fallos := fallos + 1; raise notice 'FAIL [lectura] A ve % (n=%) — FUGA ENTRE GRUPOS', r.descripcion, n; end if;
  end loop;

  -- Nota de diseño: `grupos` es la ÚNICA excepción intencional. La policy de
  -- descubrimiento (RF-020) permite a cualquier autenticado VER la fila de un
  -- grupo activo (para poder solicitar unirse). Verificamos ese comportamiento
  -- esperado. (La app debe proyectar solo columnas seguras: id/nombre/desc.)
  total := total + 1;
  select count(*) into n from public.grupos where id = gB;
  if n = 1 then raise notice 'OK   [descubrir] A ve la FILA de grupo B (intencional, RF-020)';
  else fallos := fallos + 1; raise notice 'FAIL [descubrir] descubrimiento de grupos roto (n=%)', n; end if;

  -- ---------------------------------------------------------------------------
  -- 3) AISLAMIENTO DE ESCRITURA — A NO debe poder modificar datos de B
  -- ---------------------------------------------------------------------------

  -- 3a. INSERT en grupo B: la policy WITH CHECK debe lanzar error.
  total := total + 1;
  begin
    insert into public.servicios (grupo_id, tipo, fecha_inicio)
      values (gB, 'servicio', now() + interval '5 days');
    fallos := fallos + 1;
    raise notice 'FAIL [escritura] A pudo INSERTAR un servicio en grupo B';
  exception when others then
    raise notice 'OK   [escritura] A no pudo insertar servicio en B (%)', sqlerrm;
  end;

  total := total + 1;
  begin
    insert into public.comunicados (grupo_id, titulo, descripcion)
      values (gB, 'hack', 'intruso');
    fallos := fallos + 1;
    raise notice 'FAIL [escritura] A pudo INSERTAR un comunicado en grupo B';
  exception when others then
    raise notice 'OK   [escritura] A no pudo insertar comunicado en B (%)', sqlerrm;
  end;

  -- 3b. UPDATE de una fila de B: RLS la deja invisible => 0 filas afectadas.
  total := total + 1;
  update public.servicios set titulo = 'hackeado por A' where id = servB;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK   [escritura] A no pudo MODIFICAR el servicio de B (0 filas)';
  else fallos := fallos + 1; raise notice 'FAIL [escritura] A modificó % fila(s) del servicio de B', n; end if;

  -- 3c. DELETE de una fila de B: igual, 0 filas afectadas.
  total := total + 1;
  delete from public.servicios where id = servB;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'OK   [escritura] A no pudo BORRAR el servicio de B (0 filas)';
  else fallos := fallos + 1; raise notice 'FAIL [escritura] A borró % fila(s) del servicio de B', n; end if;

  -- ---------------------------------------------------------------------------
  -- 4) OPERACIONES PRIVILEGIADAS (SECURITY DEFINER) — deben rechazar a A
  -- ---------------------------------------------------------------------------

  total := total + 1;
  begin
    perform public.eliminar_grupo(gB);
    fallos := fallos + 1;
    raise notice 'FAIL [rpc] A pudo ejecutar eliminar_grupo(B)';
  exception when others then
    raise notice 'OK   [rpc] eliminar_grupo(B) rechazado para A (%)', sqlerrm;
  end;

  total := total + 1;
  begin
    perform public.transferir_admin(gB, ugB);
    fallos := fallos + 1;
    raise notice 'FAIL [rpc] A pudo ejecutar transferir_admin sobre B';
  exception when others then
    raise notice 'OK   [rpc] transferir_admin(B) rechazado para A (%)', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- RESUMEN
  -- ---------------------------------------------------------------------------
  raise notice '=============================================================';
  raise notice ' RESUMEN: % checks · % OK · % FALLOS', total, total - fallos, fallos;
  raise notice '=============================================================';

  if fallos > 0 then
    raise exception 'AISLAMIENTO RLS: % de % checks FALLARON (ver NOTICEs arriba)', fallos, total;
  end if;
end $$;

-- Deshace TODO: usuarios, grupos y datos de prueba. La DB queda intacta.
rollback;
