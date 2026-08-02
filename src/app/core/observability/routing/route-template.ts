import type { Route, Router } from '@angular/router';

import { sanitizeUrl } from '../privacy/sanitize-url';

/**
 * De la URL visitada a la plantilla de ruta.
 *
 * ```
 * /auth/verificar?token=eyJhbGciOi…   →   /auth/verificar
 * /pacientes/8437                     →   /pacientes/:pacienteId
 * ```
 *
 * ## Por qué contra la configuración del Router y no con una expresión regular
 *
 * Una expresión regular tiene que **adivinar** qué segmento es un
 * identificador. Se equivoca en las dos direcciones: `/panel/2026` es un año
 * que forma parte de la ruta, y un identificador con forma de palabra
 * (`/organizacion/clinica-norte`) pasaría intacto. Las dos equivocaciones son
 * caras — la primera parte una operación en mil, la segunda deja un dato
 * identificable en un atributo.
 *
 * La configuración del Router **sabe** cuáles son parámetros, porque están
 * declarados con dos puntos. Recorrerla es más trabajo y es lo correcto.
 *
 * ## Hoy no hay ningún parámetro declarado
 *
 * `app.routes.ts` no tiene ni un `:id`. Esto existe igual porque el día que se
 * agregue `/pacientes/:pacienteId` nadie va a acordarse de volver acá, y el
 * fallo sería silencioso: identificadores de pacientes en los nombres de
 * operación de Jaeger.
 */
export function routeTemplate(router: Router, url: string): string {
  const path = sanitizeUrl(url);
  const segments = path.split('/').filter((segment) => segment !== '');

  const matched = matchSegments(router.config, segments);
  return matched === null ? path : `/${matched.join('/')}`;
}

/**
 * Recorre el árbol de rutas en paralelo con los segmentos de la URL.
 *
 * Devuelve los segmentos **de la plantilla** (con los `:param` tal como se
 * declararon) o `null` si ninguna rama encaja, en cuyo caso quien llama se
 * queda con la ruta saneada. Preferir la ruta real a inventar una plantilla es
 * deliberado: una plantilla equivocada agruparía operaciones distintas.
 */
function matchSegments(routes: readonly Route[], segments: readonly string[]): string[] | null {
  if (segments.length === 0) {
    return [];
  }

  for (const route of routes) {
    // Las rutas comodín no aportan plantilla: agrupar todo lo desconocido bajo
    // `/**` escondería precisamente lo que hay que ver.
    if (route.path === undefined || route.path === '**') {
      continue;
    }

    const declared = route.path.split('/').filter((segment) => segment !== '');
    if (declared.length > segments.length) {
      continue;
    }

    if (!declared.every((segment, index) => matches(segment, segments[index]))) {
      continue;
    }

    const rest = segments.slice(declared.length);
    if (rest.length === 0) {
      return declared;
    }

    const children = matchSegments(route.children ?? [], rest);
    if (children !== null) {
      return [...declared, ...children];
    }

    /**
     * Encajó el prefijo pero no lo que sigue. Puede ser una ruta hija diferida
     * cuya configuración todavía no se cargó (`loadChildren`), así que se
     * conserva lo reconocido y el resto se descarta en vez de dar por buena una
     * plantilla incompleta.
     */
    if (route.loadChildren !== undefined) {
      return declared;
    }
  }

  return null;
}

/** Un segmento declarado encaja si es literal e igual, o si es un parámetro. */
function matches(declared: string, actual: string | undefined): boolean {
  if (actual === undefined) return false;
  return declared.startsWith(':') || declared === actual;
}
