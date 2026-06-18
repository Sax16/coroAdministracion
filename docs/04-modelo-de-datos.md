# 04 · Modelo de Datos

> Diseñado para PostgreSQL 15+ (Supabase). Multi-tenant estricto: cada fila de cualquier tabla tiene `grupo_id` (directo o transitivo) y RLS lo enforza. Última revisión: 2026-06-10 (post-auditoría).

## Cambios respecto a la versión anterior

Esta versión corrige los hallazgos de la auditoría realizada el 2026-06-10. Ver `CHANGELOG-AUDITORIA.md` para el detalle. Los más importantes:

- Helper functions movidas de `auth.` a `public.` (Supabase no recomienda crear funciones en `auth`).
- RLS de `usuarios_grupos` permite la auto-inserción del fundador como Admin.
- Nueva function `transferir_admin()` con SECURITY DEFINER para hacer la transición atómica.
- RLS de `estados_asistencia_servicio` y `asistencias_ensayo` valida responsable/encargado concreto del evento, no solo "responsable + admin".
- UK `(grupo_id, fecha_inicio)` en `servicios` para que `ON CONFLICT` del trigger de generación funcione.
- UK de `solicitudes_grupo` convertida a partial unique index (PostgreSQL no soporta UK parciales como constraint).
- Nueva tabla `dispositivos` para guardar Expo push tokens.
- Vista `v_mi_semana` reescrita para agrupar roles por servicio.
- Decisión documentada: `estados_asistencia_servicio` se crea al asignar (con default `asistio`), no al cerrar.
- Decisión documentada: el trigger de patrón usa upsert; servicios cancelados manualmente NO se resucitan.
- Validación de que `responsable_id` y `encargado_id` sean miembros activos del grupo.
- Índices de performance documentados.

## 1. Diagrama entidad–relación (texto)

```
                          ┌──────────────┐
                          │ auth.users   │  (Supabase Auth, gestionado)
                          └──────┬───────┘
                                 │ 1
                                 │
                          ┌──────┴───────┐
                          │  perfiles    │  (1:1 con auth.users)
                          └──────┬───────┘
                                 │ 1
                                 │
                          ┌──────┴───────┐ N
                          │usuarios_     │ ← tabla de unión
                          │  grupos      │    (rol + estado)
                          └──────┬───────┘
                                 │ N
                                 │
                          ┌──────┴───────┐ 1
                          │   grupos     │
                          └──────┬───────┘
                                 │
       ┌─────────────┬───────────┼───────────┬─────────────────────┐
       │ 1           │ 1         │ 1         │ 1                   │ 1
       │             │           │           │                     │
       ▼ *           ▼ *         ▼ *         ▼ *                   ▼ *
┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐      ┌────────────┐
│solicitudes │ │ patrones_  │ │servicios │ │ ensayos  │      │comunicados │
│  _grupo    │ │ recurrentes│ └────┬─────┘ └────┬─────┘      └────────────┘
└────────────┘ └────────────┘      │            │
                                   │ 1          │ 1
                              ┌────┴─────┐      │
                              │          │      │
                              ▼ *        ▼ *    ▼ *
                       ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐
                       │asignac.  │ │justificac.   │ │invitados_  │ │asistencias_│
                       │_servicio │ │_servicio     │ │  ensayo    │ │  ensayo    │
                       └────┬─────┘ └──────────────┘ └────────────┘ └────────────┘
                            │ N
                            │
                            ▼ 1
                       ┌────────────┐
                       │usuarios_   │
                       │  grupos    │
                       └────────────┘

  (Estados de asistencia de servicio: tabla de hechos)
                              ┌──────────────────────┐
                              │estados_asistencia_   │
                              │    servicio          │
                              └──────────────────────┘
                              1:1 con asignaciones_servicio

  (Dispositivos para push: por usuario, no por grupo)
                              ┌────────────┐
                              │dispositivos│
                              └────────────┘
```

## 2. Tablas

### 2.1 `auth.users` (gestionado por Supabase)

No la creamos nosotros. Es donde Supabase Auth guarda el usuario. Nuestra `perfiles` se enlaza por `id`.

### 2.2 `perfiles`

Datos personales de la cuenta. **1:1 con `auth.users`**. No tiene `grupo_id` — es información de la persona, no de su membresía.

| Columna       | Tipo          | Notas                                          |
|---------------|---------------|------------------------------------------------|
| `id`          | `uuid` PK     | FK a `auth.users.id` ON DELETE CASCADE        |
| `nombre`      | `text` NOT NULL|                                                |
| `apellido`    | `text` NOT NULL|                                                |
| `email`       | `text` NOT NULL UNIQUE | espejado de `auth.users`                |
| `telefono`    | `text`        |                                                |
| `foto_url`    | `text`        |                                                |
| `created_at`  | `timestamptz` | default `now()`                                |
| `updated_at`  | `timestamptz` | default `now()`                                |

**Política de RLS para el trigger `handle_new_user()`:** la policy de INSERT en `perfiles` permite que el rol `service_role` (que es el que usa el trigger con `security definer`) inserte. Equivalente: la policy permite INSERT cuando `auth.uid() = new.id` O el actor es service_role.

### 2.3 `grupos`

