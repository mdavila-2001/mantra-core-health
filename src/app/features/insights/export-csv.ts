/**
 * Exportación a CSV compatible con Excel en configuración regional hispana:
 * separador «;», coma decimal ya escrita por el formateador, y marca BOM para que
 * los acentos se lean bien. Se descarga en el navegador; no sale nada a un servidor.
 */
function cell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[;"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  return [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿', toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
