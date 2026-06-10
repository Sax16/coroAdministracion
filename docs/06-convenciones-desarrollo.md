# 06 · Convenciones de Desarrollo

> Convenciones que todo dev (humano o worker session) debe seguir al trabajar en este repo.
> Última revisión: 2026-06-10.

## 1. Package manager: `pnpm` SIEMPRE

**Regla firme:** en este proyecto se usa `pnpm`. **Nunca** `npm` ni `yarn`.

### Por qué

- Instalación más rápida (contenido direccionable, hard links).
- `pnpm-lock.yaml` es la única fuente de verdad para versiones.
- Ahorra espacio en disco al compartir node_modules entre proyectos.
- Estricto con dependencias no declaradas (no phantom dependencies).

### Cómo respetar la convención

- ✅ `pnpm install`, `pnpm add <pkg>`, `pnpm remove <pkg>`, `pnpm run <script>`
- ✅ `pnpm dlx <cmd>` (equivalente a `npx`, pero vía pnpm)
- ❌ **Nunca** `npm install`, `npm i`, `npm run ...`
- ❌ **Nunca** `yarn`, `yarn add`, `yarn install`
- ❌ **Nunca** commitear `package-lock.json` ni `yarn.lock`

### Verificación rápida

Si ves un `package-lock.json` o `yarn.lock` en el repo, es un error — eliminarlo y correr `pnpm install` para regenerar `pnpm-lock.yaml`.

## 2. Estructura de archivos (referencia rápida)

```
coroAdministracion/
├── app/                  ← Expo Router (rutas = archivos)
├── src/
│   ├── features/         ← lógica por dominio
│   ├── components/       ← UI compartido
│   ├── lib/              ← supabase client, notifications, etc.
│   ├── stores/           ← zustand
│   └── types/            ← tipos generados
├── supabase/             ← migraciones SQL, edge functions
├── docs/                 ← esta documentación
├── assets/
├── app.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

Detalle completo en [`02-stack-y-arquitectura.md`](./02-stack-y-arquitectura.md) §3.

## 3. Convenciones de código

- **TypeScript strict mode** activado en `tsconfig.json`.
- **Linting:** ESLint + Prettier (configs creadas en bootstrap).
- **Naming:**
  - Componentes React: `PascalCase` (`MiComponente.tsx`).
  - Hooks: `camelCase` con prefijo `use` (`useMiHook.ts`).
  - Types/interfaces: `PascalCase`.
  - Constantes globales: `UPPER_SNAKE_CASE`.
  - Archivos de utilidades: `camelCase` (`formatearFecha.ts`).
- **Imports:** preferir imports absolutos con alias `@/` (configurar en `tsconfig.json`).
- **No barrel files innecesarios** (un `index.ts` que re-exporta todo). Carga perezosa explícita es más predecible.

## 4. Commits

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Mensaje en **español** para mantener coherencia con el equipo y la documentación.
- Cuerpo del commit opcional, pero recomendado cuando el cambio no es trivial.
- **No commitear** archivos generados (`.expo/`, `node_modules/`, `dist/`, etc.) — ya están en `.gitignore`.
- **No commitear** secretos (`.env*` están en `.gitignore`).

Ejemplos:

```
feat(servicios): crear pantalla de detalle con asignados
fix(rls): corregir policy de usuarios_grupos para auto-inserción del fundador
docs(04): documentar function transferir_admin con SECURITY DEFINER
chore: actualizar Expo SDK a 52.0.0
```

## 5. Branches

- `main` — producción. Solo recibe merges de `release/*` o hotfixes.
- `feat/<codigo-rf>` — features nuevos. Ej: `feat/RF-040-patron-recurrente`.
- `fix/<codigo-rf-o-descripcion>` — bugfixes.
- `docs/<tema>` — cambios solo de documentación.
- `chore/<tema>` — tareas de mantenimiento (deps, configs).

Convención derivada de Conventional Commits: el prefijo del branch matchea el tipo del commit principal.

## 6. RLS y multi-tenant

- **Toda tabla nueva** que tenga datos de un grupo DEBE tener `grupo_id` y RLS.
- Helper functions en `public.`, **nunca** en `auth.`.
- Para lógica transaccional multi-tabla, crear una function con `SECURITY DEFINER` y `grant execute to authenticated`.
- Detalle completo en [`04-modelo-de-datos.md`](./04-modelo-de-datos.md) §5 y §6.

## 7. Variables de entorno

- `.env` y variantes están en `.gitignore`. Nunca commitear secretos.
- Convenciones de nombres:
  - `EXPO_PUBLIC_*` — variables expuestas al cliente (bundle de Expo). Usar con cuidado.
  - Sin prefijo `EXPO_PUBLIC_` — variables solo del servidor (no se incluyen en el bundle, pero no se usan aquí porque la app es cliente puro).
- Para Supabase, las claves se exponen con `EXPO_PUBLIC_` (es la práctica estándar con Expo, asumiendo que las RLS están bien configuradas).

## 8. Antes de pedir un PR

- [ ] `pnpm install` corre limpio
- [ ] `pnpm typecheck` (cuando esté configurado)
- [ ] `pnpm lint` (cuando esté configurado)
- [ ] `pnpm test` (cuando haya tests)
- [ ] Probado en iOS Simulator y Android Emulator (o en Expo Go)
- [ ] Sin secretos en el diff
- [ ] Sin archivos generados por error
