/**
 * Tipos del dominio de Solicitudes de ingreso a grupo.
 *
 * Cubre RF-020 a RF-023 del MVP.
 *
 * Decisiones de diseño (doc 04 §2.5 + §6.3):
 * - `solicitudes_grupo` tiene un partial unique index
 *   `uq_solicitud_pendiente` que impide que un usuario tenga DOS
 *   solicitudes pendientes al mismo grupo. Si intenta, devuelve
 *   unique violation (SQLSTATE 23505).
 * - Aprobar es atómico vía SECURITY DEFINER function
 *   `aprobar_solicitud(uuid)` que crea el `usuarios_grupos` con
 *   estado='activo' y marca la solicitud como aprobada en una
 *   sola transacción.
 * - Rechazar es UPDATE directo: la RLS permite a admin UPDATE la
 *   solicitud, basta con cambiar estado a 'rechazada'.
 * - RF-066 (push de respuesta a solicitud): lo dispara la app
 *   cliente al aprobar/rechazar, llamando a notificarPush().
 *
 * Ver docs/04-modelo-de-datos.md §2.5, §6.3.
 */

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export interface Solicitud {
  id: string;
  grupo_id: string;
  usuario_id: string;
  mensaje: string | null;
  estado: EstadoSolicitud;
  respondida_por: string | null;
  created_at: string;
  respondida_at: string | null;
}

export interface SolicitudDetallada extends Solicitud {
  grupo: {
    id: string;
    nombre: string;
  };
  solicitante: {
    usuario_id: string;
    nombre: string;
    apellido: string;
    email: string;
  };
  respondida_por_nombre: string | null;
}

/** Lo que devuelve la búsqueda de grupos (RF-020). Solo campos seguros. */
export interface GrupoDescubierto {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Flag: si el usuario actual ya es miembro activo de este grupo. */
  ya_es_miembro: boolean;
}

export interface CrearSolicitudInput {
  grupo_id: string;
  mensaje: string | null;
}