| Columna         | Tipo          | Notas |
|-----------------|---------------|-------|
| `id`            | `uuid` PK     | default `gen_random_uuid()` |
| `nombre`        | `text` NOT NULL|       |
| `descripcion`   | `text`        |       |
| `admin_id`      | `uuid` NOT NULL| FK a `perfiles.id` (admin actual) |
| `zona_horaria`  | `text` NOT NULL default 'America/Lima' | IANA tz |
| `created_at`    | `timestamptz` |       |
| `updated_at`    | `timestamptz` |       |
| `deleted_at`    | `timestamptz` | soft delete |

UK: `admin_id` debe ser único entre grupos NO-eliminados? No, puede ser admin de varios. Sin UK extra.

> **Decisión de diseño:** guardamos `admin_id` redundante en `grupos` para evitar joins en queries frecuentes. La membresía Admin está **además** en `usuarios_grupos.rol = 'admin'`. Si se transfiere, se actualiza `grupos.admin_id` Y la fila correspondiente en `usuarios_grupos` (en una transacción vía la function `transferir_admin`).

### 2.4 `usuarios_grupos`

Tabla de unión persona ↔ grupo, con **rol** y **estado**. Esta es la fuente de verdad para "¿quién pertenece a qué grupo con qué rol".

| Columna       | Tipo                              | Notas |
|---------------|-----------------------------------|-------|
| `id`          | `uuid` PK                         |       |
| `usuario_id`  | `uuid` NOT NULL                   | FK a `perfiles.id` |
| `grupo_id`    | `uuid` NOT NULL                   | FK a `grupos.id` |
| `rol`         | `rol_grupo_enum` NOT NULL         | `admin` / `miembro` |
| `estado`      | `estado_membresia_enum` NOT NULL  | `activo` / `inactivo` |
| `fecha_ingreso` | `date` NOT NULL default `current_date` |  |
| `created_at`  | `timestamptz`                     |       |
| `updated_at`  | `timestamptz`                     |       |

UK: `(usuario_id, grupo_id)`.

**Enums:**

```sql
create type rol_grupo_enum as enum ('admin', 'miembro');
create type estado_membresia_enum as enum ('activo', 'inactivo');
```

### 2.5 `solicitudes_grupo`

Solicitudes de ingreso a un grupo. Cuando se aprueban, se crea fila en `usuarios_grupos`.

| Columna       | Tipo                              | Notas |
|---------------|-----------------------------------|-------|
| `id`          | `uuid` PK                         |       |
| `grupo_id`    | `uuid` NOT NULL                   | FK    |
| `usuario_id`  | `uuid` NOT NULL                   | FK al solicitante |
| `mensaje`     | `text`                            | opcional |
| `estado`      | `estado_solicitud_enum` NOT NULL  | `pendiente` / `aprobada` / `rechazada` |
| `respondida_por` | `uuid`                         | admin que respondió |
| `created_at`  | `timestamptz`                     |       |
| `respondida_at` | `timestamptz`                   |       |

> **UK parcial:** PostgreSQL no soporta UK condicionales como constraint. Usamos un **partial unique index**:
> ```sql
> create unique index uq_solicitud_pendiente 
>   on solicitudes_grupo (grupo_id, usuario_id) 
>   where estado = 'pendiente';
> ```
> Esto impide que un usuario tenga dos solicitudes `pendiente` al mismo grupo, pero permite múltiples `aprobada`/`rechazada` históricas.

**Enum:**

```sql
create type estado_solicitud_enum as enum ('pendiente', 'aprobada', 'rechazada');
```

### 2.6 `patrones_recurrentes`

Configuración semanal del grupo. **Una fila por grupo** (1:1).

| Columna            | Tipo          | Notas |
|--------------------|---------------|-------|
| `id`               | `uuid` PK     |       |
| `grupo_id`         | `uuid` NOT NULL UNIQUE | FK |
| `configuracion`    | `jsonb` NOT NULL | ver estructura abajo |
| `offset_alarma_min`| `int` NOT NULL default 60 | minutos antes del servicio |
| `semanas_generadas`| `int` NOT NULL default 4 | hasta dónde generar servicios |
| `updated_at`       | `timestamptz` |       |

**Estructura de `configuracion` (jsonb):**

```json
{
  "dias": {
    "1": [{"hora": "19:00"}],
    "2": [{"hora": "19:00"}],
    "3": [{"hora": "19:00"}],
    "4": [{"hora": "19:00"}],
    "5": [{"hora": "19:00"}],
    "6": [{"hora": "10:00"}, {"hora": "18:00"}],
    "0": []
  }
}
```

Claves: `"0"` = domingo, `"1"` = lunes, ..., `"6"` = sábado. Cada día es un array de horarios (soporta doble horario del domingo).

### 2.7 `servicios`

Servicios concretos generados del patrón o creados manualmente. **Una fila por servicio**.

