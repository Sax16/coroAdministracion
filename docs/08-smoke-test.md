# 08 · Smoke Test (v0.1.0)

> Plan ejecutable de smoke test para validar el MVP antes de publicar a
> TestFlight/Play Internal con grupos beta reales. Última revisión: 2026-06-16.

## 1. Alcance y criterios de salida

Este smoke test valida que el MVP funciona end-to-end en un entorno local
controlado (Expo Go en simulador iOS o emulador Android, **no** TestFlight).
El objetivo es encontrar bugs críticos antes de invertir tiempo y dinero en
la distribución a testers externos.

**Criterio de "pass":** los 13 escenarios de §3 se completan sin bloqueantes
(crashes, errores de RLS, datos corruptos). Bugs menores o cosméticas se
anotan en §5 y se aceptan para v0.1.0 si no rompen el flujo.

**Fuera de alcance (v0.2.0):** tests automatizados con Jest/Detox, tests
formales de RLS, pruebas de carga, validación de accesibilidad, sync de
calendarios externos, modo offline, multi-idioma.

## 2. Pre-requisitos del entorno

Antes de empezar, validá que el entorno local esté completo. El commit
[`b9d1a96`](../CHANGELOG.md) ya aplicó los fixes de peer deps necesarios.

### 2.1. Validación estática (no requiere simulador)

Desde la raíz del proyecto:

```bash
pnpm typecheck            # → 0 errores
pnpm lint                 # → 0 errores, 0 warnings
npx expo-doctor@latest    # → 21/21 checks passed
npx expo export --platform all --output-dir /tmp/coro-export
                         # → iOS + Android + Web bundles generados
```

Si alguno falla, **no** sigas. El smoke test va a fallar también.

### 2.2. Tooling nativo (solo si vas a buildear en sim/emulador)

Para correr en simulador iOS / emulador Android necesitás, además:

| Herramienta | Versión mín. | Instalación | Notas |
|---|---|---|---|
| Xcode | 15+ | App Store (no `brew`) | ~12 GB. Acepta la licencia la primera vez con `sudo xcodebuild -license accept` |
| Xcode Command Line Tools | 16+ | `xcode-select --install` | Ya está en el entorno |
| CocoaPods | 1.15+ | `brew install cocoapods` | Para instalar pods de iOS |
| JDK | 17 (LTS) | `brew install openjdk@17` | Requerido por Gradle 8+ |
| Android Studio | Hedgehog+ | `brew install --cask android-studio` | Incluye SDK, emulator, platform-tools |
| Android SDK Platform | 35 | desde Android Studio SDK Manager | API 35 es el target de RN 0.85 |
| Android Emulator | API 34+ | desde Android Studio AVD Manager | Para emular dispositivos |

**Alternativa rápida:** si solo querés validar la lógica de negocio sin
preocuparte por builds nativos, **usá Expo Go** en un teléfono físico o en
el simulador de iOS (`i` en la terminal de `pnpm start`). Expo Go ya tiene
todos los native modules de SDK 56 y evita todo el setup de arriba.

### 2.3. Estado del backend

```bash
# Confirmá que el proyecto Supabase dev esté respondiendo
curl -sI https://pgtdkyoyosxybnrlfuwa.supabase.co/rest/v1/ | head -1
# → HTTP/2 200

# Confirmá que las migraciones estén aplicadas
psql $DATABASE_URL -c "select version from supabase_migrations.schema_migrations order by version desc limit 5"
# → debe listar las 3 migraciones (initial, push, solicitar_unirse)
```

## 3. Escenarios de smoke test

Cada escenario se ejecuta en orden. Si uno falla, anotalo en §5 y seguí
con el siguiente — los bugs pueden ser independientes.

### S-01 · Registro y login

**Setup:** cuenta nueva con email `smoke+{timestamp}@test.com`.

1. Pantalla de login → tap "Registrarse"
2. Llenar email + password (8+ chars, 1 mayúscula, 1 número) + nombre + apellido
3. Submit → debe redirigir a `/(app)/grupos` (no hay grupos)
4. Sign out desde el header
5. Login con las mismas credenciales → debe volver a `/(app)/grupos`

