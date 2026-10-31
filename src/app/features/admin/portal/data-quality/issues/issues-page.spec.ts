import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { IssuesPage } from './issues-page';

const SCREEN = '/superadmin/portal/data-quality/issues';
const ISSUES = '/admin/governance/data-quality/issues';

const issue = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000a1',
  ruleId: '00000000-0000-4000-8000-0000000000b1',
  ruleCode: 'DQ-IDENT-001',
  ruleName: 'SIMULADO · El documento no puede estar vacío',
  severity: 'ERROR',
  status: 'OPEN',
  fieldPath: 'identifier[0].value',
  resourceId: null,
  assignedUserId: null,
  tenantId: 't1',
  runId: 'run1',
  createdAt: '2026-10-30T10:00:00.000Z',
  resolvedAt: null,
  resolutionText: null,
  ...over,
});

describe('IssuesPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let dialogAnswer: string | null = 'Corregido en el origen';

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/data-quality/issues', component: IssuesPage }]),
        { provide: DialogService, useValue: { confirmWithReason: () => Promise.resolve(dialogAnswer) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, IssuesPage);
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const list = () => http.expectOne((r) => r.url === ISSUES);

  afterEach(() => http.verify());

  it('por omisión pide sólo las abiertas y dibuja cada incidencia con su severidad, su campo y sus acciones', async () => {
    await open();
    const req = list();
    expect(req.request.params.get('status')).toBe('OPEN');
    req.flush({ items: [issue()], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    const table = el().querySelector('[data-testid="portal-quality-issues-table"]')!;
    expect(table.textContent).toContain('DQ-IDENT-001');
    expect(table.textContent).toContain('Error');
    expect(table.textContent).toContain('identifier[0].value');
    expect(table.textContent).toContain('Esperando decisión');
    expect(el().querySelector('[data-testid="portal-quality-resolve"]')).not.toBeNull();
    expect(text()).toContain('1 incidencia con estos filtros');
  });

  it('descarta de la URL lo que la API rechazaría y manda lo válido', async () => {
    await open(`${SCREEN}?status=DISMISSED&severity=GRAVISIMA&ruleId=no-es-uuid&q=documento`);
    const req = list();
    expect(req.request.params.get('status')).toBe('DISMISSED');
    expect(req.request.params.has('severity')).toBe(false);
    expect(req.request.params.has('ruleId')).toBe(false);
    expect(req.request.params.get('q')).toBe('documento');
    req.flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    // S3: el vacío dice por qué y ofrece quitar los filtros
    expect(text()).toContain('Ninguna incidencia coincide con los filtros elegidos.');
    expect(text()).toContain('Quitar los filtros');
  });

  it('sin incidencias abiertas el vacío no calla: orienta', async () => {
    await open();
    list().flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('No hay incidencias abiertas');
    expect(text()).toContain('Ver todas las incidencias');
  });

  it('resolver manda la acción y el motivo, avisa y vuelve a leer la lista', async () => {
    await open();
    list().flush({ items: [issue()], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-quality-resolve"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    const post = http.expectOne((r) => r.url === `${ISSUES}/00000000-0000-4000-8000-0000000000a1/resolution`);
    expect(post.request.body).toEqual({ action: 'RESOLVE', note: 'Corregido en el origen' });
    post.flush({ issue: issue({ status: 'RESOLVED' }), alreadyApplied: false });
    list().flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-quality-notice"]')?.textContent).toContain('quedó resuelta');
  });

  it('si la API ya la tenía resuelta lo dice, no finge un cambio', async () => {
    await open();
    list().flush({ items: [issue()], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-quality-resolve"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    http
      .expectOne((r) => r.url.endsWith('/resolution'))
      .flush({ issue: issue({ status: 'RESOLVED' }), alreadyApplied: true });
    list().flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('ya estaba en ese estado: no se cambió nada');
  });

  it('un 409 explica que otra persona la cerró distinto y actualiza la lista', async () => {
    await open();
    list().flush({ items: [issue()], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-quality-dismiss"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    http.expectOne((r) => r.url.endsWith('/resolution')).flush(
      { statusCode: 409, code: 'CONFLICT', message: 'x', error: 'Conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    list().flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('Otra persona cerró esta incidencia con otro desenlace');
  });

  it('si la persona se arrepiente en el diálogo no se manda nada', async () => {
    dialogAnswer = null;
    await open();
    list().flush({ items: [issue()], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    (el().querySelector('[data-testid="portal-quality-resolve"]') as HTMLElement).click();
    await harness.fixture.whenStable();
    http.expectNone((r) => r.url.endsWith('/resolution'));
    dialogAnswer = 'Corregido en el origen';
  });

  it('una incidencia cerrada muestra su motivo y no ofrece acciones', async () => {
    await open(`${SCREEN}?status=ALL`);
    list().flush({
      items: [issue({ status: 'DISMISSED', resolvedAt: '2026-10-31T09:00:00.000Z', resolutionText: 'Falso positivo' })],
      nextCursor: null,
      limit: 25,
      total: 1,
    });
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-quality-resolution-text"]')?.textContent).toContain('Falso positivo');
    expect(el().querySelector('[data-testid="portal-quality-resolve"]')).toBeNull();
  });

  it('un fallo de la API no se dibuja como lista vacía', async () => {
    await open();
    list().flush(
      { statusCode: 500, code: 'INTERNAL_ERROR', message: 'x', error: 'Internal Server Error', correlationId: 'req-1' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    harness.detectChanges();
    expect(text()).not.toContain('No hay incidencias abiertas');
  });
});