| Columna        | Tipo                       | Notas |
|----------------|----------------------------|-------|
| `id`           | `uuid` PK                  |       |
| `grupo_id`     | `uuid` NOT NULL            | FK    |
| `tipo`         | `tipo_evento_enum` NOT NULL| siempre `servicio` en esta tabla |
| `titulo`       | `text`                     | ej. "Servicio de oración", "Culto familiar". Opcional. |
| `fecha_inicio` | `timestamptz` NOT NULL     |       |
| `fecha_fin`    | `timestamptz`              |       |
| `lugar`        | `text`                     |       |
| `descripcion`  | `text`                     |       |
| `notas_canciones` | `text`                  | **NUEVO**: setlist en texto libre. Reemplaza la mención de "canciones del repertorio (placeholder)" que era engañosa. |
| `estado`       | `estado_evento_enum` NOT NULL default 'programado' | `programado` / `cancelado` / `realizado` |
| `responsable_id` | `uuid`                   | FK a `perfiles.id`. Miembro que cierra la asistencia. |
| `asistencia_cerrada` | `boolean` NOT NULL default false |       |
| `asistencia_cerrada_at` | `timestamptz`       |       |
| `asistencia_cerrada_por` | `uuid`                | quién cerró |
| `created_at`   | `timestamptz`              |       |
| `updated_at`   | `timestamptz`              |       |

**Constraints críticos:**

```sql
-- Necesario para que el trigger de generación use ON CONFLICT
alter table servicios add constraint uq_servicios_grupo_fecha 
  unique (grupo_id, fecha_inicio);
```

### 2.8 `asignaciones_servicio`

Vínculo N:M entre `usuarios_grupos` y `servicios`, con un **rol de servicio**.

| Columna       | Tipo                     | Notas |
|---------------|--------------------------|-------|
| `id`          | `uuid` PK                |       |
| `servicio_id` | `uuid` NOT NULL          | FK ON DELETE CASCADE |
| `usuario_grupo_id` | `uuid` NOT NULL     | FK a `usuarios_grupos.id` ON DELETE CASCADE |
| `rol_servicio`| `rol_servicio_enum` NOT NULL | `cantante` / `musico` / `limpieza` |
| `created_at`  | `timestamptz`            |       |

UK: `(servicio_id, usuario_grupo_id, rol_servicio)` — un miembro no puede tener la misma asignación duplicada, pero sí varias con roles distintos.

**Enum:**

```sql
create type rol_servicio_enum as enum ('cantante', 'musico', 'limpieza');
```

> **Decisión:** `limpieza` no es un área, es una asignación. Un cantante puede tener una asignación `cantante` Y una `limpieza` en el mismo servicio.

### 2.9 `estados_asistencia_servicio` (tabla de hechos)

El estado final de cada asignación respecto al servicio.

| Columna             | Tipo                          | Notas |
|---------------------|-------------------------------|-------|
| `id`                | `uuid` PK                     |       |
| `asignacion_id`     | `uuid` NOT NULL UNIQUE        | FK a `asignaciones_servicio.id` |
| `estado`            | `estado_asistencia_enum` NOT NULL default 'asistio' | `asistio` / `no_asistio` / `justificado` |
| `set_by`            | `uuid`                        | FK a `perfiles.id` — quién hizo el último cambio (null si lo creó el sistema al asignar) |
| `updated_at`        | `timestamptz`                 |       |

> **Decisión crítica (de la auditoría):** la fila de `estados_asistencia_servicio` se crea **al momento de asignar** (no al cerrar asistencia), con `estado` por default `asistio`. Esto simplifica la query de "quién falta" y la vista de resumen. El responsable solo edita las filas que cambian de `asistio` a `no_asistio` o a `justificado`.

**Enum:**

```sql
create type estado_asistencia_enum as enum ('asistio', 'no_asistio', 'justificado');
```

### 2.10 `justificaciones_servicio`

Una justificación por (servicio, miembro). Texto libre.

| Columna       | Tipo           | Notas |
|---------------|----------------|-------|
| `id`          | `uuid` PK      |       |
| `servicio_id` | `uuid` NOT NULL| FK    |
| `usuario_grupo_id` | `uuid` NOT NULL | FK |
| `texto`       | `text` NOT NULL| texto libre |
| `created_at`  | `timestamptz`  |       |

UK: `(servicio_id, usuario_grupo_id)`.

### 2.11 `ensayos`

| Columna        | Tipo                       | Notas |
|----------------|----------------------------|-------|
| `id`           | `uuid` PK                  |       |
| `grupo_id`     | `uuid` NOT NULL            | FK    |
| `titulo`       | `text` NOT NULL            |       |
| `fecha_inicio` | `timestamptz` NOT NULL     |       |
| `fecha_fin`    | `timestamptz`              |       |
| `lugar`        | `text`                     |       |
| `descripcion`  | `text`                     |       |
| `tema`         | `text`                     | texto libre: canción o tema a ensayar |
| `estado`       | `estado_evento_enum` NOT NULL default 'programado' | `programado` / `cancelado` / `realizado` |
| `encargado_id` | `uuid`                     | FK a `perfiles.id` — el Encargado del ensayo |
| `asistencia_cerrada` | `boolean` NOT NULL default false | |
| `asistencia_cerrada_at` | `timestamptz`        | |
| `asistencia_cerrada_por` | `uuid`              | |
| `created_at`   | `timestamptz`              |       |
| `updated_at`   | `timestamptz`              |       |

### 2.12 `invitados_ensayo`

Quién fue invitado al ensayo.

| Columna       | Tipo           | Notas |
|---------------|----------------|-------|
| `id`          | `uuid` PK      |       |
| `ensayo_id`   | `uuid` NOT NULL| FK ON DELETE CASCADE |
| `usuario_grupo_id` | `uuid` NOT NULL | FK ON DELETE CASCADE |
| `created_at`  | `timestamptz`  |       |

