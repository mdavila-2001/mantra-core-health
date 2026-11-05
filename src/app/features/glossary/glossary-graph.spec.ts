import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GlossaryNeighborhood } from '../../core/data-access/terminology/terminology.types';
import { GlossaryGraph } from './glossary-graph';

/**
 * El árbol de términos: lee el vecindario del término de la URL, lo dibuja
 * en grupos y abre cada término bajo demanda.
 */
const TOS = '3cea6ad4-d83f-4d1c-a8a2-0cc8991b59b0';
const FIEBRE = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const sintoma = { internalCode: 'glossary-category-signs-symptoms', name: 'Signos y síntomas' };
const enfermedad = { internalCode: 'glossary-category-disease', name: 'Enfermedades' };

const HOOD_TOS: GlossaryNeighborhood = {
  focus: {
    conceptId: TOS,
    slug: 'tos',
    display: 'Tos',
    category: sintoma,
    shortDefinition: 'Expulsión brusca y ruidosa del aire de los pulmones.',
  },
  groups: [
    {
      type: 'SYMPTOM',
      direction: 'incoming',
      total: 2,
      items: [
        { conceptId: 'd-1', slug: 'd-1', display: 'Neumonía', category: enfermedad },
        { conceptId: 'd-2', slug: 'd-2', display: 'Asma', category: enfermedad },
      ],
    },
    {
      type: 'SYMPTOM',
      direction: 'outgoing',
      total: 1,
      items: [{ conceptId: FIEBRE, slug: 'fiebre', display: 'Fiebre', category: sintoma }],
    },
  ],
};

const HOOD_FIEBRE: GlossaryNeighborhood = {
  focus: {
    conceptId: FIEBRE,
    slug: 'fiebre',
    display: 'Fiebre',
    category: sintoma,
    shortDefinition: 'Elevación de la temperatura corporal.',
  },
  groups: [
    {
      type: 'SYMPTOM',
      direction: 'incoming',
      total: 1,
      items: [{ conceptId: 'd-3', slug: 'd-3', display: 'Gripe', category: enfermedad }],
    },
  ],
};

