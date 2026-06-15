/**
 * Tipos del dominio de Ensayos.
 *
 * Cubre RF-070 a RF-076 del MVP.
 *
 * Diferencia con servicios (ver doc 04 §2.10):
 * - Ensayos NO tienen `titulo` obligatorio con texto rico; tienen `titulo`
 *   (corto) y `tema` (texto libre con la canción o tema a ensayar).
 * - Ensayos NO tienen asignaciones de roles (cantante/musico/limpieza).
 *   Solo tienen INVITACIONES (un miembro está invitado o no).
 * - Ensayos tienen `encargado_id` (un miembro que cierra la asistencia),
 *   equivalente al `responsable_id` de servicios.
 * - Ensayos NO tienen justificación: la asistencia es black/white.
 *
 * Ver docs/04-modelo-de-datos.md §2.11.
 */

export type EstadoEnsayo = 'programado' | 'cancelado' | 'realizado';

export interface Ensayo {
  id: string;
  grupo_id: string;
  titulo: string;
  fecha_inicio: string; // ISO timestamptz
  fecha_fin: string | null;
  lugar: string | null;
  descripcion: string | null;
  tema: string | null;
  estado: EstadoEnsayo;
  encargado_id: string | null;
  asistencia_cerrada: boolean;
  asistencia_cerrada_at: string | null;
  asistencia_cerrada_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnsayoConEncargado extends Ensayo {
  encargado: {
    usuario_id: string;
    nombre: string;
    apellido: string;
  } | null;
}

export interface InvitadoEnsayo {
  id: string;
  ensayo_id: string;
  usuario_grupo_id: string;
  created_at: string;
}

/**
 * Servicio con invitados (JOIN a usuarios_grupos + perfil), listo para
 * mostrar en la pantalla de detalle.
 */
export interface InvitadoEnsayoDetallado extends InvitadoEnsayo {
  miembro: {
    usuario_grupo_id: string;
    usuario_id: string;
    nombre: string;
    apellido: string;
    rol: 'admin' | 'miembro';
  };
}

export interface CrearEnsayoInput {
  grupo_id: string;
  titulo: string;
  fecha_inicio: string; // ISO
  fecha_fin: string | null;
  lugar: string | null;
  descripcion: string | null;
  tema: string | null;
  encargado_id: string | null;
}

export type EditarEnsayoInput = Partial<Omit<CrearEnsayoInput, 'grupo_id'>>;

/** Constantes de UI */
export const DEFAULTS_ESTADO: EstadoEnsayo = 'programado';
