import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UiVisibilityAdminClient } from './ui-visibility-admin.client';
import type { UiElementDraft } from './ui-visibility.types';

const DRAFT: UiElementDraft = {
  key: 'pharmacy.orders.export-button',
  kind: 'ACTION',
  moduleCode: 'pharmacy',
  parentKey: 'pharmacy.orders',
  label: 'Exportar pedidos',
  description: null,
  defaultVisible: true,
};

describe('UiVisibilityAdminClient', () => {
  let http: HttpTestingController;
  let client: UiVisibilityAdminClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(UiVisibilityAdminClient);
  });

  afterEach(() => http.verify());

  it('lista elementos mandando sólo los filtros con valor (la API valida con forbidNonWhitelisted)', () => {
    client.listElements({ module: 'pharmacy', kind: 'ACTION', q: '', status: 'ACTIVE', limit: 50 }).subscribe();
    const req = http.expectOne((r) => r.url === '/admin/ui-visibility/elements');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('module')).toBe('pharmacy');
    expect(req.request.params.get('kind')).toBe('ACTION');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], nextCursor: null, total: 0 });
  });

  it('alta manual: POST del borrador tal cual, sin campos que el contrato no declara', () => {
    client.createElement(DRAFT).subscribe();
    const req = http.expectOne('/admin/ui-visibility/elements');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(DRAFT);
    req.flush({});
  });

  it('sincroniza envolviendo los borradores en { elements } (idempotente por key)', () => {
    let result: unknown;
    client.syncElements([DRAFT]).subscribe((r) => (result = r));
    const req = http.expectOne('/admin/ui-visibility/elements/sync');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ elements: [DRAFT] });
    req.flush({ created: 1, updated: 0, retired: 0, unchanged: 0 });
    expect(result).toEqual({ created: 1, updated: 0, retired: 0, unchanged: 0 });
  });

  it('lista reglas: active=false viaja (un false no es "sin filtro") y lo vacío no', () => {
    client.listRules({ elementKey: 'a.b', active: false, subjectId: '' }).subscribe();
    const req = http.expectOne((r) => r.url === '/admin/ui-visibility/rules');
    expect(req.request.params.get('elementKey')).toBe('a.b');
    expect(req.request.params.get('active')).toBe('false');
    expect(req.request.params.has('subjectId')).toBe(false);
    req.flush({ items: [], nextCursor: null, total: 0 });
  });

  it('crea una regla con POST', () => {
    const body = {
      elementKey: 'a.b',
      effect: 'HIDE',
      subjectType: 'ALL',
      subjectId: null,
      reason: 'Se retira el botón mientras dura la migración.',
    } as const;
    client.createRule(body).subscribe();
    const req = http.expectOne('/admin/ui-visibility/rules');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('edita con PATCH y la versión vista en If-Match', () => {
    client.updateRule('rule/1', { effect: 'SHOW', reason: 'Se vuelve a mostrar el botón.' }, 3).subscribe();
    const req = http.expectOne('/admin/ui-visibility/rules/rule%2F1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('3');
    expect(req.request.body).toEqual({ effect: 'SHOW', reason: 'Se vuelve a mostrar el botón.' });
    req.flush({});
  });

  it('termina una regla con POST …/end y sin DELETE: las reglas no se borran', () => {
    client.endRule('r1').subscribe();
    const req = http.expectOne('/admin/ui-visibility/rules/r1/end');
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('la vista previa pide por userId o por roleCode, nunca por los dos', () => {
    client.previewForUser('u-1').subscribe();
    const a = http.expectOne((r) => r.url === '/admin/ui-visibility/preview');
    expect(a.request.params.get('userId')).toBe('u-1');
    expect(a.request.params.has('roleCode')).toBe(false);
    a.flush({});

    client.previewForRole('DPO').subscribe();
    const b = http.expectOne((r) => r.url === '/admin/ui-visibility/preview');
    expect(b.request.params.get('roleCode')).toBe('DPO');
    expect(b.request.params.has('userId')).toBe(false);
    b.flush({});
  });

  it('un 409 de versión llega al suscriptor como error con el cuerpo intacto', () => {
    let status = 0;
    let code = '';
    client.updateRule('r1', { reason: 'Motivo suficiente para el cambio.' }, 1).subscribe({
      error: (e: { status: number; error: { reason: string } }) => {
        status = e.status;
        code = e.error.reason;
      },
    });
    http
      .expectOne('/admin/ui-visibility/rules/r1')
      .flush({ code: 'CONFLICT', reason: 'UI_RULE_VERSION_MISMATCH' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
    expect(code).toBe('UI_RULE_VERSION_MISMATCH');
  });
});
