/**
 * Un tamaño en bytes, dicho como lo diría una persona: «2,4 MB», «812 KB».
 *
 * Base 1024 y una sola cifra decimal, con la coma de `es-BO`. Los bytes sueltos
 * van sin decimales: «0 B», no «0,0 B».
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toLocaleString('es-BO', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}
