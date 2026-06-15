/**
 * Tipos del dominio de Asistencia / Cierre de servicio.
 *
 * Cubre RF-090 a RF-097 del MVP.
 *
 * Decisiones de diseño (doc 04 §2.9 + doc 03):
 * - Las filas de `estados_asistencia_servicio` se crean AL ASIGNAR
 *   (con default `asistio`), no al cerrar. El responsable solo
 *   edita las que cambian de estado.
 * - El responsable es POR EVENTO, no permanente. En MVP siempre se
 *   designa al crear el servicio o el ensayo. El campo es
 *   `servicios.responsable_id`.
 * - Solo el admin del grupo o el responsable del servicio pueden
 *   cerrar/reabrir (helper function `usuario_puede_cerrar_servicio`).
 * - Un miembro puede tener múltiples justificaciones? No, la unique
 *   constraint (servicio_id, usuario_grupo_id) limita a una por
 *   miembro-servicio. La justificación se edita, no se duplica.
 *
 * Ver docs/04-modelo-de-datos.md §2.9, §2.10, §5.4, §6.
 */

import type { RolServicio } from '@/features/asignaciones/types';

export type EstadoAsistencia = 'asistio' | 'no_asistio' | 'justificado';

export const ESTADOS_ASISTENCIA: EstadoAsistencia[] = ['asistio', 'no_asistio', 'justificado'];

export const ESTADO_LABELS: Record<EstadoAsistencia, string> = {
  asistio: 'Asistió',
  no_asistio: 'No asistió',
  justificado: 'Justificado',
};

export const ESTADO_COLORS: Record<EstadoAsistencia, { bg: string; fg: string; ring: string }> = {
  asistio: { bg: 'bg-emerald-100', fg: 'text-emerald-700', ring: 'border-emerald-300' },
  no_asistio: { bg: 'bg-red-100', fg: 'text-red-700', ring: 'border-red-300' },
  justificado: { bg: 'bg-amber-100', fg: 'text-amber-700', ring: 'border-amber-300' },
};

/**
 * Una asignación de un servicio enriquecida con:
 * - el estado de asistencia actual
 * - si tiene justificación escrita
 * - el texto de la justificación (si existe)
 */
export interface AsignacionConEstado {
  /** Id de la fila en `asignaciones_servicio`. */
  asignacion_id: string;
  /** Id de la fila en `usuarios_grupos` (miembro). */
  usuario_grupo_id: string;
  rol_servicio: RolServicio;
  estado: EstadoAsistencia;
  /** Id de `estados_asistencia_servicio.id` (para updates). */
  estado_id: string;
  /** Texto de la justificación si existe. */
  justificacion: string | null;
  /** Datos del miembro asignado. */
  miembro: {
    usuario_id: string;
    nombre: string;
    apellido: string;
  };
}

/**
 * Resumen completo de un servicio para la pantalla de cierre.
 * Incluye el servicio, quién es el responsable, si está cerrado, y
 * la lista de asignaciones con sus estados.
 */
export interface ResumenCierre {
  servicio: {
    id: string;
    titulo: string | null;
    fecha_inicio: string;
    lugar: string | null;
    estado: 'programado' | 'cancelado' | 'realizado';
    asistencia_cerrada: boolean;
    asistencia_cerrada_at: string | null;
    asistencia_cerrada_por_nombre: string | null;
  };
  responsable: {
    usuario_id: string;
    nombre: string;
    apellido: string;
  } | null;
  asignaciones: AsignacionConEstado[];
}

/**
 * Para el lado del MIEMBRO: su estado y justificación en un servicio
 * concreto. Lo usa la pantalla "Justificar" (RF-096).
 */
export interface MiEstadoEnServicio {
  asignacion_id: string;
  estado: EstadoAsistencia;
  justificacion: string | null;
  servicio: {
    id: string;
    titulo: string | null;
    fecha_inicio: string;
  };
}
