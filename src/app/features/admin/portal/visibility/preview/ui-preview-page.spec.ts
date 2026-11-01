import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { UiElement, UiPreview, UiVisibilityRule } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { PreviewPanel } from './preview-panel';
import { UiPreviewPage } from './ui-preview-page';

const SCREEN = '/superadmin/portal/governance/ui-preview';
const ELEMENTS = '/admin/ui-visibility/elements';
const RULES = '/admin/ui-visibility/rules';
const PREVIEW = '/admin/ui-visibility/preview';
const USER_ID = '00000000-0000-4000-8000-00000000c002';

const element = (key: string, label: string): UiElement => ({
  id: `id-${key}`,
  key,
  kind: key.includes('.') ? 'SCREEN' : 'MODULE',
  moduleCode: key.split('.')[0]!,
  parentKey: key.includes('.') ? key.split('.').slice(0, -1).join('.') : null,
  label,
  description: null,
  defaultVisible: true,
  source: 'CODE',
  status: 'ACTIVE',
  activeRuleCount: 0,
});
const ELEMENT_LIST = [
  element('lab', 'Laboratorio (SIMULADO)'),
  element('lab.results', 'Resultados (SIMULADO)'),
  element('lab.results.print', 'Imprimir (SIMULADO)'),
  element('lab.results.chart', 'Gráfico (SIMULADO)'),
];

const WINNER: UiVisibilityRule = {
  id: 'rule-1',
  elementKey: 'lab.results',
  effect: 'HIDE',
  subjectType: 'ORG_TYPE',
  subjectId: 'PAYER',
  subjectLabel: 'PAYER',
  validFrom: null,
  validTo: null,
  reason: 'Las aseguradoras no presentan resultados.',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdByLabel: 'Soporte (SIMULADO)',
};

const PREVIEW_BODY: UiPreview = {
  subject: { type: 'USER', id: USER_ID, label: 'Persona sintética (SIMULADO)' },
  entries: [
    { elementKey: 'lab.results', hidden: true, winningRuleId: 'rule-1', reason: 'RULE', ancestorKey: null },
    { elementKey: 'lab.results.print', hidden: true, winningRuleId: null, reason: 'ANCESTOR_HIDDEN', ancestorKey: 'lab.results' },
    { elementKey: 'lab.results.chart', hidden: false, winningRuleId: 'rule-2', reason: 'RULE', ancestorKey: null },
  ],
};

