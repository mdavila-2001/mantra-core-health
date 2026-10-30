import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { GlossaryNeighborhood } from '../../core/data-access/terminology/terminology.types';
import { GlossaryCompare } from './glossary-compare';

/** El comparador diferencial (TAREA-41 F5.3): dos vecindarios, lado a lado. */
const A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const enfermedad = { internalCode: 'glossary-category-disease', name: 'Enfermedades' };
const sintoma = { internalCode: 'glossary-category-signs-symptoms', name: 'Signos y síntomas' };
const estudio = { internalCode: 'glossary-category-imaging', name: 'Imagenología' };

const v = (id: string, category: typeof sintoma) => ({ conceptId: id, slug: id, display: id, category });

const vecindario = (id: string, display: string, groups: GlossaryNeighborhood['groups']): GlossaryNeighborhood => ({
  focus: { conceptId: id, slug: id, display, category: enfermedad, shortDefinition: '' },
  groups,
});

const NEUMONIA = vecindario(A, 'Neumonía', [
  { type: 'SYMPTOM', direction: 'outgoing', total: 2, items: [v('Fiebre', sintoma), v('Crepitantes', sintoma)] },
  { type: 'REQUIRED_TEST', direction: 'outgoing', total: 1, items: [v('Radiografía de tórax', estudio)] },
]);
const BRONQUITIS = vecindario(B, 'Bronquitis', [
  { type: 'SYMPTOM', direction: 'outgoing', total: 2, items: [v('Fiebre', sintoma), v('Sibilancias', sintoma)] },
]);

describe('GlossaryCompare', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'glossary/compare', component: GlossaryCompare },
          { path: 'glossary/network', children: [] },
          { path: 'glossary/:conceptId', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const html = () => harness.fixture.nativeElement as HTMLElement;
  const vecinos = (id: string) =>
    http.expectOne((r) => r.url === `/terminology/concepts/${id}/glossary-neighborhood`);

  async function abrir(): Promise<void> {
    await harness.navigateByUrl(`/glossary/compare?a=${A}&b=${B}`, GlossaryCompare);
    vecinos(A).flush(NEUMONIA);
    vecinos(B).flush(BRONQUITIS);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }

  it('sin los dos términos no pide nada y explica qué hacer', async () => {
    await harness.navigateByUrl(`/glossary/compare?a=${A}`, GlossaryCompare);

    http.expectNone((r) => r.url.includes('glossary-neighborhood'));
    expect(html().textContent).toContain('Elija dos términos para compararlos');
  });

  it('con el mismo término dos veces pide uno distinto', async () => {
    await harness.navigateByUrl(`/glossary/compare?a=${A}&b=${A}`, GlossaryCompare);

    http.expectNone((r) => r.url.includes('glossary-neighborhood'));
    expect(html().textContent).toContain('Elija dos términos distintos');
  });

  it('pide los dos vecindarios con la muestra máxima del contrato', async () => {
    await harness.navigateByUrl(`/glossary/compare?a=${A}&b=${B}`, GlossaryCompare);

    const a = vecinos(A);
    const b = vecinos(B);
    expect(a.request.params.get('perGroup')).toBe('50');
    expect(b.request.params.get('perGroup')).toBe('50');
    a.flush(NEUMONIA);
    b.flush(BRONQUITIS);
  });

  it('muestra lo compartido, lo que distingue y el estudio que discrimina', async () => {
    await abrir();

    const compartidos = [...html().querySelectorAll('.comparar__compartido-nombre')].map((a) => a.textContent?.trim());
    expect(compartidos).toEqual(['Fiebre']);

    const columnas = [...html().querySelectorAll('.relation-groups__group')].map((g) =>
      (g.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(columnas[0]).toContain('Sólo en Neumonía');
    expect(columnas[0]).toContain('Crepitantes');
    expect(columnas[1]).toContain('Sólo en Bronquitis');
    expect(columnas[1]).toContain('Sibilancias');
    expect(columnas[2]).toContain('Sólo para Neumonía');
    expect(columnas[2]).toContain('Radiografía de tórax');
    expect(columnas[3]).toContain('Ningún estudio propio registrado.');
  });

  it('si falla un vecindario, muestra el error y no una comparación a medias', async () => {
    await harness.navigateByUrl(`/glossary/compare?a=${A}&b=${B}`, GlossaryCompare);
    vecinos(A).flush(NEUMONIA);
    vecinos(B).flush({ message: 'caído' }, { status: 503, statusText: 'Service Unavailable' });
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(html().querySelector('.comparar__compartidos')).toBeNull();
    expect(html().querySelector('.relation-groups__group')).toBeNull();
  });

  it('cambiar un término reescribe la URL y conserva el otro', async () => {
    await abrir();
    const router = TestBed.inject(Router);

    (harness.routeDebugElement!.componentInstance as { choose(s: string, o: unknown): void }).choose('b', {
      value: 'cccc',
      label: 'Asma',
    });
    await harness.fixture.whenStable();

    expect(router.url).toBe(`/glossary/compare?a=${A}&b=cccc`);
    vecinos(A).flush(NEUMONIA);
    vecinos('cccc').flush(vecindario('cccc', 'Asma', []));
  });
});
