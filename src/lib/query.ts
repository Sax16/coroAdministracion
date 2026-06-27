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