UK: `(ensayo_id, usuario_grupo_id)`.

### 2.13 `asistencias_ensayo`

Una fila por invitado, cuando se cierra la asistencia.

| Columna       | Tipo                          | Notas |
|---------------|-------------------------------|-------|
| `id`          | `uuid` PK                     |       |
| `invitacion_id` | `uuid` NOT NULL UNIQUE      | FK a `invitados_ensayo.id` |
| `estado`      | `estado_asistencia_ensayo_enum` NOT NULL | `asistio` / `no_asistio` |
| `set_by`      | `uuid`                        | FK a `perfiles.id` |
| `updated_at`  | `timestamptz`                 |       |

> **Diferencia con servicios:** en ensayos no hay justificación. Es black/white: fue o no fue.

**Enum:**

```sql
create type estado_asistencia_ensayo_enum as enum ('asistio', 'no_asistio');
```

### 2.14 `comunicados`

| Columna        | Tipo           | Notas |
|----------------|----------------|-------|
| `id`           | `uuid` PK      |       |
| `grupo_id`     | `uuid` NOT NULL| FK    |
| `titulo`       | `text` NOT NULL|       |
| `descripcion`  | `text` NOT NULL|       |
| `fecha_inicio` | `timestamptz`  | opcional — si es para un momento concreto. Renombrado de `fecha_evento` en M-22 para coherencia con `servicios` y `ensayos`. |
| `lugar`        | `text`         | opcional |
| `created_at`   | `timestamptz`  |       |

> **No tiene `estado_asistencia`** — por diseño (RF-084).

### 2.15 `dispositivos` (NUEVO)

Necesario para enviar push notifications personalizadas.

| Columna        | Tipo           | Notas |
|----------------|----------------|-------|
| `id`           | `uuid` PK      |       |
| `usuario_id`   | `uuid` NOT NULL| FK a `perfiles.id` ON DELETE CASCADE |
| `expo_push_token` | `text` NOT NULL UNIQUE | token entregado por Expo |
| `plataforma`   | `plataforma_enum` | `ios` / `android` |
| `app_version`  | `text`         | ej. "1.0.0" — útil para debugging |
| `last_seen_at` | `timestamptz`  | última vez que la app se conectó |
| `created_at`   | `timestamptz`  |       |
| `updated_at`   | `timestamptz`  |       |

> Esta tabla **no tiene `grupo_id`** (es por usuario, no por grupo). Un usuario recibe push de todos los grupos donde es miembro activo. La RLS filtra por `usuario_id = auth.uid()`.

## 3. Enums consolidados

```sql
create type rol_grupo_enum as enum ('admin', 'miembro');
create type estado_membresia_enum as enum ('activo', 'inactivo');
create type estado_solicitud_enum as enum ('pendiente', 'aprobada', 'rechazada');
create type tipo_evento_enum as enum ('servicio', 'ensayo', 'comunicado');
create type estado_evento_enum as enum ('programado', 'cancelado', 'realizado');
create type rol_servicio_enum as enum ('cantante', 'musico', 'limpieza');
create type estado_asistencia_enum as enum ('asistio', 'no_asistio', 'justificado');
create type estado_asistencia_ensayo_enum as enum ('asistio', 'no_asistio');
create type plataforma_enum as enum ('ios', 'android');
```

## 4. Reglas de integridad (a nivel SQL)

