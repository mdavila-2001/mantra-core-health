import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PolicyDetailPage } from './policy-detail-page';

const ID = '00000000-0000-4000-8000-000000000005';
const SCREEN = `/superadmin/portal/governance/policies/${ID}`;

const detail = {
  id: ID,
  type: 'ANONYMIZATION',
  code: 'ANON-HASH',
  name: null,
  stateCode: null,
  stateLabel: null,
  attributes: { technique: 'Hash con sal', description: null },
  updatedAt: null,
  configuration: { algorithm: 'sha256', salt: '[oculto]' },
  appliesTo: [
    { kind: 'FIELD', total: 52, items: ['a.b.c', 'a.b.d'], truncated: true },
    { kind: 'TENANT_BINDING', total: 3, items: [], truncated: false },
  ],
  history: [
    {
      id: 'h1',
      action: 'Alta',
      changedByUserId: 'u1',
      reason: null,
      recordedAt: '2026-10-02T10:00:00.000Z',
    },
  ],
};

describe('PolicyDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/governance/policies/:id', component: PolicyDetailPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PolicyDetailPage);
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  afterEach(() => http.verify());

  it('pide la política por el id de la URL y muestra atributos, estado y configuración sin secretos', async () => {
    await open();
    http.expectOne(`/admin/governance/policies/${ID}`).flush(detail);
    harness.detectChanges();
    expect(text()).toContain('ANON-HASH');
    expect(text()).toContain('Técnica: Hash con sal');
    // Un atributo sin valor se dice, no se omite ni se pinta como «No».
    expect(text()).toContain('Sin declarar');
    expect(text()).toContain('Sin estado');
    expect(root().querySelector('[data-testid="portal-policy-config"]')!.textContent).toContain(
      '[oculto]',
    );
    expect(text()).toContain('La API no registra fecha de cambio');
  });

  it('la pestaña «A qué se aplica» dice el recorte y explica el vínculo que no lista', async () => {
    await open(`${SCREEN}?vista=aplica`);
    http.expectOne(`/admin/governance/policies/${ID}`).flush(detail);
    harness.detectChanges();
    const section = root().querySelector('[data-testid="portal-policy-applies"]')!;
    expect(section.textContent).toContain('Campos (52)');
    expect(section.textContent).toContain('Se muestran 2 de 52.');
    expect(section.textContent).toContain('Vínculos con organizaciones (3)');
    expect(section.textContent).toContain('sólo informa cuántos son');
  });

  it('el historial muestra la acción y, sin motivo, lo dice', async () => {
    await open(`${SCREEN}?vista=historial`);
    http.expectOne(`/admin/governance/policies/${ID}`).flush(detail);
    harness.detectChanges();
    const section = root().querySelector('[data-testid="portal-policy-history"]')!;
    expect(section.textContent).toContain('Alta');
    expect(section.textContent).toContain('Sin motivo registrado');
  });

  it('una política que no existe se dice como no encontrada y no dibuja la ficha', async () => {
    await open();
    http
      .expectOne(`/admin/governance/policies/${ID}`)
      .flush(
        {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Política no encontrada',
          error: 'Not Found',
        },
        { status: 404, statusText: 'Not Found' },
      );
    harness.detectChanges();
    expect(root().querySelector('[data-testid="portal-policy-detail"]')).toBeNull();
  });
});