describe('UiPreviewPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  /** Por omisión el listado de personas llega vacío: el campo pide el identificador a mano. */
  async function open(url = SCREEN, people: readonly { id: string; displayName: string }[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/ui-preview', component: UiPreviewPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, UiPreviewPage);
    harness.detectChanges();
    http.match((r) => r.url === ELEMENTS).forEach((r) => r.flush({ items: ELEMENT_LIST, nextCursor: null, total: 4 }));
    http.match((r) => r.url === '/authz/internal-users').forEach((r) =>
      r.flush({
        items: people.map((p) => ({ ...p, statusConceptId: 'active', globalRoles: [], assignments: [] })),
        nextCursor: null,
        total: people.length,
      }),
    );
    http.match('/authz/roles').forEach((r) =>
      r.flush([{ id: 'r-ph', code: 'PHARMACY_STAFF', name: 'Personal de farmacia', isSystem: true, tenantId: null }]),
    );
    harness.detectChanges();
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const byTestId = (id: string) => root().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const panel = () =>
    harness.routeDebugElement!.query(By.directive(PreviewPanel)).componentInstance as unknown as {
      target: { (): string; set(v: string): void };
      state: () => { status: string } | null;
      includeVisible: { set(v: boolean): void };
      run(): void;
      problem(): string;
    };

  /** Responde lo que el servidor contestaría a un «ver como» con una regla ganadora legible. */
  function answerPreview(body: UiPreview = PREVIEW_BODY, rules: readonly UiVisibilityRule[] = [WINNER]): void {
    http.expectOne((r) => r.url === PREVIEW).flush(body);
    const lookup = http.match((r) => r.url === RULES);
    for (const r of lookup) {
      expect(r.request.params.get('active')).toBe('true');
      r.flush({ items: rules, nextCursor: null, total: rules.length });
    }
    harness.detectChanges();
  }

  afterEach(() => http.verify());

  it('trae el aviso de que ocultar no es seguridad y no consulta nada hasta que se pide', async () => {
    await open();
    http.expectNone((r) => r.url === PREVIEW);
    expect(byTestId('visibility-notice')!.textContent).toContain('Ocultar no es proteger');
    expect(text()).toContain('Ver como esta persona');
  });

  it('con el listado de personas, se elige por nombre (no se pide el uuid) y se consulta su userId', async () => {
    await open(SCREEN, [
      { id: USER_ID, displayName: 'Persona sintética (SIMULADO)' },
      { id: '00000000-0000-4000-8000-00000000c003', displayName: 'Otra persona (SIMULADO)' },
    ]);
    expect(text()).toContain('Persona');
    expect(text()).not.toContain('Identificador de la persona');
    expect(root().querySelector('input[data-testid="preview-target-USER"]')).toBeNull();
    panel().target.set(USER_ID);
    panel().run();
    const req = http.expectOne((r) => r.url === PREVIEW);
    expect(req.request.params.get('userId')).toBe(USER_ID);
    req.flush(PREVIEW_BODY);
    http.match((x) => x.url === RULES).forEach((r) => r.flush({ items: [WINNER], nextCursor: null, total: 1 }));
    harness.detectChanges();
    expect(byTestId('preview-summary')!.textContent).toContain('Persona sintética (SIMULADO)');
  });

  it('por persona: manda userId, y para cada oculto muestra la regla ganadora y la cascada con su ancestro', async () => {
    await open(`${SCREEN}?user=${USER_ID}`);
    const req = http.expectOne((r) => r.url === PREVIEW);
    expect(req.request.params.get('userId')).toBe(USER_ID);
    expect(req.request.params.has('roleCode')).toBe(false);
    req.flush(PREVIEW_BODY);
    for (const r of http.match((x) => x.url === RULES)) {
      expect(r.request.params.get('active')).toBe('true');
      r.flush({ items: [WINNER], nextCursor: null, total: 1 });
    }
    harness.detectChanges();

    const summary = byTestId('preview-summary')!.textContent!;
    expect(summary).toContain('Persona sintética (SIMULADO)');
    const table = byTestId('preview-table-USER')!.textContent!;
    // Regla ganadora, con su sujeto, su motivo y su efecto.
    expect(table).toContain('Laboratorio (SIMULADO) › Resultados (SIMULADO)');
    expect(table).toContain('Lo oculta una regla');
    expect(table).toContain('Oculta');
    expect(table).toContain('Tipo de organización: PAYER');
    expect(table).toContain('Las aseguradoras no presentan resultados.');
    // La cascada dice cuál elemento superior arrastra.
    expect(table).toContain('Cascada');
    expect(table).toContain('Oculto por cascada: «Laboratorio (SIMULADO) › Resultados (SIMULADO)» está oculto');
    expect(table).toContain('Ninguna: lo decide el elemento superior');
    // Lo que una regla deja visible no se mezcla con los ocultos hasta que se pide.
    expect(table).not.toContain('Gráfico');
  });

  it('el interruptor suma los elementos que una regla deja visibles', async () => {
    await open(`${SCREEN}?user=${USER_ID}`);
    answerPreview();
    expect(byTestId('preview-table-USER')!.textContent).not.toContain('Gráfico');
    panel().includeVisible.set(true);
    harness.detectChanges();
    expect(byTestId('preview-table-USER')!.textContent).toContain('Gráfico (SIMULADO)');
    expect(byTestId('preview-table-USER')!.textContent).toContain('Visible');
  });

  it('si no se pudo leer la regla ganadora, igual muestra al oculto con el id de la regla', async () => {
    await open(`${SCREEN}?user=${USER_ID}`);
    http.expectOne((r) => r.url === PREVIEW).flush(PREVIEW_BODY);
    http.match((r) => r.url === RULES).forEach((r) => r.flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' }));
    harness.detectChanges();
    const table = byTestId('preview-table-USER')!.textContent!;
    expect(table).toContain('Regla rule-1');
    expect(table).toContain('Resultados (SIMULADO)');
  });

  it('nada oculto no queda mudo: orienta hacia las reglas', async () => {
    await open(`${SCREEN}?user=${USER_ID}`);
    answerPreview({ ...PREVIEW_BODY, entries: [] });
    expect(text()).toContain('No queda nada oculto');
    expect(text()).toContain('Ver las reglas');
  });

  it('un identificador mal escrito se marca en el campo y no consulta', async () => {
    await open();
    const p = panel();
    p.target.set('no-es-uuid');
    p.run();
    harness.detectChanges();
    http.expectNone((r) => r.url === PREVIEW);
    expect(p.problem()).toContain('uuid');
  });

  it('una persona que no existe (404) se explica en el campo, sin mostrar un error crudo', async () => {
    await open();
    const p = panel();
    p.target.set(USER_ID);
    p.run();
    http.expectOne((r) => r.url === PREVIEW).flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(p.problem()).toBe('No se encontró a esa persona.');
    expect(p.state()).toBeNull();
  });

  it('sin permiso (403) se cuenta como sin permiso', async () => {
    await open();
    const p = panel();
    p.target.set(USER_ID);
    p.run();
    http.expectOne((r) => r.url === PREVIEW).flush({ code: 'FORBIDDEN', message: 'No' }, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(p.state()!.status).toBe('forbidden');
  });

  it('por rol: pide roleCode, con el rol elegido de la lista', async () => {
    await open(`${SCREEN}?view=role&role=PHARMACY_STAFF`);
    const req = http.expectOne((r) => r.url === PREVIEW);
    expect(req.request.params.get('roleCode')).toBe('PHARMACY_STAFF');
    expect(req.request.params.has('userId')).toBe(false);
    req.flush({ subject: { type: 'ROLE', id: 'PHARMACY_STAFF', label: 'PHARMACY_STAFF' }, entries: [] });
    harness.detectChanges();
    expect(byTestId('preview-summary')!.textContent).toContain('PHARMACY_STAFF');
  });
});
