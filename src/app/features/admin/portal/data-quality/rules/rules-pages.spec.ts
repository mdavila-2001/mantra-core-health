import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { RuleDetailPage } from './rule-detail-page';
import { RulesPage } from './rules-page';

const BASE = '/admin/governance/data-quality/rules';
const RULE = {
  id: '00000000-0000-4000-8000-0000000000b1',
  ruleCode: 'DQ-IDENT-001',
  name: 'SIMULADO · Documento obligatorio',
  severity: 'ERROR',
  state: { code: 'ACTIVE', display: 'Activa' },
  dimension: { code: 'DQ_COMPLETENESS', display: 'Completitud' },
  ruleSet: { id: 's1', code: 'DQ-BASE', name: 'Reglas base', version: '1.0' },
  openIssues: 2,
  totalIssues: 5,
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('Reglas de calidad de datos', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open<T>(url: string, component: new () => T): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/data-quality/rules', component: RulesPage },
          { path: 'superadmin/portal/data-quality/rules/:ruleId', component: RuleDetailPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, component);
  }
  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  afterEach(() => http.verify());

  it('la lista dice cuántas incidencias abiertas tiene cada regla y enlaza a su ficha', async () => {
    await open('/superadmin/portal/data-quality/rules?severity=ERROR&q=doc', RulesPage);
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('severity')).toBe('ERROR');
    expect(req.request.params.get('q')).toBe('doc');
    req.flush({ items: [RULE], nextCursor: null, limit: 25, total: 1 });
    harness.detectChanges();
    expect(text()).toContain('DQ-IDENT-001');
    expect(text()).toContain('2 abiertas de 5');
    expect(text()).toContain('Completitud');
    expect(el().querySelector('[data-testid="portal-quality-rule-link"]')?.getAttribute('href')).toContain(
      `/data-quality/rules/${RULE.id}`,
    );
  });

  it('sin reglas el vacío explica que el análisis no comprueba nada', async () => {
    await open('/superadmin/portal/data-quality/rules', RulesPage);
    http.expectOne((r) => r.url === BASE).flush({ items: [], nextCursor: null, limit: 25, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('No hay reglas de calidad de datos cargadas');
  });

  const DETAIL = {
    ...RULE,
    ruleExpression: 'identifier.exists()',
    expressionLanguage: 'FHIRPATH',
    remediationGuidance: null,
    issuesByStatus: { OPEN: 2, RESOLVED: 2, DISMISSED: 1, other: 0 },
    recentRuns: [
      {
        id: 'run1',
        startedAt: '2026-10-30T09:00:00.000Z',
        completedAt: null,
        result: { code: 'QUAL_FAIL', display: 'Quality run failed' },
        recordsEvaluated: null,
        issuesDetected: 3,
      },
    ],
  };

  async function openDetail(view: string): Promise<void> {
    await open(`/superadmin/portal/data-quality/rules/${RULE.id}?vista=${view}`, RuleDetailPage);
    http.expectOne((r) => r.url === `${BASE}/${RULE.id}`).flush(DETAIL);
    harness.detectChanges();
  }

  it('las corridas dicen «no informado» cuando la corrida no lo informó: no es cero', async () => {
    await openDetail('corridas');
    const runs = el().querySelector('[data-testid="portal-quality-rule-runs"]')!;
    expect(runs.textContent).toContain('Quality run failed');
    expect(runs.textContent).toContain('No informado');
  });

  it('la expresión se muestra tal como la guarda la API', async () => {
    await openDetail('expresion');
    expect(el().querySelector('[data-testid="portal-quality-rule-expression"]')?.textContent).toContain('identifier.exists()');
  });

  it('las incidencias de la regla se cuentan por estado', async () => {
    await openDetail('incidencias');
    const counts = el().querySelector('[data-testid="portal-quality-rule-counts"]')!;
    expect(counts.textContent).toContain('Descartadas');
    expect(counts.textContent).toContain('Resueltas');
  });

  it('una regla que no existe se dice como tal (S6), no como pantalla vacía', async () => {
    await open('/superadmin/portal/data-quality/rules/00000000-0000-4000-8000-00000000dead', RuleDetailPage);
    http.expectOne((r) => r.url.endsWith('/rules/00000000-0000-4000-8000-00000000dead')).flush(
      { statusCode: 404, code: 'NOT_FOUND', message: 'Regla no encontrada', error: 'Not Found' },
      { status: 404, statusText: 'Not Found' },
    );
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-quality-rule-detail"]')).toBeNull();
  });
});
