import { addressFromPoint, municipalityName, pointLabel } from './address-from-point';
import type { LocalityFromPoint } from './map-location-picker/map-location-picker';

const PUNTO = { lat: -17.7833, lng: -63.1821 };

function localidad(cambio: Partial<LocalityFromPoint> = {}): LocalityFromPoint {
  return {
    punto: PUNTO,
    calle: null,
    calleSola: null,
    zona: null,
    municipioConceptId: null,
    ...cambio,
  };
}

describe('addressFromPoint', () => {
  it('usa la calle deducida cuando la hay', () => {
    expect(addressFromPoint(localidad({ calle: 'Calle Guapay 3861, Equipetrol', zona: 'Equipetrol' }))).toBe(
      'Calle Guapay 3861, Equipetrol',
    );
  });

  it('sin calle, dice la zona y el municipio, sin inventar una calle', () => {
    expect(addressFromPoint(localidad({ zona: 'Equipetrol' }), 'Santa Cruz de la Sierra')).toBe(
      'Equipetrol, Santa Cruz de la Sierra',
    );
  });

  it('sin calle ni zona ni municipio, guarda el punto mismo', () => {
    expect(addressFromPoint(localidad())).toBe('Punto GPS -17.78330, -63.18210');
    expect(pointLabel(PUNTO)).toBe('Punto GPS -17.78330, -63.18210');
  });

  it('corta la línea al largo que admite el control', () => {
    expect(addressFromPoint(localidad({ calle: 'x'.repeat(400) }), null, 300)).toHaveLength(300);
  });
});

describe('municipalityName', () => {
  const ramas = [
    {
      conceptId: 'dep-scz',
      sigla: 'SC',
      nombre: 'Santa Cruz',
      municipios: [{ conceptId: 'mun-scz', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
    },
  ];

  it('traduce el conceptId al nombre del municipio', () => {
    expect(municipalityName(ramas, 'mun-scz')).toBe('Santa Cruz de la Sierra');
  });

  it('devuelve null si no lo conoce', () => {
    expect(municipalityName(ramas, 'otro')).toBeNull();
    expect(municipalityName(ramas, null)).toBeNull();
  });
});
