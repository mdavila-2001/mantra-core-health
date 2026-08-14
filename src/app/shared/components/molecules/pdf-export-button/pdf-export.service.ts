import { Injectable } from '@angular/core';

import {
  exportElementToPdf,
  type PdfExportOptions,
} from '../../../utils/pdf-export/pdf-export';

/**
 * Envuelve la exportación a PDF para que se pueda sustituir en pruebas.
 *
 * La utilidad `exportElementToPdf` es una función de módulo, y una función de
 * módulo no se puede reemplazar: el objeto de espacio de nombres de un módulo
 * ES está congelado, así que `vi.spyOn` sobre él falla. Envolverla en un
 * servicio da la costura, y de paso sigue la costumbre del repo —`DialogService`,
 * `ToastService`— de que lo que toca el navegador sea inyectable.
 *
 * **No agrega lógica**: delega y ya. Si algún día hace falta un PDF con otro
 * motor, éste es el único archivo que cambia.
 */
@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /**
   * Exporta un elemento a un PDF descargable.
   *
   * @param element - Qué exportar.
   * @param filename - Nombre del archivo; se le agrega `.pdf` si falta.
   * @param options - Título del documento.
   */
  export(
    element: HTMLElement,
    filename: string,
    options: PdfExportOptions = {},
  ): void {
    exportElementToPdf(element, filename, options);
  }
}
