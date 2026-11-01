import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PolicyDetailPage } from './policy-detail-page';

const ID = '00000000-0000-4000-8000-000000000005';
const SCREEN = `/superadmin/portal/governance/policies/${ID}`;
const DETAIL = `/admin/governance/policies/ANONYMIZATION/${ID}`;
const CHANGE_LOG = '/admin/governance/change-log';

const detail = {
  policyType: 'ANONYMIZATION',
  id: ID,
  code: 'ANON-HASH',
  name: null,
  state: null,
  version: 2,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: null,
  createdByUserId: '00000000-0000-4000-8000-000000000800',
  updatedByUserId: null,
  settings: {
    technique: 'HASH',
    description: null,
    parameterKeys: ['algorithm', 'salt'],
  },
  appliedTo: {
    total: 52,
    items: [
      { schemaName: 'a', tableName: 'b', columnName: 'c' },
      { schemaName: 'a', tableName: 'b', columnName: 'd' },
    ],
    truncated: true,
  },
};

const changeLog = (items: object[]) => ({
  items,
  nextCursor: null,
  limit: 20,
  order: 'recorded_at desc, id desc',
});

const change = {
  id: 'h1',
  targetType: 'anonymization_rules',
  targetId: ID,
  action: 'CREATED',
  changedByUserId: 'u1',
  reason: null,
  recordedAt: '2026-10-02T10:00:00.000Z',
};

describe('PolicyDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = `${SCREEN}?tipo=ANONYMIZATION`): Promise<void> {
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

  /** Responde el detalle y, como la ficha lo pide enseguida, la bitácora. */
  function answer(log: object = changeLog([change])): void {
    http.expectOne(DETAIL).flush(detail);
    http.expectOne((r) => r.url === CHANGE_LOG).flush(log);
    harness.detectChanges();
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  afterEach(() => http.verify());

  it('pide la política por tipo e id de la URL y muestra ajustes y estado, sin valores de parámetros', async () => {
    await open();
    answer();
    expect(text()).toContain('ANON-HASH');
    expect(text()).toContain('Técnica: HASH');
    // La API manda sólo los NOMBRES de los parámetros: se dicen como tales.
    expect(text()).toContain('Parámetros (sólo sus nombres)');
    expect(text()).toContain('algorithm, salt');
    // Un ajuste sin valor se dice, no se omite ni se pinta como «No».
    expect(text()).toContain('Sin declarar');
    expect(text()).toContain('Sin estado');
    expect(text()).toContain('Versión 2');
    expect(text()).toContain('La API no registra fecha de cambio');
  });

  it('la pestaña «A qué se aplica» nombra las columnas y dice el recorte', async () => {
    await open(`${SCREEN}?tipo=ANONYMIZATION&vista=aplica`);
    answer();
    const section = root().querySelector('[data-testid="portal-policy-applies"]')!;
    expect(section.textContent).toContain('Columnas (52)');
    expect(section.textContent).toContain('a.b.c');
    expect(section.textContent).toContain('Se muestran 2 de 52.');
  });

  it('una residencia dice que la API no lista a qué se aplica, en vez de «ninguno»', async () => {
    await open(`${SCREEN}?tipo=ANONYMIZATION&vista=aplica`);
    http.expectOne(DETAIL).flush({
      ...detail,
      policyType: 'RESIDENCY',
      settings: {},
      appliedTo: { total: 0, items: [], truncated: false },
    });
    http.expectOne((r) => r.url === CHANGE_LOG).flush(changeLog([]));
    harness.detectChanges();
    const section = root().querySelector('[data-testid="portal-policy-applies"]')!;
    expect(section.textContent).toContain('no lista a qué organizaciones');
  });

  it('el historial sale de la bitácora filtrada por la política, desde un día antes de su alta', async () => {
    await open(`${SCREEN}?tipo=ANONYMIZATION&vista=historial`);
    http.expectOne(DETAIL).flush(detail);
    const req = http.expectOne((r) => r.url === CHANGE_LOG);
    expect(req.request.params.get('targetId')).toBe(ID);
    // Sin `from` la API sólo mira 30 días: se pide desde el alta (menos un día).
    expect(req.request.params.get('from')).toBe('2026-08-31T00:00:00.000Z');
    req.flush(changeLog([change]));
    harness.detectChanges();
    const section = root().querySelector('[data-testid="portal-policy-history"]')!;
    expect(section.textContent).toContain('CREATED');
    expect(section.textContent).toContain('Sin motivo registrado');
  });

  it('sin cambios en la bitácora lo dice y ofrece una salida', async () => {
    await open(`${SCREEN}?tipo=ANONYMIZATION&vista=historial`);
    http.expectOne(DETAIL).flush(detail);
    http.expectOne((r) => r.url === CHANGE_LOG).flush(changeLog([]));
    harness.detectChanges();
    expect(text()).toContain('La bitácora de gobierno no registra cambios sobre esta política.');
  });

  it('un fallo de la bitácora no tumba la ficha de la política', async () => {
    await open(`${SCREEN}?tipo=ANONYMIZATION&vista=historial`);
    http.expectOne(DETAIL).flush(detail);
    http
      .expectOne((r) => r.url === CHANGE_LOG)
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'Prohibido', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();
    expect(root().querySelector('[data-testid="portal-policy-detail"]')).not.toBeNull();
    expect(text()).toContain('ANON-HASH');
  });

  it('una política que no existe se dice como no encontrada y no dibuja la ficha', async () => {
    await open();
    http.expectOne(DETAIL).flush(
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

  it('sin un tipo que la API conozca no se pide nada y la ficha es «no encontrada»', async () => {
    await open(SCREEN);
    harness.detectChanges();
    http.expectNone((r) => r.url.startsWith('/admin/governance/'));
    expect(root().querySelector('[data-testid="portal-policy-detail"]')).toBeNull();
    http.verify();
  });

  it('un tipo que ya no existe (CLASSIFICATION) tampoco llega a la API', async () => {
    await open(`${SCREEN}?tipo=CLASSIFICATION`);
    harness.detectChanges();
    http.expectNone((r) => r.url.startsWith('/admin/governance/'));
    expect(root().querySelector('[data-testid="portal-policy-detail"]')).toBeNull();
  });
});