**Espera:** sesión persiste, AsyncStorage guarda el token, `perfiles` row creada
por el trigger `handle_new_user`.

**Cubre:** RF-001, RF-002, RF-003.

### S-02 · Crear primer grupo (onboarding admin)

**Setup:** usuario recién logueado, sin grupos.

1. Desde `/(app)/grupos`, tap "Crear grupo"
2. Nombre: "Grupo Smoke Test" + zona horaria: America/Lima
3. Submit → debe redirigir al home del grupo nuevo
4. Volver a `/(app)/grupos` → el grupo aparece en la lista con rol "Admin"

**Espera:** SECURITY DEFINER `crear_grupo()` se ejecutó, `grupos.admin_id`
es el usuario actual, `usuarios_grupos` tiene una fila con `rol='admin'`.

**Cubre:** RF-010, RF-014, RF-016.

### S-03 · Configurar patrón recurrente

**Setup:** grupo "Grupo Smoke Test" activo.

1. Desde home del grupo → "Patrón semanal" (o equivalente en el grid)
2. Configurar Domingo 09:00 (servicio) + Jueves 19:30 (ensayo)
3. Save
4. Verificar en Supabase dashboard: `patrones_recurrentes` tiene 2 filas,
   `servicios` tiene varios para las próximas 4 semanas (generación automática)

**Espera:** el trigger `generar_servicios_desde_patron` corrió al guardar.
La generación es atómica: o genera todo o nada.

**Cubre:** RF-040, RF-041, RF-044.

### S-04 · Aprobar solicitud de ingreso (multi-usuario)

**Setup:** necesitás **dos cuentas distintas** registradas.

1. **Cuenta A (admin):** seguir en "Grupo Smoke Test" como admin
2. **Cuenta B (miembro):** sign out, registrar `smoke.b+{timestamp}@test.com`
3. Cuenta B → "Buscar grupo" → "Grupo Smoke Test" → "Solicitar ingreso"
4. Cuenta A: debe llegar push (si está configurado) + aparece en inbox
5. Cuenta A: inbox admin → aprobar
6. Cuenta B: debe aparecer el grupo en su lista
7. Cuenta B: tap en el grupo → debe entrar al home como miembro

**Espera:** la SECURITY DEFINER `aprobar_solicitud()` insertó en
`usuarios_grupos` con `rol='miembro'`, RLS permite ver el grupo a ambos.

**Cubre:** RF-020, RF-021, RF-022, RF-023, RF-065, RF-066.

### S-05 · Asignar rol en un servicio

**Setup:** grupo activo, 2 miembros, servicios generados (S-03).

1. Home del grupo → "Asignaciones" (o desde la sección del servicio)
2. Navegar a la semana actual
3. Tap en un servicio futuro → "Asignar"
4. Elegir cuenta B para rol "Voz 1"
5. Save
6. Verificar en `asignaciones` que hay 1 fila con `estado='asignado'`
7. Verificar que se creó una fila en `estados_asistencia` (RF-092)

**Espera:** pantalla de asignaciones muestra a B con el rol en el slot
correspondiente. La UI de "Mi semana" de B lo refleja.

**Cubre:** RF-050, RF-051, RF-052, RF-053.

### S-06 · "Mi semana" + scheduler de alarmas

**Setup:** cuenta B logueada, grupo activo "Grupo Smoke Test".

1. Bottom tab / menú → "Mi semana"
2. Debe mostrar el servicio asignado de S-05 con día, hora, rol
3. En Android: si API ≥ 31, debe pedir permiso `SCHEDULE_EXACT_ALARM`
4. Conceder el permiso
5. Verificar en logcat / Metro logs: se agendó una notificación con
   `trigger: { date, channelId: 'alarm' }` 1h antes del servicio

**Espera:** la lista muestra solo servicios donde el usuario está asignado
(RF-054). En Android 12+ pide `SCHEDULE_EXACT_ALARM` (RF-064). La alarma
está agendada pero **no se valida que suene** en este smoke (eso requiere
esperar 1h o forzar el trigger manualmente).

