import type { PdfBlock, PdfQrMatrix } from './pdf-document.types';

/**
 * Arma un bloque de código QR para el maquetador.
 *
 * La librería se carga **en diferido**: sólo la necesitan los papeles que
 * llevan QR (la representación gráfica de una factura), y con un `import`
 * estático entraría en el fragmento de todos los documentos.
 *
 * **Nunca rechaza.** Si la librería no carga, devuelve `null` y el documento
 * sale sin QR: sin código, el papel sigue siendo legible.
 *
 * @param content - Lo que codifica el QR (una URL de verificación).
 * @param text - La leyenda que va al lado del código.
 * @param title - El título de la leyenda.
 */
export async function qrBlock(content: string, text: string, title?: string): Promise<PdfBlock | null> {
  const qr = await qrMatrix(content);
  if (qr === null) return null;
  return { kind: 'qr', text, qr, ...(title === undefined ? {} : { title }) };
}

/** La matriz de módulos de un QR con corrección de errores media, o `null`. */
export async function qrMatrix(content: string): Promise<PdfQrMatrix | null> {
  try {
    const module = (await import('qrcode')) as typeof import('qrcode') & {
      readonly default?: typeof import('qrcode');
    };
    const qrcode = module.default ?? module;
    const { modules } = qrcode.create(content, { errorCorrectionLevel: 'M' });
    return { size: modules.size, modules: modules.data };
  } catch {
    return null;
  }
}
