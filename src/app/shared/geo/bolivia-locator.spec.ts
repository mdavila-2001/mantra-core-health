/**
 * El resolvedor de un punto del mapa contra los límites **reales** del
 * producto: las provincias de `public/geo` y los contornos municipales. Un
 * doble de cada capa probaría el algoritmo y no el dato, y el dato es lo que
 * se desalinea (la proyección, la grafía de un nombre, un municipio que no
 * cruzó con el catálogo).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';
import { CONTORNOS_DE_MUNICIPIOS } from '@shared/components/organisms/department-map/bolivia-municipalities.geometry';
import type { ProvinciasDeBolivia } from '@shared/components/organisms/map/provinces';

import { provinciaDeMunicipio, resolverUbicacion } from './bolivia-locator';

const NOMBRES: Readonly<Record<string, string>> = {
  CH: 'Chuquisaca',
  LP: 'La Paz',
  CB: 'Cochabamba',
  OR: 'Oruro',
  PT: 'Potosí',
  TJ: 'Tarija',
  SC: 'Santa Cruz',
  BE: 'Beni',
  PD: 'Pando',
};

/** El catálogo, armado con los mismos municipios que se dibujan. */
const RAMAS: readonly RamaDepartamento[] = Object.entries(NOMBRES).map(([sigla, nombre]) => ({
  conceptId: `dep-${sigla}`,
  sigla,
  nombre,
  municipios: CONTORNOS_DE_MUNICIPIOS.filter((c) => c.sigla === sigla).map((c) => ({
    conceptId: `mun-${c.ine}`,
    nombre: c.nombre,
    ine: c.ine,
  })),
}));

const PROVINCIAS = JSON.parse(
  readFileSync(join(process.cwd(), 'public/geo/bolivia-provincias.geojson'), 'utf8'),
) as ProvinciasDeBolivia;

const cargador = () => Promise.resolve(PROVINCIAS);

describe('resolverUbicacion', () => {
  it.each([
    ['Santa Cruz de la Sierra', { lat: -17.7833, lng: -63.1821 }, 'Santa Cruz', 'Andrés Ibáñez'],
    ['La Paz', { lat: -16.5, lng: -68.15 }, 'La Paz', 'Murillo'],
    ['Sucre', { lat: -19.0333, lng: -65.2627 }, 'Chuquisaca', 'Oropeza'],
    ['Cochabamba', { lat: -17.3935, lng: -66.157 }, 'Cochabamba', 'Cercado'],
  ])('%s: dice el departamento, la provincia y el municipio', async (nombre, punto, dep, prov) => {
    const lugar = await resolverUbicacion(punto, RAMAS, cargador);

    expect(lugar.departamento?.nombre).toBe(dep);
    expect(lugar.provincia).toBe(prov);
    expect(lugar.municipio).not.toBeNull();
    // El municipio es del mismo departamento: nunca uno de otro.
    expect(lugar.departamento?.municipios).toContain(lugar.municipio);
    if (nombre !== 'Cochabamba') expect(lugar.municipio?.nombre).toBe(nombre);
  });

  it('un punto fuera de Bolivia no resuelve nada', async () => {
    const lima = await resolverUbicacion({ lat: -12.04, lng: -77.03 }, RAMAS, cargador);
    const oceano = await resolverUbicacion({ lat: 0, lng: 0 }, RAMAS, cargador);

    expect(lima).toEqual({ departamento: null, provincia: null, municipio: null });
    expect(oceano).toEqual({ departamento: null, provincia: null, municipio: null });
  });

  it('sin provincias igual dice departamento y municipio, y deja la provincia en null', async () => {
    const lugar = await resolverUbicacion({ lat: -16.5, lng: -68.15 }, RAMAS, () =>
      Promise.resolve(null),
    );

    expect(lugar.provincia).toBeNull();
    expect(lugar.departamento?.nombre).toBe('La Paz');
    expect(lugar.municipio?.nombre).toBe('La Paz');
  });

  it('si el cargador de provincias falla no lanza', async () => {
    const lugar = await resolverUbicacion({ lat: -16.5, lng: -68.15 }, RAMAS, () =>
      Promise.reject(new Error('sin red')),
    );

    expect(lugar.departamento?.nombre).toBe('La Paz');
  });
});

describe('provinciaDeMunicipio', () => {
  it('vuelve a deducir la provincia del municipio que se eligió a mano', async () => {
    const sucre = RAMAS.find((r) => r.sigla === 'CH')?.municipios.find((m) => m.nombre === 'Sucre');
    expect(sucre).toBeDefined();

    expect(await provinciaDeMunicipio(sucre!, 'CH', cargador)).toBe('Oropeza');
  });

  it('sin provincias devuelve null', async () => {
    const sucre = RAMAS.find((r) => r.sigla === 'CH')!.municipios[0];

    expect(await provinciaDeMunicipio(sucre, 'CH', () => Promise.resolve(null))).toBeNull();
  });
});
