import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { GlossaryNeighborhood } from '../../core/data-access/terminology/terminology.types';
import { GlossaryNetwork } from './glossary-network';

/**
 * El mapa como ruta clínica (TAREA-41 F0): lee el vecindario del término de
 * la URL, lo reparte en zonas y columnas, y cada vecino lo pasa al centro.
 */
const TOS = '3cea6ad4-d83f-4d1c-a8a2-0cc8991b59b0';
const NEUMONIA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const enfermedad = { internalCode: 'glossary-category-disease', name: 'Enfermedades' };
const farmaco = { internalCode: 'glossary-category-pharmacology', name: 'Farmacología' };

const vecinos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    conceptId: `d-${String(i).padStart(2, '0')}`,
    slug: `d-${i}`,
    display: `Enfermedad ${String(i).padStart(2, '0')}`,
    category: enfermedad,
  }));

const VECINDARIO: GlossaryNeighborhood = {
  focus: {
    conceptId: TOS,
    slug: 'tos',
    display: 'Tos',
    category: { internalCode: 'glossary-category-signs-symptoms', name: 'Signos y síntomas' },
    shortDefinition: 'Expulsión brusca y ruidosa del aire de los pulmones.',
  },
  groups: [
    { type: 'SYMPTOM', direction: 'incoming', total: 47, items: vecinos(8) },
    {
      type: 'TREATMENT',
      direction: 'outgoing',
      total: 1,
      items: [{ conceptId: 'f-1', slug: 'f-1', display: 'Dextrometorfano', category: farmaco }],
    },
  ],
};

describe('GlossaryNetwork', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'glossary/network', component: GlossaryNetwork },
          { path: 'glossary/:conceptId', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  function html(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function vecindario(conceptId = TOS) {
    return http.expectOne(
      (r) => r.url === `/terminology/concepts/${conceptId}/glossary-neighborhood` && r.params.has('perGroup'),
    );
  }

  async function abrir(conceptId = TOS): Promise<void> {
    await harness.navigateByUrl(`/glossary/network?focus=${conceptId}`, GlossaryNetwork);
    vecindario(conceptId).flush(VECINDARIO);
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }

  it('sin término elegido no pide nada y ofrece buscar uno', async () => {
    await harness.navigateByUrl('/glossary/network', GlossaryNetwork);

    http.expectNone((r) => r.url.includes('glossary-neighborhood'));
    expect(html().textContent).toContain('Elija un término para ver su mapa');
  });

  it('pide el vecindario del término de la URL con una muestra por grupo', async () => {
    await harness.navigateByUrl(`/glossary/network?focus=${TOS}`, GlossaryNetwork);

    const req = vecindario();
    expect(req.request.params.get('perGroup')).toBe('8');
    req.flush(VECINDARIO);
  });

  it('pone el término al centro y sus enfermedades en «Diagnóstico, estudio y tratamiento»', async () => {
    await abrir();

    expect(html().querySelector('#ruta-foco-titulo')?.textContent?.trim()).toBe('Tos');
    const titulos = [...html().querySelectorAll('.ruta__grupo-titulo')].map((h) =>
      (h.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(titulos).toEqual(['Enfermedades que lo presentan', 'Tratamientos 1']);
    const zona = html().querySelector('.ruta__zona--siguiente .ruta__zona-titulo');
    expect(zona?.textContent?.trim()).toBe('Diagnóstico, estudio y tratamiento');
  });

  it('muestra las etiquetas completas, sin recortar el nombre', async () => {
    await abrir();

    const botones = [...html().querySelectorAll<HTMLButtonElement>('.ruta__vecino')];
    expect(botones.map((b) => b.textContent?.trim())).toContain('Dextrometorfano');
    expect(botones.every((b) => !(b.textContent ?? '').includes('…'))).toBe(true);
  });

  it('«Ver todos» pide el grupo entero y deja de ofrecerlo cuando llegó', async () => {
    await abrir();

    const boton = [...html().querySelectorAll<HTMLButtonElement>('.ruta__grupo-accion')].find(
      (b) => b.textContent?.trim() === 'Ver todos',
    );
    expect(boton).toBeDefined();
    boton!.click();

    const req = http.expectOne(
      (r) => r.url.endsWith('/glossary-neighborhood') && r.params.get('type') === 'SYMPTOM',
    );
    expect(req.request.params.get('direction')).toBe('incoming');
    expect(req.request.params.get('limit')).toBe('200');
    req.flush({ focus: VECINDARIO.focus, groups: [{ type: 'SYMPTOM', direction: 'incoming', total: 47, items: vecinos(47) }] });
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(html().querySelectorAll('.ruta__zona--siguiente .ruta__vecino')).toHaveLength(48);
    expect(html().textContent).toContain('Mostrar menos');
    expect(html().textContent).not.toContain('Ver todos');
  });

  it('un vecino pasa al centro y queda en el recorrido', async () => {
    await abrir();
    const router = TestBed.inject(Router);

    html().querySelector<HTMLButtonElement>('.ruta__vecino')!.click();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/glossary/network?focus=d-00');
    vecindario('d-00').flush({
      ...VECINDARIO,
      focus: { ...VECINDARIO.focus, conceptId: NEUMONIA, display: 'Enfermedad 00', category: enfermedad },
      groups: [],
    });
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    const recorrido = html().querySelector('.ruta__recorrido');
    expect(recorrido?.textContent).toContain('Tos');
    expect(recorrido?.querySelector('[aria-current]')?.textContent?.trim()).toBe('Enfermedad 00');
    expect(html().textContent).toContain('Todavía no tiene relaciones publicadas.');
  });

  it('un término que no existe muestra el estado de no encontrado', async () => {
    await harness.navigateByUrl('/glossary/network?focus=no-existe', GlossaryNetwork);

    vecindario('no-existe').flush(
      { statusCode: 404, message: 'Término del glosario no encontrado' },
      { status: 404, statusText: 'Not Found' },
    );
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(html().querySelector('.ruta__mapa')).toBeNull();
  });
});
