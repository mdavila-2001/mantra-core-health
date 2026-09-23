import { NO_SAVED_PLACES, savedPlacesOf, type SavedPlaces } from './saved-places';
import type { OwnAddress, OwnPatientProfile } from './profiles.types';

/** El resto de `OwnPatientProfile` no importa a este cálculo: se completa con lo mínimo. */
function perfilCon(homeAddress?: OwnAddress, workAddress?: OwnAddress): OwnPatientProfile {
  return {
    residenceMunicipalityConceptId: 'municipio-1',
    homeAddress,
    workAddress,
    coverages: [],
    guardians: [],
  } as unknown as OwnPatientProfile;
}

describe('savedPlacesOf', () => {
  it('sin direcciones, ningún lugar guardado', () => {
    expect(savedPlacesOf(perfilCon())).toEqual(NO_SAVED_PLACES satisfies SavedPlaces);
  });

  it('un par válido de domicilio se traduce a punto', () => {
    const resultado = savedPlacesOf(perfilCon({ latitude: -17.7833, longitude: -63.1821 }));
    expect(resultado.home).toEqual({ lat: -17.7833, lng: -63.1821 });
    expect(resultado.work).toBeNull();
  });

  it('domicilio y trabajo se leen por separado', () => {
    const resultado = savedPlacesOf(
      perfilCon({ latitude: -17.78, longitude: -63.18 }, { latitude: -16.5, longitude: -68.15 }),
    );
    expect(resultado.home).toEqual({ lat: -17.78, lng: -63.18 });
    expect(resultado.work).toEqual({ lat: -16.5, lng: -68.15 });
  });

  it('media coordenada no ubica nada: sólo latitud', () => {
    expect(savedPlacesOf(perfilCon({ latitude: -17.78 })).home).toBeNull();
  });

  it('media coordenada no ubica nada: sólo longitud', () => {
    expect(savedPlacesOf(perfilCon({ longitude: -63.18 })).home).toBeNull();
  });

  it('0,0 no es un origen válido', () => {
    expect(savedPlacesOf(perfilCon({ latitude: 0, longitude: 0 })).home).toBeNull();
  });

  it('una dirección sin coordenadas —sólo texto— no es un lugar guardado', () => {
    expect(savedPlacesOf(perfilCon({ lines: 'Av. Banzer 3er anillo' })).home).toBeNull();
  });
});
