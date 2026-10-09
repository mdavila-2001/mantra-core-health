import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';

import {
  departmentByCity,
  placeUnambiguousByCity,
  normalizePlace,
} from './city-department';

const SC = 'geo:bo:department:SC';
const PD = 'geo:bo:department:PD';
const PT = 'geo:bo:department:PT';

/**
 * Tres departamentos, con «San Pedro» en dos de ellos: es uno de los siete
 * nombres que el catálogo del INE repite entre departamentos (Santa Cruz 071005,
 * Pando 090202).
 */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: SC,
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' },
      { conceptId: 'm-sc-2', nombre: 'San Pedro', ine: '071005' },
    ],
  },
  {
    conceptId: PD,
    sigla: 'PD',
    nombre: 'Pando',
    municipios: [
      { conceptId: 'm-pd-1', nombre: 'Cobija', ine: '090101' },
      { conceptId: 'm-pd-2', nombre: 'San Pedro', ine: '090202' },
    ],
  },
  {
    conceptId: PT,
    sigla: 'PT',
    nombre: 'Potosí',
    municipios: [{ conceptId: 'm-pt-1', nombre: 'Potosí', ine: '050101' }],
  },
];

describe('lugarInequivocoPorCiudad', () => {
  it('ubica un municipio con su departamento y con el nombre del catálogo', () => {
    const lugar = placeUnambiguousByCity(RAMAS).get(normalizePlace('santa cruz de la sierra'));

    expect(lugar).toEqual({ departamento: SC, municipio: 'Santa Cruz de la Sierra' });
  });

  it('no adivina un nombre que el catálogo repite entre departamentos', () => {
    // Asignarlo a uno sería mostrar en Pando lo que está en Santa Cruz, o al revés.
    expect(placeUnambiguousByCity(RAMAS).has(normalizePlace('San Pedro'))).toBe(false);
  });

  it('las tildes y las mayúsculas no separan la misma ciudad', () => {
    expect(placeUnambiguousByCity(RAMAS).get(normalizePlace('POTOSI'))?.municipio).toBe('Potosí');
  });

  it('un catálogo vacío no ubica nada', () => {
    expect(placeUnambiguousByCity([]).size).toBe(0);
  });
});

describe('departamentoPorCiudad (la de los directorios ya mergeados)', () => {
  it('no cambió: con un nombre repetido se sigue quedando con el último', () => {
    // Fija que la subtarea 2.3 no alteró clínicas, farmacias ni hospitales.
    // Que esto sea deuda y no un comportamiento deseado está anotado en la ficha.
    expect(departmentByCity(RAMAS).get(normalizePlace('San Pedro'))).toBe(PD);
  });
});
