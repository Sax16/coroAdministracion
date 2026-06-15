/**
 * Tipos de la feature "Mi semana" (RF-054, RF-055, RF-063, RF-064, RF-076).
 *
 * "Mi semana" muestra los servicios Y ensayos en los que el usuario
 * actual está asignado/invitado, en el rango [lunes_actual, lunes_actual + 14 días).
 *
 * A partir de la integración de ensayos, "Mi semana" muestra dos tipos
 * de eventos con el mismo patrón visual. Para no romper la API existente
 * (que solo manejaba `MiServicio`), se introduce un tipo discriminado
 * `MiEvento` que la UI puede renderizar.
 *
 * Ver docs/03-requerimientos.md §"Asignaciones semanales" + §"Ensayos".
 */

import type { Ensayo } from '@/features/ensayos/types';
import type { RolServicio } from '@/features/asignaciones/types';

// =============================================================================
// Eventos individuales
// =============================================================================

export interface MiAsignacionEnServicio {
  /** Id de la fila en `asignaciones_servicio`. */
  asignacion_id: string;
  rol_servicio: RolServicio;
}

export interface MiServicio {
  id: string;
  fecha_inicio: string; // ISO timestamptz
  titulo: string | null;
  tipo: 'servicio' | 'ensayo' | 'comunicado';
  estado: 'programado' | 'cancelado' | 'realizado';
  lugar: string | null;
  /** Roles que tiene el usuario actual en este servicio. */
  mis_roles: RolServicio[];
}

// =============================================================================
// MiEvento: union discriminado para la UI
// =============================================================================

/** Servicio del usuario con su(kind='servicio') info de asignación. */
export interface MiEventoServicio {
  kind: 'servicio';
  id: string;
  fecha_inicio: string;
  titulo: string | null;
  lugar: string | null;
  estado: MiServicio['estado'];
  mis_roles: RolServicio[];
  /** Estado de asistencia del usuario actual (RF-091/096). */
  mi_estado: 'asistio' | 'no_asistio' | 'justificado' | null;
  /** Texto de justificación si existe (RF-097). */
  mi_justificacion: string | null;
}

/** Ensayo del usuario. El usuario está invitado (es 1:1 en `invitados_ensayo`). */
export interface MiEventoEnsayo {
  kind: 'ensayo';
  id: string;
  fecha_inicio: string;
  titulo: string;
  lugar: string | null;
  estado: Ensayo['estado'];
  /** No hay roles en ensayos; el array se mantiene vacío para uniformidad. */
  mis_roles: [];
}

export type MiEvento = MiEventoServicio | MiEventoEnsayo;
