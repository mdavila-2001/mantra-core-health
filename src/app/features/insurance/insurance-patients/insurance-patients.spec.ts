import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BoOccupationsCatalog } from '../../../core/data-access/terminology/bo-occupations.service';
import { SearchMemoryService } from '../../../core/navigation/search-memory.service';
import { InsurancePatients } from './insurance-patients';

/**
 * Directorio de pacientes de la aseguradora. Se monta con `RouterTestingHarness`
 * porque los filtros de catálogo y el rango de nacimiento **viven en la URL**:
 * sin un router de verdad, cambiar un filtro no recargaría nada.
 */
const ROUTE = '/administration/insurance-patients';

const WITH_COVERAGE = {
  patientProfileId: 'pp-1',
  fullName: 'Ana Salas',
  documentNumber: '4567890',
  birthDate: '1990-10-05',
  age: 35,
  phone: '+591 70000001',
  email: 'ana@example.com',
  genderCode: 'GENDER_FEMALE',
  occupationDisplay: 'Docente',
  coverage: {
    hasActiveCoverage: true,
    planName: 'Plan Salud Vital',
    policyIdentifier: 'POL-1',
  },
  communityProfileSlug: 'ana-salas',
};

const WITHOUT_COVERAGE = {
  patientProfileId: 'pp-2',
  fullName: 'Luis Rojas',
  coverage: { hasActiveCoverage: false },
};

function page(items: unknown[], nextCursor: string | null = null) {
  return { items, limit: 10, nextCursor };
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
        provideRouter([{ path: 'administration/insurance-patients', component: InsurancePatients }]),
        {
          provide: BoOccupationsCatalog,
          useValue: {
            listar: () => of([{ conceptId: 'occ-doc', code: 'DOC', display: 'Docente' }]),
          },
        },
      ],
    });
    TestBed.inject(SearchMemoryService).write('insurer-patients', { q: '' });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(ROUTE, InsurancePatients);
    flushGender();
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
    return http.expectOne((r) => r.url === '/insurance/patients');
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

  it('pide la primera página de 10 sin ningún filtro ni id de aseguradora', () => {
    const req = request();

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['limit']);
    expect(req.request.params.get('limit')).toBe('10');

    req.flush(page([]));
  });

  it('con filas queda en `ready` y pinta nombre, documento y teléfono con enlace tel:', () => {
    respond([WITH_COVERAGE]);

    expect(state().status).toBe('ready');
    expect(el().textContent).toContain('Ana Salas');
    expect(el().textContent).toContain('CI 4567890');
    const phone = el().querySelector<HTMLAnchorElement>('.directory__phone-link');
    expect(phone?.getAttribute('href')).toBe('tel:+59170000001');
    expect(el().textContent).toContain('05/10/1990');
    expect(el().textContent).toContain('35 años');
  });

  it('AC-3: un paciente sin cobertura vigente dice exactamente «Ninguno»', () => {
    respond([WITH_COVERAGE, WITHOUT_COVERAGE]);

    const none = byTestId('badge-insurance-none');
    expect(none?.textContent?.trim()).toBe('Ninguno');
    expect(el().querySelectorAll('[data-testid="badge-insurance-none"]')).toHaveLength(1);
    expect(el().textContent).toContain('Plan Salud Vital');
    expect(el().textContent).toContain('Póliza POL-1');
  });

  it('dice «Sin correo» y «No especificada» cuando faltan, sin dejar el hueco mudo', () => {
    respond([WITHOUT_COVERAGE]);

    expect(el().textContent).toContain('Sin correo');
    expect(el().textContent).toContain('No especificada');
  });

  it('AC-4: «Escribir» abre el chat con el slug del paciente', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    respond([WITH_COVERAGE]);

    byTestId('btn-message-patient')?.click();

    expect(navigate).toHaveBeenCalledWith(['/messaging'], { queryParams: { escribirA: 'ana-salas' } });
  });

  it('AC-4: sin perfil de comunidad «Escribir» no navega y dice por qué', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    respond([WITHOUT_COVERAGE]);

    const button = byTestId('btn-message-patient');
    button?.click();

    expect(navigate).not.toHaveBeenCalled();
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.getAttribute('aria-label')).toContain('todavía no activó la mensajería');
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

  it('AC-2: un filtro de catálogo va a la URL y a la petición, y vuelve a la primera página', async () => {
    respond([WITH_COVERAGE], 'c-2');

    await router.navigate([], { queryParams: { insuranceStatus: 'NO_INSURANCE' }, queryParamsHandling: 'merge' });
    harness.detectChanges();

    const req = request();
    expect(req.request.params.get('insuranceStatus')).toBe('NO_INSURANCE');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(router.url).toContain('insuranceStatus=NO_INSURANCE');
    req.flush(page([WITHOUT_COVERAGE]));
  });

  it('el texto buscado va a la petición pero NO a la URL', () => {
    respond([WITH_COVERAGE]);

    internal<(text: string) => void>('onSearch')('4567890');
    harness.detectChanges();

    const req = request();
    expect(req.request.params.get('search')).toBe('4567890');
    expect(router.url).not.toContain('4567890');
    req.flush(page([WITH_COVERAGE]));
  });

  it('el rango de nacimiento viaja como fecha civil, sin correrse de huso', async () => {
    respond([]);

    internal<(date: Date | null) => void>('onBirthFrom')(new Date(1980, 0, 1));
    await harness.fixture.whenStable();
    harness.detectChanges();

    const req = request();
    expect(req.request.params.get('birthDateFrom')).toBe('1980-01-01');
    req.flush(page([]));
  });

  it('siguiente página: manda el cursor que entregó la anterior', () => {
    respond([WITH_COVERAGE], 'c-2');

    internal<(cursor: string) => void>('move')('c-2');
    harness.detectChanges();

    const req = request();
    expect(req.request.params.get('cursor')).toBe('c-2');
    req.flush(page([WITHOUT_COVERAGE]));
  });

  it('vacío con filtros dice que ninguno coincide; vacío sin filtros, que todavía no hay nadie', async () => {
    respond([]);
    expect(el().textContent).toContain('Todavía no hay pacientes');

    await router.navigate([], { queryParams: { genderConceptId: 'g-f' }, queryParamsHandling: 'merge' });
    harness.detectChanges();
    request().flush(page([]));
    harness.detectChanges();

    expect(state().status).toBe('empty');
    expect(el().textContent).toContain('Ningún paciente coincide con los filtros elegidos.');
  });

  it('«Limpiar filtros» saca de la URL todo lo propio y vacía la búsqueda', async () => {
    respond([]);
    await router.navigate([], {
      queryParams: { insuranceStatus: 'NO_INSURANCE', birthDateFrom: '1980-01-01' },
      queryParamsHandling: 'merge',
    });
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
});