```sql
-- 1. Cascadas y FKs
alter table perfiles          add constraint fk_perfiles_auth foreign key (id) references auth.users(id) on delete cascade;
alter table grupos            add constraint fk_grupos_admin foreign key (admin_id) references perfiles(id);
alter table usuarios_grupos   add constraint fk_ug_perfil  foreign key (usuario_id) references perfiles(id) on delete cascade;
alter table usuarios_grupos   add constraint fk_ug_grupo   foreign key (grupo_id) references grupos(id) on delete cascade;
alter table solicitudes_grupo add constraint fk_sg_grupo   foreign key (grupo_id) references grupos(id) on delete cascade;
alter table solicitudes_grupo add constraint fk_sg_usuario foreign key (usuario_id) references perfiles(id) on delete cascade;
alter table solicitudes_grupo add constraint fk_sg_responde foreign key (respondida_por) references perfiles(id);

alter table patrones_recurrentes add constraint fk_pr_grupo foreign key (grupo_id) references grupos(id) on delete cascade;

alter table servicios         add constraint fk_serv_grupo foreign key (grupo_id) references grupos(id) on delete cascade;
alter table servicios         add constraint fk_serv_resp  foreign key (responsable_id) references perfiles(id);
alter table servicios         add constraint fk_serv_cierra foreign key (asistencia_cerrada_por) references perfiles(id);

alter table asignaciones_servicio add constraint fk_as_serv foreign key (servicio_id) references servicios(id) on delete cascade;
alter table asignaciones_servicio add constraint fk_as_ug   foreign key (usuario_grupo_id) references usuarios_grupos(id) on delete cascade;

alter table justificaciones_servicio add constraint fk_js_serv foreign key (servicio_id) references servicios(id) on delete cascade;
alter table justificaciones_servicio add constraint fk_js_ug   foreign key (usuario_grupo_id) references usuarios_grupos(id) on delete cascade;

alter table estados_asistencia_servicio add constraint fk_eas_asig  foreign key (asignacion_id) references asignaciones_servicio(id) on delete cascade;
alter table estados_asistencia_servicio add constraint fk_eas_setby foreign key (set_by) references perfiles(id);

alter table ensayos          add constraint fk_ens_grupo    foreign key (grupo_id) references grupos(id) on delete cascade;
alter table ensayos          add constraint fk_ens_encargado foreign key (encargado_id) references perfiles(id);
alter table ensayos          add constraint fk_ens_cierra    foreign key (asistencia_cerrada_por) references perfiles(id);
alter table invitados_ensayo add constraint fk_ie_ens foreign key (ensayo_id) references ensayos(id) on delete cascade;
alter table invitados_ensayo add constraint fk_ie_ug  foreign key (usuario_grupo_id) references usuarios_grupos(id) on delete cascade;
alter table asistencias_ensayo add constraint fk_ae_ie  foreign key (invitacion_id) references invitados_ensayo(id) on delete cascade;
alter table asistencias_ensayo add constraint fk_ae_setby foreign key (set_by) references perfiles(id);

alter table comunicados      add constraint fk_com_grupo foreign key (grupo_id) references grupos(id) on delete cascade;

alter table dispositivos     add constraint fk_disp_usuario foreign key (usuario_id) references perfiles(id) on delete cascade;

-- 2. Checks
alter table servicios  add constraint chk_serv_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio);
alter table ensayos    add constraint chk_ens_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio);
alter table patrones_recurrentes add constraint chk_offset_pos check (offset_alarma_min >= 0);
alter table patrones_recurrentes add constraint chk_semanas_pos check (semanas_generadas between 1 and 26);
alter table grupos    add constraint chk_admin_es_miembro check (
  exists (
    select 1 from usuarios_grupos ug
    where ug.usuario_id = grupos.admin_id
      and ug.grupo_id = grupos.id
      and ug.rol = 'admin'
      and ug.estado = 'activo'
  )
);

-- 3. Trigger: responsable y encargado deben ser miembros activos del grupo
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

create trigger trg_servicios_validar_responsable
  before insert or update of responsable_id, grupo_id on servicios
  for each row execute function validar_pertenencia_responsable();

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

create trigger trg_ensayos_validar_encargado
  before insert or update of encargado_id, grupo_id on ensayos
  for each row execute function validar_pertenencia_encargado();
```

## 5. Row Level Security (RLS) — multi-tenant

**Principio rector:** cada tabla con datos de un grupo tiene `grupo_id` o se llega a él por FK. La política filtra por membresía activa del usuario actual.

### 5.1 Helper functions

> **Corrección de la auditoría:** movidas de `auth.` a `public.`. Supabase no recomienda crear funciones en el schema `auth` (es gestionado por ellos y se puede romper en updates).

```sql
-- Devuelve los grupos a los que pertenece el usuario actual, como set
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

-- Devuelve true si el usuario es admin del grupo
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

-- Devuelve true si el usuario es admin O responsable del servicio
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

-- Análoga para ensayos
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
```

### 5.2 Patrones de política

**Lectura para todos los miembros del grupo** (patrón `miembros`):

```sql
alter table servicios enable row level security;
create policy "servicios: ver los de mi grupo"
  on servicios for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));
```

**Escritura solo Admin** (patrón `admin_only`):

```sql
create policy "servicios: insertar solo admin"
  on servicios for insert
  with check (public.usuario_es_admin_de(auth.uid(), grupo_id));

create policy "servicios: actualizar solo admin"
  on servicios for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));
```

**Miembro edita solo sus propias filas** (patrón `self`):

```sql
alter table justificaciones_servicio enable row level security;
create policy "justificaciones: ver los de mi grupo"
  on justificaciones_servicio for select
  using (servicio_id in (
    select id from servicios
    where grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

create policy "justificaciones: insertar solo para mí mismo"
  on justificaciones_servicio for insert
  with check (
    usuario_grupo_id in (
      select id from usuarios_grupos
      where usuario_id = auth.uid()
        and estado = 'activo'
    )
  );
```

### 5.3 Política especial: `usuarios_grupos` (auto-inserción del fundador)

> **Corrección crítica de la auditoría:** el fundador de un grupo debe poder insertarse a sí mismo como Admin, sin que haya un admin preexistente.

```sql
alter table usuarios_grupos enable row level security;

-- SELECT: miembros del grupo pueden ver la membresía
create policy "ug: ver los de mi grupo"
  on usuarios_grupos for select
  using (grupo_id in (select public.usuario_grupos_activos(auth.uid())));

-- INSERT: el propio usuario se inscribe como admin en un grupo donde admin_id = él,
--         O un admin inserta a otro (como miembro)
create policy "ug: fundador se inserta como admin"
  on usuarios_grupos for insert
  with check (
    -- Caso A: me estoy insertando a mí mismo como admin en MI grupo recién creado
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
    -- Caso B: un admin inserta a otro miembro en su grupo
    (
      rol = 'miembro'
      and public.usuario_es_admin_de(auth.uid(), grupo_id)
    )
  );

-- UPDATE: solo el admin del grupo
create policy "ug: actualizar solo admin"
  on usuarios_grupos for update
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));

-- DELETE: solo el admin
create policy "ug: eliminar solo admin"
  on usuarios_grupos for delete
  using (public.usuario_es_admin_de(auth.uid(), grupo_id));
```

