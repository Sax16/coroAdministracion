# 03 · Requerimientos

> Trazabilidad: cada requerimiento tiene un código `RF-###` (funcional) o `RNF-###` (no funcional). Última revisión: 2026-06-10 (post-auditoría). Ver `CHANGELOG-AUDITORIA.md`.

## 1. Requerimientos Funcionales (RF)

### Autenticación y cuenta

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-001 | Registro de usuario | MUST | Un usuario nuevo se registra con email y contraseña. Queda en estado "sin grupo". |
| RF-002 | Login email + contraseña | MUST | El usuario puede iniciar sesión con email y contraseña. |
| RF-003 | Logout | MUST | El usuario puede cerrar sesión desde su perfil. |
| RF-004 | Recuperación de contraseña | MUST | El usuario puede solicitar un link de recuperación por email. |
| RF-005 | Editar perfil propio | MUST | El usuario puede editar su nombre, apellido, foto y teléfono desde su perfil. |
| RF-006 | Eliminar cuenta | MUST | El usuario puede eliminar su cuenta de la plataforma (acción destructiva con doble confirmación). **Regla:** si el usuario es Admin de uno o más grupos activos, la app lo obliga a transferir el rol o eliminar esos grupos antes de permitir borrar la cuenta. Esto evita dejar grupos huérfanos sin admin. |

### Grupos

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-010 | Crear grupo | MUST | Cualquier usuario registrado puede crear un nuevo grupo, indicando nombre. Se vuelve Admin automáticamente. |
| RF-011 | Editar datos del grupo | MUST | El Admin puede editar nombre y descripción del grupo. |
| RF-012 | Eliminar grupo | MUST | El Admin puede eliminar el grupo (acción destructiva, doble confirmación, con resumen de lo que se va a borrar). |
| RF-013 | Transferir Admin | MUST | El Admin puede transferir el rol de Admin a otro miembro activo del grupo. |
| RF-014 | Salir del grupo | MUST | Un Miembro puede salirse del grupo. El Admin **no** puede salirse directamente; debe transferir antes. |
| RF-015 | Selector de grupo activo | MUST | Un usuario con varios grupos puede elegir con qué grupo trabajar. La app recuerda la última selección. |
| RF-016 | Listado de mis grupos | MUST | El usuario ve todos los grupos a los que pertenece y su rol en cada uno. |

### Solicitudes de ingreso

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-020 | Solicitar unirse a grupo | MUST | Un usuario puede solicitar unirse a un grupo existente (por código o búsqueda de nombre). |
| RF-021 | Listado de solicitudes pendientes | MUST | El Admin ve las solicitudes pendientes en un inbox. |
| RF-022 | Aprobar solicitud | MUST | El Admin aprueba una solicitud; el solicitante queda como Miembro activo del grupo. |
| RF-023 | Rechazar solicitud | MUST | El Admin rechaza una solicitud; el solicitante recibe notificación. |

### Miembros

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-030 | Listado de miembros | MUST | Listado de miembros del grupo con: nombre, rol, estado (activo/inactivo), fecha de ingreso. |
| RF-031 | Detalle de miembro | MUST | Ver datos del miembro y su historial de participación (servicios y ensayos de los últimos 3 meses). |
| RF-032 | Dar de baja lógica a un miembro | MUST | El Admin marca un miembro como inactivo (soft delete). El miembro no ve el grupo ni recibe notificaciones, pero su historial se conserva. |
| RF-033 | Reactivar miembro | MUST | El Admin puede volver a marcar a un miembro inactivo como activo. |

### Patrón recurrente de servicios

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-040 | Configurar patrón recurrente | MUST | El Admin configura el patrón semanal: por cada día, 1 o varios horarios. Ej: "Mar-Sáb 19:00, Dom 10:00 y 18:00". |
| RF-041 | Generar servicios automáticamente | MUST | El sistema genera servicios concretos a partir del patrón para las próximas N semanas (default 4, configurable). |
| RF-042 | Excluir un servicio puntual | MUST | El Admin puede marcar un servicio como cancelado antes de que ocurra. Los asignados reciben push. Las asignaciones se mantienen en el historial pero el servicio queda en estado `cancelado`. |
| RF-043 | Crear servicio excepcional | MUST | El Admin puede crear un servicio fuera del patrón (ej. servicio especial de viernes 21:00). |
| RF-044 | Configurar offset de alarma | MUST | El Admin define cuántos minutos antes de cada servicio suena la alarma local (default 60). |

