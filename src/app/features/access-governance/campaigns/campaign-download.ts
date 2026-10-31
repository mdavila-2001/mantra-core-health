import { releaseObjectUrlLater } from '../../../shared/utils/file-download/release-object-url';

/* ============================================================================
    Entrega de un archivo exportado. La API manda el contenido como texto con su `sha256`; acá se convierte en descarga.
   ========================================================================== */

const MIME: Readonly<Record<'csv' | 'json', string>> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

/** `certificacion-q4-2026-2026-11-03.csv`: sin tildes, espacios ni símbolos. */
export function exportFileName(
  campaignName: string,
  format: 'csv' | 'json',
  now: Date = new Date(),
): string {
  const base = campaignName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dia = now.toISOString().slice(0, 10);
  return `${base === '' ? 'campana' : base}-${dia}.${format}`;
}

interface UrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

/** Descarga `content` como archivo. Recibe el documento y la API de URLs para poder probarse sin navegador. */
export function downloadText(
  doc: Document,
  url: UrlApi,
  fileName: string,
  format: 'csv' | 'json',
  content: string,
): void {
  const href = url.createObjectURL(new Blob([content], { type: MIME[format] }));
  const ancla = doc.createElement('a');
  ancla.href = href;
  ancla.download = fileName;
  doc.body.append(ancla);
  ancla.click();
  ancla.remove();
  // Después, no en este tick: Safari y Firefox cancelarían una descarga que aún no empezó (F8).
  releaseObjectUrlLater(href, (u) => url.revokeObjectURL(u));
}
