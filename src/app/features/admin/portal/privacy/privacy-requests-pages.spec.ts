import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { PrivacyRequestDetailPage } from './privacy-request-detail-page';
import { PrivacyRequestsPage } from './privacy-requests-page';

const LIST = '/admin/governance/privacy-requests';
const ID = '00000000-0000-4000-8000-0000000000d1';
const COUNTS = { RECEIVED: 2, IN_PROGRESS: 1, COMPLETED: 0, REJECTED: 0, other: 0 };

const request = (over: Record<string, unknown> = {}) => ({
  id: ID,
  subjectUserId: '00000000-0000-4000-8000-0000000000e1',
  type: 'ACCESS',
  status: 'RECEIVED',
  jurisdiction: 'PE',
  requestedAt: '2026-10-05T10:00:00.000Z',
  completedAt: null,
  resultFileId: null,
  updatedAt: '2026-10-05T10:00:00.000Z',
  rowVersion: 1,
  allowedTransitions: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
  ...over,
});

describe('Solicitudes de privacidad', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed = true;

  async function open<T>(url: string, component: new () => T): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/governance/privacy-requests', component: PrivacyRequestsPage },
          { path: 'superadmin/portal/governance/privacy-requests/:requestId', component: PrivacyRequestDetailPage },
        ]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmed) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, component);
  }
  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  afterEach(() => {
    confirmed = true;
    http.verify();
  });

  it('la lista pone los conteos de la API en las pestañas y dibuja tipo, jurisdicción y espera', async () => {
    await open('/superadmin/portal/governance/privacy-requests?status=RECEIVED&type=NADA', PrivacyRequestsPage);
    const req = http.expectOne((r) => r.url === LIST);
    expect(req.request.params.get('status')).toBe('RECEIVED');
    // un tipo que la API rechazaría no se manda
    expect(req.request.params.has('type')).toBe(false);
    req.flush({ items: [request()], nextCursor: null, limit: 25, total: 1, statusCounts: COUNTS });
    harness.detectChanges();
    expect(text()).toContain('Recibidas (2)');
    expect(text()).toContain('En curso (1)');
    const table = el().querySelector('[data-testid="portal-privacy-requests-table"]')!;
    expect(table.textContent).toContain('Acceso a sus datos');
    expect(table.textContent).toContain('Perú');
    expect(table.textContent).toContain('Sin cerrar hace');
  });

  it('sin solicitudes el vacío lo dice, no queda en blanco', async () => {
    await open('/superadmin/portal/governance/privacy-requests', PrivacyRequestsPage);
    http
      .expectOne((r) => r.url === LIST)
      .flush({ items: [], nextCursor: null, limit: 25, total: 0, statusCounts: { ...COUNTS, RECEIVED: 0, IN_PROGRESS: 0 } });
    harness.detectChanges();
    expect(text()).toContain('Todavía no se recibió ninguna solicitud de privacidad');
  });

  it('la ficha ofrece sólo las transiciones que la API publicó', async () => {
    await open(`/superadmin/portal/governance/privacy-requests/${ID}?vista=tramitar`, PrivacyRequestDetailPage);
    http.expectOne((r) => r.url === `${LIST}/${ID}`).flush(request({ allowedTransitions: ['COMPLETED', 'REJECTED'], status: 'IN_PROGRESS' }));
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-privacy-move-IN_PROGRESS"]')).toBeNull();
    expect(el().querySelector('[data-testid="portal-privacy-move-COMPLETED"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="portal-privacy-move-REJECTED"]')).not.toBeNull();
  });

  it('una solicitud cerrada no ofrece ningún botón y lo explica', async () => {
    await open(`/superadmin/portal/governance/privacy-requests/${ID}?vista=tramitar`, PrivacyRequestDetailPage);
    http
      .expectOne((r) => r.url === `${LIST}/${ID}`)
      .flush(request({ status: 'COMPLETED', allowedTransitions: [], completedAt: '2026-10-10T10:00:00.000Z' }));
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-privacy-closed"]')?.textContent).toContain('no admite más cambios');
    expect(el().querySelector('[data-testid="portal-privacy-actions"]')).toBeNull();
  });

  it('tramitar pide confirmación, usa PATCH /privacy/dsar/:id y vuelve a leer la solicitud', async () => {
    await open(`/superadmin/portal/governance/privacy-requests/${ID}?vista=tramitar`, PrivacyRequestDetailPage);
    http.expectOne((r) => r.url === `${LIST}/${ID}`).flush(request());
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-privacy-move-IN_PROGRESS"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    const patch = http.expectOne((r) => r.url === `/privacy/dsar/${ID}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'IN_PROGRESS' });
    patch.flush({ id: ID });
    http.expectOne((r) => r.url === `${LIST}/${ID}`).flush(request({ status: 'IN_PROGRESS', allowedTransitions: ['COMPLETED', 'REJECTED'] }));
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-privacy-notice"]')?.textContent).toContain('en curso');
    expect(el().querySelector('[data-testid="portal-privacy-request-status"]')?.textContent).toContain('En curso');
  });

  it('si la persona no confirma no se manda nada', async () => {
    confirmed = false;
    await open(`/superadmin/portal/governance/privacy-requests/${ID}?vista=tramitar`, PrivacyRequestDetailPage);
    http.expectOne((r) => r.url === `${LIST}/${ID}`).flush(request());
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-privacy-move-REJECTED"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    http.expectNone((r) => r.url.startsWith('/privacy/dsar'));
  });

  it('un 403 al tramitar se dice con todas las letras y no cambia nada', async () => {
    await open(`/superadmin/portal/governance/privacy-requests/${ID}?vista=tramitar`, PrivacyRequestDetailPage);
    http.expectOne((r) => r.url === `${LIST}/${ID}`).flush(request());
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-privacy-move-COMPLETED"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    http.expectOne((r) => r.url === `/privacy/dsar/${ID}`).flush(
      { statusCode: 403, code: 'FORBIDDEN', message: 'x', error: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-privacy-notice"]')?.textContent).toContain('no tiene permiso');
  });
});
