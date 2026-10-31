/**
 * Qué lleva el QR de una invitación: la dirección de «Mis accesos» con el código
 * ya puesto, para que quien lo escanee solo tenga que confirmar.
 *
 * **El código es un secreto de portador** (192 bits de azar que la API guarda solo
 * como huella): quien lo tenga entra. Por eso va en el **fragmento** (`#code=`) y
 * no en la query: el fragmento nunca sale del navegador —no llega a los logs del
 * servidor ni del proxy ni viaja en `Referer`— y, apenas se lee, `my-support` lo
 * borra de la barra de direcciones y del historial (`stripInvitationCode`).
 *
 * El código **no se transforma**: es base64url y distingue mayúsculas de
 * minúsculas. Pasarlo a mayúsculas, como se hacía con el formato viejo, hace que
 * la API lo rechace siempre.
 */
export function invitationLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/my-support#code=${encodeURIComponent(code)}`;
}

/** Quita los espacios que se cuelan al copiar y pegar. No toca mayúsculas ni nada más. */
export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

function fromParams(params: URLSearchParams): string | null {
  const code = params.get('code');
  return code === null || code === '' ? null : normalizeInvitationCode(code);
}

/** El código de una dirección: del fragmento (`#code=`) o, por los QR impresos antes, de la query. */
function codeOfUrl(url: URL): string | null {
  return fromParams(new URLSearchParams(url.hash.replace(/^#/, ''))) ?? fromParams(url.searchParams);
}

/** Si lo pegado es la dirección completa del QR, saca el código; si no, devuelve el texto sin espacios. */
export function codeFromPasted(raw: string): string {
  const texto = raw.trim();
  try {
    const code = codeOfUrl(new URL(texto));
    if (code !== null) return code;
  } catch {
    // No era una dirección: es el código a secas.
  }
  return normalizeInvitationCode(texto);
}

/**
 * Saca el código de la dirección en la que se abrió la pantalla y devuelve esa
 * misma dirección **sin él**, para reemplazarla en el historial. Acepta una ruta
 * relativa (`/my-support#code=…`).
 */
export function stripInvitationCode(path: string): { readonly code: string | null; readonly path: string } {
  const url = new URL(path, 'http://local.invalid');
  const code = codeOfUrl(url);
  if (code === null) return { code: null, path };
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  hash.delete('code');
  url.searchParams.delete('code');
  const resto = hash.toString();
  return { code, path: `${url.pathname}${url.search}${resto === '' ? '' : `#${resto}`}` };
}
