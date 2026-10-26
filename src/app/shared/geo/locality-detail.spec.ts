import type { ProvinciasDeBolivia } from '../components/organisms/map/provinces';
import {
  findOutline,
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
