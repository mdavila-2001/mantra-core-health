import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { SearchMemoryService } from '../../../core/navigation/search-memory.service';
import { API_BASE_URL } from '../../../core/data-access/api';
import { SessionStore } from '../../../core/auth/session.store';
import { InsurancePatients } from './insurance-patients';

/**
 * Directorio de pacientes de la aseguradora. Se monta con `RouterTestingHarness`
 * para comprobar la navegación al chat y que los filtros nunca llegan a la URL.
 */
const ROUTE = '/administration/insurance-patients';

const WITH_COVERAGE = {
  patientProfileId: 'pp-1',
  fullName: 'Ana Salas',
  birthDate: '1990-10-05',
  age: 35,
  phone: '+591 70000001',
  email: 'ana@example.com',
  genderCode: 'GENDER_FEMALE',
  occupationDisplay: 'Docente',
  insurers: [{ id: 'carrier-1', name: 'Seguro Sintético' }],
  messaging: { channel: 'internal', available: true },
};

const WITHOUT_COVERAGE = {
  patientProfileId: 'pp-2',
  fullName: 'Luis Rojas',
  insurers: [],
  messaging: { channel: 'internal', available: false },
};

function page(items: unknown[], nextCursor: string | null = null) {
  return { items, total: items.length, limit: 25, nextCursor };
}

