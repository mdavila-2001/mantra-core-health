import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { InsuranceApprovals } from './insurance-approvals';

const BANDEJA = '/prior-authorization-requests/inbox';

function fila(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    origin: 'PHARMACY',
    status: 'SUBMITTED',
    decision: null,
    patient: { id: 'p', displayName: `Paciente ${id}`, patientCode: 'P', memberIdentifier: 'M' },
    planName: 'Plan Oro',
    currencyCode: 'BOB',
    itemCount: 2,
    totalRequestedAmount: '100.00',
    submittedAt: '2026-09-20T12:00:00.000Z',
    ...over,
  };
}

describe('InsuranceApprovals', () => {
  let fixture: ComponentFixture<InsuranceApprovals>;
  let http: HttpTestingController;
  let router: Router;

  async function montar(url = '/administration/insurance-approvals'): Promise<void> {
    TestBed.configureTestingModule({
      imports: [InsuranceApprovals],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/insurance-approvals', component: InsuranceApprovals }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(InsuranceApprovals);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('sin parámetro abre en pendientes', async () => {
    await montar();
    const req = http.expectOne((r) => r.url === BANDEJA);
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush({ items: [fila('a'), fila('b')] });
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid="approval-link"]')).toHaveLength(2);
    expect(el().textContent).toContain('Pendiente');
  });

  it('?estado=todas no manda status; ?estado=decididas manda DETERMINED', async () => {
    await montar('/administration/insurance-approvals?estado=todas');
    expect(http.expectOne((r) => r.url === BANDEJA).request.params.has('status')).toBe(false);
    TestBed.resetTestingModule();
    await montar('/administration/insurance-approvals?estado=decididas');
    const req = http.expectOne((r) => r.url === BANDEJA);
    expect(req.request.params.get('status')).toBe('DETERMINED');
    req.flush({ items: [fila('c', { status: 'DETERMINED', decision: 'PARTIAL' })] });
    fixture.detectChanges();
    expect(el().textContent).toContain('Aprobación parcial');
  });

  it('pendientes vacía: S3 con enlace a las respondidas que respeta el ?', async () => {
    await montar();
    http.expectOne((r) => r.url === BANDEJA).flush({ items: [] });
    fixture.detectChanges();
    expect(el().textContent).toContain('No hay solicitudes esperando respuesta');
    const enlace = [...el().querySelectorAll<HTMLAnchorElement>('a')].find((a) =>
      a.textContent?.includes('Ver las respondidas'),
    );
    expect(enlace?.getAttribute('href')).toBe('/administration/insurance-approvals?estado=decididas');
  });

  it('un tenant que no es aseguradora ve S5, no una lista vacía', async () => {
    await montar();
    http
      .expectOne((r) => r.url === BANDEJA)
      .flush(
        { code: 'FORBIDDEN', message: 'No hay acceso a esa solicitud de seguro', timestamp: '', path: BANDEJA },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();
    expect(el().textContent).toContain('No hay acceso');
    expect(el().querySelectorAll('[data-testid="approval-link"]')).toHaveLength(0);
  });

  it('un cambio de filtro cancela la lectura anterior: no pinta una respuesta vieja', async () => {
    await montar();
    const vieja = http.expectOne((r) => r.url === BANDEJA);
    await router.navigateByUrl('/administration/insurance-approvals?estado=decididas');
    fixture.detectChanges();
    expect(vieja.cancelled).toBe(true);
    http
      .expectOne((r) => r.url === BANDEJA && r.params.get('status') === 'DETERMINED')
      .flush({ items: [fila('d', { status: 'DETERMINED', decision: 'APPROVED' })] });
    fixture.detectChanges();
    expect(el().textContent).toContain('Aprobada');
  });
});
