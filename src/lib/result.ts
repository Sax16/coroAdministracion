/**
 * Tipo Result compartido por todas las APIs de features.
 *
 * Patrón: cada función API devuelve `Result<T>` en vez de tirar
 * excepciones. El caller (hooks) decide si mostrar el error al
 * usuario, loguearlo, o seguir. Es explícito en el tipo de retorno
 * y no requiere try/catch en cada callsite.
 *
 * Uso:
 * ```ts
 * const r = await apiListarAlgo();
 * if (!r.ok) {
 *   setError(r.error);
 *   return;
 * }
 * // r.data está tipado como T
 * ```
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
