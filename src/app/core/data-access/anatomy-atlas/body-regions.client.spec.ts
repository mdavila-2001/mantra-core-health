import { readFileSync } from 'node:fs';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { AnatomyPart } from './anatomy-atlas.types';
import { BodyRegionsClient, expandBodyRegions } from './body-regions.client';
import type { BodyRegionsFile } from './body-regions.types';

const PEQUENO: BodyRegionsFile = {
  version: 1,
  catalogo: 't',
  mallas: ['A', 'B', 'C'],
  regiones: {
    MANO: { tipo: 'propia', tocar: 'malla', capa: 'skeleton', capas: ['skeleton'], izq: [0], der: [1], centro: [] },
    CODO: {
      tipo: 'propia',
      tocar: 'punto',
      capa: 'skeleton',
      capas: ['skeleton'],
      izq: [0, 2],
      der: [1],
      centro: [],
      encuadre: { modo: 'interseccion', izq: [[0], [2]], der: [[1]], caja: { izq: [0, 0, 0, 1, 1, 1], der: [0, 0, 0, 1, 1, 1] } },
    },
  },
  toque: { MANO: [0, 1] },
};

describe('expandBodyRegions', () => {
  it('resuelve las posiciones de la tabla a ids de malla', () => {
    const mapa = expandBodyRegions(PEQUENO);
    expect(mapa.regiones['MANO'].izq).toEqual(['A']);
    expect(mapa.regiones['CODO'].encuadre?.izq).toEqual([['A'], ['C']]);
    expect(mapa.regiones['MANO'].encuadre).toBeNull();
    expect(mapa.regionDeMalla.get('B')).toBe('MANO');
    expect(mapa.regionDeMalla.has('C')).toBe(false);
  });

  it('falla fuerte ante una posición fuera de la tabla', () => {
    expect(() => expandBodyRegions({ ...PEQUENO, toque: { MANO: [9] } })).toThrow(/fuera de la tabla/);
  });
});

describe('body-regions.json (el que viaja con la app)', () => {
  const leer = <T>(ruta: string): T => JSON.parse(readFileSync(`public/anatomy-atlas-3d/${ruta}`, 'utf8')) as T;
  const archivo = leer<BodyRegionsFile>('catalog/body-regions.json');
  const mapa = expandBodyRegions(archivo);

  it('toda malla que nombra existe en parts.json', () => {
    const existentes = new Set(leer<AnatomyPart[]>('catalog/parts.json').map((p) => p.meshId));
    expect(archivo.mallas.filter((id) => !existentes.has(id))).toEqual([]);
  });

  it('cubre las 156 regiones del catálogo y toda malla tocable apunta a una región que existe', () => {
    expect(Object.keys(mapa.regiones)).toHaveLength(156);
    for (const region of mapa.regionDeMalla.values()) expect(mapa.regiones[region]).toBeDefined();
  });

  it('las mallas de cada lado coinciden con el side del atlas', () => {
    const parts = new Map(leer<AnatomyPart[]>('catalog/parts.json').map((p) => [p.meshId, p]));
    for (const r of Object.values(mapa.regiones)) {
      expect(r.izq.filter((id) => parts.get(id)?.side === 'right')).toEqual([]);
      expect(r.der.filter((id) => parts.get(id)?.side === 'left')).toEqual([]);
    }
  });

  it('las articulaciones traen caja de encuadre por lado', () => {
    const rodilla = mapa.regiones['RODILLA'];
    expect(rodilla.tocar).toBe('punto');
    expect(rodilla.encuadre?.modo).toBe('interseccion');
    expect(rodilla.encuadre?.caja.izq).toHaveLength(6);
  });
});

describe('BodyRegionsClient', () => {
  it('pide el archivo una vez por sesión y no guarda el fallo', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const client = TestBed.inject(BodyRegionsClient);
    const http = TestBed.inject(HttpTestingController);
    const vistos: number[] = [];
    client.regions().subscribe((m) => vistos.push(Object.keys(m.regiones).length));
    client.regions().subscribe((m) => vistos.push(Object.keys(m.regiones).length));
    http.expectOne('/anatomy-atlas-3d/catalog/body-regions.json').flush(PEQUENO);
    expect(vistos).toEqual([2, 2]);

  });

  it('un fallo no queda guardado: el siguiente pedido vuelve a la red', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const client = TestBed.inject(BodyRegionsClient);
    const http = TestBed.inject(HttpTestingController);
    client.regions().subscribe({ error: () => undefined });
    http.expectOne('/anatomy-atlas-3d/catalog/body-regions.json').flush('x', { status: 500, statusText: 'err' });
    client.regions().subscribe({ error: () => undefined });
    http.expectOne('/anatomy-atlas-3d/catalog/body-regions.json').flush(PEQUENO);
    http.verify();
  });
});
