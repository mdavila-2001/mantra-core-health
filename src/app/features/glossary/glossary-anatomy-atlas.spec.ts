import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { anatomyShardOf } from '../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import { ATLAS_3D_FEMALE_ONLY_IDS } from '../../core/data-access/anatomy-atlas/anatomy-ontology.generated';
import type { AnatomyPart, AnatomyStructure } from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { GlossaryAnatomyAtlas } from './glossary-anatomy-atlas';

const UTERO = 'UBERON:0000995';

const PARTES: readonly AnatomyPart[] = [
  { meshId: 'FMA24474', layer: 'skeleton', sex: 'shared', structureId: 'UBERON:0000981', shard: 0, side: 'right', labelEn: 'right femur', match: 'fma_parent' },
];

const FICHA_SIN_DEFINICION: AnatomyStructure = {
  id: UTERO,
  labelEn: 'uterus',
  labelEs: 'útero',
  synonymsEn: [],
  fma: ['17558'],
  regions: ['R05'],
  definition: null,
  isA: [],
  relations: [],
  incoming: [],
  netter: [],
  meshes: [],
  extendedDescription: null,
  images: [],
};

/** Las mallas que la página resalta: es estado interno, se lee para no depender del WebGL. */
const seleccion = (pagina: GlossaryAnatomyAtlas): string[] =>
  (pagina as unknown as { selectedMeshes: () => string[] }).selectedMeshes();

