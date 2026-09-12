import type { PublicProfileKind } from './community.types';

/**
 * El prefijo de ruta pública de cada vertical.
 *
 * Es el mismo mapa que declara `rutasDeFichasPublicas()` en `app.routes.ts`, y
 * por eso vive acá y no dentro de una pantalla: tres lugares lo necesitan —las
 * rutas, el JSON-LD de la ficha y ahora el panel de contacto del chat— y tres
 * copias se separan la primera vez que nazca una vertical nueva.
 *
 * `PATIENT` está ausente **a propósito**: un paciente no tiene ficha pública, y
 * `undefined` es la respuesta correcta, no un caso olvidado.
 */
const PREFIX: Readonly<Partial<Record<PublicProfileKind, string>>> = {
  PRACTITIONER: 'p',
  ORGANIZATION: 'o',
  PHARMACY: 'f',
  DIAGNOSTIC_UNIT: 'l',
  INSURER: 's',
};

/**
 * El `routerLink` de la ficha pública de un perfil, o `null` si no tiene una.
 *
 * Devuelve `null` en los tres casos en que no hay a dónde ir, y el que llama
 * sólo tiene que preguntar una vez: sin `kind` —la API todavía no lo manda—,
 * sin `slug`, o con una vertical que no se publica (un paciente).
 *
 * @param kind - La vertical de la ficha, si se conoce.
 * @param slug - El identificador legible de la URL pública.
 * @returns Los segmentos para `routerLink`, o `null`.
 */
export function publicProfileLink(
  kind: PublicProfileKind | undefined,
  slug: string | undefined,
): readonly string[] | null {
  const prefix = kind === undefined ? undefined : PREFIX[kind];
  if (prefix === undefined || slug === undefined || slug === '') {
    return null;
  }
  return [`/${prefix}`, slug];
}
