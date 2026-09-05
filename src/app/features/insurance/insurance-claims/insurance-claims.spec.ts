import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InsuranceClaims } from './insurance-claims';

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const CARRIER_ID = '22222222-2222-4222-8222-222222222222';

/** Una fila tal cual la manda el servidor: importes como **cadena**. */
function claimWire(overrides: Record<string, unknown> = {}) {
  return {
    id: CLAIM_ID,
    claimIdentifier: 'CLM-m6guv-004',
    patient: {
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Rosa Quispe Mamani',
      patientCode: 'PAC-0001',
      memberIdentifier: 'AF-1',
    },
    carrierName: 'Nacional Seguros',
    insuranceCarrierId: CARRIER_ID,
    policyIdentifier: 'POL-1',
    policyBrokerName: null,
    billedTotal: { amount: '1615.125', currency: { code: 'BOB', display: 'Boliviano' } },
    approvedTotal: null,
    submittedAt: '2026-05-01T12:00:00.000Z',
    status: { code: 'CLAIM_SUBMITTED', display: 'Reclamo enviado' },
    hasOpenDispute: false,
    ...overrides,
  };
}

/**
 * El listado de solicitudes de seguro presentadas (TAREA-16).
 *
 * Es la cara del **prestador que envió** el reclamo: el alcance lo resuelve el
 * servidor por las prácticas de la organización, y la pantalla sólo tiene que
 * mostrar lo que le llega y no inventar nada que el contrato no traiga.
 */
describe('InsuranceClaims', () => {
  let fixture: ComponentFixture<InsuranceClaims>;
  let component: InsuranceClaims;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Monta y responde el catálogo de aseguradoras del filtro. */
  function mount(carriers: unknown[] = []): void {
    fixture = TestBed.createComponent(InsuranceClaims);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/insurance-carriers').flush({ items: carriers, count: carriers.length });
  }

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function status(): string {
    return internal<() => { status: string }>('results')().status;
  }

  /** La petición del listado, sea cual sea su query. */
  function listado() {
    return http.expectOne((req) => req.url === '/insurance-claims');
  }

  it('empieza cargando y pide la primera página por cursor', () => {
    mount();
    const req = listado();

    expect(status()).toBe('loading');
    // Sin cursor en la primera página, y con tamaño de página fijo: el cursor
    // no conoce el total, así que no hay número de página que mandar.
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.get('limit')).toBe('25');

    req.flush({ items: [], nextCursor: null });
  });

  it('usa el estado vacío explícito cuando la organización no presentó nada', () => {
    mount();
    listado().flush({ items: [], nextCursor: null });

    expect(status()).toBe('empty');
  });

  it('pinta la fila con el identificador, el paciente y el importe tal cual llega', () => {
    mount();
    listado().flush({ items: [claimWire()], nextCursor: null });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(status()).toBe('ready');
    expect(texto).toContain('CLM-m6guv-004');
    expect(texto).toContain('Rosa Quispe Mamani');
    // El importe no se reformatea ni se redondea: AC-16-6 compara cadenas.
    expect(texto).toContain('1615.125');
    // Y no se filtra el uuid de la solicitud a la vista.
    expect(texto).not.toContain(CLAIM_ID);
  });

  /**
   * AC-16-7: sin dictamen, el total aprobado se dice con palabras. Un `0.00`
   * ahí significaría «denegaron todo», que es otra cosa.
   */
  it('declara la ausencia de dictamen en vez de mostrar cero', () => {
    mount();
    listado().flush({ items: [claimWire()], nextCursor: null });
    fixture.detectChanges();

    const celda: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="claim-approved"]',
    );
    expect(celda.textContent?.trim()).toBe('Sin dictaminar');
    expect(celda.textContent).not.toContain('0.00');
  });

  it('marca la solicitud reclamada', () => {
    mount();
    listado().flush({ items: [claimWire({ hasOpenDispute: true })], nextCursor: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reclamada');
  });

  it('sigue el cursor que devolvió el servidor, sin números de página', () => {
    mount();
    listado().flush({ items: [claimWire()], nextCursor: 'cursor-2' });
    fixture.detectChanges();

    internal<(cursor: string) => void>('move')('cursor-2');

    const segunda = listado();
    expect(segunda.request.params.get('cursor')).toBe('cursor-2');
    segunda.flush({ items: [], nextCursor: null });
  });

  /**
   * El 403 del servidor —«esta pantalla no es tuya», AC-16-14— no es un error
   * técnico: tiene su propio estado, para que la pantalla pueda explicarlo en
   * vez de ofrecer un reintento que va a volver a fallar.
   */
  it('traduce el 403 del alcance a estado prohibido, no a error', () => {
    mount();
    listado().flush(
      { code: 'FORBIDDEN', message: 'No hay acceso a esa solicitud de seguro' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(status()).toBe('forbidden');
  });

  it('usa el estado de error compartido cuando la lectura falla de verdad', () => {
    mount();
    listado().flush(
      { message: 'falló', requestId: 'req-clm' },
      { status: 500, statusText: 'Server Error' },
    );

    expect(status()).toBe('error');
  });
});