describe('GlossaryAnatomyAtlas', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'glossary/anatomy-atlas', component: GlossaryAnatomyAtlas }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  function html(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function responderCatalogo(partes: readonly AnatomyPart[] = PARTES, compuestas: object = {}): void {
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(partes);
    http.expectOne('/anatomy-atlas-3d/catalog/composites.json').flush(compuestas);
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [[UTERO, 'útero', 'uterus', 0]] });
  }

  it('la vista «Mujer» dice de dónde salen las piezas femeninas y qué sigue siendo del cuerpo de referencia', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas?sex=female');
    responderCatalogo();
    harness.detectChanges();
    const aviso = html().querySelector('[data-testid="atlas3d-aviso-mujer"]')?.textContent ?? '';
    expect(aviso).toContain('Cuerpo femenino de referencia');
    expect(aviso).toContain('Visible Human Female');
    expect(aviso).toContain('HuBMAP');
    expect(aviso).toContain('que es masculino');
    expect(aviso).toContain('La vagina, la vulva');
    expect(html().textContent).toContain('Piezas femeninas del modelo');
    expect(html().textContent).toContain('Estructuras femeninas sin pieza 3D');
  });

  it('en «Mujer» separa las estructuras femeninas con pieza 3D de las que no tienen', async () => {
    const VAGINA = 'UBERON:0000996';
    await harness.navigateByUrl('/glossary/anatomy-atlas?sex=female');
    http
      .expectOne('/anatomy-atlas-3d/catalog/parts.json')
      .flush([
        { meshId: 'VH_F_body_of_uterus', layer: 'organs', sex: 'female', structureId: 'UBERON:0009853', shard: 0, side: null, labelEn: 'body of uterus', match: 'hra_exact' },
        { meshId: 'VH_F_fat_L', layer: 'organs', sex: 'female', structureId: 'FMA:73166', shard: 0, side: 'left', labelEn: 'left mammary fat', match: 'hra_only' },
      ]);
    http.expectOne('/anatomy-atlas-3d/catalog/composites.json').flush({ [UTERO]: ['UBERON:0009853'], 'FMA:57991': ['FMA:73166'] });
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({
      shards: 32,
      entries: [
        [UTERO, 'útero', 'uterus', 1],
        ['UBERON:0009853', 'cuerpo del útero', 'body of uterus', 1],
        ['FMA:57991', 'glándula mamaria izquierda', 'left mammary gland', 1],
        ['FMA:73166', 'tejido adiposo interlobular de la glándula mamaria izquierda', 'x', 1],
        [VAGINA, 'vagina', 'vagina', 0],
      ],
    });
    harness.detectChanges();
    const conPieza = html().querySelector('[data-testid="atlas3d-femeninas-modelo"]')?.textContent ?? '';
    const sinPieza = html().querySelector('[data-testid="atlas3d-femeninas-sin-pieza"]')?.textContent ?? '';
    expect(conPieza).toContain('útero');
    expect(conPieza).toContain('cuerpo del útero');
    expect(conPieza).toContain('glándula mamaria izquierda');
    expect(conPieza).not.toContain('vagina');
    expect(sinPieza).toContain('vagina');
    expect(sinPieza).not.toContain('útero');
  });

  it('en «Mujer» el útero resalta las piezas femeninas que lo forman, y en «Hombre» ninguna', async () => {
    const partes: AnatomyPart[] = [
      { meshId: 'VH_F_body_of_uterus', layer: 'organs', sex: 'female', structureId: 'UBERON:0009853', shard: 0, side: null, labelEn: 'body of uterus', match: 'hra_exact' },
      { meshId: 'VH_F_cervix', layer: 'organs', sex: 'female', structureId: 'UBERON:0000002', shard: 0, side: null, labelEn: 'uterine cervix', match: 'hra_exact' },
    ];
    const compuestas = { [UTERO]: ['UBERON:0000002', 'UBERON:0009853'] };
    const shard = String(anatomyShardOf(UTERO, 32)).padStart(2, '0');

    const mujer = await harness.navigateByUrl(`/glossary/anatomy-atlas?sex=female&structure=${encodeURIComponent(UTERO)}`, GlossaryAnatomyAtlas);
    responderCatalogo(partes, compuestas);
    http.expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).flush({ [UTERO]: FICHA_SIN_DEFINICION });
    harness.detectChanges();
    expect(seleccion(mujer).sort()).toEqual(['VH_F_body_of_uterus', 'VH_F_cervix']);

    const hombre = await harness.navigateByUrl(`/glossary/anatomy-atlas?structure=${encodeURIComponent(UTERO)}`, GlossaryAnatomyAtlas);
    harness.detectChanges();
    expect(seleccion(hombre)).toEqual([]);
  });

  it('con «Hombre» no muestra el aviso', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas');
    responderCatalogo();
    harness.detectChanges();
    expect(html().querySelector('[data-testid="atlas3d-aviso-mujer"]')).toBeNull();
  });

  it('una estructura sin definición en la ontología lo dice, y no la completa', async () => {
    await harness.navigateByUrl(`/glossary/anatomy-atlas?structure=${encodeURIComponent(UTERO)}`);
    responderCatalogo();
    const shard = String(anatomyShardOf(UTERO, 32)).padStart(2, '0');
    http.expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).flush({ [UTERO]: FICHA_SIN_DEFINICION });
    harness.detectChanges();
    expect(html().querySelector('[data-testid="atlas3d-ficha-titulo"]')?.textContent).toContain('útero');
    expect(html().querySelector('[data-testid="atlas3d-sin-definicion"]')?.textContent).toContain('no se completa a mano');
    expect(html().textContent).toContain('traducción automática sin revisar');
    expect(html().textContent).toContain('Descripción extendida');
  });

  it('las fuentes van en una tabla con fuente, licencia, cita y DOI', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas');
    responderCatalogo();
    harness.detectChanges();
    const tabla = html().querySelector('[data-testid="atlas3d-fuentes"]');
    expect([...(tabla?.querySelectorAll('thead th') ?? [])].map((n) => n.textContent?.trim())).toEqual([
      'Fuente',
      'Licencia',
      'Cita',
      'DOI',
    ]);
    expect(tabla?.querySelectorAll('tbody tr').length).toBe(4);
    expect(tabla?.querySelector('a[href^="https://doi.org/"]')).not.toBeNull();
  });

  it('muestra los créditos y las licencias de las cuatro fuentes', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas');
    responderCatalogo();
    harness.detectChanges();
    const creditos = html().querySelector('[data-testid="atlas3d-creditos"]')?.textContent ?? '';
    expect(creditos).toContain('BodyParts3D');
    expect(creditos).toContain('CC-BY-SA 2.1 JP');
    expect(creditos).toContain('UBERON');
    expect(creditos).toContain('Foundational Model of Anatomy');
    expect(creditos).toContain('HuBMAP');
    expect(creditos).toContain('CC BY 4.0');
  });

  it('la lista femenina incluye útero, cuello uterino y ovario, y no la mama, que existe en los dos sexos', () => {
    expect(ATLAS_3D_FEMALE_ONLY_IDS).toContain('UBERON:0000995');
    expect(ATLAS_3D_FEMALE_ONLY_IDS).toContain('UBERON:0000002');
    expect(ATLAS_3D_FEMALE_ONLY_IDS).toContain('UBERON:0000992');
    expect(ATLAS_3D_FEMALE_ONLY_IDS).not.toContain('UBERON:0001911');
  });

  it('avisa una vez, a nivel de página, que el castellano es traducción automática', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas');
    responderCatalogo();
    harness.detectChanges();
    expect(html().querySelector('[data-testid="atlas3d-nota-traduccion"]')?.textContent).toContain('traducción automática, sin revisión humana');
  });

  it('de Netter muestra sólo el número de lámina, nunca el texto del índice', async () => {
    await harness.navigateByUrl(`/glossary/anatomy-atlas?structure=${encodeURIComponent(UTERO)}`);
    responderCatalogo();
    const shard = String(anatomyShardOf(UTERO, 32)).padStart(2, '0');
    http.expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).flush({
      [UTERO]: { ...FICHA_SIN_DEFINICION, netter: [{ netterId: 'ENT_1', plates: [372, 368, 372], matchKind: 'exact' }] },
    });
    harness.detectChanges();
    expect(html().querySelector('[data-testid="atlas3d-netter"]')?.textContent).toContain('Láminas 368, 372.');
  });

  it('el pulmón no tiene malla propia, pero abrirlo resalta los lóbulos que sí', async () => {
    const PULMON_DERECHO = 'UBERON:0002167';
    const lobulo = (meshId: string, structureId: string): AnatomyPart => ({
      meshId, layer: 'organs', sex: 'shared', structureId, shard: 0, side: 'right', labelEn: meshId, match: 'fma_exact',
    });
    const pagina = await harness.navigateByUrl(
      `/glossary/anatomy-atlas?structure=${encodeURIComponent(PULMON_DERECHO)}`,
      GlossaryAnatomyAtlas,
    );
    responderCatalogo(
      [lobulo('FMA7316', 'UBERON:0002170'), lobulo('FMA7317', 'UBERON:0002171'), lobulo('FMA9', 'UBERON:0000981')],
      { [PULMON_DERECHO]: ['UBERON:0002170', 'UBERON:0002171'] },
    );
    harness.detectChanges();
    expect(seleccion(pagina)).toEqual(['FMA7316', 'FMA7317']);
  });

  it('la ficha de una compuesta no dice «sin pieza 3D»: dice que se resaltan sus partes', async () => {
    const PULMON_DERECHO = 'UBERON:0002167';
    const lobulo: AnatomyPart = {
      meshId: 'FMA7316', layer: 'organs', sex: 'shared', structureId: 'UBERON:0002170', shard: 0, side: 'right', labelEn: 'x', match: 'fma_exact',
    };
    await harness.navigateByUrl(`/glossary/anatomy-atlas?structure=${encodeURIComponent(PULMON_DERECHO)}`);
    responderCatalogo([lobulo], { [PULMON_DERECHO]: ['UBERON:0002170'] });
    const shard = String(anatomyShardOf(PULMON_DERECHO, 32)).padStart(2, '0');
    http
      .expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`)
      .flush({ [PULMON_DERECHO]: { ...FICHA_SIN_DEFINICION, id: PULMON_DERECHO, labelEs: 'pulmón derecho' } });
    harness.detectChanges();
    expect(html().querySelector('[data-testid="atlas3d-sin-pieza"]')).toBeNull();
    expect(html().querySelector('[data-testid="atlas3d-compuesta"]')?.textContent).toContain('se resaltan las piezas de sus partes (1)');
  });

  it('si composites.json falla, el atlas sigue andando: la compuesta queda sin pieza, como antes', async () => {
    const pagina = await harness.navigateByUrl(
      `/glossary/anatomy-atlas?structure=${encodeURIComponent('UBERON:0002167')}`,
      GlossaryAnatomyAtlas,
    );
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(PARTES);
    http.expectOne('/anatomy-atlas-3d/catalog/composites.json').flush('no', { status: 404, statusText: 'Not Found' });
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [] });
    harness.detectChanges();
    expect(seleccion(pagina)).toEqual([]);
  });

  describe('búsqueda mientras el catálogo carga', () => {
    async function abrirYEscribir(texto: string): Promise<void> {
      await harness.navigateByUrl('/glossary/anatomy-atlas');
      http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(PARTES);
      http.expectOne('/anatomy-atlas-3d/catalog/composites.json').flush({});
      harness.detectChanges();
      const campo = html().querySelector<HTMLInputElement>('[data-testid="atlas3d-buscar"] input');
      campo!.value = texto;
      campo!.dispatchEvent(new Event('input'));
      await new Promise((resolver) => setTimeout(resolver, 300));
      harness.detectChanges();
    }

    it('con el índice sin llegar, dice que carga y no «no encontramos» (el falso negativo que estresaba)', async () => {
      await abrirYEscribir('pulm');
      expect(html().querySelector('[data-testid="atlas3d-cargando"]')?.textContent).toContain('Cargando el catálogo');
      expect(html().textContent).not.toContain('No encontramos estructuras');
    });

    it('cuando el índice llega, los resultados reemplazan el aviso', async () => {
      await abrirYEscribir('útero');
      http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [[UTERO, 'útero', 'uterus', 0]] });
      harness.detectChanges();
      expect(html().querySelector('[data-testid="atlas3d-cargando"]')).toBeNull();
      expect(html().querySelector('.atlas3d__resultados')?.textContent).toContain('útero');
    });

    it('si el índice falla, lo dice y deja reintentar', async () => {
      await abrirYEscribir('pulm');
      http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush('no', { status: 500, statusText: 'Error' });
      harness.detectChanges();
      expect(html().querySelector('[data-testid="atlas3d-catalogo-fallo"]')).not.toBeNull();
      html().querySelector<HTMLButtonElement>('.atlas3d__reintentar')!.click();
      harness.detectChanges();
      http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [] });
      harness.detectChanges();
      expect(html().querySelector('[data-testid="atlas3d-catalogo-fallo"]')).toBeNull();
    });
  });
});
