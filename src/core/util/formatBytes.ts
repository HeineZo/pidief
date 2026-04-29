const UNITS = ['o', 'Ko', 'Mo', 'Go'] as const;

/**
 * Formate une taille en octets en chaîne lisible (ex: 1.2 Mo).
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} ${UNITS[0]}`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
};
