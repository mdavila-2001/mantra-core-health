import { HttpHeaders } from '@angular/common/http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { registrarTerminologia } from './handlers/terminology.handlers';
import {
  AlmacenDeGlosario,
  ArchivoAusente,
  idDeConjunto,
  type LectorDeArchivos,
  type ManifiestoDelGlosario,
} from './glossary-shards';
import { MockRouter } from './mock-router';
import { uuid } from './mock-store';

/**
 * El glosario de la maqueta, leído bajo demanda desde los shards.
 *
 * Estas pruebas leen **la semilla commiteada** (`public/glossary-seed/`) con un
 * lector de disco en vez de `fetch`: es exactamente lo que el navegador baja,
 * así que lo que se prueba es el dato real y no un doble inventado para la
 * prueba. `glossary-data/` —el completo— no está en git; el lector lo declara
 * ausente, que es el caso de cualquier máquina sin la descarga.
 */
const PUBLICO = join(process.cwd(), 'public');

/** Lee de disco y cuenta cada archivo pedido, para probar que la carga es diferida. */
function lectorDeDisco(): { leer: LectorDeArchivos; pedidos: string[] } {
  const pedidos: string[] = [];
  const leer: LectorDeArchivos = (ruta) => {
    pedidos.push(ruta);
    const archivo = join(PUBLICO, ruta);
    if (ruta.startsWith('glossary-data/') || !existsSync(archivo)) {
      return Promise.reject(new ArchivoAusente(ruta));
    }
    return Promise.resolve(JSON.parse(readFileSync(archivo, 'utf8')) as unknown);
  };
  return { leer, pedidos };
}

function montar() {
  const { leer, pedidos } = lectorDeDisco();
  const almacen = new AlmacenDeGlosario(leer);
  const router = new MockRouter();
  registrarTerminologia(router, almacen);

  async function get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const resultado = await match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    });
    return resultado as T;
  }

  return { almacen, get, pedidos };
}

interface Pagina {
  readonly items: readonly {
    conceptId: string;
    display: string;
    translated: boolean;
    category: { internalCode: string };
    tags: readonly string[];
  }[];
  readonly count: number;
  readonly total: number;
  readonly offset: number;
}

