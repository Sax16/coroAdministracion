/**
 * Helpers compartidos para fechas y horas en formularios.
 *
 * Centraliza la lógica que antes vivía duplicada entre `EnsayoForm`,
 * `ComunicadoForm`, `nuevo.tsx` (servicio excepcional) y `patron.tsx`.
 *
 * Decisiones:
 * - **Hora**: siempre se guarda y compara como string `"HH:MM"` en 24h
 *   (formato del jsonb del patrón y de los inputs viejos). El picker
 *   nativo devuelve `Date`, así que `dateToHHMM` y `hhmmToDate` son los
 *   adaptadores entre los dos mundos.
 * - **Fecha**: el form de "servicio excepcional" usa un `Date` local
 *   (no UTC) para evitar líos con DST/zonas. `combineLocalDateTime`
 *   toma un Date (fecha) + un string "HH:MM" (hora) y devuelve el ISO
 *   UTC correspondiente. La pantalla lo renderiza siempre en local.
 * - **Validaciones**: las funciones devuelven mensajes en castellano
 *   para mostrar inline.
 */

export const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const DMY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Valida un string "HH:MM" en 24h. */
export function isHoraValida(hora: string): boolean {
  return HHMM_REGEX.test(hora);
}

/** Valida un string "YYYY-MM-DD". */
export function isFechaYMDValida(fecha: string): boolean {
  return YMD_REGEX.test(fecha);
}

/** Formatea una `Date` como "HH:MM" en 24h (hora local del dispositivo). */
export function dateToHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Formatea una `Date` como "YYYY-MM-DD" (fecha local). */
export function dateToYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Devuelve una `Date` con la hora `hhmm` aplicada sobre la base de `d`.
 * Si `d` es null, usa hoy. Útil para sincronizar el picker de hora con
 * la fecha seleccionada en el picker de fecha.
 */
export function hhmmToDate(hhmm: string, base?: Date | null): Date {
  const d = base ? new Date(base) : new Date();
  if (!isHoraValida(hhmm)) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Combina una fecha `Date` (tomamos año/mes/día LOCAL) con un string
 * "HH:MM" y devuelve el ISO UTC. La gracia es que el form trabaja en
 * hora local del usuario, no UTC.
 */
export function combineLocalDateTime(fecha: Date, horaHHMM: string): string | null {
  if (!isHoraValida(horaHHMM)) return null;
  const [h, m] = horaHHMM.split(':').map(Number);
  const d = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    h,
    m,
    0,
    0,
  );
  return d.toISOString();
}

/**
 * Devuelve un `Date` con la fecha de `iso` (en local) a medianoche.
 * Usado para inicializar el DatePicker en su modo date sin arrastrar
 * horas residuales.
 */
export function isoToLocalDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parsea "DD/MM/AAAA" y devuelve una `Date` local a medianoche, o null
 * si el formato es inválido. NO valida que la fecha exista (ej.
 * 31/02). Usá `isValidLocalDate` después para eso.
 */
export function parseDMY(s: string): Date | null {
  const m = DMY_REGEX.exec(s.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 0, 0, 0, 0);
}

/** Verifica que la fecha realmente exista (no es 31/02, etc.). */
export function isValidLocalDate(d: Date, dd: number, mm: number, yyyy: number): boolean {
  return (
    d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd
  );
}

/** Formato largo para mostrar en el DatePickerField: "Domingo 22 de junio, 2026". */
export function formatDateDisplay(d: Date): string {
  // Usamos Intl directamente; el locale lo dejamos fijo a es-419 (LatAm)
  // porque la app es del coro local. Si en el futuro se i18n-ea, se cambia.
  try {
    return new Intl.DateTimeFormat('es-419', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    // Fallback si Intl falla (no debería en RN moderno, pero por las dudas)
    return dateToYMD(d);
  }
}

/** Capitaliza la primera letra (Intl devuelve "domingo" en minúscula). */
export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formato corto para mostrar en el TimePickerField: "19:00" en 24h. */
export function formatTimeDisplay(d: Date): string {
  return dateToHHMM(d);
}
