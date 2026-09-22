import type { OwnAddress, OwnPatientProfile } from './profiles.types';

/* ============================================================================
    Los lugares que el paciente ya declaró — domicilio y trabajo —, listos
    para usarse como origen de una búsqueda de proximidad (FT-19 · subtarea
    B.2). No agrega ningún dato: traduce lo que `OwnPatientProfile` ya trae.
    ========================================================================== */

/** Un punto en el mapa, listo para consultar `GET /public/nearby`. */
export interface SavedPlace {
  readonly lat: number;
  readonly lng: number;
}

/** Los dos lugares que el perfil del paciente puede tener guardados. */
export interface SavedPlaces {
  readonly home: SavedPlace | null;
  readonly work: SavedPlace | null;
}

/**
 * Ninguno de los dos lugares está disponible.
 *
 * Es el valor con el que arranca `/nearby-places` mientras el perfil no
 * llegó, y al que cae si la sesión no es de un paciente o el perfil no se
 * pudo leer: en los tres casos el selector de origen se comporta igual —sin
 * lugares que ofrecer, sólo queda «Usar mi ubicación actual»—.
 */
export const NO_SAVED_PLACES: SavedPlaces = { home: null, work: null };

/**
 * El punto de una dirección, o `null` si no ubica nada.
 *
 * Dos motivos para descartarla, los mismos que ya usan `patient-profile-edit`
 * (`puntoDe`) y `my-profile` (`enlaceAlMapa`) por separado — acá se juntan
 * porque un origen de búsqueda tiene que pasar los dos filtros a la vez:
 *
 * 1. **Media coordenada no ubica nada.** Latitud sin longitud —o viceversa—
 *    no es un punto, y tratarla como uno pondría el origen en el meridiano
 *    cero.
 * 2. **`0, 0` no es Bolivia.** Es el valor por el que decae una comparación
 *    floja contra `undefined`, y un origen ahí de verdad da resultados —el
 *    golfo de Guinea también tiene prestadores en el índice, a miles de
 *    kilómetros—, que es peor que no ofrecer el botón.
 */
function placeOf(address: OwnAddress | undefined): SavedPlace | null {
  if (address?.latitude === undefined || address.longitude === undefined) {
    return null;
  }
  if (address.latitude === 0 && address.longitude === 0) {
    return null;
  }
  return { lat: address.latitude, lng: address.longitude };
}

/** Los lugares guardados de un perfil de paciente ya leído. */
export function savedPlacesOf(profile: OwnPatientProfile): SavedPlaces {
  return {
    home: placeOf(profile.homeAddress),
    work: placeOf(profile.workAddress),
  };
}
