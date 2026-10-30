import { jsPDF } from 'jspdf';
import { expect, type Page } from '@playwright/test';

/**
 * Los cinco documentos legales del autorregistro de aseguradora (subtarea 1.2),
 * en el orden del registro de procesos — el mismo de
 * `DOCUMENTOS_LEGALES_DEL_REGISTRO` en `shared-registration/legal-documents.ts`.
 */
export const CLAVES_DE_DOCUMENTOS_LEGALES = [
  'constitutionFileId',
  'taxIdentifierFileId',
  'commerceRegistryFileId',
  'operatingLicenseFileId',
  'healthAuthorityCertificateFileId',
] as const;

export type ClaveDeDocumentoLegal = (typeof CLAVES_DE_DOCUMENTOS_LEGALES)[number];

/** Las claves de documento que puede manejar un `<app-dropzone-pdf>` en este alta (subtarea 1.4). */
export type ClaveDeDocumentoDelAlta = ClaveDeDocumentoLegal | 'powerOfAttorneyFileId';

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

/**
 * El testId de la dropzone de un documento (`dropzone-pdf.ts`).
 *
 * Exportado desde la subtarea 1.4: el helper del poder notariado
 * (`representante-legal.ts`) lo necesita para el sexto documento del alta,
 * que vive fuera de {@link CLAVES_DE_DOCUMENTOS_LEGALES}.
 */
export function testIdDeDocumento(clave: ClaveDeDocumentoDelAlta): string {
  return `registro-organizacion-doc-${clave}`;
}

/**
 * Sube un archivo a la dropzone de `clave` y espera a que termine: `ready`
 * (botón «Quitar» visible) o `error` (alerta con el mensaje).
 */
export async function subirArchivo(
  page: Page,
  clave: ClaveDeDocumentoDelAlta,
  archivo: ArchivoDePrueba,
): Promise<void> {
  const testId = testIdDeDocumento(clave);
  await page.getByTestId(testId).setInputFiles(archivo);
}

/** Espera a que la dropzone de `clave` termine en `ready` (subida exitosa). */
export async function esperarSubidaLista(
  page: Page,
  clave: ClaveDeDocumentoDelAlta,
): Promise<void> {
  await expect(page.getByTestId(`${testIdDeDocumento(clave)}-quitar`)).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Sube los 5 documentos legales y avanza el asistente, asumiendo que la
 * página vigente es «Documentación legal obligatoria (PDF)» —los cinco en una
 * sola vista—. Deja el asistente en «Representante legal (1 de 2)».
 */
export async function subirLosCincoDocumentos(page: Page): Promise<void> {
  for (const clave of CLAVES_DE_DOCUMENTOS_LEGALES) {
    await subirArchivo(page, clave, pdfDePrueba(clave));
    await esperarSubidaLista(page, clave);
  }
  await page.getByTestId('paginated-form-continuar').click();
}
