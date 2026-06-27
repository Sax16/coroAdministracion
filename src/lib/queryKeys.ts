/**
 * Fuente única de query keys de TanStack Query. Centralizarlas evita typos y
 * hace explícita la invalidación. Se amplía a medida que migran más features.
 */
export const qk = {
  grupos: () => ['grupos'] as const,
  grupo: (id: string) => ['grupo', id] as const,
};
