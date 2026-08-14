/**
 * Cabeceras de seguridad del servidor de producción.
 *
 * Viven aparte de `server.ts` porque son la única lógica del servidor que
 * merece prueba propia: una CSP mal armada rompe la aplicación entera de forma
 * silenciosa —el navegador bloquea recursos sin avisarle a nadie— y el modo de
 * fallo es exactamente el que menos se nota en desarrollo.
 *
 * ## Lo que NO se puede usar acá, y por qué
 *
 * **Nonce por petición, no.** Cuatro rutas se prerenderizan en el build
 * (`/auth`, `/auth/register`, `/auth/forgot-password`, `/design-system`): su HTML se
 * genera cuando todavía no existe ninguna petición que numerar. Un nonce las
 * dejaría con un valor muerto y sus scripts bloqueados.
 *
 * Por eso los scripts en línea se autorizan por **hash**, que es estable entre
 * el build y cada respuesta. Los hashes se calculan recorriendo el HTML del
 * propio artefacto al arrancar —ver `collectInlineScriptHashes`— y no se
 * escriben a mano: escribirlos garantizaría que se separen en el primer cambio.
 *
 * Y no basta con el script del tema. Una página prerenderizada trae **cuatro**
 * scripts en línea: el del tema más los tres que Angular emite para la
 * hidratación (el delegador de eventos, su arranque y el `__nghData__` con el
 * estado del render). Los tres son distintos en cada ruta, y por eso el hash se
 * recolecta del artefacto entero en vez de declararse.
 *
 * **`'unsafe-inline'` en `style-src`, sí.** Angular emite los estilos de
 * componente en línea. Sin él, la aplicación se ve sin estilos. Es un riesgo
 * mucho menor que en `script-src`, y es lo habitual en aplicaciones Angular.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Dónde puede pedir datos el navegador, además del propio origen. */
export interface SecurityHeadersOptions {
  /**
   * Raíz de la API cuando vive en otro dominio.
   *
   * Vacío —lo recomendado— significa mismo origen, y entonces `connect-src`
   * se queda en `'self'`. Es el único valor que cambia entre un despliegue y
   * otro, y viene de `PUBLIC_API_BASE_URL`.
   */
  readonly apiBaseUrl?: string;
  /**
   * Hashes `sha256-…` de los scripts en línea que hay que autorizar.
   *
   * Se calculan del HTML servido, no se declaran a mano.
   */
  readonly inlineScriptHashes?: readonly string[];
}

/**
 * Hash CSP de un script en línea.
 *
 * El contenido es **exactamente** el texto entre `<script>` y `</script>`, sin
 * recortar: un espacio de más cambia el hash y el navegador bloquea el script.
 */
export function cspHashOf(scriptContent: string): string {
  return `'sha256-${createHash('sha256').update(scriptContent, 'utf8').digest('base64')}'`;
}

/**
 * Extrae los scripts en línea de un HTML y devuelve sus hashes.
 *
 * Se ignoran los que llevan `src`: ésos los cubre `'self'`.
 */
export function inlineScriptHashesOf(html: string): string[] {
  const hashes: string[] = [];
  const script = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = script.exec(html)) !== null) {
    hashes.push(cspHashOf(match[1] ?? ''));
  }

  return hashes;
}

/**
 * Recorre el artefacto del navegador y devuelve los hashes de **todos** los
 * scripts en línea que contiene.
 *
 * Cubre `index.csr.html` —el cascarón de las rutas que se pintan en el
 * cliente— y el `index.html` de cada ruta prerenderizada, que traen además los
 * scripts de hidratación de Angular.
 *
 * Si la carpeta no se puede leer devuelve una lista vacía en vez de lanzar: un
 * servidor que no arranca por no poder calcular una cabecera es peor que uno
 * que arranca con una CSP más estrecha y lo dice en los registros.
 */
export function collectInlineScriptHashes(browserDistFolder: string): string[] {
  const hashes = new Set<string>();
  const pending: string[] = [browserDistFolder];

  while (pending.length > 0) {
    // `pop()` sobre un array no vacío siempre devuelve algo, pero el tipo no lo
    // sabe y `noUncheckedIndexedAccess` no está para discutirlo.
    const current = pending.pop();
    if (current === undefined) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          for (const hash of inlineScriptHashesOf(readFileSync(full, 'utf8'))) {
            hashes.add(hash);
          }
        } catch {
          // Un archivo ilegible no debe impedir el arranque.
        }
      }
    }
  }

  return [...hashes];
}

/** El origen de una URL absoluta, o `null` si no lo es. */
function originOf(url: string | undefined): string | null {
  if (url === undefined || url === '') {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * La política de seguridad de contenido, ya armada.
 *
 * `frame-ancestors 'none'` es lo que cierra el clickjacking, y en un sistema de
 * salud importa más que en otros: un iframe superpuesto puede inducir a
 * confirmar una acción clínica que la persona cree estar haciendo en otro sitio.
 */
export function contentSecurityPolicy(options: SecurityHeadersOptions = {}): string {
  const apiOrigin = originOf(options.apiBaseUrl);
  const scriptHashes = options.inlineScriptHashes ?? [];

  return [
    "default-src 'self'",
    `script-src 'self'${scriptHashes.length > 0 ? ` ${scriptHashes.join(' ')}` : ''}`,
    // Angular emite los estilos de componente en línea; sin esto no hay estilos.
    "style-src 'self' 'unsafe-inline'",
    // Las tipografías están autoalojadas: no hace falta abrir ningún CDN.
    "font-src 'self'",
    // `data:` cubre los SVG en línea del sistema de diseño.
    "img-src 'self' data:",
    `connect-src 'self'${apiOrigin === null ? '' : ` ${apiOrigin}`}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Todas las cabeceras de seguridad, listas para `res.setHeader`.
 *
 * `Strict-Transport-Security` solo tiene sentido sobre HTTPS; se emite igual
 * porque un navegador la ignora sobre HTTP y omitirla obligaría a que el
 * servidor supiera si está detrás de TLS, que es información que no tiene.
 */
export function securityHeaders(
  options: SecurityHeadersOptions = {},
): Readonly<Record<string, string>> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    // Impide que el navegador adivine el tipo de un recurso y lo ejecute.
    'X-Content-Type-Options': 'nosniff',
    // Redundante con `frame-ancestors` para navegadores que aún no lo soportan.
    'X-Frame-Options': 'DENY',
    // Una URL con identificadores no debe viajar a otro sitio en el `Referer`.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // La aplicación no usa ninguna de las tres. Declararlo lo hace cumplir.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  };
}
