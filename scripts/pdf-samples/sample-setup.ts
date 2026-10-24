import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { jsPDF } from 'jspdf';

import { setDocumentSignature, type PdfSignature } from '../../src/app/core/pdf-branding/pdf-signature';
import {
  FONT_FILES,
  setDocumentFonts,
  type PdfFonts,
} from '../../src/app/core/pdf-branding/pdf-fonts';
import type { PdfLogo } from '../../src/app/core/pdf-branding/pdf-logo';

/**
 * Lo que el portal prepara en el navegador antes de exportar —las fuentes de
 * marca, el logo del consultorio, la firma—, preparado acá desde disco para
 * generar las muestras en Node sin canvas ni `fetch`.
 */

const FONTS = 'public/alovida/tipografias';
const FIXTURES = 'scripts/pdf-samples/fixtures';

/** Dónde quedan las muestras: `PDF_SAMPLES_DIR` o `artifacts/pdf-samples/`. */
export const OUTPUT_DIR = process.env['PDF_SAMPLES_DIR'] ?? 'artifacts/pdf-samples';

export function loadBrandFonts(): void {
  const font = (archivo: string) => ({ archivo, base64: readFileSync(join(FONTS, archivo)).toString('base64') });
  const fuentes = Object.fromEntries(
    Object.entries(FONT_FILES).map(([papel, archivo]) => [papel, font(archivo)]),
  ) as PdfFonts;
  setDocumentFonts(fuentes);
}

/** Una imagen PNG de las fixtures, con sus proporciones leídas del encabezado IHDR. */
export function fixtureImage(file: string): PdfLogo {
  const bytes = readFileSync(join(FIXTURES, file));
  return {
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    formato: 'PNG',
    ancho: bytes.readUInt32BE(16),
    alto: bytes.readUInt32BE(20),
  };
}

/** Una profesional ficticia, con firma y sello de muestra. */
export const SAMPLE_SIGNATURE: PdfSignature = {
  nombre: 'Dra. Lucía Fernández Rojas',
  matricula: 'MP-4521',
  firma: fixtureImage('signature.png'),
  sello: fixtureImage('stamp.png'),
};

export function useSampleSignature(): void {
  setDocumentSignature(SAMPLE_SIGNATURE);
}

/** Una fecha fija: las muestras se comparan entre corridas. */
export const SAMPLE_DATE = new Date(2026, 9, 24, 10, 32);

export function savePdf(doc: jsPDF, file: string): string {
  const path = join(OUTPUT_DIR, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(doc.output('arraybuffer')));
  return path;
}
