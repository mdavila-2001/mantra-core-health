/**
 * The code an order QR carries: the patient generates it in «Mis órdenes» and sends it to the
 * center, which reads it (camera, image, clipboard, chat) and the order is addressed to it.
 * One format for whoever writes it and whoever reads it, so they cannot disagree.
 *
 * Simulator contract: unsigned and non-expiring. The real API must issue it signed and with a
 * deadline before this goes to production; readers must treat it as an identifier only.
 */
const PREFIX = 'ALOVIDA-ORDEN:v1:';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The text drawn in an order's QR. */
export function orderQrCode(orderId: string): string {
  return `${PREFIX}${orderId}`;
}

/** The order id a scanned text carries, or `null` if it is not an order code (tolerates pasted whitespace). */
export function orderIdFromQrCode(text: string): string | null {
  const clean = text.trim();
  if (!clean.startsWith(PREFIX)) return null;
  const id = clean.slice(PREFIX.length);
  return ID.test(id) ? id.toLowerCase() : null;
}