describe('InsurancePatients', () => {
  let harness: RouterTestingHarness;
  let component: InsurancePatients;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([
          { path: 'administration/insurance-patients', component: InsurancePatients },
        ]),
      ],
    });
    TestBed.inject(SearchMemoryService).write('insurer-patients::', {});
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(ROUTE, InsurancePatients);
    flushGender();
    http
      .expectOne('/insurance/patients/options')
      .flush({ insurers: [{ id: 'carrier-1', name: 'Seguro Sintético' }] });
    harness.detectChanges();
  });

  afterEach(() => http.verify());

  /** El catálogo de sexo se pide una vez, al montar. */
  function flushGender(): void {
    http
      .expectOne(
        (r) =>
          r.url === '/system-context/dynamic-enums' &&
          r.params.get('target') === 'profiles.persons.administrative_gender_concept_id',
      )
      .flush({
        code: 'gender',
        name: 'gender',
        definitionId: 'def',
        valueSetId: 'vs',
        cacheToken: 'v1',
        options: [
          { conceptId: 'g-f', code: 'GENDER_FEMALE', display: 'Administrative gender female' },
          { conceptId: 'g-m', code: 'GENDER_MALE', display: 'Administrative gender male' },
        ],
      });
    harness.detectChanges();
  }

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function request() {
    return http.expectOne((r) => r.url === '/insurance/patients/search');
  }

  function respond(items: unknown[], nextCursor: string | null = null): void {
    request().flush(page(items, nextCursor));
    harness.detectChanges();
  }

  function state(): { status: string } {
    return internal<() => { status: string }>('listing')();
  }

  function el(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function byTestId(id: string): HTMLElement | null {
    return el().querySelector(`[data-testid="${id}"]`);
  }

  it('pide la primera página de 25 sin filtros en la URL', () => {
    const req = request();

    expect(req.request.method).toBe('POST');
    expect(req.request.params.keys()).toEqual([]);
    expect(req.request.body).toEqual({ limit: 25 });

    req.flush(page([]));
  });

  it('con filas queda en `ready` y pinta nombre, fecha y teléfono sin documento', () => {
    respond([WITH_COVERAGE]);

    expect(state().status).toBe('ready');
    expect(el().textContent).toContain('Ana Salas');
    expect(el().textContent).not.toContain('CI ');
    const phone = el().querySelector<HTMLAnchorElement>('.directory__phone-link');
    expect(phone?.getAttribute('href')).toBe('tel:+59170000001');
    expect(el().textContent).toContain('05/10/1990');
    expect(el().textContent).toContain('35 años');
  });

  it('AC-3: un paciente sin cobertura vigente dice exactamente «Ninguno»', () => {
    respond([WITH_COVERAGE, WITHOUT_COVERAGE]);

    const none = byTestId('badge-insurance-none');
    expect(none?.textContent?.trim()).toBe('Ninguno');
    expect(el().querySelectorAll('[data-testid="badge-insurance-none"]')).toHaveLength(2);
    expect(el().textContent).toContain('Seguro Sintético');
    expect(el().textContent).not.toContain('Póliza');
  });

  it('dice «Sin correo» y «No especificada» cuando faltan, sin dejar el hueco mudo', () => {
    respond([WITHOUT_COVERAGE]);

    expect(el().textContent).toContain('Sin correo');
    expect(el().textContent).toContain('No especificada');
  });

  it('AC-4: «Enviar Mensaje» resuelve la conversación por id y canal interno', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    respond([WITH_COVERAGE]);

    byTestId('btn-message-patient')?.click();

    const req = http.expectOne('/insurance/patients/conversation');
    expect(req.request.body).toEqual({ patientProfileId: 'pp-1', channel: 'internal' });
    req.flush({ conversationId: 'conversation-1' });
    expect(navigate).toHaveBeenCalledWith(['/messaging', 'conversation-1']);
  });

  it('AC-4: sin perfil de comunidad «Escribir» no navega y dice por qué', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    respond([WITHOUT_COVERAGE]);

    const button = byTestId('btn-message-patient');
    button?.click();

    expect(navigate).not.toHaveBeenCalled();
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(el().textContent).toContain('Este paciente no tiene mensajería disponible.');
  });

  it('copia el teléfono y lo anuncia en la región viva, que siempre está en el DOM', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    respond([WITH_COVERAGE]);
    expect(byTestId('directory-notice')?.getAttribute('aria-live')).toBe('polite');

    byTestId('btn-copy-phone')?.click();
    await Promise.resolve();
    harness.detectChanges();

    expect(writeText).toHaveBeenCalledWith('+591 70000001');
    expect(byTestId('directory-notice')?.textContent).toContain('copiado');
  });

  it('AC-2: el filtro viaja sólo en el cuerpo y vuelve a la primera página', () => {
    respond([WITH_COVERAGE], 'c-2');

    internal<(key: string, value: string) => void>('setFilter')('insurance', 'NO_INSURANCE');
    harness.detectChanges();

    const req = request();
    expect(req.request.body.insuranceStatus).toBe('NO_INSURANCE');
    expect(req.request.body.cursor).toBeUndefined();
    expect(router.url).toBe(ROUTE);
    req.flush(page([WITHOUT_COVERAGE]));
  });

  it('el texto buscado va a la petición pero NO a la URL', () => {
    respond([WITH_COVERAGE]);

    internal<(text: string) => void>('onSearch')('Ana');
    harness.detectChanges();

    const req = request();
    expect(req.request.body.search).toBe('Ana');
    expect(router.url).not.toContain('Ana');
    req.flush(page([WITH_COVERAGE]));
  });

  it('el rango de nacimiento viaja como fecha civil, sin correrse de huso', async () => {
    respond([]);

    internal<(date: Date | null) => void>('onBirthFrom')(new Date(1980, 0, 1));
    await harness.fixture.whenStable();
    harness.detectChanges();

    const req = request();
    expect(req.request.body.birthDateFrom).toBe('1980-01-01');
    req.flush(page([]));
  });

  it('siguiente página: manda el cursor que entregó la anterior', () => {
    respond([WITH_COVERAGE], 'c-2');

    internal<(cursor: string) => void>('move')('c-2');
    harness.detectChanges();

    const req = request();
    expect(req.request.body.cursor).toBe('c-2');
    req.flush(page([WITHOUT_COVERAGE]));
  });

  it('vacío con filtros dice que ninguno coincide; vacío sin filtros, que todavía no hay nadie', async () => {
    respond([]);
    expect(el().textContent).toContain('Todavía no hay pacientes');

    internal<(key: string, value: string) => void>('setFilter')('genderConceptId', 'g-f');
    harness.detectChanges();
    request().flush(page([]));
    harness.detectChanges();

    expect(state().status).toBe('empty');
    expect(el().textContent).toContain('No se encontraron pacientes con los filtros seleccionados');
  });

  it('«Limpiar filtros» restablece criterios sin alterar la URL', async () => {
    respond([]);
    internal<(key: string, value: string) => void>('setFilter')('insurance', 'NO_INSURANCE');
    internal<(key: string, value: string) => void>('setFilter')('birthDateFrom', '1980-01-01');
    harness.detectChanges();
    request().flush(page([]));
    harness.detectChanges();

    byTestId('btn-reset-filters')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).not.toContain('insuranceStatus');
    expect(router.url).not.toContain('birthDateFrom');
    request().flush(page([]));
  });

  it('un error de la API no deja la tabla en blanco: pasa a un estado de error', () => {
    request().flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(state().status).toBe('error');
  });

  it('cancela la consulta anterior cuando cambia la búsqueda', () => {
    const previous = request();
    internal<(value: string) => void>('onSearch')('Luis');
    harness.detectChanges();
    expect(previous.cancelled).toBe(true);
    respond([WITHOUT_COVERAGE]);
    expect(el().textContent).toContain('Luis Rojas');
    expect(el().textContent).not.toContain('Ana Salas');
  });

  it('espera 300 ms desde la última tecla antes de buscar', async () => {
    respond([]);
    vi.useFakeTimers();
    try {
      const search = el().querySelector<HTMLInputElement>('app-search-field input')!;
      search.value = 'An';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(200);
      search.value = 'Ana';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(299);
      http.expectNone('/insurance/patients/search');
      await vi.advanceTimersByTimeAsync(1);
      harness.detectChanges();
      const req = request();
      expect(req.request.body.search).toBe('Ana');
      req.flush(page([WITH_COVERAGE]));
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([10, 25, 50])('pagina a %i filas y muestra el total del servidor', (limit) => {
    respond([WITH_COVERAGE], 'next');
    internal<(cursor: string) => void>('move')('next');
    request().flush(page([WITHOUT_COVERAGE]));
    internal<(size: string) => void>('onPageSize')(String(limit));
    harness.detectChanges();
    if (limit === 25) internal<() => void>('reload')();
    const req = request();
    expect(req.request.body.limit).toBe(limit);
    if (limit !== 25) expect(req.request.body.cursor).toBeUndefined();
    req.flush({ ...page([WITH_COVERAGE]), total: 145, limit });
    harness.detectChanges();
    expect(byTestId('directory-count')?.textContent).toContain('145');
  });

  it('rechaza fechas invertidas y acepta un único día inclusivo', () => {
    respond([]);
    const set = internal<(key: string, value: string) => void>('setFilter');
    set('birthDateFrom', '2000-10-06');
    set('birthDateTo', '2000-10-05');
    harness.detectChanges();
    expect(state().status).toBe('validation');
    http.expectNone('/insurance/patients/search');
    set('birthDateFrom', '2000-10-05');
    harness.detectChanges();
    const req = request();
    expect(req.request.body.birthDateFrom).toBe(req.request.body.birthDateTo);
    req.flush(page([]));
  });

  it('combina profesión libre y aseguradora y conserva filtros al reintentar', () => {
    respond([]);
    const set = internal<(key: string, value: string) => void>('setFilter');
    set('occupation', 'Artesana textil');
    set('insurance', 'carrier-1');
    harness.detectChanges();
    const failed = request();
    const body: unknown = failed.request.body;
    expect(body).toEqual({
      limit: 25,
      occupation: 'Artesana textil',
      insuranceCarrierId: 'carrier-1',
    });
    failed.flush({}, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    const retry = Array.from(el().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reintentar carga'),
    );
    expect(retry).toBeDefined();
    retry?.click();
    const retried = request();
    expect(retried.request.body).toEqual(body);
    retried.flush(page([]));
    expect(router.url).toBe(ROUTE);
  });

  it('un rechazo de chat mantiene la búsqueda y no navega', () => {
    respond([]);
    internal<(value: string) => void>('onSearch')('Ana');
    harness.detectChanges();
    respond([WITH_COVERAGE]);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    byTestId('btn-message-patient')?.click();
    byTestId('btn-message-patient')?.click();
    http
      .expectOne('/insurance/patients/conversation')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(el().textContent).toContain('No se pudo abrir la conversación');
    expect(internal<() => { search: string }>('criteria')().search).toBe('Ana');
    expect(el().textContent).toContain('Ana Salas');
  });

  it('descarta búsquedas al cambiar de cuenta y no consulta si falla la autorización', () => {
    respond([WITH_COVERAGE]);
    internal<(value: string) => void>('onSearch')('Ana');
    harness.detectChanges();
    const pending = request();
    const payload = btoa(JSON.stringify({ sub: 'synthetic-user-2', roles: ['USER'], tenants: [] }));
    TestBed.inject(SessionStore).start({
      accessToken: `e30.${payload}.synthetic`,
      refreshToken: 'synthetic',
    });
    harness.detectChanges();
    expect(pending.cancelled).toBe(true);
    const options = http.expectOne('/insurance/patients/options');
    options.flush({code: 'FORBIDDEN', message: 'Acceso denegado'}, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(state().status).toBe('forbidden');
    expect(internal<() => { search: string }>('criteria')().search).toBe('');
    expect(el().textContent).not.toContain('Ana Salas');
    http.expectNone('/insurance/patients/search');
  });

  it('explica el impedimento cuando faltan perfiles de mensajería', () => {
    respond([WITH_COVERAGE]);
    byTestId('btn-message-patient')?.click();
    http
      .expectOne('/insurance/patients/conversation')
      .flush({code: 'PRECONDITION_FAILED', message: 'Mensajería no disponible'}, { status: 422, statusText: 'Unprocessable Entity' });
    harness.detectChanges();
    expect(el().textContent).toContain('ambos deben tener la mensajería activa');
    expect(el().textContent).toContain('Ana Salas');
  });
});
