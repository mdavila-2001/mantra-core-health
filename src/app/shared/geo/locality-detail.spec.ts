import type { ProvinciasDeBolivia } from '../components/organisms/map/provinces';
import {
  findOutline,
  municipalityAt,
  provinceOfMunicipality,
  unproject,
  type MunicipalityOutlineRef,
  type ProjectionOfBolivia,
} from './locality-detail';

const PROYECCION: ProjectionOfBolivia = { lng0: -70, lat1: -10, coseno: 1, escala: 100 };

const CONTORNOS: readonly MunicipalityOutlineRef[] = [
  { ine: '030301', sigla: 'CB', nombre: 'Sacaba', x: 400, y: 700 },
  { ine: '070201', sigla: 'SC', nombre: 'Warnes', x: 600, y: 700 },
  { ine: '030401', sigla: 'CB', nombre: 'Quillacollo', x: 380, y: 710 },
];

/** Una provincia cuadrada de lado 2° alrededor de (lng -66, lat -17). */
const PROVINCIAS: ProvinciasDeBolivia = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nombre: 'Chapare', departamento: 'Cochabamba', rotulo: [-66, -17] },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-67, -18],
            [-65, -18],
            [-65, -16],
            [-67, -16],
            [-67, -18],
          ],
        ],
      },
    },
  ],
};

describe('locality-detail', () => {
  it('unproject deshace la proyección de las siluetas', () => {
    expect(unproject(400, 700, PROYECCION)).toEqual({ lng: -66, lat: -17 });
  });

  describe('findOutline', () => {
    it('busca por código INE dentro del departamento', () => {
      expect(findOutline(CONTORNOS, 'CB', '030301', 'otro nombre')?.nombre).toBe('Sacaba');
    });

    it('un INE de otro departamento no cuenta', () => {
      expect(findOutline(CONTORNOS, 'SC', '030301', 'Nadie')).toBeNull();
    });

    it('con un código legado cae al nombre, sin tildes ni mayúsculas', () => {
      expect(findOutline(CONTORNOS, 'CB', 'CB-SACABA', 'SÁCABA')?.ine).toBe('030301');
    });

    it('el nombre repetido en otro departamento no se confunde', () => {
      expect(findOutline(CONTORNOS, 'SC', 'SC-X', 'Sacaba')).toBeNull();
    });
  });

  describe('provinceOfMunicipality', () => {
    it('devuelve la provincia que contiene el punto interior del municipio', () => {
      expect(provinceOfMunicipality(PROVINCIAS, CONTORNOS[0], PROYECCION)).toBe('Chapare');
    });

    it('si el punto cae fuera de toda provincia, no inventa una', () => {
      expect(provinceOfMunicipality(PROVINCIAS, CONTORNOS[1], PROYECCION)).toBeNull();
    });

    it('sin provincias o sin contorno devuelve null', () => {
      expect(provinceOfMunicipality(null, CONTORNOS[0], PROYECCION)).toBeNull();
      expect(provinceOfMunicipality(PROVINCIAS, null, PROYECCION)).toBeNull();
    });
  });
});

describe('municipalityAt', () => {
  // Dos cuadrados vecinos de 100 × 100 en el viewBox; con PROYECCION el punto
  // (lng -69, lat -11) cae en (100, 100).
  const CUADRADOS = [
    { ine: '000001', sigla: 'SC', nombre: 'Oeste', x: 50, y: 50, d: 'M0 0L100 0L100 100L0 100Z' },
    { ine: '000002', sigla: 'SC', nombre: 'Este', x: 150, y: 50, d: 'M100 0L200 0L200 100L100 100Z' },
    // Un municipio de dos islas: el punto en la segunda también cuenta.
    { ine: '000003', sigla: 'SC', nombre: 'Islas', x: 350, y: 50, d: 'M300 0L320 0L320 20L300 20ZM380 80L400 80L400 100L380 100Z' },
  ];

  it('devuelve el contorno que contiene el punto', () => {
    expect(municipalityAt(CUADRADOS, { lng: -69.5, lat: -10.5 }, PROYECCION)?.nombre).toBe('Oeste');
    expect(municipalityAt(CUADRADOS, { lng: -68.5, lat: -10.5 }, PROYECCION)?.nombre).toBe('Este');
  });

  it('mira todos los anillos de un municipio partido', () => {
    expect(municipalityAt(CUADRADOS, { lng: -66.1, lat: -10.9 }, PROYECCION)?.nombre).toBe('Islas');
  });

  it('fuera de todo contorno no inventa un municipio', () => {
    expect(municipalityAt(CUADRADOS, { lng: -60, lat: -15 }, PROYECCION)).toBeNull();
  });

  it('con la geometría real: la plaza de Santa Cruz, Cobija y Lima', async () => {
    const { CONTORNOS_DE_MUNICIPIOS, PROYECCION_DE_BOLIVIA } = await import(
      '../components/organisms/department-map/bolivia-municipalities.geometry'
    );
    const en = (lat: number, lng: number) =>
      municipalityAt(CONTORNOS_DE_MUNICIPIOS, { lat, lng }, PROYECCION_DE_BOLIVIA);

    expect(en(-17.7833, -63.1821)).toMatchObject({ ine: '070101', sigla: 'SC' });
    expect(en(-11.0267, -68.7692)?.nombre).toBe('Cobija');
    expect(en(-12.0464, -77.0428)).toBeNull();
  });
});
