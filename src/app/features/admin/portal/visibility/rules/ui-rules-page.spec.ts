import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { UiElement, UiVisibilityRule } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { RuleEditDialog } from './rule-edit-dialog';
import { RuleFormPanel } from './rule-form-panel';
import { UiRulesPage } from './ui-rules-page';

const SCREEN = '/superadmin/portal/governance/ui-rules';
const ELEMENTS = '/admin/ui-visibility/elements';
const RULES = '/admin/ui-visibility/rules';
const USER_ID = '00000000-0000-4000-8000-00000000c002';

interface Sig {
  (): unknown;
  set(v: string): void;
}

const element = (key: string, label: string, extra: Partial<UiElement> = {}): UiElement => ({
  id: `id-${key}`,
  key,
  kind: key.includes('.') ? 'ACTION' : 'MODULE',
  moduleCode: key.split('.')[0]!,
  parentKey: key.includes('.') ? key.split('.').slice(0, -1).join('.') : null,
  label,
  description: null,
  defaultVisible: true,
  source: 'CODE',
  status: 'ACTIVE',
  activeRuleCount: 0,
  ...extra,
});
const ELEMENT_LIST = [
  element('pharmacy', 'Farmacia (SIMULADO)'),
  element('pharmacy.orders', 'Pedidos (SIMULADO)'),
  element('pharmacy.orders.export', 'Exportar (SIMULADO)'),
];

const rule = (id: string, extra: Partial<UiVisibilityRule> = {}): UiVisibilityRule => ({
  id,
  elementKey: 'pharmacy.orders.export',
  effect: 'HIDE',
  subjectType: 'ROLE',
  subjectId: 'PHARMACY_STAFF',
  subjectLabel: 'PHARMACY_STAFF',
  validFrom: null,
  validTo: null,
  reason: 'El personal de mostrador no exporta pedidos.',
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  createdByLabel: 'Soporte AloVida (SIMULADO)',
  ...extra,
});
const ACTIVE = rule('r1');
const ENDED = rule('r2', {
  effect: 'SHOW',
  subjectType: 'ALL',
  subjectId: null,
  subjectLabel: 'Todos',
  validTo: '2026-10-02T10:00:00.000Z',
  reason: 'Ya terminó la migración.',
});

