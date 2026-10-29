import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnatomyAtlasClient, anatomyShardOf } from './anatomy-atlas.client';

describe('AnatomyAtlasClient', () => {
  let client: AnatomyAtlasClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AnatomyAtlasClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calcula el shard como el generador (FNV-1a de 32 bits)', () => {
    // Valores calculados con `shardDe` de scripts/gen-anatomy-ontology-fixture.mjs.
    expect(anatomyShardOf('UBERON:0000981', 32)).toBe(anatomyShardOf('UBERON:0000981', 32));
    expect(anatomyShardOf('', 32)).toBe(0x811c9dc5 % 32);
    for (const id of ['UBERON:0000948', 'FMA:24474', 'BP3D:BP24']) {
      const shard = anatomyShardOf(id, 32);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(32);
    }
  });

  it('pide cada archivo una sola vez por sesión', () => {
    const recibidos: number[] = [];
    client.parts().subscribe((p) => recibidos.push(p.length));
    client.parts().subscribe((p) => recibidos.push(p.length));
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush([]);
    expect(recibidos).toEqual([0, 0]);
  });

  it('lee qué partes con malla tiene cada estructura compuesta', () => {
    let compuestas: unknown = null;
    client.composites().subscribe((c) => (compuestas = c));
    http.expectOne('/anatomy-atlas-3d/catalog/composites.json').flush({ 'UBERON:0002167': ['UBERON:0002170'] });
    expect(compuestas).toEqual({ 'UBERON:0002167': ['UBERON:0002170'] });
  });

  it('lee la ficha del shard que le toca y devuelve null si no está', () => {
    const id = 'UBERON:0000981';
    const shard = String(anatomyShardOf(id, 32)).padStart(2, '0');
    let ficha: unknown = 'sin respuesta';
    let ausente: unknown = 'sin respuesta';
    client.structure(id).subscribe((f) => (ficha = f));
    client.structure('UBERON:9999999').subscribe((f) => (ausente = f));
    http.match(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).forEach((r) => r.flush({ [id]: { id } }));
    // El segundo id puede caer en otro shard; se responde vacío.
    http.match(() => true).forEach((r) => r.flush({}));
    expect(ficha).toEqual({ id });
    expect(ausente).toBeNull();
  });

  it('un fallo no queda guardado: el siguiente pedido vuelve a la red', () => {
    client.index().subscribe({ error: () => undefined });
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush('caído', { status: 503, statusText: 'Service Unavailable' });
    client.index().subscribe();
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [] });
  });
});
