/**
 * Tipos del dominio del patrón recurrente.
 *
 * Convenciones (deben coincidir con el doc 04 y la función
 * generar_servicios_desde_patron() en la DB):
 * - `0` = Domingo, `1` = Lunes, ..., `6` = Sábado. Coincide con
 *   `extract(dow from ...)` de PostgreSQL.
 * - `hora` se guarda como string "HH:MM" en 24h (formato del jsonb).
 * - `dias` siempre incluye las 7 keys, aunque estén vacías.
 *
 * Ver docs/04-modelo-de-datos.md §2.6.
 */

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Etiquetas legibles por el usuario. */
export const DIAS_LABELS: Record<DiaSemana, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

/**
 * Orden en que mostramos los días en la UI: lunes → domingo.
 * Es la convención más común en calendarios (LatAm, EU), aunque el
 * patrón internamente usa `0=domingo` para coincidir con PostgreSQL.
 */
export const DIAS_ORDEN: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];

/** Etiquetas cortas para chips (3 letras). */
export const DIAS_LABELS_CORTOS: Record<DiaSemana, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

export interface Horario {
  hora: string; // "HH:MM" en 24h
}

export interface PatronConfig {
  dias: Record<string, Horario[]>;
}

export interface PatronCompleto {
  grupo_id: string;
  configuracion: PatronConfig;
  offset_alarma_min: number;
  semanas_generadas: number;
}

/** Patrón vacío por default (lo usa crear_grupo() al inicializar). */
export const PATRON_VACIO: PatronConfig = {
  dias: { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] },
};

/** Defaults para los campos numéricos. Coinciden con la DB. */
export const DEFAULTS = {
  offsetAlarmaMin: 60,
  semanasGeneradas: 4,
  maxSemanas: 26,
  minOffsetMin: 0,
} as const;

/** Valida un string de hora "HH:MM" en 24h. */
export function isHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

/** Convierte `PatronConfig` a un map normalizado para manipular en UI. */
export function configToMap(config: PatronConfig): Record<DiaSemana, Horario[]> {
  return {
    0: config.dias['0'] ?? [],
    1: config.dias['1'] ?? [],
    2: config.dias['2'] ?? [],
    3: config.dias['3'] ?? [],
    4: config.dias['4'] ?? [],
    5: config.dias['5'] ?? [],
    6: config.dias['6'] ?? [],
  };
}

/** Convierte un map de vuelta al formato jsonb del doc. */
export function mapToConfig(map: Record<DiaSemana, Horario[]>): PatronConfig {
  return {
    dias: {
      '0': map[0],
      '1': map[1],
      '2': map[2],
      '3': map[3],
      '4': map[4],
      '5': map[5],
      '6': map[6],
    },
  };
}