**Cubre:** RF-054, RF-055, RF-063, RF-064.

### S-07 · Crear ensayo

**Setup:** cuenta A (admin) en home del grupo.

1. "Ensayos" → "Crear ensayo"
2. Fecha: mañana 20:00, lugar: "Salón principal", descripción: "Ensayo smoke"
3. Save
4. Tap en el ensayo creado → detalle
5. Agregar cuenta B como invitado (o como encargado si B es admin)
6. Cuenta B: debe ver el ensayo en su lista y recibir push

**Espera:** el ensayo aparece en el listado de ambos. Push enviado vía edge
function `notificar-push` con evento `ensayo_creado` o `ensayo_invitacion`.

**Cubre:** RF-070, RF-071, RF-072, RF-073, RF-074.

### S-08 · Crear comunicado

**Setup:** cuenta A (admin).

1. "Comunicados" → "Crear comunicado"
2. Título: "Smoke test", cuerpo: "Probando comunicados", prioridad: "normal"
3. Publicar (no guardar borrador)
4. Verificar en Supabase: `comunicados.estado='publicado'`
5. Cuenta B: debe aparecer en el listado y recibir push

**Espera:** el push llega con el título. El comunicado aparece en orden
cronológico inverso.

**Cubre:** RF-080, RF-081, RF-082, RF-083, RF-084.

### S-09 · Push token se registra al login

**Setup:** cuenta B en un dispositivo físico (o emulador con FCM configurado).

1. Sign out + sign in de cuenta B
2. En Metro logs / `device_push_tokens` table: debe aparecer un token
3. Verificar en Supabase: `dispositivos` tiene una fila con el `user_id` de B
4. **Test manual del push:** desde el dashboard de Supabase, llamar a la
   edge function `notificar-push` con un payload de prueba al usuario B

**Espera:** el dispositivo recibe la push en < 5s. Si no llega, validar:
- iOS: ¿se pidió permiso de notificaciones? (debe hacerlo `PushTokenRegistrar`)
- Android: ¿el `google-services.json` está bien configurado?
- El token en `dispositivos` no es `null`

**Cubre:** RF-060, RF-061, RF-062, RF-085.

### S-10 · Cerrar asistencia de servicio

**Setup:** cuenta A (admin) o el responsable asignado.

1. Home del grupo → "Servicios" o "Asistencia" → servicio que ya pasó
2. Tap "Cerrar asistencia"
3. Marcar cuenta B como "Asistió" + otro como "Faltó"
4. Save
5. Verificar en `asistencia` que las filas tienen `estado` correspondiente
6. La pantalla de "Mi semana" de B debe mostrar el badge "Asistió"

**Espera:** pantalla de cierre muestra totales correctos. Las justificaciones
quedan pendientes para el que faltó.

**Cubre:** RF-090, RF-091, RF-092, RF-093.

### S-11 · Justificar inasistencia

**Setup:** cuenta B marcada como "Faltó" en S-10.

1. Cuenta B: "Mi semana" → tap en el servicio con badge "Faltó"
2. Botón "Justificar"
3. Texto libre: "Estuve enfermo"
4. Submit
5. Verificar en `justificaciones` con `estado='pendiente'`
6. Cuenta A: debe ver la justificación pendiente en el detalle del servicio

**Espera:** el badge de B cambia a "Falta justificada". El admin puede
después aprobar/rechazar (si está implementado el flujo de aprobación).

**Cubre:** RF-094, RF-095, RF-096, RF-097.

### S-12 · Transferir admin + eliminar grupo (doble barrera)

**Setup:** cuenta A es admin de "Grupo Smoke Test" + cuenta B es miembro.

1. Cuenta A: home del grupo → "Transferir admin" (card admin)
2. Elegir cuenta B → doble Alert.alert → confirmar
3. Verificar en `grupos.admin_id` que ahora es B
4. Cuenta A: ya no ve la card de admin
5. Cuenta B: ahora ve la card de admin
6. Cuenta B: "Eliminar grupo" → tipear `ELIMINAR` → Alert.alert final
7. Verificar: el grupo desaparece para ambos usuarios
8. El grupo activo del store se limpia si B lo tenía activo

