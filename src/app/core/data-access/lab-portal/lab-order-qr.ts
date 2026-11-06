/**
 * El código que lleva el QR de una orden (06/11/2026).
 *
 * El paciente lo genera en «Mis órdenes» y se lo manda al laboratorio o al
 * centro de imagenología, que lo lee por cámara, archivo, portapapeles o
 * desde un adjunto del chat. Un solo formato para quien lo escribe y quien lo
 * lee, para que no puedan discrepar.
 *
 * **Sin firma, sin vencimiento**: es el contrato del simulador (P52). La API
 * real tiene que emitirlo firmado y con plazo antes de que esto salga a
 * producción; quien lo lea no debe confiar en él más que como un identificador.
 */
const PREFIJO = 'ALOVIDA-ORDEN:v1:';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El texto que se dibuja en el QR de la orden. */
export function orderQrCode(orderId: string): string {
  return `${PREFIJO}${orderId}`;
}

/**
 * El id de la orden que lleva un texto leído, o `null` si no es un código de
 * orden. Tolera espacios y saltos de línea alrededor (lo que trae un pegado).
 */
export function orderIdFromQrCode(text: string): string | null {
  const limpio = text.trim();
  if (!limpio.startsWith(PREFIJO)) return null;
  const id = limpio.slice(PREFIJO.length);
  return ID.test(id) ? id.toLowerCase() : null;
}
