# 01 · Visión General y Alcance del MVP

> Documento vivo. Última revisión: 2026-06-10 (post-auditoría). Reescrito tras alineación con el Product Owner y aplicación de correcciones. Ver `CHANGELOG-AUDITORIA.md` para el detalle.

## 1. El problema

Las iglesias y comunidades que tienen grupos de alabanza (coros, bandas, equipos de adoración) hoy gestionan la operación con un combo caótico:

- **WhatsApp** para asignaciones, avisos, justificaciones y hasta "yo no pude ir el martes".
- **Hojas de cálculo** para los roles de cada semana, los miembros del equipo, los ensayos.
- **Memoria humana** del director para recordar quién cantó la semana pasada y evitar la rotación injusta.
- **Grupos de Telegram o Signal** paralelos, porque WhatsApp ya no alcanza.

Resultado: asignaciones perdidas, miembros que no se enteraron, confusiones de horarios, "yo creí que me tocaba" y, al final, equipos quemados.

## 2. La solución

Una **app móvil nativa (iOS + Android)** que sea el centro de operación del grupo de alabanza:

- **Multi-grupo desde el día 1**: una persona puede pertenecer a varios grupos (ej. directora de un coro y miembro de otro).
- **Una sola fuente de la verdad** para miembros, asignaciones semanales, ensayos y comunicados.
- **Programación recurrente inteligente** que respeta la realidad: la iglesia tiene un patrón semanal, pero hay semanas donde un día no hay culto y eso se ajusta.
- **Asignaciones flexibles**: cantantes y músicos se intercambian roles, todos pueden hacer limpieza, y un mismo miembro puede tener varios roles en el mismo servicio.
- **Cierre de asistencia post-servicio con justificación**: el responsable marca quién fue, el miembro que faltó justifica desde la app, el estado final es visible para todos.
- **Alarmas reales de celular** para no olvidar el servicio — pero sin quemar batería.

## 3. Usuarios y roles

### 3.1 Roles a nivel de plataforma (no de grupo)

- **Anónimo**: puede ver landing / login / registro.
- **Usuario registrado**: tiene una cuenta personal. Puede crear grupos o solicitar unirse a uno.

### 3.2 Roles dentro de un grupo

Una persona tiene **un único rol de sistema** dentro de un grupo, pero al ser asignada a un servicio puede tener **varios roles de servicio** (cantar + limpiar, por ejemplo).

| Rol | Quién es | Permisos clave |
|---|---|---|
| **Admin / Director** | El creador del grupo. Puede transferir el rol a otro miembro. | Configurar el grupo, patrón recurrente, aprobar solicitudes, asignar servicios, asignar responsables, cerrar asistencia, eliminar el grupo, transferir admin. |
| **Miembro** | Cualquiera aceptado en el grupo. | Ver asignaciones, confirmar/justificar, recibir notificaciones, proponer salida del grupo. |
| **Responsable** | Miembro designado por el admin para un **servicio concreto**. | Cerrar la asistencia del servicio que tiene asignado, marcar justificados. |
| **Encargado de ensayos** | Miembro designado por el admin para un **ensayo concreto**. | Cerrar la asistencia del ensayo. |

> **Nota:** Responsable y Encargado de ensayos son roles **de tarea**, no de sistema. Se asignan **siempre por evento** en MVP (siempre hay que designarlos al crear el servicio/ensayo). Una misma persona puede ser responsable de un servicio y encargado de un ensayo el mismo día. La opción "responsable permanente" del grupo queda fuera del MVP y entra en v0.3.0.

### 3.3 Multi-grupo

- Un usuario puede ser **Admin de un grupo y Miembro de otro** simultáneamente.
- Al abrir la app, el usuario elige con qué grupo trabajar (selector de grupo activo).
- La cuenta personal (nombre, email, foto) es única; los datos de pertenencia (rol, fecha de ingreso) son por grupo.

## 4. Conceptos del dominio

### 4.1 Grupo de alabanza
La unidad organizativa. Tiene un nombre, un admin, un patrón de servicios recurrentes y un conjunto de miembros.

### 4.2 Patrón recurrente
Configuración que el admin hace **una vez** y el sistema usa para generar los servicios de cada semana. Ejemplo típico:

- Martes a sábado: 1 servicio a las 19:00
- Domingo: 2 servicios (10:00 y 18:00)

El admin puede ajustar el patrón si cambia la realidad (ej. en época de restricciones un mes se hace solo domingos).

### 4.3 Servicio
Una instancia concreta generada desde el patrón recurrente (o creada manualmente como excepcional). Tiene fecha, hora, lugar, asignaciones y un responsable.

### 4.4 Asignación de servicio
Vínculo entre un miembro y un servicio, con un **rol de servicio** (cantante / músico / limpieza). Un mismo miembro puede tener varias asignaciones en el mismo servicio (cantar + limpiar).

