import { PAYMENT_PROOF_MAX_BYTES, PAYMENT_PROOF_MIME_TYPES, type PaymentProof } from './billing-simulated.types';

/** El atributo `accept` del selector de archivo: los mismos formatos que valida el servidor. */
export const PAYMENT_PROOF_ACCEPT = PAYMENT_PROOF_MIME_TYPES.join(',');

/** Lo que se le dice a la persona cuando el archivo no sirve. */
export const PAYMENT_PROOF_REJECTION =
  'El comprobante tiene que ser una imagen JPG, PNG o WEBP, o un PDF de hasta 3 MB.';

/** `true` si el archivo cumple formato y tope. */
export function isValidPaymentProof(file: File): boolean {
  return (PAYMENT_PROOF_MIME_TYPES as readonly string[]).includes(file.type) && file.size > 0 && file.size <= PAYMENT_PROOF_MAX_BYTES;
}

/** Lee el archivo como `data:` URL. Rechaza si el navegador no pudo leerlo. */
export function readPaymentProof(file: File): Promise<PaymentProof> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.onload = () =>
      resolve({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl: String(reader.result),
      });
    reader.readAsDataURL(file);
  });
}

/** El tamaño legible: «820 KB», «1,4 MB». */
export function formatProofSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`;
}
