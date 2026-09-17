/**
 * Utilidades para transformar un teléfono tal como lo guarda la API en un
 * destino accionable (`tel:`, `https://wa.me/…`).
 *
 * Ninguna de las tres funciones valida formato: eso ya lo hizo el servidor al
 * escribir el dato. Acá sólo se limpia lo que un enlace nativo no admite.
 */

/**
 * Deja un teléfono en la forma que `tel:` acepta.
 *
 * RFC 3966 sólo tolera `+`, `-`, `.`, `(` y `)` como separadores dentro de un
 * `tel:`; un espacio (frecuente en cómo se lee un número boliviano) deja el
 * enlace muerto en el navegador que sí respeta la norma. Se quita todo lo que
 * no sea dígito o signo `+`.
 *
 * @param raw - El teléfono tal como lo guarda la API.
 * @returns El teléfono listo para `'tel:' + dialable(raw)`.
 */
export function dialable(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

/**
 * Deja sólo los dígitos de un teléfono, para un enlace `wa.me`.
 *
 * `wa.me` no acepta el signo `+` ni separadores: quiere el número completo
 * (código de país incluido) como una cadena de dígitos.
 *
 * @param raw - El teléfono tal como lo guarda la API (se espera E.164, con `+`).
 * @returns Sólo los dígitos.
 */
export function whatsappDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Arma el enlace de WhatsApp con un mensaje pre-cargado.
 *
 * @param raw - El teléfono tal como lo guarda la API.
 * @param text - El mensaje a precargar en el chat.
 * @returns La URL de `wa.me`, o `null` si el teléfono no deja dígitos
 *   suficientes para ser un número real (menos de 7): un enlace `wa.me/`
 *   sin número abre WhatsApp sin ningún destinatario, que es peor que no
 *   ofrecer el botón.
 */
export function whatsappUrl(raw: string, text: string): string | null {
  const digits = whatsappDigits(raw);
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
