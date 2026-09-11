import { jsPDF } from 'jspdf';
import { expect, type Page } from '@playwright/test';

/**
 * Los cinco documentos legales del autorregistro de aseguradora (subtarea 1.2),
 * en el orden del registro de procesos — el mismo de
 * `DOCUMENTOS_LEGALES_DEL_REGISTRO` en `registro-compartido/documentos-legales.ts`.
 */
export const CLAVES_DE_DOCUMENTOS_LEGALES = [
  'constitutionFileId',
  'taxIdentifierFileId',
  'commerceRegistryFileId',
  'operatingLicenseFileId',
  'healthAuthorityCertificateFileId',
] as const;

export type ClaveDeDocumentoLegal = (typeof CLAVES_DE_DOCUMENTOS_LEGALES)[number];

export interface ArchivoDePrueba {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

/** Un PDF real y mínimo, no una cadena de bytes disfrazada de PDF. */
export function pdfDePrueba(titulo: string): ArchivoDePrueba {
  const pdf = new jsPDF();
  pdf.text(titulo, 20, 30);
  pdf.text('Documento de prueba. Sin datos personales.', 20, 45);
  return {
    name: 'documento.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf.output('arraybuffer')),
  };
}

/** Un archivo que no es un PDF válido: formato equivocado o de más de `bytes`. */
export function archivoFalso(
  name: string,
  mimeType: string,
  bytes: number,
): ArchivoDePrueba {
  return { name, mimeType, buffer: Buffer.alloc(bytes) };
}

/** El testId de la dropzone de un documento (`dropzone-pdf.ts`). */
function testIdDeDocumento(clave: ClaveDeDocumentoLegal): string {
  return `registro-organizacion-doc-${clave}`;
}

/**
 * Sube un archivo a la dropzone de `clave` y espera a que termine: `ready`
 * (botón «Quitar» visible) o `error` (alerta con el mensaje).
 */
export async function subirArchivo(
  page: Page,
  clave: ClaveDeDocumentoLegal,
  archivo: ArchivoDePrueba,
): Promise<void> {
  const testId = testIdDeDocumento(clave);
  await page.getByTestId(testId).setInputFiles(archivo);
}

/** Espera a que la dropzone de `clave` termine en `ready` (subida exitosa). */
export async function esperarSubidaLista(page: Page, clave: ClaveDeDocumentoLegal): Promise<void> {
  await expect(page.getByTestId(`${testIdDeDocumento(clave)}-quitar`)).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Sube los 5 documentos legales y avanza el asistente, asumiendo que la
 * página vigente es «Documentación legal obligatoria (PDF) (1 de 2)» —los
 * primeros 4 documentos— y que después de «Continuar» aparece «(2 de 2)»
 * —el certificado del SEDES—. Deja el asistente en la página siguiente
 * («Tu cuenta»).
 */
export async function subirLosCincoDocumentos(page: Page): Promise<void> {
  const [primeraTanda, segundaTanda] = [
    CLAVES_DE_DOCUMENTOS_LEGALES.slice(0, 4),
    CLAVES_DE_DOCUMENTOS_LEGALES.slice(4),
  ] as const;

  for (const clave of primeraTanda) {
    await subirArchivo(page, clave, pdfDePrueba(clave));
    await esperarSubidaLista(page, clave);
  }
  await page.getByTestId('paginated-form-continuar').click();

  await expect(page.locator('.paginated-form__titulo')).toContainText('(2 de 2)');
  for (const clave of segundaTanda) {
    await subirArchivo(page, clave, pdfDePrueba(clave));
    await esperarSubidaLista(page, clave);
  }
  await page.getByTestId('paginated-form-continuar').click();
}
