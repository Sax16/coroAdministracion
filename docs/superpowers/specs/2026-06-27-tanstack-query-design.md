# Diseño — Adopción de TanStack Query (slice de referencia)

> Fecha: 2026-06-27 · Estado: aprobado, listo para plan de implementación.
> Origen: ítem #3 de la auditoría — `@tanstack/react-query` está instalado y el
> `QueryClient` montado en `app/_layout.tsx`, pero ninguna feature lo usa (los
> hooks son manuales con `useState`/`useCallback` + `Result<T>` y refrescan con
> `useFocusEffect`). Se paga el costo de la dependencia sin ninguno de los
> beneficios, y conviven dos paradigmas.

## Objetivo

Adoptar TanStack Query **de verdad** como capa de estado de servidor, empezando
por un slice de referencia que fije el patrón a copiar por el resto de las
features. Beneficios buscados: caché compartida (eliminar el N+1 de
`listarMisGrupos`), deduplicación, refetch en background, invalidación tras
mutaciones, y menos boilerplate de loading/error por hook.

## Decisiones tomadas

1. **Migración incremental**, no big-bang. Se migra un slice de alto valor
   primero; el resto se migra después copiando el molde. Convivencia explícita
   del patrón viejo y el nuevo durante la transición.
2. **Adaptador `unwrap`**: las `api.ts` NO se tocan — siguen devolviendo
   `Result<T>`. Un helper las envuelve en la `queryFn` y lanza en error (que es
   lo que Query espera). Preserva la capa api intacta y bien probada.
3. **Forma idiomática de Query** en los hooks: devuelven directamente
   `{ data, isLoading, isError, error, refetch, ... }`. Las pantallas del slice
   se actualizan a esa forma y se les quita el `useEffect`/`useFocusEffect`
   manual. Nada de capa de traducción al shape viejo.

## Arquitectura — piezas nuevas en `src/lib/`

### `src/lib/query.ts` — adaptador Result → Query

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

### `src/lib/queryKeys.ts` — factory central de query keys

```ts
/**
 * Fuente única de query keys. Centralizarlas evita typos y hace explícita la
 * invalidación. Crece a medida que migran features.
 */
export const qk = {
  grupos: () => ['grupos'] as const,
  grupo: (id: string) => ['grupo', id] as const,
};
```

> El `QueryClient` ya está montado en `app/_layout.tsx` (con `retry: 1`,
> `staleTime: 30_000`). No hay trabajo de provider; se reutiliza tal cual.

## Slice de referencia: `grupos`

Se elige `grupos` porque es donde está el dolor (el N+1 de `listarMisGrupos`
repetido en varias pantallas) y porque tiene lectura **y** mutaciones, así el
slice demuestra los dos patrones de una vez.

### Hook de lectura

```ts
// src/features/grupos/hooks.ts
export function useMisGrupos() {
  return useQuery({
    queryKey: qk.grupos(),
    queryFn: () => listarMisGrupos().then(unwrap),
  });
}
```

### Hooks de mutación (crear / editar / eliminar / transferir admin)

```ts
export function useEditarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarGrupoInput) => editarGrupo(input).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.grupos() }),
  });
}
```

Las cuatro mutaciones de `grupos` (`crearGrupo`, `editarGrupo`, `eliminarGrupo`,
`transferirAdmin`) pasan a `useMutation` e invalidan `qk.grupos()` en `onSuccess`
(la lista se refresca sola, sin refetch manual).

## Pantallas del slice que se actualizan

- `app/(app)/grupos/index.tsx` — listado → `useMisGrupos()`.
- `app/(app)/grupos/[id]/mi-semana.tsx` y `.../[id]/eliminar.tsx` — hoy llaman
  `listarMisGrupos()` en un `useEffect` **solo para obtener el nombre/rol** de un
  grupo. Pasan a `useMisGrupos()` y lo derivan del caché → **se elimina el N+1**.
  Este es el "antes/después" que prueba la ganancia de caché compartida.
- `app/(app)/grupos/[id]/editar.tsx`, `.../grupos/crear.tsx`,
  `.../[id]/transferir-admin.tsx` — usan los hooks de mutación; tras éxito la
  lista se refresca por invalidación (se les saca el refetch manual / la
  re-navegación con refetch).

En todas: se eliminan los `useState`/`useEffect`/`useFocusEffect` manuales para
estos datos y entra `{ data, isLoading, error }`. El `error` que ve la pantalla
es `error.message`, que ya es el mensaje en español (de `mapSupabaseError` vía
`unwrap`).

## Fuera de alcance (se migran después con este mismo molde)

`servicios`, `asignaciones`, `asistencia`, `ensayos`, `comunicados`,
`solicitudes`, la data de `mi-semana`, `patron` y `dispositivos` **no se tocan**
en este slice — siguen con su patrón manual. Convivencia aceptada durante la
transición. Cada una se migrará en su propio paso copiando el patrón de `grupos`.

## Manejo de errores

`unwrap` lanza `new Error(r.error)`, donde `r.error` ya pasó por
`mapSupabaseError` (mensaje en español, ítem #6 de la auditoría). Por lo tanto el
`error.message` que expone Query es directamente apto para la UI; no hace falta
mapear de nuevo en la pantalla.

## Verificación

- `pnpm typecheck` + `pnpm lint` limpios.
- Sin tests de UI (no existen aún), el slice se valida con un smoke manual:
  abrir *Grupos* → editar un grupo → confirmar que el nombre se actualiza solo
  en *Mi semana* sin refetch manual (la prueba viva de la caché compartida e
  invalidación).

## Riesgos / notas

- La invalidación `qk.grupos()` refetchea la lista completa tras cada mutación;
  para el tamaño del dato (pocos grupos por usuario) es despreciable.
- Quedan dos paradigmas conviviendo hasta completar la migración del resto de
  features; está documentado y es intencional.
