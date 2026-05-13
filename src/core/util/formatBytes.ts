import { getByteUnits } from '@i18n';

/**
 * Formate une taille en octets en chaîne lisible (ex: 1.2 Mo / 1.2 MB).
 *
 * Les unités sont résolues selon la langue active (`o/Ko/Mo/Go` en FR,
 * `B/KB/MB/GB` en EN). L'arrondi suit la convention héritée :
 * - sous 1024 → entier ;
 * - sous 100 → un chiffre après la virgule ;
 * - au-delà → entier.
 */
export const formatBytes = (bytes: number): string => {
  const units = getByteUnits();
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
};