### 5.4 Política especial: `estados_asistencia_servicio` (responsable o admin del evento)

> **Corrección crítica de la auditoría:** el responsable es un miembro del grupo, no necesariamente un admin. La policy debe verificar que sea el responsable **de este servicio concreto**.

```sql
alter table estados_asistencia_servicio enable row level security;

create policy "eas: ver los de mi grupo"
  on estados_asistencia_servicio for select
  using (asignacion_id in (
    select asv.id from asignaciones_servicio asv
    join servicios s on s.id = asv.servicio_id
    where s.grupo_id in (select public.usuario_grupos_activos(auth.uid()))
  ));

create policy "eas: insertar admin o responsable del servicio"
  on estados_asistencia_servicio for insert
  with check (public.usuario_puede_cerrar_servicio(auth.uid(), (
    select servicio_id from asignaciones_servicio where id = asignacion_id
  )));

create policy "eas: actualizar admin o responsable del servicio"
  on estados_asistencia_servicio for update
  using (public.usuario_puede_cerrar_servicio(auth.uid(), (
    select servicio_id from asignaciones_servicio where id = asignacion_id
  )));
```

### 5.5 Checklist de políticas

| Tabla                          | Select                  | Insert             | Update            | Delete            |
|--------------------------------|-------------------------|--------------------|-------------------|-------------------|
| `perfiles`                     | self                    | self + service_role | self              | service_role      |
| `grupos`                       | miembros                | autenticado (crea grupo) | admin           | admin (soft)      |
| `usuarios_grupos`              | miembros del grupo      | fundador + admin   | admin             | admin             |
| `solicitudes_grupo`            | admin del grupo + self  | self               | admin             | admin             |
| `patrones_recurrentes`         | miembros                | admin              | admin             | admin             |
| `servicios`                    | miembros                | admin              | admin             | admin (soft)      |
| `asignaciones_servicio`        | miembros                | admin              | admin             | admin             |
| `justificaciones_servicio`     | miembros                | self               | self              | self              |
| `estados_asistencia_servicio`  | miembros                | responsable+admin  | responsable+admin | admin             |
| `ensayos`                      | miembros                | admin              | admin             | admin (soft)      |
| `invitados_ensayo`             | miembros                | admin              | admin             | admin             |
| `asistencias_ensayo`           | miembros                | encargado+admin    | encargado+admin   | admin             |
| `comunicados`                  | miembros                | admin              | admin             | admin             |
| `dispositivos`                 | self                    | self               | self              | self              |

## 6. Operaciones privilegiadas (SECURITY DEFINER)

> **Corrección crítica de la auditoría:** transferir admin y crear grupo requieren lógica transaccional que no cabe en una policy. Se modelan como functions con `security definer` que se ejecutan con permisos del owner.

### 6.1 `crear_grupo(nombre text, descripcion text)` — crea grupo y asigna admin

```sql
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

  -- Crear el patrón recurrente con config vacía por default
  insert into public.patrones_recurrentes (grupo_id, configuracion)
  values (v_grupo_id, '{"dias": {"0":[],"1":[],"2":[],"3":[],"4":[],"5":[],"6":[]}}'::jsonb);

  return v_grupo_id;
end;
$$;

-- Permisos: usuarios autenticados pueden llamarla
grant execute on function public.crear_grupo(text, text) to authenticated;
```

### 6.2 `transferir_admin(p_grupo_id uuid, p_nuevo_admin_usuario_grupo_id uuid)` — transfiere admin atómicamente

```sql
create or replace function public.transferir_admin(
  p_grupo_id uuid,
  p_nuevo_admin_usuario_grupo_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_admin_actual uuid;
  v_nuevo_usuario_id uuid;
begin
  -- Validar que quien llama es el admin actual del grupo
  if not public.usuario_es_admin_de(auth.uid(), p_grupo_id) then
    raise exception 'Solo el admin actual puede transferir el rol';
  end if;

  -- Obtener el usuario_id del nuevo admin (a partir de la fila de usuarios_grupos)
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

  -- Transacción atómica: 3 updates
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
```

### 6.3 `aprobar_solicitud(p_solicitud_id uuid)` — aprueba solicitud atómica

```sql
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
```

### 6.4 `eliminar_grupo(p_grupo_id uuid)` — soft delete con validaciones

```sql
create or replace function public.eliminar_grupo(p_grupo_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.usuario_es_admin_de(auth.uid(), p_grupo_id) then
    raise exception 'Solo el admin puede eliminar el grupo';
  end if;

  -- Soft delete: preserva el historial
  update public.grupos
    set deleted_at = now(), updated_at = now()
    where id = p_grupo_id;

  -- Marcar todos los miembros como inactivos
  update public.usuarios_grupos
    set estado = 'inactivo', updated_at = now()
    where grupo_id = p_grupo_id;
end;
$$;

grant execute on function public.eliminar_grupo(uuid) to authenticated;
```

