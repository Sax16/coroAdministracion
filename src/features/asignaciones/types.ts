/**
 * Tipos del dominio de Asignaciones.
 *
 * Convenciones (deben coincidir con `public.rol_servicio_enum` y
 * `public.estados_asistencia_servicio`):
 * - `RolServicio`: 'cantante' | 'musico' | 'limpieza'
 * - `Asignacion`: fila cruda de `public.asignaciones_servicio`
 * - `AsignacionDetallada`: join con servicio + perfil del miembro, listo para UI
 * - `MiembroGrupo`: usuario_grupo + nombre del perfil, para selectores
 *
 * La "semana" que mostramos es lunes → domingo. Los servicios se filtran
 * por `fecha_inicio` en zona horaria del grupo (RF-050).
 *
 * Ver docs/04-modelo-de-datos.md §3.6, §3.7.
 */

export type RolServicio = 'cantante' | 'musico' | 'limpieza';

export const ROLES_SERVICIO: RolServicio[] = ['cantante', 'musico', 'limpieza'];

export const ROLES_LABELS: Record<RolServicio, string> = {
  cantante: 'Cantante',
  musico: 'Músico',
  limpieza: 'Limpieza',
};

export const ROLES_EMOJI: Record<RolServicio, string> = {
  cantante: '🎤',
  musico: '🎵',
  limpieza: '🧹',
};

/** Fila cruda de `public.asignaciones_servicio`. */
export interface Asignacion {
  id: string;
  servicio_id: string;
  usuario_grupo_id: string;
  rol_servicio: RolServicio;
  created_at: string;
}

/**
 * Asignación con datos enriquecidos (perfil del miembro) para mostrar
 * en UI sin un join extra.
 */
export interface AsignacionDetallada extends Asignacion {
  miembro: {
    usuario_grupo_id: string;
    usuario_id: string;
    nombre: string;
    apellido: string;
  };
}

/**
 * Servicio de la semana con sus asignaciones. Estructura optimizada para
 * el render de la vista semanal: una card por día, una sección por servicio.
 */
export interface ServicioConAsignaciones {
  id: string;
  fecha_inicio: string; // ISO timestamptz
  titulo: string | null;
  tipo: 'servicio' | 'ensayo' | 'comunicado';
  estado: 'programado' | 'cancelado' | 'realizado';
  asignaciones: AsignacionDetallada[];
}

/**
 * Miembro del grupo con su id de `usuarios_grupos`, para usar en selectores
 * de asignación. Solo miembros en estado `activo`.
 */
export interface MiembroGrupo {
  usuario_grupo_id: string;
  usuario_id: string;
  nombre: string;
  apellido: string;
  rol: 'admin' | 'miembro';
}

// =============================================================================
// Helpers de semana (lunes → domingo)
// =============================================================================

/** Devuelve la fecha del lunes de la semana que contiene `fecha`, en hora local. */
export function getLunesSemana(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 = domingo, 1 = lunes, ..., 6 = sábado
  // Queremos que lunes sea día 0 de nuestra semana, domingo sea día 6.
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow; // si es domingo (0), retrocede 6 días
  d.setDate(d.getDate() + diff);
  return d;
}

/** Devuelve los 7 días de la semana empezando en lunes, como Date en hora local. */
export function getDiasSemana(lunes: Date): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    out.push(d);
  }
  return out;
}

export const DIAS_SEMANA_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Suma o resta N días a una fecha y devuelve un nuevo Date. */
export function agregarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Devuelve el rango [inicio, fin) de timestamps ISO que cubre la semana,
 * listo para filtrar `fecha_inicio` en queries Supabase (que se guarda en
 * timestamptz UTC, pero el patrón los genera desde la zona horaria del grupo).
 *
 * Devuelve inicio y fin exclusivos (el fin es el lunes de la semana siguiente).
 */
export function getRangoSemanaISO(lunes: Date): { inicio: string; fin: string } {
  const fin = agregarDias(lunes, 7);
  return {
    inicio: lunes.toISOString(),
    fin: fin.toISOString(),
  };
}

/** Formatea una fecha como "Lun 10 jun" para mostrar en headers. */
export function formatearDiaCorto(fecha: Date): string {
  const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${DIAS_SEMANA_LABELS[(fecha.getDay() + 6) % 7]} ${fecha.getDate()} ${mes[fecha.getMonth()]}`;
}

/** Formatea una fecha como "10 de junio". */
export function formatearDiaLargo(fecha: Date): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${fecha.getDate()} de ${meses[fecha.getMonth()]}`;
}

/**
 * Formatea un ISO timestamptz como "HH:MM" en hora local del dispositivo.
 * (El servidor guarda en UTC; mostramos en local del usuario.)
 */
export function formatearHora(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
