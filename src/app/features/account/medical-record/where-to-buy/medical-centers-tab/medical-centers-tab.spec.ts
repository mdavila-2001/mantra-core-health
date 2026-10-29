import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MedicalCentersTab, stateOf } from './medical-centers-tab';

const ENDOSCOPY = 'c-endoscopia';
const SPIROMETRY = 'c-espirometria';

const LABELS = {
  items: [
    { conceptId: ENDOSCOPY, code: 'PRO_ENDOSCOPIA_ALTA', display: 'Endoscopía alta' },
    { conceptId: SPIROMETRY, code: 'PRO_ESPIROMETRIA', display: 'Espirometría' },
  ],
};

function procedure(conceptId: string) {
  return {
    serviceRequestId: `sr-${conceptId}`,
    conceptId,
    categoryConceptId: 'cat-procedure',
    requestedAt: '2026-10-24T12:00:00.000Z',
  };
}

function center(siteId: string, practiceName: string, complete: boolean, missing: string[] = []) {
  return {
    siteId,
    practiceId: `pr-${siteId}`,
    practiceName,
    siteName: `Sede ${siteId}`,
    complete,
    missingProcedureConceptIds: missing,
    distanceKm: complete ? 6.4 : 0.1,
    addressText: 'Av. Busch 1450, La Paz',
    latitude: -16.4985,
    longitude: -68.1215,
  };
}

const WITH_CENTERS = {
  procedures: [procedure(ENDOSCOPY), procedure(SPIROMETRY)],
  centers: [
    center('s-sur', 'Clínica Sur', true),
    center('s-norte', 'Centro Médico Miraflores', false, [SPIROMETRY]),
  ],
  total: 2,
  limit: 20,
};

describe('MedicalCentersTab', () => {
  let fixture: ComponentFixture<MedicalCentersTab>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MedicalCentersTab);
  });

  afterEach(() => http.verify());

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  /** Abre la pestaña y responde la consulta de centros y la de nombres. */
  function openWith(response: object, labels: object = LABELS): void {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/clinical/me/procedure-centers').flush(response);
    const pending = http.match((r) => r.url === '/terminology/concepts');
    for (const request of pending) request.flush(labels);
    fixture.detectChanges();
  }

  it('no consulta nada mientras la pestaña está cerrada', () => {
    fixture.detectChanges();
    http.expectNone((r) => r.url === '/clinical/me/procedure-centers');
  });

  it('al abrirse pide los centros sin mandar qué procedimientos son', () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === '/clinical/me/procedure-centers');
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush({ procedures: [], centers: [], total: 0, limit: 20 });
  });

  it('abre solo con los centros que tienen todo y deja ver los parciales con lo que les falta', () => {
    openWith(WITH_CENTERS);
    expect(text()).toContain('Procedimientos pendientes: Endoscopía alta, Espirometría');
    expect(text()).toContain('Clínica Sur — Sede s-sur');
    expect(text()).toContain('6,4 km en línea recta');
    expect(text()).not.toContain('Centro Médico Miraflores');

    const toggle = byTestId('medical-centers-show-partial') as HTMLButtonElement;
    expect(toggle.textContent).toContain('Ver el que tiene una parte');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    fixture.detectChanges();

    expect(text()).toContain('Centro Médico Miraflores');
    expect(byTestId('medical-centers-missing')?.textContent).toContain('Le falta: Espirometría');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toContain('Mostrar solo los que tienen todos');
  });

  it('cada centro trae «Cómo llegar» por OpenStreetMap en una pestaña nueva', () => {
    openWith(WITH_CENTERS);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '[data-testid="medical-centers-list"] a[href*="openstreetmap.org/directions"]',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('aria-label')).toBe(
      'Cómo llegar a Clínica Sur — Sede s-sur (abre en una pestaña nueva)',
    );
  });

  it('si ninguno tiene todo, lo dice y ofrece ver los parciales', () => {
    openWith({ ...WITH_CENTERS, centers: [WITH_CENTERS.centers[1]], total: 1 });
    expect(byTestId('medical-centers-none-complete')?.textContent).toContain(
      'Ningún centro tiene hoy todos los procedimientos que le pidieron.',
    );
    expect(byTestId('medical-centers-show-partial')).not.toBeNull();
  });

  it('sin procedimientos pendientes no pide nombres y ofrece la guía de clínicas', () => {
    openWith({ procedures: [], centers: [], total: 0, limit: 20 });
    http.expectNone((r) => r.url === '/terminology/concepts');
    expect(text()).toContain('No tiene procedimientos pendientes.');
    expect(text()).toContain('Ver clínicas y hospitales');
  });

  it('con procedimientos pero sin centros que los declaren, no inventa una lista', () => {
    openWith({ procedures: [procedure(ENDOSCOPY)], centers: [], total: 0, limit: 20 });
    expect(text()).toContain('Ningún centro registrado declara hoy los procedimientos que le pidieron.');
    expect(byTestId('medical-centers-list')).toBeNull();
  });

  it('vuelve a medir cuando cambia el punto de partida, y no antes', () => {
    openWith(WITH_CENTERS);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    http.expectNone((r) => r.url === '/clinical/me/procedure-centers');

    fixture.componentRef.setInput('origin', { label: 'su casa', lat: -16.5, lng: -68.1 });
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === '/clinical/me/procedure-centers');
    expect(request.request.params.get('lat')).toBe('-16.5');
    expect(request.request.params.get('lng')).toBe('-68.1');
    request.flush(WITH_CENTERS);
    for (const pending of http.match((r) => r.url === '/terminology/concepts')) pending.flush(LABELS);
    fixture.detectChanges();
    expect(byTestId('medical-centers-origin')?.textContent).toContain('medidas desde su casa');
  });

  it('un error del servidor se muestra con reintento, sin lista', () => {
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/clinical/me/procedure-centers')
      .flush({ message: 'caído' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(byTestId('medical-centers-list')).toBeNull();
    expect(text()).not.toContain('No tiene procedimientos pendientes.');
  });
});

describe('stateOf', () => {
  it('un concepto que el catálogo no nombra queda como «Un procedimiento pedido», no como un id', () => {
    const state = stateOf(
      {
        procedures: [{ ...procedure(ENDOSCOPY), requestedAt: new Date() }],
        centers: [center('s-1', 'Clínica', false, [ENDOSCOPY])],
        total: 1,
        limit: 20,
      },
      new Map(),
    );
    expect(state.status).toBe('ready');
    const data = state.status === 'ready' ? state.data : null;
    expect(data?.procedures[0]?.name).toBe('Un procedimiento pedido');
    expect(data?.centers[0]?.missing).toEqual(['Un procedimiento pedido']);
  });

  it('una sede sin coordenadas no ofrece «Cómo llegar» ni distancia', () => {
    const state = stateOf(
      {
        procedures: [{ ...procedure(ENDOSCOPY), requestedAt: new Date() }],
        centers: [{ ...center('s-1', 'Clínica', true), latitude: null, longitude: null, distanceKm: null }],
        total: 1,
        limit: 20,
      },
      new Map(),
    );
    const data = state.status === 'ready' ? state.data : null;
    expect(data?.centers[0]?.directions).toBeNull();
    expect(data?.centers[0]?.distance).toBeNull();
  });
});