> **M-27 — Garantía de visibilidad de grupos soft-deleted:** ¿qué impide que un admin activo de un grupo soft-deleted siga viendo datos del grupo?
>
> **Análisis:** la function `eliminar_grupo()` ejecuta **dos updates atómicos**:
> 1. `grupos.deleted_at = now()` — marca el grupo como eliminado.
> 2. `usuarios_grupos.estado = 'inactivo'` para TODOS los miembros del grupo (incluido el admin que eliminó).
>
> Después de esto, **todos** los miembros (sin importar el rol) tienen `estado = 'inactivo'`. Por lo tanto, la helper function `public.usuario_grupos_activos(uid)` devuelve **0 grupos** para cualquiera que haya sido miembro de ese grupo.
>
> **Conclusión:** no se necesitan políticas RLS adicionales que filtren por `grupos.deleted_at is null`. La cadena `usuarios_grupos.estado` + `usuario_grupos_activos()` ya cierra el caso. **Esta garantía depende de que `eliminar_grupo()` siempre ejecute ambos updates** (lo cual es así porque están en la misma function transaccional).
>
> **Riesgo residual:** si en el futuro alguien agrega otro camino para marcar un grupo como `deleted_at` sin pasar por esta function (ej. UPDATE manual desde SQL), podría romper la garantía. Se mitiga con un trigger `BEFORE UPDATE OF deleted_at` en `grupos` que fuerce el `usuarios_grupos.estado = 'inactivo'` correspondiente. **No se implementa en MVP** (es defensa en profundidad) pero queda como nota para v0.2.0.

### 6.5 `eliminar_cuenta()` — elimina cuenta con validaciones previas

> **Corrección de la auditoría:** la app debe forzar al usuario a transferir admin de todos los grupos que administra, o eliminar esos grupos, ANTES de borrar la cuenta.

```sql
create or replace function public.eliminar_cuenta()
returns void
language plpgsql
security definer
as $$
declare
  v_grupos_admin record;
begin
  -- Verificar grupos donde es admin
  for v_grupos_admin in
    select g.id, g.nombre
    from public.grupos g
    where g.admin_id = auth.uid()
      and g.deleted_at is null
  loop
    raise exception 'Debes transferir o eliminar el grupo "%" antes de eliminar tu cuenta', v_grupos_admin.nombre;
  end loop;

  -- Marcar membresías como inactivas
  update public.usuarios_grupos
    set estado = 'inactivo', updated_at = now()
    where usuario_id = auth.uid();

  -- Eliminar el perfil (cascade borrará auth.users)
  delete from public.perfiles where id = auth.uid();
end;
$$;

grant execute on function public.eliminar_cuenta() to authenticated;
```

## 7. Triggers / funciones

### 7.1 `handle_new_user()` — al registrarse en `auth.users`

```sql
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 7.2 `generar_servicios_desde_patron()` — al insertar/actualizar el patrón

> **Decisión documentada (de la auditoría):** upsert por `(grupo_id, fecha_inicio)`. Los servicios cancelados manualmente NO se resucitan al regenerar.

```sql
create or replace function public.generar_servicios_desde_patron()
returns trigger
language plpgsql
as $$
declare
  dia_key text;
  dia_int int;
  horarios jsonb;
  horario jsonb;
  hora_str text;
  fecha_calculada date;
  fecha_hora timestamptz;
  i int;
begin
  for dia_key, horarios in
    select key, value
    from jsonb_each(new.configuracion->'dias')
  loop
    dia_int := dia_key::int;
    for horario in select * from jsonb_array_elements(horarios)
    loop
      hora_str := horario->>'hora';
      for i in 0..(new.semanas_generadas - 1) loop
        -- Calcular la fecha del día de la semana dentro de la semana i
        fecha_calculada := (
          current_date
          + ((7 - extract(dow from current_date)::int + dia_int) % 7)
          + (i * 7)
        )::date;

        fecha_hora := (fecha_calculada::text || ' ' || hora_str)::timestamp
                       at time zone new.zona_horaria;

        -- Si la fecha calculada ya pasó, saltar
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

create trigger trg_patron_generar_servicios
  after insert or update of configuracion, semanas_generadas, zona_horaria
  on patrones_recurrentes
  for each row execute function generar_servicios_desde_patron();
```

### 7.3 `crear_estado_asistencia_al_asignar()` — al crear asignación, crea su estado

> **Decisión documentada (de la auditoría):** la fila en `estados_asistencia_servicio` se crea al asignar, con default `asistio`.

```sql
create or replace function public.crear_estado_asistencia_al_asignar()
returns trigger language plpgsql as $$
begin
  insert into estados_asistencia_servicio (asignacion_id, estado, set_by)
  values (new.id, 'asistio', null);
  return new;
end;
$$;

create trigger trg_asignacion_crear_estado
  after insert on asignaciones_servicio
  for each row execute function crear_estado_asistencia_al_asignar();
```

### 7.4 `set_updated_at_*` — mantener `updated_at`

Triggers estándar por tabla (perfiles, grupos, usuarios_grupos, servicios, ensayos, dispositivos, etc.).

### 7.5 `notificar_evento()` — disparar push via Edge Function

Stub para v0.1.0. La implementación se detalla al construir la edge function.

## 8. Vistas

```sql
-- Vista principal de la pantalla "Mi semana" (con roles agrupados).
-- SECURITY INVOKER: las RLS de servicios / asignaciones_servicio se aplican
-- al caller, así que solo ve servicios de sus grupos activos. Filtros
-- adicionales: estado=programado y rango de 14 días. Ver migración
-- 20260617000000_vistas_security_invoker.sql.
create or replace view v_mi_semana
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
      select id from usuarios_grupos where usuario_id = auth.uid() and grupo_id = s.grupo_id
    )),
    '{}'::text[]
  ) as mis_roles
