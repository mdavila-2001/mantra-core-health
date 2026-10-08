import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '@core/auth/session.store';
import type {
  PatientSpendingResponseDto,
  SpendingMovementDto,
} from '@core/data-access/patient-spending/patient-spending.dto';

import { Spending } from './spending';

/**
 * «Mis gastos». Lo que se fija: la pantalla se guarda por perfil de paciente,
 * pide el rango del 1 de enero del año pasado a hoy, el vacío ofrece salida,
 * y con datos cada tarjeta dice su cifra — la del mes, la del año, las
 * categorías que cambian con el selector y los últimos movimientos.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const TODAY = new Date();
const THIS_MONTH = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1, 10);
const LAST_YEAR = new Date(TODAY.getFullYear() - 1, 2, 1, 10);

function movement(
  id: string,
  when: Date,
  paid: string,
  code: string,
  description: string,
): SpendingMovementDto {
  return {
    id,
    occurredAt: when.toISOString(),
    description,
    category: { code, display: code },
    providerName: 'Farmacia Vida',
    grossAmount: paid,
    coveredAmount: '0.00',
    discountAmount: '0.00',
    paidAmount: paid,
  };
}

function page(items: SpendingMovementDto[]): PatientSpendingResponseDto {
  return { currency: 'BOB', from: 'x', to: 'y', items };
}

describe('Spending', () => {
  let fixture: ComponentFixture<Spending>;
  let http: HttpTestingController;

  function abrirSesion(claims: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
  }

  function montar(): void {
    fixture = TestBed.createComponent(Spending);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(testId?: string): string {
    const el = testId === undefined ? raiz() : raiz().querySelector(`[data-testid="${testId}"]`);
    return (el?.textContent ?? '').replace(/\s+/g, ' ');
  }

  function responder(items: SpendingMovementDto[]): void {
    http.expectOne((r) => r.url === '/patient-spending/me').flush(page(items));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sin perfil de paciente lo dice, sin pedir nada', () => {
    abrirSesion({});
    montar();

    expect(texto()).toContain('Esta sección es para pacientes');
    expect(raiz().querySelector('[data-testid="spending-dashboard"]')).toBeNull();
  });

  it('pide del 1 de enero del año pasado a hoy', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    const req = http.expectOne((r) => r.url === '/patient-spending/me');
    expect(req.request.params.get('from')).toBe(`${TODAY.getFullYear() - 1}-01-01`);
    expect(req.request.params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    req.flush(page([]));
  });

  it('sin movimientos ofrece una salida en vez de un tablero en cero', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    responder([]);

    expect(texto()).toContain('Todavía no tiene gastos registrados');
    expect(texto()).toContain('Buscar un profesional');
    expect(raiz().querySelector('[data-testid="spending-dashboard"]')).toBeNull();
  });

  it('con datos, cada tarjeta dice su cifra', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    responder([
      movement('a', THIS_MONTH, '300.00', 'SPEND_CONSULTATION', 'Consulta de control'),
      movement('b', THIS_MONTH, '100.00', 'SPEND_PHARMACY', 'Compra de medicamentos'),
      movement('c', LAST_YEAR, '900.00', 'SPEND_IMAGING', 'Tomografía'),
    ]);

    expect(texto('spending-this-month')).toMatch(/Bs 400,00/);
    expect(texto('spending-year-to-date')).toMatch(/Bs 400,00/);
    expect(texto('spending-previous-year')).toMatch(/Bs 900,00/);
    // El mes a mes dibuja doce meses, cada uno con su nombre accesible.
    const meses = raiz().querySelectorAll('[data-testid="spending-year-chart-month"]');
    expect(meses).toHaveLength(12);
    expect(meses[2]?.getAttribute('aria-label')).toContain('Bs 900,00');
    // Los últimos movimientos, del más reciente al más antiguo.
    expect(raiz().querySelectorAll('[data-testid="spending-recent"] tbody tr')).toHaveLength(3);
  });

  it('las categorías cambian con el selector: el mes contra el año', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    const earlierThisYear = new Date(TODAY.getFullYear(), 0, 1, 10);
    responder([
      movement('a', THIS_MONTH, '300.00', 'SPEND_CONSULTATION', 'Consulta'),
      ...(TODAY.getMonth() === 0
        ? []
        : [movement('b', earlierThisYear, '50.00', 'SPEND_LABORATORY', 'Hemograma')]),
    ]);

    const rotulos = () =>
      [...raiz().querySelectorAll('[data-testid="spending-category"] .spending__category-name')].map(
        (el) => el.textContent?.trim(),
      );
    expect(rotulos()).toEqual(['Consultas']);

    const anio = [...raiz().querySelectorAll<HTMLButtonElement>('app-segmented-control button')].find(
      (b) => b.textContent?.includes('Este año'),
    );
    anio?.click();
    fixture.detectChanges();

    expect(rotulos()).toEqual(
      TODAY.getMonth() === 0 ? ['Consultas'] : ['Consultas', 'Laboratorio'],
    );
  });

  it('un error del servidor no se disfraza de tablero vacío', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    http
      .expectOne((r) => r.url === '/patient-spending/me')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(raiz().querySelector('[data-testid="spending-dashboard"]')).toBeNull();
    expect(texto()).not.toContain('Todavía no tiene gastos registrados');
  });
});
