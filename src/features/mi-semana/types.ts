/**
 * Tipos de la feature "Mi semana" (RF-054, RF-055, RF-063, RF-064).
 *
 * "Mi semana" muestra los servicios en los que el usuario actual
 * está asignado, en el rango [lunes_actual, lunes_actual + 14 días).
 * Cada item incluye los roles que tiene asignados el usuario en ese
 * servicio (puede ser 1 o varios, ver RF-052).
 *
 * Se diferencia de la vista semanal del admin (`/asignaciones`):
 * - Solo muestra servicios donde el usuario actual está asignado.
 * - No es editable.
 * - Al renderizar, agenda alarmas locales.
 *
 * Ver docs/03-requerimientos.md §"Asignaciones semanales".
 */

import type { RolServicio } from '@/features/asignaciones/types';

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
