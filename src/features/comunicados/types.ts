/**
 * Tipos del dominio de Comunicados.
 *
 * Cubre RF-080 a RF-084 del MVP.
 *
 * Decisiones de diseño (doc 04 §2.14 + doc 03):
 * - RF-084: por diseño, no hay lista de asistencia en comunicados. No
 *   hay estados, no hay `responsable_id`, no hay invitaciones. Es
 *   una vía de comunicación de una sola dirección.
 * - RF-081 ("propios"): la tabla no tiene `autor_id`, así que la
 *   interpretación práctica es que cualquier admin puede editar o
 *   eliminar cualquier comunicado del grupo. La RLS de la tabla
 *   enforcea "admin puede todo". En v0.2.0 con la columna `autor_id`
 *   se podría refinar a "solo el autor puede editar/eliminar".
 * - `fecha_inicio` y `lugar` son opcionales. Un comunicado puede ser
 *   solo texto (ej. "El domingo cambiamos de horario") o un evento
 *   concreto con fecha y lugar.
 *
 * Ver docs/04-modelo-de-datos.md §2.14.
 */

export interface Comunicado {
  id: string;
  grupo_id: string;
  titulo: string;
  descripcion: string;
  fecha_inicio: string | null; // ISO timestamptz opcional
  lugar: string | null;
  created_at: string;
}

export interface CrearComunicadoInput {
  grupo_id: string;
  titulo: string;
  descripcion: string;
  fecha_inicio: string | null;
  lugar: string | null;
}

export type EditarComunicadoInput = Partial<
  Omit<CrearComunicadoInput, 'grupo_id'>
>;