### Asignaciones semanales

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-050 | Vista semanal de servicios | MUST | El Admin ve los 7 días de la semana con los servicios generados y un botón para asignar. |
| RF-051 | Asignar miembro a servicio | MUST | El Admin selecciona un miembro y le asigna uno o varios roles de servicio: `cantante`, `musico`, `limpieza`. |
| RF-052 | Múltiples asignaciones por miembro-servicio | MUST | Un mismo miembro puede tener varios roles en el mismo servicio (cantar + limpiar). |
| RF-053 | Editar asignación | MUST | El Admin puede cambiar o quitar una asignación mientras el servicio no haya comenzado. |
| RF-054 | Miembro ve su semana | MUST | Cada miembro ve sus servicios y ensayos de la semana actual y la siguiente. |
| RF-055 | Programar alarma local al ver asignación | MUST | Al renderizar la pantalla "Mi semana", la app agenda una alarma local (categoría `alarm`, sonido custom) para cada asignación, respetando el offset configurado. |

### Notificaciones y alarmas

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-060 | Push de servicio creado | MUST | Cuando se crea un servicio, todos los miembros del grupo reciben push. |
| RF-061 | Push de servicio modificado | MUST | Si cambia fecha, hora o lugar de un servicio, push a los asignados. |
| RF-062 | Push de servicio cancelado | MUST | Si se cancela un servicio, push a los asignados. |
| RF-063 | Alarma local pre-servicio | MUST | Suena N minutos antes del servicio (N configurable, default 60), programada al ver la pantalla "Mi semana". |
| RF-064 | Permiso de alarmas exactas Android | MUST | En Android 12+, pedir permiso `SCHEDULE_EXACT_ALARM` al usuario la primera vez que accede a "Mi semana". |
| RF-065 | Push de solicitud recibida | MUST | El Admin recibe push cuando hay una nueva solicitud de ingreso. |
| RF-066 | Push de respuesta a solicitud | MUST | El solicitante recibe push cuando es aprobado o rechazado. |

### Ensayos

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-070 | Crear ensayo | MUST | El Admin crea un ensayo: fecha, hora inicio, hora fin, lugar, descripción, canción o tema a ensayar (texto libre, no repertorio en MVP). |
| RF-071 | Asignar encargado de ensayo | MUST | El Admin designa un Encargado de ensayos por ensayo concreto. |
| RF-072 | Editar ensayo | MUST | El Admin puede editar cualquier campo. |
| RF-073 | Cancelar ensayo | MUST | El Admin puede cancelar un ensayo. Push a involucrados. |
| RF-074 | Listado de ensayos | MUST | Vista "próximos" y "pasados". |
| RF-075 | Cerrar asistencia de ensayo | MUST | El Encargado marca para cada miembro invitado: `asistio` / `no_asistio`. Cierre explícito. |
| RF-076 | Push y alarma de ensayo | MUST | Mismo comportamiento que servicios: push al crear/editar/cancelar, alarma local al ver la asignación. |

### Comunicados / Reuniones

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-080 | Crear comunicado | MUST | El Admin publica: título, descripción, fecha/hora (opcional), lugar (opcional). |
| RF-081 | Editar / eliminar comunicado | MUST | El Admin puede editar o eliminar comunicados propios. |
| RF-082 | Listado de comunicados | MUST | Vista cronológica de comunicados. |
| RF-083 | Push de comunicado | MUST | Todos los miembros del grupo reciben push al publicarse. |
| RF-084 | **No** se trackea asistencia en comunicados | MUST | Por diseño, no hay lista de asistencia. |

### Dispositivos y push tokens

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-085 | Registro de push token | MUST | Al primer login, la app registra el `expo_push_token` del dispositivo en la tabla `dispositivos`. Se actualiza en cada apertura. |
| RF-086 | Limpieza de tokens | SHOULD | Si Expo marca un token como inválido, eliminarlo de la tabla. |