describe('GlossaryGraph', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'glossary/graph', component: GlossaryGraph },
          { path: 'glossary/:conceptId', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const html = (): HTMLElement => harness.fixture.nativeElement as HTMLElement;
  const termino = (id: string) =>
    http.expectOne((r) => r.url === `/terminology/concepts/${id}/glossary-neighborhood` && r.params.has('perGroup'));
  const ficha = (id: string) => http.match((r) => r.url === `/terminology/concepts/${id}`);

  async function abrir(): Promise<void> {
    await harness.navigateByUrl(`/glossary/graph?focus=${TOS}`, GlossaryGraph);
    termino(TOS).flush(HOOD_TOS);
    await harness.fixture.whenStable();
    ficha(TOS).forEach((r) => r.flush({}, { status: 404, statusText: 'No' }));
    harness.fixture.detectChanges();
  }

  const nodos = (tipo: string): HTMLElement[] =>
    Array.from(html().querySelectorAll<HTMLElement>(`[data-testid="grafo-nodo-${tipo}"]`));

  it('sin término elegido no pide nada y ofrece buscar uno', async () => {
    await harness.navigateByUrl('/glossary/graph', GlossaryGraph);
    http.expectNone((r) => r.url.includes('glossary-neighborhood'));
    expect(html().textContent).toContain('Elija un término para ver su árbol');
  });

  it('dibuja el término, sus grupos y los términos de cada grupo', async () => {
    await abrir();
    expect(nodos('term').map((n) => n.getAttribute('aria-label'))).toEqual([
      expect.stringContaining('Tos'),
      expect.stringContaining('Asma'),
      expect.stringContaining('Neumonía'),
      expect.stringContaining('Fiebre'),
    ]);
    expect(nodos('group').length).toBeGreaterThanOrEqual(2);
    expect(html().querySelector('[data-testid="grafo-resumen"]')?.textContent).toMatch(/4 términos en \d grupos/);
  });

  it('la raíz muestra su definición dentro del nodo', async () => {
    await abrir();
    expect(html().textContent).toContain('Expulsión brusca');
  });

  it('un clic abre un término: pide su vecindario y lo agrega al árbol', async () => {
    await abrir();
    const fiebre = nodos('term').find((n) => n.getAttribute('aria-label')?.startsWith('Fiebre'))!;
    fiebre.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    termino(FIEBRE).flush(HOOD_FIEBRE);
    ficha(FIEBRE).forEach((r) => r.flush({}, { status: 404, statusText: 'No' }));
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(nodos('term').some((n) => n.getAttribute('aria-label')?.startsWith('Gripe'))).toBe(true);
    expect(fiebre.getAttribute('aria-expanded')).toBe('true');
  });

  it('otro clic lo cierra sin volver a pedir nada', async () => {
    await abrir();
    const fiebre = () => nodos('term').find((n) => n.getAttribute('aria-label')?.startsWith('Fiebre'))!;
    fiebre().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    termino(FIEBRE).flush(HOOD_FIEBRE);
    ficha(FIEBRE).forEach((r) => r.flush({}, { status: 404, statusText: 'No' }));
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    fiebre().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Elegir un término vuelve a pedir su ficha (la anterior falló); su vecindario no.
    ficha(FIEBRE).forEach((r) => r.flush({}, { status: 404, statusText: 'No' }));
    harness.fixture.detectChanges();
    http.expectNone((r) => r.url.includes('glossary-neighborhood'));
    expect(nodos('term').some((n) => n.getAttribute('aria-label')?.startsWith('Gripe'))).toBe(false);
  });

  it('la vista «Lista» trae los mismos términos como botones', async () => {
    await abrir();
    const lista = Array.from(html().querySelectorAll<HTMLElement>('[role="radio"]')).find(
      (radio) => radio.textContent?.trim() === 'Lista',
    );
    lista!.click();
    harness.fixture.detectChanges();
    const items = html().querySelectorAll('[data-testid="grafo-item"]');
    expect(items.length).toBe(4);
  });

  it('el enlace de compartir lleva el término central y los abiertos', async () => {
    await abrir();
    const pagina = harness.routeDebugElement!.componentInstance as unknown as { shareUrl(): string };
    const url = new URL(pagina.shareUrl());
    expect(url.searchParams.get('focus')).toBe(TOS);
    expect(url.searchParams.get('expand')).toBeNull();
  });

  it('un enlace con cientos de términos abiertos pide a lo sumo doce, sin repetidos ni basura', async () => {
    const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const pedidos = [...Array.from({ length: 60 }, (_, n) => uuid(n + 1)), uuid(1), uuid(2), 'no-es-un-id', '../x', TOS];
    await harness.navigateByUrl(`/glossary/graph?focus=${TOS}&expand=${pedidos.join(',')}`, GlossaryGraph);

    const lecturas = (): number =>
      http.match((r) => r.url.endsWith('/glossary-neighborhood')).length;
    // La raíz primero; después, de a 4 a la vez, hasta el tope.
    let total = 0;
    for (let ronda = 0; ronda < 10; ronda++) {
      const abiertas = http.match((r) => r.url.endsWith('/glossary-neighborhood'));
      if (abiertas.length === 0) break;
      total += abiertas.length;
      expect(abiertas.length).toBeLessThanOrEqual(4);
      abiertas.forEach((r) => r.flush(HOOD_TOS));
      await harness.fixture.whenStable();
    }
    expect(total + lecturas()).toBe(1 + 12);
    http.match((r) => r.url.includes('/terminology/concepts/')).forEach((r) => r.flush({}, { status: 404, statusText: 'No' }));
  });

  it('un error al leer el término central se dice y se puede reintentar', async () => {
    await harness.navigateByUrl(`/glossary/graph?focus=${TOS}`, GlossaryGraph);
    termino(TOS).flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(html().querySelector('[data-testid="grafo-lienzo"]')).toBeNull();
    expect(html().textContent?.toLowerCase()).toContain('reintentar');
  });
});