describe('UiRulesPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;

  async function open(url = SCREEN): Promise<void> {
    confirmed = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/ui-rules', component: UiRulesPage }]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmed) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, UiRulesPage);
    harness.detectChanges();
  }

  /** El índice del catálogo, la lista de roles de los selectores y la tabla de reglas. */
  function flush(rules: readonly UiVisibilityRule[] = [ACTIVE, ENDED]): TestRequest | undefined {
    http.match((r) => r.url === ELEMENTS).forEach((r) => r.flush({ items: ELEMENT_LIST, nextCursor: null, total: 3 }));
    http.match('/authz/roles').forEach((r) =>
      r.flush([{ id: 'r-ph', code: 'PHARMACY_STAFF', name: 'Personal de farmacia', isSystem: true, tenantId: null }]),
    );
    const table = http.match((r) => r.url === RULES && r.method === 'GET')[0];
    table?.flush({ items: rules, nextCursor: null, total: rules.length });
    harness.detectChanges();
    return table;
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const byTestId = (id: string) => root().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const all = (id: string) => Array.from(root().querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const dialog = () =>
    harness.routeDebugElement!.query(By.directive(RuleEditDialog)).componentInstance as unknown as {
      effect: Sig;
      reason: Sig;
      validTo: Sig;
      save(): void;
      saving(): boolean;
      problem(field: string): string;
    };
  const form = () =>
    harness.routeDebugElement!.query(By.directive(RuleFormPanel)).componentInstance as unknown as {
      elementKey: Sig;
      effect: Sig;
      subjectType: Sig;
      subjectId: Sig;
      validFrom: Sig;
      validTo: Sig;
      reason: Sig;
      save(): void;
      problem(field: string): string;
      saving(): boolean;
    };

  afterEach(() => http.verify());

  describe('lista', () => {
    it('muestra cada regla con su efecto, la ruta del elemento, el sujeto, la vigencia y el motivo', async () => {
      await open();
      flush();
      const table = byTestId('ui-rules-table')!.textContent!;
      expect(table).toContain('Oculta');
      expect(table).toContain('Farmacia (SIMULADO) › Pedidos (SIMULADO) › Exportar (SIMULADO)');
      expect(table).toContain('pharmacy.orders.export');
      expect(table).toContain('PHARMACY_STAFF');
      expect(table).toContain('Rol');
      expect(table).toContain('Vigente');
      expect(table).toContain('Terminada');
      expect(table).toContain('El personal de mostrador no exporta pedidos.');
      expect(table).toContain('Versión 1');
      expect(byTestId('visibility-notice')!.textContent).toContain('Ocultar no es proteger');
    });

    it('sólo las que siguen rigiendo se pueden editar o terminar: una terminada no tiene acciones', async () => {
      await open();
      flush();
      expect(all('ui-rule-edit')).toHaveLength(1);
      expect(all('ui-rule-end')).toHaveLength(1);
      expect(text()).toContain('Sin acciones');
    });

    it('por omisión pide las vigentes (active=true)', async () => {
      await open();
      expect(flush()!.request.params.get('active')).toBe('true');
    });

    it('los filtros de la URL viajan a la API', async () => {
      await open(`${SCREEN}?element=pharmacy.orders&subjectType=ROLE&state=ended`);
      const req = flush([ENDED])!;
      expect(req.request.params.get('elementKey')).toBe('pharmacy.orders');
      expect(req.request.params.get('subjectType')).toBe('ROLE');
      expect(req.request.params.get('active')).toBe('false');
    });

    it('«Todas» no manda active', async () => {
      await open(`${SCREEN}?state=all`);
      expect(flush()!.request.params.has('active')).toBe(false);
    });

    it('sin reglas, orienta: toda la interfaz se muestra según el valor por omisión', async () => {
      await open();
      flush([]);
      expect(text()).toContain('Todavía no hay reglas vigentes');
      expect(text()).toContain('Crear la primera regla');
    });
  });

  describe('terminar', () => {
    it('confirma, hace POST …/end (no DELETE), avisa y recarga', async () => {
      await open();
      flush();
      all('ui-rule-end')[0]!.click();
      await harness.fixture.whenStable();
      const req = http.expectOne(`${RULES}/r1/end`);
      expect(req.request.method).toBe('POST');
      req.flush(rule('r1', { validTo: '2026-10-31T12:00:00.000Z', version: 2 }));
      harness.detectChanges();
      expect(byTestId('ui-rules-done')!.textContent).toContain('Quedó en el historial');
      flush([ENDED]);
    });

    it('al terminarla, la interfaz de quien la terminó se pone al día (refresh del motor de visibilidad)', async () => {
      await open();
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      flush();
      all('ui-rule-end')[0]!.click();
      await harness.fixture.whenStable();
      expect(refresh).not.toHaveBeenCalled();
      http.expectOne(`${RULES}/r1/end`).flush(rule('r1', { validTo: '2026-10-31T12:00:00.000Z', version: 2 }));
      harness.detectChanges();
      expect(refresh).toHaveBeenCalledTimes(1);
      flush([ENDED]);
    });

    it('si ya estaba terminada (UI_RULE_ENDED) lo dice en palabras, recarga la lista y no refresca la visibilidad', async () => {
      await open();
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      flush();
      all('ui-rule-end')[0]!.click();
      await harness.fixture.whenStable();
      http
        .expectOne(`${RULES}/r1/end`)
        .flush({ code: 'CONFLICT', message: 'crudo', details: { reason: 'UI_RULE_ENDED' } }, { status: 409, statusText: 'Conflict' });
      harness.detectChanges();
      expect(byTestId('ui-rules-failure')!.textContent).toContain('Esa regla ya terminó');
      expect(byTestId('ui-rules-failure')!.textContent).not.toContain('crudo');
      expect(refresh).not.toHaveBeenCalled();
      flush([ENDED]); // la recarga de la tabla
    });

    it('si se arrepiente no sale ninguna petición', async () => {
      await open();
      flush();
      confirmed = false;
      all('ui-rule-end')[0]!.click();
      await harness.fixture.whenStable();
      http.expectNone((r) => r.url.endsWith('/end'));
    });

    it('si la API lo rechaza lo dice y la regla sigue en la lista', async () => {
      await open();
      flush();
      all('ui-rule-end')[0]!.click();
      await harness.fixture.whenStable();
      http.expectOne(`${RULES}/r1/end`).flush({ code: 'FORBIDDEN', message: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
      harness.detectChanges();
      expect(byTestId('ui-rules-failure')!.textContent).toContain('Sin permiso');
      expect(all('ui-rule-end')).toHaveLength(1);
    });
  });

  describe('editar', () => {
    async function openDialog() {
      await open();
      flush();
      all('ui-rule-edit')[0]!.click();
      harness.detectChanges();
      return dialog();
    }

    it('manda sólo lo que cambió, con la versión vista en If-Match', async () => {
      const d = await openDialog();
      d.effect.set('SHOW');
      d.reason.set('Se vuelve a mostrar el botón de exportar.');
      d.save();
      const req = http.expectOne(`${RULES}/r1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.headers.get('If-Match')).toBe('1');
      expect(req.request.body).toEqual({ effect: 'SHOW', reason: 'Se vuelve a mostrar el botón de exportar.' });
      req.flush(rule('r1', { effect: 'SHOW', version: 2 }));
      harness.detectChanges();
      expect(byTestId('ui-rules-done')!.textContent).toContain('versión 2');
      flush();
    });

    it('al guardar, refresca la visibilidad de esta sesión; si falla, no', async () => {
      const d = await openDialog();
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      d.reason.set('Se ajusta el motivo de la regla de exportar.');
      d.save();
      http
        .expectOne(`${RULES}/r1`)
        .flush({ code: 'X', message: 'x', details: { reason: 'UI_RULE_PROTECTED_ELEMENT' } }, { status: 422, statusText: 'Unprocessable' });
      harness.detectChanges();
      expect(refresh).not.toHaveBeenCalled();
      expect(dialog().problem('subjectId')).toContain('no se puede ocultar a quienes la administran');
      d.save();
      http.expectOne(`${RULES}/r1`).flush(rule('r1', { reason: 'Se ajusta el motivo de la regla de exportar.', version: 2 }));
      harness.detectChanges();
      expect(refresh).toHaveBeenCalledTimes(1);
      flush();
    });

    it('sin cambios no envía; con un motivo corto lo marca en el campo', async () => {
      const d = await openDialog();
      d.save();
      http.expectNone((r) => r.method === 'PATCH');
      d.reason.set('corto');
      d.save();
      expect(d.problem('reason')).toContain('al menos 10');
      http.expectNone((r) => r.method === 'PATCH');
    });

    it('conflicto 409: no pierde lo escrito, muestra la versión vigente y reenvía sobre ella', async () => {
      const d = await openDialog();
      d.reason.set('Mi motivo nuevo, escrito antes del conflicto.');
      d.save();
      http.expectOne(`${RULES}/r1`).flush(
        { code: 'CONFLICT', reason: 'UI_RULE_VERSION_MISMATCH', message: 'cambió' },
        { status: 409, statusText: 'Conflict' },
      );
      // Trae la versión vigente para mostrarla.
      const current = http.expectOne((r) => r.url === RULES && r.params.get('elementKey') === 'pharmacy.orders.export');
      expect(current.request.params.get('subjectType')).toBe('ROLE');
      current.flush({
        items: [rule('r1', { version: 2, effect: 'SHOW', reason: 'Otra persona lo mostró.' })],
        nextCursor: null,
        total: 1,
      });
      harness.detectChanges();
      const conflict = byTestId('rule-conflict')!;
      expect(conflict.textContent).toContain('La regla cambió mientras la editaba');
      expect(conflict.textContent).toContain('versión 2');
      expect(conflict.textContent).toContain('Muestra');
      expect(conflict.textContent).toContain('Otra persona lo mostró.');
      expect(byTestId('rule-edit-error')).toBeNull(); // el aviso de conflicto reemplaza al error genérico
      // Lo escrito sigue ahí.
      expect(root().querySelector('textarea')!.value).toBe('Mi motivo nuevo, escrito antes del conflicto.');
      // Adoptar la versión vigente y guardar de nuevo manda If-Match: 2 con lo escrito.
      byTestId('rule-conflict-adopt')!.click();
      harness.detectChanges();
      expect(byTestId('rule-conflict')).toBeNull();
      d.save();
      const retry = http.expectOne(`${RULES}/r1`);
      expect(retry.request.headers.get('If-Match')).toBe('2');
      expect(retry.request.body).toEqual({ reason: 'Mi motivo nuevo, escrito antes del conflicto.' });
      retry.flush(rule('r1', { version: 3 }));
      harness.detectChanges();
      expect(byTestId('ui-rules-done')).not.toBeNull();
      flush();
    });

    it('un error de campo del servidor vuelve al campo y el diálogo sigue abierto con lo escrito', async () => {
      const d = await openDialog();
      d.reason.set('Un motivo suficientemente largo.');
      d.save();
      http.expectOne(`${RULES}/r1`).flush(
        { code: 'VALIDATION_FAILED', message: 'x', details: { fields: [{ field: 'reason', messages: ['El motivo contiene texto no permitido.'] }] } },
        { status: 400, statusText: 'Bad Request' },
      );
      harness.detectChanges();
      expect(d.problem('reason')).toBe('El motivo contiene texto no permitido.');
      expect(d.saving()).toBe(false);
      expect(root().querySelector('textarea')!.value).toBe('Un motivo suficientemente largo.');
    });
  });

  describe('nueva regla', () => {
    async function openForm(url = `${SCREEN}?view=new`) {
      await open(url);
      flush();
      return form();
    }

    it('con el elemento de la URL ya elegido, y sin enviar nada si falta lo obligatorio', async () => {
      const f = await openForm(`${SCREEN}?view=new&element=pharmacy.orders.export`);
      expect(f.elementKey()).toBe('pharmacy.orders.export');
      f.save();
      http.expectNone((r) => r.method === 'POST');
      expect(f.problem('reason')).toContain('al menos 10');
      expect(f.problem('subjectId')).toBe(''); // «Todos» no pide a quién
    });

    it('según el tipo de sujeto pide un id válido, y cambiar el tipo limpia el anterior', async () => {
      const f = await openForm();
      f.elementKey.set('pharmacy.orders');
      f.reason.set('Motivo de prueba suficiente.');
      f.subjectType.set('USER');
      f.subjectId.set('no-es-uuid');
      f.save();
      expect(f.problem('subjectId')).toContain('uuid');
      f.subjectType.set('ROLE');
      f.subjectId.set('minusculas');
      f.save();
      expect(f.problem('subjectId')).toContain('en mayúsculas');
      f.subjectId.set('');
      f.save();
      expect(f.problem('subjectId')).toContain('Indique a quién');
      http.expectNone((r) => r.method === 'POST');
    });

    it('la vigencia: el fin no puede ser anterior al inicio', async () => {
      const f = await openForm();
      f.elementKey.set('pharmacy.orders');
      f.reason.set('Motivo de prueba suficiente.');
      f.validFrom.set('2026-12-10');
      f.validTo.set('2026-12-01');
      f.save();
      expect(f.problem('validTo')).toContain('posterior');
      http.expectNone((r) => r.method === 'POST');
    });

    it('crea la regla con sus fechas como instantes, avisa y vuelve a la lista filtrada por el elemento', async () => {
      const f = await openForm();
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      f.elementKey.set('pharmacy.orders.export');
      f.effect.set('HIDE');
      f.subjectType.set('USER');
      f.subjectId.set(USER_ID);
      f.validFrom.set('2026-12-01');
      f.reason.set('  Se oculta a esta persona mientras dura la auditoría.  ');
      f.save();
      f.save(); // doble envío
      const req = http.expectOne((r) => r.method === 'POST' && r.url === RULES);
      expect(f.saving()).toBe(true);
      expect(req.request.body).toMatchObject({
        elementKey: 'pharmacy.orders.export',
        effect: 'HIDE',
        subjectType: 'USER',
        subjectId: USER_ID,
        validTo: null,
        reason: 'Se oculta a esta persona mientras dura la auditoría.',
      });
      expect(new Date(req.request.body.validFrom).getFullYear()).toBe(2026);
      req.flush(rule('r9', { subjectType: 'USER', subjectId: USER_ID, subjectLabel: 'Soporte' }), { status: 201, statusText: 'Created' });
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(byTestId('ui-rules-notice')!.textContent).toContain('Se creó la regla: oculta');
      expect(refresh).toHaveBeenCalledTimes(1);
      const list = http.match((r) => r.url === RULES && r.method === 'GET');
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((r) => r.request.params.get('elementKey') === 'pharmacy.orders.export')).toBe(true);
      list.forEach((r) => r.flush({ items: [], nextCursor: null, total: 0 }));
    });

    it('una regla repetida vuelve al campo «a quién», con la regla vigente nombrada, y se conserva lo escrito', async () => {
      const f = await openForm();
      f.elementKey.set('pharmacy.orders.export');
      f.subjectType.set('ROLE');
      f.subjectId.set('PHARMACY_STAFF');
      f.reason.set('Motivo de prueba suficiente.');
      f.save();
      http.expectOne((r) => r.method === 'POST').flush(
        { code: 'CONFLICT', reason: 'UI_RULE_DUPLICATE', message: 'dup' },
        { status: 409, statusText: 'Conflict' },
      );
      harness.detectChanges();
      expect(f.problem('subjectId')).toContain('Ya hay una regla vigente');
      expect(byTestId('rule-form-error')!.textContent).toContain('Ya hay una regla vigente');
      expect(f.saving()).toBe(false);
      expect(f.reason()).toBe('Motivo de prueba suficiente.');
      expect(f.subjectId()).toBe('PHARMACY_STAFF');
    });

    it('un elemento retirado se marca en el campo elemento', async () => {
      const f = await openForm();
      f.elementKey.set('pharmacy.orders.export');
      f.reason.set('Motivo de prueba suficiente.');
      f.save();
      http.expectOne((r) => r.method === 'POST').flush(
        { code: 'CONFLICT', reason: 'UI_ELEMENT_RETIRED', message: 'retirado' },
        { status: 409, statusText: 'Conflict' },
      );
      harness.detectChanges();
      expect(f.problem('elementKey')).toContain('retirado');
    });

    it('si el catálogo no se pudo leer lo dice y deja reintentar', async () => {
      await open(`${SCREEN}?view=new`);
      http.match((r) => r.url === ELEMENTS).forEach((r) => r.flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' }));
      http.match('/authz/roles').forEach((r) => r.flush([]));
      http.match((r) => r.url === RULES).forEach((r) => r.flush({ items: [], nextCursor: null, total: 0 }));
      harness.detectChanges();
      expect(byTestId('rule-form-index-error')!.textContent).toContain('No se pudo leer el catálogo');
    });
  });
});
