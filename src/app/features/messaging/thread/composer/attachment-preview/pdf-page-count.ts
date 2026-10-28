import { InjectionToken } from '@angular/core';

/** Cuenta las páginas de un PDF, o `null` si no se puede saber. */
export type PdfPageCounter = (file: File) => Promise<number | null>;

/**
 * El mismo motor que ya rasteriza los PDF en `app-file-preview`, cargado sólo
 * cuando hay un PDF en la vista previa: quien manda fotos no lo descarga.
 */
export const countPdfPages: PdfPageCounter = async (file) => {
  let task: { destroy(): Promise<void> } | null = null;
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
    const loading = pdfjs.getDocument({ data: await file.arrayBuffer() });
    task = loading;
    const pdf = await loading.promise;
    return pdf.numPages;
  } catch {
    // Un PDF protegido o dañado se manda igual; sólo no se dice cuántas páginas tiene.
    return null;
  } finally {
    // Salga bien o mal, el trabajador de pdf.js no queda vivo.
    await task?.destroy().catch(() => undefined);
  }
};

/** Token para que las pruebas no tengan que levantar pdf.js. */
export const PDF_PAGE_COUNTER = new InjectionToken<PdfPageCounter>('PDF_PAGE_COUNTER', {
  providedIn: 'root',
  factory: () => countPdfPages,
});
