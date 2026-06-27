# TanStack Query — slice `grupos` · Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoptar TanStack Query de verdad en el slice `grupos` (lectura cacheada + mutaciones con invalidación), eliminando el N+1 de `listarMisGrupos`.

**Architecture:** Las `api.ts` siguen devolviendo `Result<T>`. Un adaptador `unwrap` las envuelve en `queryFn`/`mutationFn` (lanza en error, que es lo que Query espera). Los hooks de feature exponen la forma idiomática de Query (`{ data, isLoading, error, refetch }` / `{ mutateAsync, isPending, error }`). Las query keys se centralizan en una factory.

**Tech Stack:** React Native + Expo, `@tanstack/react-query` (ya instalado y con `QueryClientProvider` montado en `app/_layout.tsx`), TypeScript strict, NativeWind.

## Global Constraints

- **Package manager: `pnpm` siempre.** Nunca `npm`/`yarn`.
- **Sin runner de tests** (Vitest es v0.2.0). La validación de cada tarea es `pnpm typecheck` + `pnpm lint` (ambos deben pasar limpios) y, donde se indica, un **smoke manual**. Esto reemplaza los pasos TDD.
- **Imports absolutos con alias `@/` → `src/`.** Sin barrel files.
- **Commits**: Conventional Commits en español.
- `Result<T>` se importa de `@/lib/result`; el mapeo de errores ya está en `@/lib/errores` (no se toca).
- Las `api.ts` de `grupos` NO se modifican en este plan.

---

### Task 1: Adaptador `unwrap` y factory de query keys

**Files:**
- Create: `src/lib/query.ts`
- Create: `src/lib/queryKeys.ts`

**Interfaces:**
- Produces: `unwrap<T>(r: Result<T>): T` (lanza `Error(r.error)` si `!r.ok`).
- Produces: `qk.grupos(): readonly ['grupos']`, `qk.grupo(id: string): readonly ['grupo', string]`.

- [ ] **Step 1: Crear `src/lib/query.ts`**

```ts
import { Result } from '@/lib/result';

/**
 * Desenvuelve un Result<T> para usarlo como retorno de una queryFn/mutationFn
 * de TanStack Query. Lanza en error (Query puebla su estado `error` con esto).
 * `r.error` ya es un mensaje amigable en español (viene de mapSupabaseError).
 */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
```

- [ ] **Step 2: Crear `src/lib/queryKeys.ts`**

```ts
/**
 * Fuente única de query keys de TanStack Query. Centralizarlas evita typos y
 * hace explícita la invalidación. Se amplía a medida que migran más features.
 */
export const qk = {
  grupos: () => ['grupos'] as const,
  grupo: (id: string) => ['grupo', id] as const,
};
```