### 4.5 Ensayo
Evento con horario y registro de asistencia (trackeada por el Encargado de ensayos).

### 4.6 Comunicado / Reunión
Aviso informativo. No se trackea asistencia. Ejemplos: "reunión de líderes el sábado 5pm", "recordatorio: traer instrumento propio".

### 4.7 Justificación
Texto libre que un miembro escribe cuando no pudo asistir a un servicio. Es visible para el responsable y el admin, y el cambio de estado (`no_asistio` → `justificado`) es visible para todos los miembros del grupo.

## 5. Alcance del MVP (v0.1.0)

### 5.1 Cuenta y grupos

- ✅ Registro e inicio de sesión con email + contraseña (Supabase Auth).
- ✅ Crear un nuevo grupo (el creador se vuelve Admin automáticamente).
- ✅ Solicitar unirse a un grupo existente.
- ✅ El Admin aprueba o rechaza solicitudes.
- ✅ Transferir el rol de Admin a otro miembro.
- ✅ Eliminar el grupo (acción destructiva, confirmación fuerte).
- ✅ Selector de grupo activo (un usuario en varios grupos).
- ✅ Editar perfil propio (nombre, foto, teléfono).

### 5.2 Gestión de miembros

- ✅ El Admin ve el listado de miembros del grupo, con su rol y estado.
- ✅ Ver detalle de un miembro (incluye su historial de participación).
- ✅ El Admin puede dar de baja lógica a un miembro.

### 5.3 Patrón recurrente de servicios

- ✅ El Admin configura el patrón semanal (días, horarios).
- ✅ Soporte para días con doble horario (ej. domingo 10:00 y 18:00).
- ✅ El sistema genera automáticamente los servicios de las próximas N semanas (configurable, default 4).
- ✅ El Admin puede **excluir un servicio puntual** (ej. "este martes no hay servicio por evento externo"). Los asignados reciben push de "servicio cancelado".
- ✅ El Admin puede crear servicios **excepcionales** fuera del patrón (ej. servicio especial de viernes 21:00).

### 5.4 Asignaciones semanales

- ✅ Vista semanal con los servicios de la semana.
- ✅ El Admin asigna miembros a cada servicio, eligiendo el rol de servicio: `cantante` / `musico` / `limpieza`.
- ✅ Un miembro puede tener varias asignaciones en el mismo servicio.
- ✅ Los miembros ven su semana: "Martes 19:00 — Cantante / Limpieza".
- ✅ Las asignaciones se pueden editar hasta que el servicio comienza.

### 5.5 Notificaciones y alarmas (híbrido inteligente)

- ✅ **Push estándar** (FCM/APNs) cuando se crea, modifica o cancela un servicio / ensayo.
- ✅ **Alarma local** (categoría `alarm`, sonido custom, full-screen) programada **al ver la asignación en la app**, configurable por el Admin en el patrón (default 60 minutos antes del servicio).
- ✅ Cero consumo extra de batería: las alarmas locales las agenda el SO, no la app. La app solo las programa al renderizar la pantalla "Mi semana".
- ✅ La alarma suena aunque el celular esté en silencio.

### 5.6 Ensayos

- ✅ El Admin programa ensayos con fecha, hora, lugar, descripción.
- ✅ El Admin designa un Encargado de ensayos por ensayo.
- ✅ El Encargado marca asistencia: `asistio` / `no_asistio`.
- ✅ Los miembros reciben push y alarma local igual que en servicios.

### 5.7 Comunicados / Reuniones

- ✅ El Admin publica un comunicado: título, descripción, fecha/hora, lugar (opcional).
- ✅ Los miembros reciben push.
- ❌ **No** se trackea asistencia.

### 5.8 Cierre de asistencia de un servicio (workflow)

Después del servicio, el Responsable (o el Admin si el Responsable falla) hace el cierre:

1. Para cada miembro asignado, el estado inicial es `asistio` (asumimos que fue; esto es configurable).
2. El Responsable ajusta los que no fueron → `no_asistio`.
3. El miembro que no fue puede escribir una **justificación en texto libre** desde la app.
4. El Responsable ve las justificaciones y cambia el estado a `justificado` si la acepta, o lo deja en `no_asistio`.
5. **El estado final es visible para todos los miembros del grupo** (visualización pasiva, sin comentarios ni mensajería).
6. La acción "Cerrar asistencia" es explícita. Antes de cerrar, el Responsable puede editar. Después de cerrar, el estado es definitivo salvo que el Admin lo reabra.

### 5.9 Perfil y vista personal

