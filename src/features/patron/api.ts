/**
 * API del patrón recurrente contra Supabase.
 *
 * Cubre RF-040, RF-041, RF-044 del MVP.
 *
 * El trigger `generar_servicios_desde_patron()` en la DB se dispara
 * automáticamente con cada UPDATE/INSERT del patrón y materializa los
 * servicios concretos. Esta API no genera nada del lado de la app: solo
 * lee y escribe el jsonb + metadatos.
 */
import { supabase } from '@/lib/supabase';

import { PatronCompleto, PatronConfig } from './types';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface PatronRow {
  grupo_id: string;
  configuracion: PatronConfig;
  offset_alarma_min: number;
  semanas_generadas: number;
}

function mapErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Lee el patrón de un grupo. Devuelve `null` si el grupo aún no tiene
 * patrón configurado (debería ser raro: `crear_grupo()` crea un patrón
 * vacío por default).
 */
export async function obtenerPatron(
  grupoId: string,
): Promise<Result<PatronCompleto | null>> {
  try {
    const { data, error } = await supabase
      .from('patrones_recurrentes')
      .select('grupo_id, configuracion, offset_alarma_min, semanas_generadas')
      .eq('grupo_id', grupoId)
      .maybeSingle<PatronRow>();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, data: null };

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}

/**
 * Guarda (upsert) el patrón de un grupo. El trigger de la DB se
 * encarga de generar/actualizar los servicios concretos.
 *
 * Validaciones que aplicamos en la app (la DB también las enforcea
 * vía CHECK constraints en `patrones_recurrentes`):
 * - `offset_alarma_min >= 0`
 * - `semanas_generadas` entre 1 y 26
 */
export async function guardarPatron(input: {
  grupo_id: string;
  configuracion: PatronConfig;
  offset_alarma_min: number;
  semanas_generadas: number;
}): Promise<Result<{ grupo_id: string }>> {
  if (input.offset_alarma_min < 0) {
    return { ok: false, error: 'El offset no puede ser negativo' };
  }
  if (input.semanas_generadas < 1 || input.semanas_generadas > 26) {
    return { ok: false, error: 'Las semanas a generar deben estar entre 1 y 26' };
  }

  try {
    const { data, error } = await supabase
      .from('patrones_recurrentes')
      .upsert(
        {
          grupo_id: input.grupo_id,
          configuracion: input.configuracion,
          offset_alarma_min: input.offset_alarma_min,
          semanas_generadas: input.semanas_generadas,
        },
        { onConflict: 'grupo_id' },
      )
      .select('grupo_id')
      .single();

    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'La DB no devolvió el grupo_id' };

    return { ok: true, data: { grupo_id: data.grupo_id } };
  } catch (e) {
    return { ok: false, error: mapErr(e) };
  }
}