**Espera:** SECURITY DEFINER `transferir_admin()` y `eliminar_grupo()` corren
transaccionalmente. RLS filtra correctamente — A no ve el grupo después de
ser transferido (no es admin).

**Cubre:** RF-012, RF-013, RNF-014, D-06, D-07.

### S-13 · Eliminar cuenta (doble barrera + pre-check)

**Setup:** cuenta B es admin de **otro** grupo de prueba (crear uno nuevo).

1. Cuenta B: bottom tab → "Perfil"
2. Tap "Eliminar cuenta"
3. **Pre-check:** la pantalla debe listar el grupo donde es admin con CTAs
   inline "Transferir admin" / "Eliminar grupo" (D-06)
4. Resolver el bloqueo: transferir admin a una tercera cuenta (o eliminar
   el grupo de prueba)
5. Volver a "Eliminar cuenta" → ahora debe estar desbloqueado
6. Tipear `ELIMINAR` → Alert.alert final → confirmar
7. Verificar: la sesión termina, redirige a login
8. Intentar login con las credenciales de B → debe fallar
9. Verificar en Supabase: la fila de `auth.users` y `perfiles` de B no existe

**Espera:** SECURITY DEFINER `eliminar_cuenta()` borra el perfil (cascade
manual). Los stores locales (`useAuthStore`, `useGrupoActivoStore`) se
limpian en el orden correcto (D-07: grupo activo antes de sesión).

**Cubre:** RF-006, RNF-014, D-06, D-07.

## 4. Verificación de RLS (smoke manual)

Adicional a los 13 escenarios, validar 2 propiedades críticas de seguridad:

1. **Aislamiento entre grupos:** cuenta C (de otro grupo) intenta abrir el
   detalle de un servicio del "Grupo Smoke Test" pegando la URL o
   modificando el estado local. La RLS debe rechazar el query (devuelve
   null o tira error de RLS).
2. **No-lectura de perfiles ajenos:** desde la consola del navegador con
   la sesión de cuenta A, intentar
   `supabase.from('perfiles').select('*')` — debe devolver solo el perfil
   propio, no el de B o C.

**Si alguna de estas falla:** STOP. Es un bloqueante de seguridad, no se
puede avanzar a TestFlight.

## 5. Reporte de bugs

Anotar cada issue con este formato:

```
### BUG-{NN}
- **Escenario:** S-NN (o "RLS-NN")
- **Severidad:** blocker | major | minor
- **Pasos para reproducir:** ...
- **Esperado:** ...
- **Obtenido:** ...
- **Screenshot / log:** (adjuntar)
- **Notas:** (workaround, si existe)
```

Al final de la sesión, el resumen debe tener:

- Total de escenarios: 13
- Pasados: X
- Fallados: Y
- Bugs blocker: N
- Bugs major: M
- Bugs minor: P

**Go/No-Go para TestFlight:** 0 bugs blocker. Si hay major, decisión
conjunta (PO + dev). Si solo minor, se aceptan y se documentan en el
CHANGELOG de v0.1.0.

## 6. Próximos pasos post-smoke

Si el smoke pasa:

1. **Rotar credenciales del `.env` actual** — la `SUPABASE_SERVICE_ROLE_KEY`
   y el `DATABASE_URL` se filtraron en outputs previos. Generar nuevas en
   el dashboard de Supabase antes de cualquier distribución.
2. **Configurar EAS** (`eas.json` + cuenta) para builds de TestFlight
   (proceso documentado por separado, fuera de scope de este smoke).
3. **Armar la distribución cerrada** de TestFlight/Play Internal con los
   3-5 grupos reales (ver roadmap §"Publicación cerrada").
4. **Abrir v0.2.0** en el roadmap con los bugs major/minor encontrados.

Si el smoke falla con blocker:

1. **NO avanzar** a TestFlight. El costo de un rollback en producción es
   mucho mayor que arreglar el bug ahora.
2. Triage del blocker: ¿es de código, de config, de datos?
3. Fix + re-correr el escenario afectado.