- ✅ Ver mi perfil.
- ✅ Editar mi nombre, foto, teléfono.
- ✅ Ver mi semana actual (servicios + ensayos asignados).
- ✅ Ver mi historial de participación.
- ✅ **Botón "Compartir mi semana"** que abre el sheet nativo del SO con un texto formateado de los servicios y ensayos de la semana. El usuario elige a qué app mandarlo (WhatsApp, Telegram, email, portapapeles). Cero integración directa con terceros.
- ✅ Salirme de un grupo (el Admin no se puede salir; debe transferir antes).
- ✅ Eliminar mi cuenta de la plataforma (botón en perfil, GDPR-style). **Flujo protegido:** si el usuario es Admin de uno o más grupos, la app lo obliga a transferir el rol o eliminar esos grupos antes de poder borrar la cuenta. Esto evita dejar grupos huérfanos sin admin.

## 6. Fuera del MVP (versiones siguientes)

- ❌ Repertorio de canciones (queda para una iteración posterior a v1.0.0).
- ❌ Tesorería / aportes / cuotas.
- ❌ Chat entre miembros o por servicio.
- ❌ Comentarios en asignaciones o servicios.
- ❌ Notificación push al Responsable recordándole cerrar asistencia (lo maneja su propia disciplina por ahora).
- ❌ Categorías en justificaciones (en MVP solo texto libre).
- ❌ Web app.
- ❌ Reportes / métricas avanzadas (asistencia %, rotación por miembro).
- ❌ Sincronización con Google Calendar / Apple Calendar.
- ❌ Subir archivos (PDFs de partituras, audios).
- ❌ Roles intermedios (líder de cantores, líder de músicos con permisos diferenciados).
- ❌ Notificación push al Admin cuando alguien justifica inasistencia (se entera al abrir el detalle del servicio).
- ❌ Resumen semanal por email automático (queda en v0.2.0 si las métricas lo justifican).
- ❌ Integración con WhatsApp Business API (descartado por complejidad/costo, no se hará nunca salvo cambio fuerte de prioridades).

## 7. Métricas de éxito del MVP

- **Activación**: el 80% de los miembros invitados al grupo abren la app al menos 1 vez en la primera semana.
- **Engagement semanal**: el director abre la app al menos 2 veces por semana para gestionar asignaciones.
- **Adopción**: cero asignaciones se comunican por WhatsApp en las 2 semanas posteriores al lanzamiento.
- **Asistencia**: el tiempo entre "se acabó el servicio" y "asistencia cerrada" es menor a 24 horas en el 70% de los casos.

## 8. Supuestos y restricciones

- Grupos de entre 5 y 80 personas (rango realista para grupos de alabanza amateur o semi-profesionales).
- Los miembros tienen smartphone iOS o Android moderno con notificaciones habilitadas.
- El Admin es técnicamente capaz de operar la app (no es power user, no es dev, pero sabe instalar apps y manejar email).
- **No hay presupuesto para backend propio**: se usa plan gratuito de Supabase mientras el grupo no supere ~50 miembros activos.
- **Cuentas de desarrollador**: el Admin del grupo asume el costo de Apple Developer (USD 99/año) y Google Play (USD 25 único).
- Zona horaria por defecto: America/Lima. Configurable por grupo.
- Idioma: español (es-PE / es-419) en MVP. No hay i18n multi-idioma.
- **Sin internet no funciona** (salvo caché de la última vista leída). La app no tiene modo offline completo en MVP.
- **Package manager: `pnpm` siempre, `npm` nunca.** Convención del proyecto (definida 2026-06-10). Ver `docs/06-convenciones-desarrollo.md`.

## 9. Glosario

| Término | Significado |
|---|---|
| **Grupo** | Un grupo de alabanza / coro / banda administrada en la app. |
| **Miembro** | Persona que integra un grupo. |
| **Admin / Director** | Creador del grupo. Tiene control total sobre su grupo. |
| **Responsable** | Miembro asignado por el Admin a un servicio concreto. Cierra la asistencia. |
| **Encargado de ensayos** | Miembro asignado por el Admin a un ensayo concreto. Cierra la asistencia del ensayo. |
| **Patrón recurrente** | Configuración semanal (días, horarios) que el sistema usa para generar servicios. |
| **Servicio** | Instancia concreta de culto/reunión de adoración generada del patrón o creada manualmente. |
| **Rol de servicio** | Función que cumple un miembro en un servicio: cantante, músico, limpieza. |
| **Ensayo** | Evento con horario y registro de asistencia. |
| **Comunicado** | Aviso informativo, sin seguimiento de asistencia. |
| **Justificación** | Texto libre que un miembro escribe al no asistir a un servicio. |
| **Asignación** | Vínculo miembro ↔ servicio con un rol de servicio. |

---

➡️ Siguiente: [02 · Stack y Arquitectura](./02-stack-y-arquitectura.md)
