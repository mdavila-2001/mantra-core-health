import { HttpHeaders } from '@angular/common/http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORIA_EQUIPOS, idDeTermino } from './fixtures/glosario-equipos';
import { AlmacenConCapasDeLaMaqueta } from './glossary-capa-de-equipos';
import { AlmacenDeGlosario, ArchivoAusente, idDeConjunto, type LectorDeArchivos } from './glossary-shards';
import { registrarTerminologia } from './handlers/terminology.handlers';
import { MockRouter } from './mock-router';

/**
 * La capa de equipos de diagnóstico sobre el glosario de los shards.
 *
 * Como `glossary-shards.spec.ts`, lee la semilla commiteada con un lector de
 * disco: lo que se prueba es que la capa se suma al dato real sin romper sus
 * cuentas ni su paginación.
 */
const PUBLICO = join(process.cwd(), 'public');

const leerDeDisco: LectorDeArchivos = (ruta) => {
  const archivo = join(PUBLICO, ruta);
  if (ruta.startsWith('glossary-data/') || !existsSync(archivo)) {
    return Promise.reject(new ArchivoAusente(ruta));
  }
  return Promise.resolve(JSON.parse(readFileSync(archivo, 'utf8')) as unknown);
};

function montar() {
  const base = new AlmacenDeGlosario(leerDeDisco);
  const almacen = new AlmacenConCapasDeLaMaqueta(base);
  const router = new MockRouter();
  registrarTerminologia(router, almacen);

  async function get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return (await match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    })) as T;
  }

  return { base, almacen, get };
}

interface Pagina {
  readonly items: readonly { conceptId: string; display: string; category: { internalCode: string } }[];
  readonly total: number;
}

interface Ficha {
  readonly conceptId: string;
  readonly display: string;
  readonly relations: readonly { type: string; conceptId: string; display: string }[];
}

describe('capa de equipos de diagnóstico del glosario de la maqueta', () => {
  it('suma la categoría «Equipos de diagnóstico» antes de «Otros», y las cuentas cierran', async () => {
    const { base, almacen, get } = montar();
    const [antes, despues] = await Promise.all([base.manifiesto(), almacen.manifiesto()]);
    const claves = despues.categories.map((c) => c.key);
    expect(claves).toContain(CATEGORIA_EQUIPOS.key);
    if (claves.includes('other')) expect(claves.indexOf(CATEGORIA_EQUIPOS.key)).toBe(claves.indexOf('other') - 1);
    expect(despues.total).toBeGreaterThan(antes.total);

    const facetas = await get<{ categories: readonly { count: number }[]; total: number }>(
      '/terminology/value-sets/$glossary-facets',
    );
    expect(facetas.categories.reduce((t, c) => t + c.count, 0)).toBe(facetas.total);
  });

  it('la categoría lista los equipos, y una búsqueda por «ecografo» encuentra el Ecógrafo', async () => {
    const { get } = montar();
    const equipos = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: idDeConjunto(CATEGORIA_EQUIPOS.internalCode),
      limit: '50',
    });
    expect(equipos.items.map((t) => t.display)).toContain('Ecógrafo');
    expect(equipos.total).toBe(equipos.items.length);
    for (const t of equipos.items) expect(t.category.internalCode).toBe(CATEGORIA_EQUIPOS.internalCode);

    const busqueda = await get<Pagina>('/terminology/concepts', { includeValueSets: 'true', q: 'ecografo', limit: '12' });
    expect(busqueda.items.map((t) => t.display)).toContain('Ecógrafo');
  });

  it('la paginación de «todos» no repite ni pierde filas al correr el desplazamiento', async () => {
    const { get } = montar();
    const primera = await get<Pagina>('/terminology/concepts', { includeValueSets: 'true', limit: '12', offset: '0' });
    const segunda = await get<Pagina>('/terminology/concepts', { includeValueSets: 'true', limit: '12', offset: '12' });
    const tercera = await get<Pagina>('/terminology/concepts', { includeValueSets: 'true', limit: '12', offset: '24' });
    const ids = [...primera.items, ...segunda.items, ...tercera.items].map((t) => t.conceptId);
    expect(ids).toHaveLength(36);
    expect(new Set(ids).size).toBe(36);
    expect(primera.total).toBe(segunda.total);
  });

  it('la ficha del Ecógrafo dice qué modalidad realiza y a dónde envía sus datos', async () => {
    const { get } = montar();
    const ecografo = await get<Ficha>(`/terminology/concepts/${idDeTermino('equipo-ecografo')}`);
    expect(ecografo.display).toBe('Ecógrafo');
    const tipos = ecografo.relations.map((r) => r.type);
    expect(tipos).toContain('PERFORMS');
    expect(tipos).toContain('SENDS_DATA_TO');
  });

  it('la cadena «Envía datos a» llega al resultado del paciente sin ciclos', async () => {
    const { get } = montar();
    const vistos: string[] = [];
    let actual: string | undefined = idDeTermino('equipo-ecografo');
    while (actual !== undefined && vistos.length < 10) {
      expect(vistos).not.toContain(actual);
      vistos.push(actual);
      const ficha: Ficha = await get<Ficha>(`/terminology/concepts/${actual}`);
      actual = ficha.relations.find((r) => r.type === 'SENDS_DATA_TO')?.conceptId;
    }
    expect(vistos.at(-1)).toBe(idDeTermino('datos-resultado-del-paciente'));
  });

  it('la modalidad Ecografía incluye estudios curados del glosario base', async () => {
    const { get } = montar();
    const ecografia = await get<Ficha>(`/terminology/concepts/${idDeTermino('modalidad-ecografia')}`);
    const incluidos = ecografia.relations.filter((r) => r.type === 'INCLUDES');
    expect(incluidos.length).toBeGreaterThan(0);
    for (const estudio of incluidos) {
      const ficha = await get<Ficha>(`/terminology/concepts/${estudio.conceptId}`);
      expect(ficha.display).toBe(estudio.display);
    }
  });
});