### Cierre de asistencia de un servicio (workflow)

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-090 | Abrir pantalla de cierre | MUST | El Responsable **designado para este servicio** (o el Admin si el Responsable falla) puede abrir la pantalla de cierre de un servicio que ya pasó o está en curso. **En MVP el responsable es siempre por evento**, no permanente. |
| RF-091 | Marcar asistencia | MUST | Para cada miembro asignado, estado: `asistio` (default al asignar) / `no_asistio`. Las filas de `estados_asistencia_servicio` se crean **al momento de asignar** con default `asistio`; el responsable solo edita las que cambian. |
| RF-092 | Ver justificaciones recibidas | MUST | El Responsable ve las justificaciones de los miembros marcados como `no_asistio`. |
| RF-093 | Cambiar estado a `justificado` | MUST | El Responsable designado (o Admin) puede cambiar el estado de `no_asistio` a `justificado`. Solo el responsable de ESE servicio o el admin del grupo. |
| RF-094 | Cerrar asistencia | MUST | Acción explícita. Estado de los miembros queda definitivo salvo que el Admin reabra. |
| RF-095 | Reabrir asistencia (solo Admin) | MUST | El Admin del grupo puede reabrir un servicio ya cerrado para editar. |
| RF-096 | Miembro justifica su inasistencia | MUST | Un miembro con estado `no_asistio` puede escribir una justificación en texto libre desde la app. El Responsable del servicio la ve. |
| RF-097 | Estado final visible para todos | MUST | El estado final de cada miembro es visible para todos los miembros del grupo (visualización pasiva, sin comentarios). |

### Vistas personales

| Código | Título | Prioridad | Descripción |
|--------|--------|-----------|-------------|
| RF-100 | Ver mi semana | MUST | Pantalla con mis servicios y ensayos de la semana actual y la siguiente, con sus horarios y roles de servicio. Si tengo varios roles en el mismo servicio, se muestran agrupados (ej. "Cantante + Limpieza"). |
| RF-101 | Ver mi historial | MUST | Listado de servicios y ensayos pasados en los que participó. |
| RF-102 | Ver detalle de un servicio | MUST | Ver el detalle completo: fecha, hora, lugar, setlist en texto libre (`notas_canciones` del servicio), asignados agrupados por rol, estado de cada asignado. |
| RF-110 | Compartir mi semana | MUST | El miembro puede tocar un botón "Compartir" en la pantalla "Mi semana". Se genera un texto formateado con sus servicios y ensayos de la semana, y se pasa al sheet nativo de compartir del sistema operativo (`Share.share()` de Expo). El usuario elige destino: WhatsApp, Telegram, email, copiar al portapapeles, lo que sea. **No se integra con WhatsApp/Email directo**; se respeta la soberanía del usuario sobre qué app usa. |

## 2. Requerimientos No Funcionales (RNF)

### Rendimiento

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-001 | Tiempo de carga | Pantallas principales cargan en < 2s en 4G. |
| RNF-002 | Tamaño de la app | Binario inicial < 50 MB por plataforma. |
| RNF-003 | Cold start | App abre en < 3s en dispositivo de gama media. |
| RNF-004 | Consumo de batería | Cero impacto medible por las alarmas locales (las agenda el SO, no la app). |

### Seguridad y privacidad

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-010 | RLS en todas las tablas | Ningún usuario puede ver datos de un grupo al que no pertenece. Multi-tenant estricto. |
| RNF-011 | HTTPS only | Todo el tráfico va sobre TLS. |
| RNF-012 | No guardar secretos en el cliente | Tokens manejados por Supabase SDK. |
| RNF-013 | Cumple GDPR básico | Botón de "Eliminar mi cuenta" en perfil; export de datos personales bajo solicitud. |
| RNF-014 | Confirmación en acciones destructivas | Eliminar grupo, eliminar cuenta, reabrir asistencia: doble confirmación con resumen. |

### Usabilidad

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-020 | Sin instrucciones necesarias | Un miembro nuevo debe poder ver su semana y confirmar asistencia sin capacitación. |
| RNF-021 | Accesibilidad mínima | Contraste WCAG AA, tamaños táctiles ≥ 44pt, soporte a `accessibilityLabel` en iOS y `contentDescription` en Android. |
| RNF-022 | Idioma | Español (es-419) en MVP. Sin i18n multi-idioma. |
| RNF-023 | Zona horaria configurable | Default America/Lima. Configurable por grupo en ajustes. |

### Compatibilidad

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-030 | iOS | iOS 15+ |
| RNF-031 | Android | Android 8.0 (API 26) + |

### Mantenibilidad

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-040 | Linting | ESLint + Prettier + TypeScript strict. |
| RNF-041 | Commits | Conventional Commits. |
| RNF-042 | Documentación | Esta carpeta `docs/` se mantiene actualizada por release. |
| RNF-043 | Multi-tenant limpio | Cualquier tabla nueva debe tener `grupo_id` y RLS desde el día 1, sin excepciones. |

