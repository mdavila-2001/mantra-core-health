/**
 * Cabeceras propias de las páginas que llevan en su dirección el token de un
 * enlace compartido de receta (S-6, REQ-FAR-01-019).
 *
 * `/rx/<token>` y la de la farmacia que cuelga de ella ya piden `noindex` y
 * `no-referrer` con una etiqueta `<meta>`, pero esa etiqueta la pone
 * JavaScript: un buscador que lee el HTML crudo no la ve, y el navegador manda
 * el `Referer` de los recursos que pide antes de que la página arranque. Acá
 * salen en la respuesta del servidor, para la primera carga.
 *
 * Lo mismo vale para el login al que se llega desde «Soy farmacia»: lleva el
 * token en `returnUrl`, y con la política general cada petición que hace la
 * pantalla lo repetiría en su `Referer`.
 *
 * `/verify/rx/<id>` lleva el id de la receta, que no es credencial: no se
 * indexa (su página ya lo pide) pero no necesita más.
 */

/** Las dos marcas: ni indexar ni mandar la dirección como `Referer`. */
const TOKEN_PAGE_HEADERS: Readonly<Record<string, string>> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

const VERIFY_PAGE_HEADERS: Readonly<Record<string, string>> = {
  'X-Robots-Tag': 'noindex, nofollow',
};

/** `/rx/<algo>` como segmento entero, en cualquier lugar de la ruta, salvo tras `verify`. */
const TOKEN_ROUTE = /(?:^|\/)(?<!verify\/)rx\/+[^/]/i;
const VERIFY_ROUTE = /(?:^|\/)verify\/+rx\//i;

function decoded(value: string): string {
  let text = value;
  for (let pass = 0; pass < 3 && text.includes('%'); pass += 1) {
    try {
      text = decodeURIComponent(text);
    } catch {
      break;
    }
  }
  return text;
}

/**
 * Las cabeceras de más para una petición de página, o un objeto vacío.
 *
 * @param url - `request.originalUrl`: ruta y query.
 */
export function shareTokenPageHeaders(url: string): Readonly<Record<string, string>> {
  const cut = url.search(/[?#]/);
  const path = decoded(cut === -1 ? url : url.slice(0, cut));
  const query = cut === -1 ? '' : decoded(url.slice(cut + 1));
  if (TOKEN_ROUTE.test(path) || TOKEN_ROUTE.test(query)) {
    return TOKEN_PAGE_HEADERS;
  }
  if (VERIFY_ROUTE.test(path)) {
    return VERIFY_PAGE_HEADERS;
  }
  return {};
}
