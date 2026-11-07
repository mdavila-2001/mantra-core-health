import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ServicesGrid } from './services-grid';

const DOCTOR = '/admin/catalogs/services';

describe('ServicesGrid', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({
      imports: [ServicesGrid],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ServicesGrid);
    fixture.detectChanges();
    return fixture;
  }
  const scopes = { types: [{ conceptId: 't1', code: 'PR_TYPE_OFFICE', display: 'Consultorio' }], practices: [], currencies: [] };
  function answerDoctor(items: object[], nextCursor: string | null = null) {
    http.expectOne((r) => r.url.endsWith(DOCTOR)).flush({ items, count: items.length, limit: 50, nextCursor });
    http.expectOne((r) => r.url.endsWith(`${DOCTOR}/scopes`)).flush(scopes);
  }
  afterEach(() => http.verify());

  it('shows the S3 empty state with a next action when the catalog has no rows', async () => {
    const fixture = create();
    answerDoctor([]);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sin servicios médicos');
    expect(text).toContain('Abrir el editor de catálogos');
  });

  it('shows the partial notice only when the API says the list is truncated', async () => {
    const fixture = create();
    answerDoctor([{ id: 's1', code: 'C1', name: 'Consulta', practiceTypeConceptId: 't1', defaultPrice: '80.00', isActive: true }], 'next');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="services-grid-partial"]')).not.toBeNull();
  });

  it('does not call any endpoint for the hospital tab and says it has no own catalog', async () => {
    const fixture = create();
    answerDoctor([]);
    (fixture.componentInstance as unknown as { onTab(i: number): void }).onTab(2);
    fixture.detectChanges();
    http.expectNone((r) => r.url.includes('hospital'));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no tiene un catálogo propio');
  });

  it('loads the laboratory tab lazily and surfaces a 403 as a forbidden state', async () => {
    const fixture = create();
    answerDoctor([]);
    (fixture.componentInstance as unknown as { onTab(i: number): void }).onTab(1);
    http.expectOne((r) => r.url.endsWith('/diagnostics/lab/services')).flush({ code: 'FORBIDDEN', message: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();
    const state = (fixture.componentInstance as unknown as { states(): Record<string, { status: string }> }).states();
    expect(state['laboratory']?.status).toBe('forbidden');
  });
});