### Disponibilidad

| Código | Título | Descripción |
|--------|--------|-------------|
| RNF-050 | SLA implícito Supabase | 99.9% según plan gratuito. Aceptable para MVP. |

## 3. Historias de usuario clave

> Formato: *Como [rol], quiero [acción], para [beneficio].*

### Admin / Director
- Como **Admin**, quiero crear un grupo y configurarlo en menos de 5 minutos, para empezar a usarlo lo antes posible.
- Como **Admin**, quiero definir el patrón recurrente una sola vez, para no tener que crear los servicios cada semana.
- Como **Admin**, quiero ver todos los servicios de la semana en una pantalla y arrastrar miembros a cada rol, para hacer la asignación semanal en menos de 10 minutos.
- Como **Admin**, quiero recibir solicitudes de ingreso y aprobarlas con un toque, para no perder potenciales miembros.
- Como **Admin**, quiero transferir la administración a otro si dejo el grupo, para no perder el trabajo del equipo.

### Miembro
- Como **Miembro**, quiero ver de un vistazo los servicios y ensayos que me tocan esta semana, para no perderme nada.
- Como **Miembro**, quiero que el celular me avise con una alarma real 1 hora antes del servicio, para no olvidarlo aunque esté en otra cosa.
- Como **Miembro**, quiero justificar mi inasistencia desde la app, para que el responsable lo registre sin que yo tenga que escribir por WhatsApp.
- Como **Miembro**, quiero ver quién más participó en un servicio pasado, para saber con quién canté.

### Responsable
- Como **Responsable de un servicio**, quiero ver la lista de asignados y marcar quién asistió, para cerrar la asistencia en menos de 5 minutos después del culto.
- Como **Responsable**, quiero ver las justificaciones de los que faltaron, para cambiar su estado a justificado.

### Encargado de ensayos
- Como **Encargado de un ensayo**, quiero marcar la asistencia de los miembros, para que el Admin vea quién vino.

## 4. Out of scope explícito (reiteración)

Para evitar scope creep, estas funcionalidades **no entran en MVP**:

- Repertorio de canciones.
- Tesorería / aportes / cuotas.
- Chat entre miembros.
- Comentarios en asignaciones o servicios.
- Reportes / métricas / estadísticas.
- Web app.
- Sincronización con Google Calendar / Apple Calendar.
- Subir archivos (PDFs de partituras, audios).
- Roles intermedios (líder de cantores, líder de músicos con permisos diferenciados).
- Notificación push al Admin cuando alguien justifica (lo ve al abrir el detalle del servicio).
- Categorías predefinidas en justificaciones (en MVP solo texto libre).
- Push recordándole al Responsable cerrar la asistencia (disciplina personal en MVP).
- Múltiples Admins simultáneos en un grupo (en MVP hay uno solo, transferible).
- Modo offline completo (la app necesita internet; caché de últimas vistas leídas).
- **Responsable permanente** del grupo (en MVP siempre es por evento; entra en v0.3.0).
- **Confirmación previa** a la asistencia tipo "¿vas a venir este martes?" (lo confirmamos post-servicio con el cierre).

### Decisión de M-25 · Notificaciones no-push (resumen)

Evaluamos 3 caminos para complementar las push notifications. Decisión final documentada para evitar reabrir la discusión:

| Camino | Decisión | Justificación |
|---|---|---|
| **Botón "Compartir mi semana"** (RF-110) | ✅ **MVP** | Cero costo, cero mantenimiento, respeta la soberanía del usuario sobre qué app usa. Cubre el 80% del caso "quiero avisarle a mi grupo por WhatsApp". |
| **Resumen semanal por email automático** | 🟡 **v0.2.0** | Útil solo si las métricas de adopción muestran que los miembros no abren la app. Costo: Resend (gratis hasta 100/día, suficiente). |
| **WhatsApp Business API** (mensajes automáticos al grupo) | ❌ **Descartado** | Cuenta Meta Business verificada, plantillas pre-aprobadas que se renuevan cada 6 meses, USD 0.005/mensaje después de los primeros 1000/mes. La complejidad no se justifica para el caso de uso. |

---

➡️ Siguiente: [04 · Modelo de Datos](./04-modelo-de-datos.md)