describe('glosario de la maqueta en shards (semilla commiteada)', () => {
  it('sin el glosario completo, cae a la semilla', async () => {
    const { almacen } = montar();
    expect(await almacen.origen()).toBe('glossary-seed');
    const manifiesto = await almacen.manifiesto();
    // Los 69 curados + el glosario oficial (CIE-10-ES, CIMA, MedlinePlus, TA98, Wikidata).
    expect(manifiesto.total).toBeGreaterThan(15000);
  });

  it('las facetas cuentan por categoría y por etiqueta sin bajar un solo shard', async () => {
    const { get, pedidos } = montar();
    const facetas = await get<{
      categories: readonly { internalCode: string; count: number; tags: readonly unknown[] }[];
      total: number;
    }>('/terminology/value-sets/$glossary-facets');

    const suma = facetas.categories.reduce((total, categoria) => total + categoria.count, 0);
    expect(suma).toBe(facetas.total);
    expect(facetas.categories.map((c) => c.internalCode)).toContain('glossary-category-disease');
    expect(pedidos.some((ruta) => ruta.includes('/shards/'))).toBe(false);
  });

  it('una categoría pagina en el orden alfabético castellano, con offset y total', async () => {
    const { get } = montar();
    const categoria = idDeConjunto('glossary-category-disease');
    const primera = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: categoria,
      limit: '12',
      offset: '0',
    });
    const segunda = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: categoria,
      limit: '12',
      offset: '12',
    });

    expect(primera.items).toHaveLength(12);
    expect(primera.total).toBeGreaterThan(100);
    expect(segunda.offset).toBe(12);
    const nombres = [...primera.items, ...segunda.items].map((t) => t.display);
    expect([...nombres].sort((a, b) => a.localeCompare(b, 'es'))).toEqual(nombres);
    // Ninguno se repite entre páginas.
    const ids = [...primera.items, ...segunda.items].map((t) => t.conceptId);
    expect(new Set(ids).size).toBe(24);
    for (const termino of primera.items) {
      expect(termino.category.internalCode).toBe('glossary-category-disease');
    }
  });

  it('castellano: todas las enfermedades tienen nombre en castellano, y la tarjeta lo cuenta', async () => {
    const { almacen, get } = montar();
    const enfermedades = (await almacen.manifiesto()).categories.find((c) => c.key === 'disease')!;
    expect(enfermedades.translatedCount).toBe(enfermedades.count);

    const valueSetId = idDeConjunto(enfermedades.internalCode);
    const primera = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId,
      limit: '48',
    });
    const ultima = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId,
      limit: '12',
      offset: String(enfermedades.count - 12),
    });
    expect(primera.items.every((t) => t.translated)).toBe(true);
    expect(ultima.items.every((t) => t.translated)).toBe(true);

    const conjuntos = await get<{ items: readonly { internalCode: string; translatedMemberCount?: number }[] }>(
      '/terminology/value-sets',
      { limit: '200' },
    );
    expect(
      conjuntos.items.find((c) => c.internalCode === enfermedades.internalCode)?.translatedMemberCount,
    ).toBe(enfermedades.translatedCount);
  });

  it('la búsqueda ignora tildes y mayúsculas (también la eñe: «rinon» encuentra «riñón»)', async () => {
    const { get } = montar();
    const rinon = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      q: 'rinon',
      limit: '48',
    });
    expect(rinon.items.some((t) => /riñ[oó]n/i.test(t.display))).toBe(true);

    const conTilde = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      q: 'Neumonía',
      limit: '48',
    });
    const sinTilde = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      q: 'neumonia',
      limit: '48',
    });
    expect(conTilde.total).toBeGreaterThan(0);
    expect(sinTilde.items.map((t) => t.conceptId)).toEqual(conTilde.items.map((t) => t.conceptId));
  });

  it('la etiqueta se intersecta con la categoría en el servidor, no en la pantalla', async () => {
    const { almacen, get } = montar();
    const manifiesto: ManifiestoDelGlosario = await almacen.manifiesto();
    const enfermedades = manifiesto.categories.find((c) => c.key === 'disease')!;
    const [clave, cantidad] = Object.entries(enfermedades.tags).sort((a, b) => b[1] - a[1])[0]!;
    const etiqueta = manifiesto.tags.find((t) => t.key === clave)!;

    const pagina = await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: idDeConjunto(enfermedades.internalCode),
      tagValueSetId: idDeConjunto(etiqueta.internalCode),
      limit: '48',
    });

    expect(pagina.total).toBe(cantidad);
    for (const termino of pagina.items) expect(termino.tags).toContain(etiqueta.name);
  });

  it('abre la ficha de un curado por el mismo id que tenía (los enlaces siguen sirviendo)', async () => {
    const { get } = montar();
    const ficha = await get<{
      display: string;
      clinicalDefinition?: { text: string };
      relations: readonly { conceptId: string; display: string }[];
    }>(`/terminology/concepts/${uuid('concept-glossary-hipertension-arterial')}`);

    expect(ficha.display).toMatch(/hipertensi/i);
    expect(ficha.clinicalDefinition?.text.length).toBeGreaterThan(20);
  });

  it('un término sin definición viaja SIN definición: el simulador no inventa el párrafo', async () => {
    const { get } = montar();
    // CIE-10-ES A00.0 «Cólera debido a Vibrio cholerae 01, biotipo cholerae»: la
    // fuente publica código y nombre, no una definición.
    const ficha = await get<Record<string, unknown>>(
      '/terminology/concepts/27db26c3-93d0-4fcd-a75a-a16af8bb1360',
    );
    expect(ficha['display']).toMatch(/^Cólera debido a Vibrio cholerae/);
    expect(ficha['clinicalDefinition']).toBeUndefined();
    expect(ficha['translated']).toBe(true);
  });

  it('un id que no es de nadie es 404, no una ficha vacía', async () => {
    const { get } = montar();
    const respuesta = await get<{ status: number }>(
      '/terminology/concepts/00000000-0000-4000-a000-000000000000',
    );
    expect(respuesta.status).toBe(404);
  });

  it('una página baja sólo los shards que necesita', async () => {
    const { get, pedidos } = montar();
    await get<Pagina>('/terminology/concepts', {
      includeValueSets: 'true',
      valueSetId: idDeConjunto('glossary-category-disease'),
      limit: '12',
    });
    const shards = pedidos.filter((ruta) => ruta.includes('/shards/'));
    expect(shards).toEqual(['glossary-seed/shards/disease/page-1.json']);
  });

  it('una ficha con `hasDetail` trae la fila completa de detail/, sin perder el id ni las relaciones', async () => {
    const fila = {
      id: 'aa000000-0000-4000-a000-000000000001',
      slug: 'cima-vtm-1',
      categoryKey: 'pharmacology',
      tagKeys: [],
      lang: 'es',
      esName: 'Espiramicina',
      definition: 'Indicaciones verbatim.',
      plainSummaryEs: '',
      relations: [],
      hasDetail: true,
    };
    const archivos: Record<string, unknown> = {
      'glossary-data/manifest.json': {
        version: 1,
        source: 'prueba',
        pageSize: 500,
        total: 1,
        categories: [
          {
            key: 'pharmacology',
            internalCode: 'glossary-category-pharmacology',
            name: 'Farmacología clínica',
            count: 1,
            pages: 1,
            tags: {},
          },
        ],
        tags: [],
      },
      'glossary-data/mock/ids/aa.json': { [fila.id]: ['pharmacology', 1, 0] },
      'glossary-data/shards/pharmacology/page-1.json': [fila],
      'glossary-data/detail/cima-vtm-1.json': {
        ...fila,
        id: 'otro',
        relations: [{ type: 'RELATED_TERM', targetSlug: 'x' }],
        drugFacts: { referenceProduct: { nregistro: '49735' }, sections: [] },
        sourceName: 'CIMA — AEMPS',
      },
    };
    const almacen = new AlmacenDeGlosario((ruta) =>
      ruta in archivos ? Promise.resolve(archivos[ruta]) : Promise.reject(new ArchivoAusente(ruta)),
    );

    const completa = await almacen.porId(fila.id);
    expect(completa?.id).toBe(fila.id);
    expect(completa?.relations).toEqual([]);
    expect(completa?.drugFacts).toEqual({ referenceProduct: { nregistro: '49735' }, sections: [] });
    expect(completa?.sourceName).toBe('CIMA — AEMPS');
  });
});
