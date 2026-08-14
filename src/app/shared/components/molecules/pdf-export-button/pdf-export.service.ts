import { Injectable } from '@angular/core';

import type { PdfExportOptions } from '../../../utils/pdf-export/pdf-export';

/**
 * Envuelve la exportación a PDF para que se pueda sustituir en pruebas.
 *
 * ## Por qué existe
 *
 * `exportElementToPdf` es una función de módulo, y una función de módulo no se
 * puede reemplazar: el objeto de espacio de nombres de un módulo ES está
 * congelado. Envolverla da la costura, y sigue la costumbre del repo
 * —`DialogService`, `ToastService`— de que lo que toca el navegador sea
 * inyectable.
 *
 * ## Por qué el import es dinámico
 *
 * **No es una optimización: es lo que evita romper el spec de la utilidad.**
 *
 * `pdf-export.spec.ts` mockea `jspdf` entero y cuenta los documentos que se
 * construyen. Con un `import` estático acá, cualquier archivo de prueba que
 * llegue a este servicio —aunque lo sustituya por un doble y nunca lo ejecute—
 * deja `jspdf` evaluado en el grafo de módulos, el mock del vecino no se aplica
 * y ese spec falla con «Ningún documento se construyó». Falla **en CI y no al
 * correr el archivo solo**, que es la peor combinación para diagnosticar.
 *
 * De paso, `jspdf` deja de entrar en el fragmento de quien sólo importa el
 * botón: se descarga cuando alguien exporta de verdad.
 *
 * El tipo sí se importa estáticamente: `import type` se borra al compilar y no
 * arrastra el módulo.
 */
@Injectable({ providedIn: 'root' })
export class PdfExportService {
  /**
   * Exporta un elemento a un PDF descargable.
   *
   * @param element - Qué exportar.
   * @param filename - Nombre del archivo; se le agrega `.pdf` si falta.
   * @param options - Título del documento.
   * @returns Una promesa que se resuelve cuando el archivo se ofreció, y que
   *   **rechaza** si la generación falló — quien llama decide qué decir.
   */
  async export(
    element: HTMLElement,
    filename: string,
    options: PdfExportOptions = {},
  ): Promise<void> {
    const { exportElementToPdf } = await import(
      '../../../utils/pdf-export/pdf-export'
    );
    exportElementToPdf(element, filename, options);
  }
}
