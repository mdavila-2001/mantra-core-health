import { HttpHeaders } from '@angular/common/http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OfficialDirectory } from './official-directory';
import { ArchivoAusente, type LectorDeArchivos } from './glossary-shards';
import { registrarPublico } from './handlers/public.handlers';
import { MockRouter } from './mock-router';

/**
 * El directorio oficial en la maqueta, leído de `public/directorio-oficial/`
 * —el archivo commiteado, el mismo que baja el navegador—, no de un doble.
 */
const PUBLICO = join(process.cwd(), 'public');
const leerDeDisco: LectorDeArchivos = (ruta) => {
  const archivo = join(PUBLICO, ruta);
  if (!existsSync(archivo)) return Promise.reject(new ArchivoAusente(ruta));
  return Promise.resolve(JSON.parse(readFileSync(archivo, 'utf8')) as unknown);
};

function montar() {
  const router = new MockRouter();
  registrarPublico(router, new OfficialDirectory(leerDeDisco));
  return async function get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
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
  };
}

interface Resultado {
  readonly kind: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly city: string | null;
  readonly verified: boolean;
  readonly location: { lat: number; lng: number } | null;
  readonly category: { code: string } | null;
  readonly distanceKm?: number;
}

describe('directorio oficial en el buscador de la maqueta', () => {
  it('las farmacias de AGEMED salen en el buscador de farmacias, con su resolución y sin «verificado»', async () => {
    const get = montar();
    const pagina = await get<{ items: readonly Resultado[]; totalHint: number }>('/public/search/pharmacies', {
      city: 'Cobija',
      limit: '200',
    });
    const deAgemed = pagina.items.filter((r) => r.headline?.includes('Resolución AGEMED'));
    // Pando no tenía ni una farmacia en el directorio anterior.
    expect(deAgemed.length).toBeGreaterThan(20);
    expect(deAgemed.every((r) => r.kind === 'PHARMACY' && r.city === 'Cobija' && !r.verified)).toBe(true);
  });

  it('los establecimientos del RUES salen como organizaciones, con su categoría', async () => {
    const get = montar();
    const pagina = await get<{ items: readonly Resultado[] }>('/public/search/organizations', { q: 'RUES', limit: '500' });
    expect(pagina.items.length).toBeGreaterThan(100);
    const categorias = new Set(pagina.items.map((r) => r.category?.code));
    expect(categorias).toContain('centro-de-primer-nivel');
    expect(categorias).toContain('hospital-publico');
    expect(categorias).toContain('caja-de-salud');
  });

  it('pedir sólo verificados deja afuera al directorio oficial', async () => {
    const get = montar();
    const pagina = await get<{ items: readonly Resultado[] }>('/public/search/pharmacies', { verified: 'true', limit: '500' });
    expect(pagina.items.some((r) => r.headline?.includes('AGEMED'))).toBe(false);
  });

  it('la ficha de una farmacia oficial abre, dice su fuente y tiene una sola sede', async () => {
    const get = montar();
    const [primera] = (await get<{ items: readonly Resultado[] }>('/public/search/pharmacies', { city: 'Trinidad', limit: '1' })).items;
    expect(primera).toBeDefined();
    const ficha = await get<{ displayName: string; biography: string; verified: boolean }>(`/public/profiles/f/${primera!.slug}`);
    expect(ficha.displayName).toBe(primera!.displayName);
    expect(ficha.biography).toContain('AGEMED');
    expect(ficha.verified).toBe(false);
    const sedes = await get<{ items: readonly unknown[] }>(`/public/profiles/f/${primera!.slug}/branches`);
    expect(sedes.items).toHaveLength(1);
    const productos = await get<{ items: readonly unknown[] }>(`/public/profiles/f/${primera!.slug}/products`);
    expect(productos.items).toEqual([]);
  });

  it('la vitrina de medicamentos lleva el ATC real del catálogo universal y no inventa marcas', async () => {
    const get = montar();
    const { items } = await get<{ items: readonly { genericName: string; atcCode: string; brands: readonly string[]; therapeuticGroup: string }[] }>(
      '/public/medications',
    );
    expect(items.length).toBe(15);
    expect(items.every((m) => /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(m.atcCode))).toBe(true);
    expect(items.find((m) => m.genericName === 'Enalapril')?.atcCode).toBe('C09AA02');
    expect(items.find((m) => m.genericName === 'Enalapril')?.therapeuticGroup).toBe('Sistema cardiovascular');
    expect(items.every((m) => m.brands.length === 0)).toBe(true);
  });

  it('«cercanos» encuentra farmacias reales con coordenada alrededor de la Plaza Murillo', async () => {
    const get = montar();
    const cerca = await get<{ items: readonly Resultado[] }>('/public/nearby', {
      lat: '-16.4955',
      lng: '-68.1336',
      radiusKm: '1',
      kind: 'PHARMACY',
      limit: '20',
    });
    expect(cerca.items.length).toBeGreaterThan(5);
    expect(cerca.items.every((r) => (r.distanceKm ?? 99) <= 1)).toBe(true);
  });
});
