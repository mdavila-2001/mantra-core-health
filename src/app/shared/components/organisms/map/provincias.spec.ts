import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';

import {
  CARGADOR_DE_PROVINCIAS,
  type ProvinciasDeBolivia,
  RUTA_DE_PROVINCIAS,
  provinciaEn,
} from './provincias';

/**
 * El archivo que baja el mapa, leído del disco: lo que se fija acá es el dato
 * que se publica, no un doble de él.
 */
const PROVINCIAS = JSON.parse(
  readFileSync(join(process.cwd(), 'public', RUTA_DE_PROVINCIAS), 'utf-8'),
) as ProvinciasDeBolivia;

describe('las provincias de Bolivia', () => {
  it('son las 112 de la división política, repartidas como corresponde', () => {
    // La fuente trae 110: las cuatro «Cercado» fundidas en una y «Gualberto
    // Villarroel» partida en dos. Si alguien regenera el archivo sin las dos
    // correcciones, esto se pone rojo.
    const porDepartamento: Record<string, number> = {};
    for (const { properties } of PROVINCIAS.features) {
      porDepartamento[properties.departamento] =
        (porDepartamento[properties.departamento] ?? 0) + 1;
    }
    expect(PROVINCIAS.features).toHaveLength(112);
    expect(porDepartamento).toEqual({
      'La Paz': 20,
      Cochabamba: 16,
      Oruro: 16,
      Potosí: 16,
      'Santa Cruz': 15,
      Chuquisaca: 10,
      Beni: 8,
      Tarija: 6,
      Pando: 5,
    });
  });

  it('no repiten nombre dentro de un departamento', () => {
    const claves = PROVINCIAS.features.map(
      ({ properties }) => `${properties.departamento}/${properties.nombre}`,
    );
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('cada nombre se escribe dentro de su propia provincia', () => {
    for (const provincia of PROVINCIAS.features) {
      const [lng, lat] = provincia.properties.rotulo;
      expect(
        provinciaEn(PROVINCIAS, { lat, lng })?.properties.nombre,
        provincia.properties.nombre,
      ).toBe(provincia.properties.nombre);
    }
  });

  it.each([
    ['la Plaza Murillo', -16.4958, -68.1336, 'Murillo', 'La Paz'],
    ['el centro de Santa Cruz', -17.7833, -63.1821, 'Andrés Ibáñez', 'Santa Cruz'],
    ['la plaza de Cochabamba', -17.3935, -66.157, 'Cercado', 'Cochabamba'],
    ['la plaza de Tarija', -21.5355, -64.7296, 'Cercado', 'Tarija'],
    ['la plaza de Trinidad', -14.8333, -64.9, 'Cercado', 'Beni'],
    ['la plaza de Sucre', -19.0476, -65.2596, 'Oropeza', 'Chuquisaca'],
  ])('%s cae en %s', (_, lat, lng, nombre, departamento) => {
    const provincia = provinciaEn(PROVINCIAS, { lat, lng });
    expect(provincia?.properties).toMatchObject({ nombre, departamento });
  });

  it('un punto fuera de Bolivia no cae en ninguna', () => {
    expect(provinciaEn(PROVINCIAS, { lat: -34.6037, lng: -58.3816 })).toBeNull();
  });
});

describe('CARGADOR_DE_PROVINCIAS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('baja el archivo una sola vez por sesión', async () => {
    const fetchFalso = vi.fn((_ruta: URL) =>
      Promise.resolve(new Response(JSON.stringify(PROVINCIAS), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const cargar = TestBed.inject(CARGADOR_DE_PROVINCIAS);

    const primera = await cargar();
    const segunda = await cargar();

    expect(primera?.features).toHaveLength(112);
    expect(segunda).toBe(primera);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(String(fetchFalso.mock.calls[0]?.[0])).toContain(RUTA_DE_PROVINCIAS);
  });

  it('si falla devuelve `null` y el próximo mapa lo vuelve a intentar', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('sin red'))
      .mockResolvedValueOnce(new Response(JSON.stringify(PROVINCIAS), { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    const cargar = TestBed.inject(CARGADOR_DE_PROVINCIAS);

    expect(await cargar()).toBeNull();
    expect(await cargar()).toBeNull();
    expect((await cargar())?.features).toHaveLength(112);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  });
});
