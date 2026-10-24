/**
 * Utilidades para transformar un teléfono tal como lo guarda la API en un
 * destino accionable (`tel:`, `https://wa.me/…`).
 *
 * `dialable` y `whatsappDigits` no validan formato: eso ya lo hizo el
 * servidor al escribir el dato, y `callCenterPhone` (que usa `dialable`) ni
 * siquiera exige E.164. `whatsappUrl` es la excepción: sí rechaza un valor
 * que no puede ser un WhatsApp real (CA-2.4, Tarea 2), porque un enlace
 * `wa.me/` roto es peor que no ofrecer el botón.
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
 * Devuelve `null` en dos casos (CA-2.4, Tarea 2): si `raw` trae una letra
 * —un dato mal cargado, no un teléfono— o si, ya limpio de todo lo que no
 * sea dígito, quedan menos de 8 (el mínimo E.164 con código de país que
 * también exige la API, `backbone.dto.ts`). Un enlace `wa.me/` sin número
 * real abre WhatsApp sin ningún destinatario, que es peor que no ofrecer
 * el botón. Con `text` vacío la URL no lleva `?text=`: un parámetro vacío
 * no agrega nada y ensucia la URL que ve quien la abre.
 *
 * @param raw - El teléfono tal como lo guarda la API.
 * @param text - El mensaje a precargar en el chat.
 * @returns La URL de `wa.me`, o `null` si `raw` no puede ser un WhatsApp real.
 */
export function whatsappUrl(raw: string, text: string): string | null {
  if (/[a-z]/i.test(raw)) return null;
  const digits = whatsappDigits(raw);
  if (digits.length < 8) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}