- [ ] **Step 3: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: ambos pasan sin errores (salida vacía de `tsc`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/query.ts src/lib/queryKeys.ts
git commit -m "feat(query): adaptador unwrap y factory de query keys"
```

---

### Task 2: `useMisGrupos` con `useQuery` + migrar el listado

El hook `useMisGrupos` actual (manual, en `src/features/grupos/hooks.ts:27-46`) **no tiene consumidores** (las pantallas llaman `listarMisGrupos()` directo de la api). Confirmar y reescribirlo a `useQuery`, luego apuntar el listado a él.

**Files:**
- Modify: `src/features/grupos/hooks.ts` (reescribir `useMisGrupos`)
- Modify: `app/(app)/grupos/index.tsx`

**Interfaces:**
- Consumes: `unwrap`, `qk` (Task 1).
- Produces: `useMisGrupos(): UseQueryResult<GrupoConRol[], Error>` con `queryKey: qk.grupos()`.

- [ ] **Step 1: Confirmar que el `useMisGrupos` viejo no tiene consumidores**

Run: `grep -rn "useMisGrupos" app src`
Expected: solo aparece en `src/features/grupos/hooks.ts`. Si aparece en alguna pantalla, agregarla a esta tarea.

- [ ] **Step 2: Reescribir `useMisGrupos` en `src/features/grupos/hooks.ts`**

Agregar al inicio del archivo (después de los imports existentes):

```ts
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/lib/query';
import { qk } from '@/lib/queryKeys';
```

Reemplazar la función `useMisGrupos` completa (líneas 23-46 del original) por:

```ts
/**
 * Lista los grupos del usuario actual con su rol (cacheado por TanStack
 * Query bajo la key `qk.grupos()`). Varias pantallas comparten este caché.
 */
export function useMisGrupos() {
  return useQuery({
    queryKey: qk.grupos(),
    queryFn: () => listarMisGrupos().then(unwrap),
  });
}
```

> `listarMisGrupos` ya está importado en el archivo. `GrupoConRol` se infiere del tipo de retorno de la api.

- [ ] **Step 3: Migrar `app/(app)/grupos/index.tsx` al hook**

Reemplazar el import de la api y el estado/efecto manual. Cambiar el import (línea 5):

```ts
// ANTES
import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
// DESPUÉS
import { GrupoConRol } from '@/features/grupos/api';
import { useMisGrupos } from '@/features/grupos/hooks';
```

Quitar el bloque de estado + `load` + `useEffect` + `onRefresh` (líneas 29-55 del original) y reemplazarlo por:

```ts
  const { data: grupos = [], isLoading, isRefetching, error, refetch } = useMisGrupos();
```

Actualizar los usos en el JSX:
- `loading ?` → `isLoading ?`
- el `RefreshControl`: `refreshing={refreshing}` → `refreshing={isRefetching}`, `onRefresh={onRefresh}` → `onRefresh={refetch}`
- el banner de error al final: `{error ? (... {error} ...)` → usar `{error ? (... {error.message} ...)`

Quitar también el import de `useCallback`/`useEffect`/`useState` si quedan sin uso (revisar: `useState` ya no se usa para grupos; `useCallback`/`useEffect` tampoco). El import de `useAuthStore` se mantiene (se usa para el email del header).

- [ ] **Step 4: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pasan limpios. (Las mutaciones siguen usando los hooks viejos, que siguen presentes.)

- [ ] **Step 5: Smoke manual**

Abrir la app → pantalla *Mis grupos*: la lista carga, el pull-to-refresh funciona, y un grupo recién creado/editado aparece al volver (por ahora vía refetch on mount/focus de Query).

- [ ] **Step 6: Commit**

```bash
git add src/features/grupos/hooks.ts "app/(app)/grupos/index.tsx"
git commit -m "feat(grupos): migrar listado a useQuery (useMisGrupos)"
```

---

### Task 3: Eliminar el N+1 — `mi-semana` y `eliminar` leen del caché

Estas dos pantallas hoy llaman `listarMisGrupos()` en un `useEffect` **solo para obtener el nombre/rol** de un grupo. Pasan a `useMisGrupos()` (caché compartido) y derivan el grupo. Este es el "antes/después" que prueba la ganancia.

**Files:**
- Modify: `app/(app)/grupos/[id]/mi-semana.tsx`
- Modify: `app/(app)/grupos/[id]/eliminar.tsx`

**Interfaces:**
- Consumes: `useMisGrupos` (Task 2).

- [ ] **Step 1: Migrar `mi-semana.tsx`**

Cambiar imports: quitar `GrupoConRol, listarMisGrupos` de `@/features/grupos/api` y agregar `useMisGrupos` de `@/features/grupos/hooks` (mantener el resto).

Reemplazar el estado + efecto que arma `nombreGrupo`/`esAdmin`/`cargandoGrupo` (líneas 56-78 del original) por:

```ts
  const { data: misGrupos } = useMisGrupos();
  const grupoActual = misGrupos?.find((g) => g.id === grupoId);
  const nombreGrupo = grupoActual?.nombre ?? null;
  const esAdmin = grupoActual?.rol === 'admin';
```

Borrar los `useState` de `nombreGrupo`/`esAdmin`/`cargandoGrupo` y el `useEffect` que los llenaba. Donde se use `cargandoGrupo` en el gate de carga inicial (línea 124: `if (cargandoGrupo && loading)`), cambiar a `if (!grupoActual && loading)`.

- [ ] **Step 2: Migrar `eliminar.tsx` (solo la parte de lectura del nombre/desc)**

Cambiar imports: quitar `listarMisGrupos` de `@/features/grupos/api`, agregar `useMisGrupos` de `@/features/grupos/hooks` (mantener `useAccionesGrupo`, que se migra en la Task 5).

Reemplazar el primer `useEffect` que trae nombre/descripción vía `listarMisGrupos` (líneas 53-71 del original) por derivación del caché:

```ts
  const { data: misGrupos } = useMisGrupos();
  const grupoActual = misGrupos?.find((g) => g.id === grupoId);
  const nombre = grupoActual?.nombre ?? null;
  const descripcion = grupoActual?.descripcion ?? null;
```

Borrar los `useState` de `nombre`/`descripcion` y ese `useEffect`. El segundo `useEffect` (count de miembros vía `supabase`) y el `loadingInfo` se mantienen tal cual. Donde el render use `loadingInfo` para el spinner, mantenerlo (sigue gobernando el count).

- [ ] **Step 3: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pasan limpios.

- [ ] **Step 4: Smoke manual (la prueba del caché compartido)**

Abrir *Mis grupos* (puebla el caché) → entrar a *Mi semana* de un grupo: el nombre aparece **sin** un fetch nuevo. Sin abrir el listado, entrar directo a Mi semana por deep link: `useMisGrupos` dispara el fetch una vez y el nombre aparece igual.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/grupos/[id]/mi-semana.tsx" "app/(app)/grupos/[id]/eliminar.tsx"
git commit -m "perf(grupos): mi-semana y eliminar leen grupos del caché (elimina N+1)"
```

---

### Task 4: Migrar mutaciones `crear` y `editar` a `useMutation`

**Files:**
- Modify: `src/features/grupos/hooks.ts` (reescribir `useCrearGrupo` y `useEditarGrupo`)
- Modify: `app/(app)/grupos/crear.tsx`
- Modify: `app/(app)/grupos/[id]/editar.tsx`

**Interfaces:**
- Consumes: `unwrap`, `qk` (Task 1); `useMisGrupos` (Task 2, usado por editar para el prefill).
- Produces: `useCrearGrupo()` → mutación cuyo `mutateAsync(input: CrearGrupoInput)` resuelve `{ id: string }`. `useEditarGrupo()` → `mutateAsync(input: { id; nombre; descripcion: string | null })` resuelve `{ id; nombre; descripcion: string | null }`. Ambas invalidan `qk.grupos()`.

- [ ] **Step 1: Reescribir `useCrearGrupo` y `useEditarGrupo` en `hooks.ts`**

Agregar a los imports de Query: `import { useMutation, useQueryClient } from '@tanstack/react-query';` (junto al `useQuery` ya agregado).

Reemplazar la función `useCrearGrupo` (líneas 48-68 del original) por:

```ts
/**
 * Mutación: crear un grupo nuevo. Invalida la lista al terminar.
 */
export function useCrearGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearGrupoInput) => apiCrearGrupo(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}
```

Reemplazar la función `useEditarGrupo` (líneas 144-175 del original) por:

```ts
/**
 * Mutación: editar nombre/descripción de un grupo (RF-011). Invalida la
 * lista al terminar.
 */
export function useEditarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; nombre: string; descripcion: string | null }) =>
      apiEditarGrupo(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}
```

> `apiCrearGrupo`, `apiEditarGrupo` y `CrearGrupoInput` ya están en el archivo.

- [ ] **Step 2: Migrar `crear.tsx`**

El hook ahora es una mutación. Cambiar el uso (líneas 21, 29-44 del original):

```ts
  const crearGrupo = useCrearGrupo();
  const { seleccionar } = useGrupoActivo();
  // ...
  const onSubmit = async () => {
    if (!canSubmit) return;
    try {
      const data = await crearGrupo.mutateAsync({
        nombre,
        descripcion: descripcion || undefined,
      });
      seleccionar({ id: data.id, nombre: nombre.trim(), rol: 'admin' });
      router.replace('/(app)/grupos');
    } catch {
      // El error se muestra vía crearGrupo.error (abajo).
    }
  };
```

En el JSX: `loading={loading}` → `loading={crearGrupo.isPending}`; el bloque de error `{error ? (...)` → `{crearGrupo.error ? (... {crearGrupo.error.message} ...)}`. El `onChangeText` del nombre llamaba `clearError()`; reemplazar por `crearGrupo.reset()`.

- [ ] **Step 3: Migrar `editar.tsx`**

Prefill desde el caché + mutación. Cambiar imports: quitar `listarMisGrupos` de la api; agregar `useMisGrupos` de hooks (junto a `useEditarGrupo`).

Reemplazar el hook y el efecto de carga (líneas 39, 41-70 del original) por:

```ts
  const editarGrupo = useEditarGrupo();
  const { data: misGrupos } = useMisGrupos();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Pre-popular el form desde el grupo cacheado, una sola vez.
  useEffect(() => {
    if (hydrated || !misGrupos) return;
    const g = misGrupos.find((x) => x.id === grupoId);
    if (g) {
      setNombre(g.nombre);
      setDescripcion(g.descripcion ?? '');
    }
    setHydrated(true);
  }, [misGrupos, grupoId, hydrated]);
```

Cambiar `onSubmit` (líneas 74-84):

```ts
  const onSubmit = async () => {
    if (!canSubmit || !grupoId) return;
    try {
      await editarGrupo.mutateAsync({
        id: grupoId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      });
      router.back();
    } catch {
      // Error mostrado vía editarGrupo.error.
    }
  };
```

En el JSX: borrar el bloque `loadError` (ya no existe; si el grupo no está en caché, el form queda vacío y el usuario puede reintentar). `editable={!loading && hydrated}` → `editable={!editarGrupo.isPending && hydrated}`; `loading={loading}` → `loading={editarGrupo.isPending}`; `disabled={!canSubmit || !hydrated}` igual; el bloque `{error ? ...}` → `{editarGrupo.error ? (... {editarGrupo.error.message} ...)}`; el `clearError()` del `onChangeText` → `editarGrupo.reset()`.

- [ ] **Step 4: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pasan limpios.

- [ ] **Step 5: Smoke manual**

Crear un grupo → vuelve al listado y aparece **sin** refetch manual (invalidación). Editar un grupo → al volver, el nombre está actualizado en el listado y en *Mi semana* (caché invalidado).

- [ ] **Step 6: Commit**

```bash
git add src/features/grupos/hooks.ts "app/(app)/grupos/crear.tsx" "app/(app)/grupos/[id]/editar.tsx"
git commit -m "feat(grupos): migrar crear/editar a useMutation con invalidación"
```

---

### Task 5: Migrar `eliminar`/`transferir` a `useMutation` y limpiar hooks viejos

**Files:**
- Modify: `src/features/grupos/hooks.ts` (reemplazar `useAccionesGrupo` por `useEliminarGrupo` + `useTransferirAdmin`)
- Modify: `app/(app)/grupos/[id]/eliminar.tsx`
- Modify: `app/(app)/grupos/[id]/transferir-admin.tsx`

**Interfaces:**
- Consumes: `unwrap`, `qk` (Task 1).
- Produces: `useEliminarGrupo()` → `mutateAsync(grupoId: string)` resuelve `null`. `useTransferirAdmin()` → `mutateAsync(input: { grupoId: string; nuevoAdminUsuarioGrupoId: string })` resuelve `null`. Ambas invalidan `qk.grupos()`.

- [ ] **Step 1: Reemplazar `useAccionesGrupo` en `hooks.ts`**

Borrar la función `useAccionesGrupo` (líneas 96-138 del original) y agregar:

```ts
/**
 * Mutación: eliminar (soft delete) un grupo (RF-012). Invalida la lista.
 */
export function useEliminarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grupoId: string) => apiEliminarGrupo(grupoId).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}

/**
 * Mutación: transferir el rol admin a otro miembro (RF-013). Invalida la lista.
 */
export function useTransferirAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { grupoId: string; nuevoAdminUsuarioGrupoId: string }) =>
      apiTransferirAdmin(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}
```

> `apiEliminarGrupo`, `apiTransferirAdmin` ya están importados.

- [ ] **Step 2: Migrar `eliminar.tsx`**

Cambiar import: `useAccionesGrupo` → `useEliminarGrupo`. Reemplazar `const { eliminar, loading, error, clearError } = useAccionesGrupo();` por `const eliminarGrupo = useEliminarGrupo();`.

En `onConfirmar`, el `onPress` del Alert (líneas 101-112 del original):

```ts
          onPress: async () => {
            try {
              await eliminarGrupo.mutateAsync(grupoId);
              if (grupoActivo?.id === grupoId) setGrupo(null);
              router.replace('/(app)/grupos');
            } catch {
              // Error mostrado vía eliminarGrupo.error.
            }
          },
```

En el JSX: `loading` → `eliminarGrupo.isPending` (en `editable`, `disabled` y el spinner); `{error ? (... {error} ...)}` → `{eliminarGrupo.error ? (... {eliminarGrupo.error.message} ...)}`; el `clearError()` del `onChangeText` del input "ELIMINAR" → `eliminarGrupo.reset()`.

- [ ] **Step 3: Migrar `transferir-admin.tsx`**

Cambiar import: `useAccionesGrupo` → `useTransferirAdmin`. Reemplazar `const { transferir, loading, error, clearError } = useAccionesGrupo();` por `const transferirAdmin = useTransferirAdmin();`.

En el `onPress` del Alert (líneas 83-95 del original):

```ts
          onPress: async () => {
            try {
              await transferirAdmin.mutateAsync({
                grupoId,
                nuevoAdminUsuarioGrupoId: seleccionado.usuario_grupo_id,
              });
              if (origen === 'eliminar-cuenta') {
                router.replace('/(app)/perfil/eliminar');
              } else {
                router.back();
              }
            } catch {
              // Error mostrado vía transferirAdmin.error.
            }
          },
```

En el JSX: `loading` → `transferirAdmin.isPending` (en `disabled`, el spinner y `CandidatoRow disabled`); `{error ? (... {error} ...)}` → `{transferirAdmin.error ? (... {transferirAdmin.error.message} ...)}`; el `clearError()` del `onPress` de la fila → `transferirAdmin.reset()`. (La lista de miembros vía `listarMiembrosActivos` se mantiene tal cual — es de `asignaciones`, fuera de este slice.)

- [ ] **Step 4: Confirmar que no quedan hooks viejos huérfanos**

Run: `grep -rn "useAccionesGrupo" app src`
Expected: 0 resultados (la función y todos sus usos fueron reemplazados).

- [ ] **Step 5: Verificar typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pasan limpios.

- [ ] **Step 6: Smoke manual**

Transferir admin a otro miembro → vuelve y el rol se ve actualizado en el listado (invalidación). Eliminar un grupo → desaparece del listado sin refetch manual.

- [ ] **Step 7: Commit**

```bash
git add src/features/grupos/hooks.ts "app/(app)/grupos/[id]/eliminar.tsx" "app/(app)/grupos/[id]/transferir-admin.tsx"
git commit -m "feat(grupos): migrar eliminar/transferir a useMutation y quitar useAccionesGrupo"
```

---

## Notas de cierre

- **Fuera de alcance** (migran después con este molde): las ~8 pantallas restantes que aún llaman `listarMisGrupos()` directo (asignaciones, comunicados, ensayos, cierre, home del grupo), y las features `servicios`/`asignaciones`/`asistencia`/`ensayos`/`comunicados`/`solicitudes`/`patron`/`dispositivos`. `useGruposAdminActivos` y `useGrupoActivo` se dejan sin tocar (la primera es del flujo eliminar-cuenta; la segunda es estado de UI/Zustand, no server-state).
- Tras completar las 5 tareas, `useMisGrupos` viejo, `useAccionesGrupo` y los `useState/useEffect` de fetch manual de grupos en las 6 pantallas quedan eliminados.
