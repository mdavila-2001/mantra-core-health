import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { anatomyShardOf } from '../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import { ATLAS_3D_FEMALE_ONLY_IDS } from '../../core/mock/fixtures/anatomy-ontology.generated';
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

  function responderCatalogo(): void {
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(PARTES);
    http.expectOne('/anatomy-atlas-3d/catalog/index.json').flush({ shards: 32, entries: [[UTERO, 'útero', 'uterus', 0]] });
  }

  it('la vista «Mujer» dice que no hay modelo femenino libre y qué muestra en su lugar', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas?sex=female');
    responderCatalogo();
    harness.detectChanges();
    const aviso = html().querySelector('[data-testid="atlas3d-aviso-mujer"]');
    expect(aviso?.textContent).toContain('No existe un modelo 3D femenino libre');
    expect(aviso?.textContent).toContain('la pelvis y las proporciones siguen siendo masculinas');
    expect(html().textContent).toContain('Estructuras femeninas sin pieza 3D');
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
    expect(html().textContent).toContain('Descripción en el glosario');
  });

  async function abrirUtero(): Promise<void> {
    await harness.navigateByUrl(`/glossary/anatomy-atlas?structure=${encodeURIComponent(UTERO)}`);
    responderCatalogo();
    const shard = String(anatomyShardOf(UTERO, 32)).padStart(2, '0');
    http.expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).flush({ [UTERO]: FICHA_SIN_DEFINICION });
    harness.detectChanges();
  }

  const ENTRADA = {
    conceptId: '44444444-4444-4444-8444-444444444444',
    code: 'Q7174',
    display: 'Útero',
    slug: 'utero',
    translated: true,
    category: { internalCode: 'glossary-category-anatomy', name: 'Anatomía' },
    shortDefinition: 'Órgano muscular hueco donde se desarrolla el embarazo.',
    tags: [],
    relationsCount: 0,
    status: 'active',
  };

  it('usa la definición que el glosario ya tiene cuando el nombre coincide exactamente', async () => {
    await abrirUtero();
    const req = http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
    expect(req.request.params.get('q')).toBe('útero');
    req.flush({ items: [{ ...ENTRADA, display: 'Útero y anexos', conceptId: 'x' }, ENTRADA], count: 2, limit: 12, total: 2 });
    harness.detectChanges();

    const texto = html().querySelector('[data-testid="atlas3d-glosario"]')?.textContent ?? '';
    expect(texto).toContain('Órgano muscular hueco');
    expect(html().querySelector('[data-testid="atlas3d-sin-glosario"]')).toBeNull();
  });

  it('un parecido no es la misma estructura: sin coincidencia exacta lo dice y no inventa', async () => {
    await abrirUtero();
    http
      .expectOne((r) => r.url.endsWith('/terminology/concepts'))
      .flush({ items: [{ ...ENTRADA, display: 'Útero y anexos' }], count: 1, limit: 12, total: 1 });
    harness.detectChanges();

    expect(html().querySelector('[data-testid="atlas3d-glosario"]')).toBeNull();
    expect(html().querySelector('[data-testid="atlas3d-sin-glosario"]')?.textContent).toContain('no se completa a mano');
  });

  it('si el glosario falla, la ficha sigue con lo de la ontología', async () => {
    await abrirUtero();
    http
      .expectOne((r) => r.url.endsWith('/terminology/concepts'))
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    harness.detectChanges();

    expect(html().querySelector('[data-testid="atlas3d-ficha-titulo"]')?.textContent).toContain('útero');
    expect(html().querySelector('[data-testid="atlas3d-sin-glosario"]')).not.toBeNull();
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
    expect(tabla?.querySelectorAll('tbody tr').length).toBe(3);
    expect(tabla?.querySelector('a[href^="https://doi.org/"]')).not.toBeNull();
  });

  it('muestra los créditos y las licencias de las tres fuentes', async () => {
    await harness.navigateByUrl('/glossary/anatomy-atlas');
    responderCatalogo();
    harness.detectChanges();
    const creditos = html().querySelector('[data-testid="atlas3d-creditos"]')?.textContent ?? '';
    expect(creditos).toContain('BodyParts3D');
    expect(creditos).toContain('CC-BY-SA 2.1 JP');
    expect(creditos).toContain('UBERON');
    expect(creditos).toContain('Foundational Model of Anatomy');
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
});
