import type { PdfLogo } from './pdf-logo';

/**
 * Lo que firma un documento: la **imagen** de la firma manuscrita, la del sello
 * médico, y el nombre y la matrícula que van escritos debajo.
 *
 * Son imágenes escaneadas, **no una firma electrónica**: nada de certificado ni
 * criptografía. Cada imagen ya viene lista para `jsPDF` (PNG o JPEG, con sus
 * proporciones); {@link prepararLogo} es quien la deja así.
 */
export interface PdfFirma {
  /** El nombre del médico, tal como se imprime bajo la línea. */
  readonly nombre: string;
  /** El número de matrícula, o `null` si no hay ninguna vigente cargada. */
  readonly matricula: string | null;
  readonly firma: PdfLogo | null;
  readonly sello: PdfLogo | null;
}

/**
 * La firma con la que salen los documentos **por omisión**: la del profesional
 * de la sesión. Mismo criterio que el logo (`establecerLogoDeDocumentos`): la
 * deja lista `PdfBrandingService` y cada documento la pisa con `options.firma`
 * (`null` = sin bloque de firma).
 *
 * `null` no es «sin imágenes»: es que **no hay un profesional al que atribuirle
 * el papel** —un paciente que baja su comprobante—, y entonces el documento no
 * lleva bloque de firma. Se limpia al cerrar sesión o cambiar de profesional.
 */
let firmaVigente: PdfFirma | null = null;

export function establecerFirmaDeDocumentos(firma: PdfFirma | null): void {
  firmaVigente = firma;
}

export function firmaDeDocumentos(): PdfFirma | null {
  return firmaVigente;
}