from servicios s
left join asignaciones_servicio asv on asv.servicio_id = s.id
where s.estado = 'programado'
  and s.fecha_inicio >= now()
  and s.fecha_inicio <  now() + interval '14 days'
group by s.id;

-- Resumen de asistencia de un servicio.
-- M-24: el contador q_sin_cerrar se eliminó. Las filas de estados_asistencia_servicio
-- se crean al asignar (con default 'asistio'), por lo que ese contador siempre sería 0.
-- SECURITY INVOKER: RLS de las 3 tablas aplica al caller. Ver migración
-- 20260617000000_vistas_security_invoker.sql.
create or replace view v_asistencia_servicio
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
```

## 9. Índices de performance

```sql
-- Multi-tenant: los `in (select usuario_grupos_activos(...))` se benefician
create index idx_usuarios_grupos_usuario on usuarios_grupos(usuario_id);
create index idx_usuarios_grupos_grupo   on usuarios_grupos(grupo_id);
create index idx_usuarios_grupos_activos on usuarios_grupos(grupo_id) where estado = 'activo';

-- Servicios: filtrado por grupo + fecha
create index idx_servicios_grupo_fecha  on servicios(grupo_id, fecha_inicio);
create index idx_servicios_estado       on servicios(estado) where estado = 'programado';

-- Asignaciones
create index idx_asignaciones_servicio  on asignaciones_servicio(servicio_id);
create index idx_asignaciones_ug        on asignaciones_servicio(usuario_grupo_id);
-- M-21: índice compuesto para la vista v_mi_semana y el flujo "mis servicios"
create index idx_asignaciones_ug_servicio on asignaciones_servicio(usuario_grupo_id, servicio_id);

-- Ensayos
create index idx_ensayos_grupo_fecha    on ensayos(grupo_id, fecha_inicio);
create index idx_invitados_ensayo       on invitados_ensayo(ensayo_id);

-- Comunicados
create index idx_comunicados_grupo_fecha on comunicados(grupo_id, created_at desc);
create index idx_comunicados_grupo_fecha_inicio on comunicados(grupo_id, fecha_inicio);

-- Justificaciones
create index idx_justificaciones_servicio on justificaciones_servicio(servicio_id);
-- M-21: índice compuesto para cruzar justificaciones con asignaciones
create index idx_justificaciones_servicio_ug on justificaciones_servicio(servicio_id, usuario_grupo_id);

-- Dispositivos (lookup por token y por usuario)
create index idx_dispositivos_usuario on dispositivos(usuario_id);
```

## 10. Estimación de tamaño (plan gratuito Supabase)

| Recurso | Estimado por grupo (50 miembros) |
|---|---|
| Servicios generados en 1 año | ~600 (2 por día × 7 días × 52 semanas, ajustando por reales) |
| Asignaciones por servicio | ~8-15 |
| Estados de asistencia | 1 por asignación |
| Ensayos por año | ~50-100 |
| Comunicados por año | ~50-200 |
| Justificaciones por año | ~50-200 |
| Storage fotos | < 500 MB |
| Realtime | Conexiones concurrentes < 80 |

✅ Cómodamente dentro del plan gratuito para los primeros 5-10 grupos activos. Más de eso, se evalúa migración a Pro.

## 11. Decisiones de diseño que conviene revisar antes de implementar

| # | Decisión | Alternativa |
|---|---|---|
| 1 | `limpieza` es un `rol_servicio` (no un área separada) | Crear tabla `areas` con N:M. **Descartado** por complejidad vs beneficio. |
| 2 | Estado de asistencia en tabla separada, se crea al asignar | Columna en `asignaciones_servicio` y se crea al cerrar. **Adoptado separado + al asignar** por auditabilidad y queries. |
| 3 | Patrón recurrente en una sola fila con jsonb | Una fila por día/horario. **Adoptado jsonb** por simplicidad y edición atómica. |
| 4 | `admin_id` redundante en `grupos` | Calcular on-the-fly. **Adoptado redundante** por performance. |
| 5 | Soft delete en grupos (`deleted_at`) | Hard delete. **Adoptado soft** para preservar historial. |
| 6 | Un solo Admin por grupo (transferible) | Múltiples Admins. **Adoptado único** para MVP; multi-admin en v0.3.0. |
| 7 | Edge Function dispara push al cambiar servicios | Trigger SQL directo a FCM. **Adoptado Edge Function**. |
| 8 | Trigger de patrón: upsert, NO resucita cancelados | Borrar+regenerar. **Adoptado upsert** para respetar cancelaciones manuales. |
| 9 | Responsable siempre por evento | Responsable permanente. **Adoptado por evento** para MVP; permanente en v0.3.0. |
| 10 | Operations privilegiadas como `SECURITY DEFINER` functions | Forzar lógica en la app. **Adoptado SECURITY DEFINER** para atomicidad y que la RLS no bloquee transacciones multi-tabla. |
| 11 | `notas_canciones` texto libre en `servicios` (no repertorio) | Repertorio completo desde MVP. **Adoptado texto libre**; repertorio en v1.1.0. |
| 12 | Tabla `dispositivos` con tokens Expo | Topic-based FCM. **Adoptado por usuario** para push personalizada. |

---

➡️ Siguiente: [05 · Roadmap](./05-roadmap.md)
