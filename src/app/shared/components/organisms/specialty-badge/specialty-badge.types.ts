/* ============================================================================
    Contratos de la insignia de especialidad.

    Los campos son primitivos a propósito. El tipo que hoy alimenta la pantalla
    —`EspecialidadVisible`, en `features/account/my-profile/…`— vive en una
    feature, y una pieza de `shared/` que importara de ahí quedaría atada a esa
    pantalla: el directorio y la ficha pública traen la misma especialidad con
    otra forma. Cada consumidor mapea lo suyo a esto.
    ========================================================================== */

import type { StatusSealVariant } from '../status-seal/status-seal.types';

/**
 * Una especialidad lista para dibujarse.
 *
 * `estado` y `sello` viajan juntos o no viajan: el sello pone el tono y la
 * forma, y `estado` es el texto que lo dice en palabras. Un sello sin texto
 * sería significado por color, que es justo lo que este componente evita.
 */
export interface SpecialtyBadgeItem {
  readonly id: string;
  readonly nombre: string;
  /** El estado en palabras. Vacío = la insignia no muestra sello. */
  readonly estado: string;
  readonly sello: StatusSealVariant | null;
}
