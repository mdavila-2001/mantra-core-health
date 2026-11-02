import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { UiElement, UiElementDraft } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { UI_ELEMENT_DRAFTS } from '../ui-element-drafts.token';
import { ElementFormPanel } from './element-form-panel';
import { UiCatalogPage } from './ui-catalog-page';

const SCREEN = '/superadmin/portal/governance/ui-catalog';
const URL = '/admin/ui-visibility/elements';

const element = (key: string, extra: Partial<UiElement> = {}): UiElement => ({
  id: `id-${key}`,
  key,
  kind: 'SCREEN',
  moduleCode: key.split('.')[0]!,
  parentKey: key.includes('.') ? key.split('.').slice(0, -1).join('.') : null,
  label: key,
  description: null,
  defaultVisible: true,
  source: 'CODE',
  status: 'ACTIVE',
  activeRuleCount: 0,
  ...extra,
});

const MODULE = element('pharmacy', { kind: 'MODULE', label: 'Farmacia (SIMULADO)' });
const ORDERS = element('pharmacy.orders', { label: 'Pedidos (SIMULADO)', activeRuleCount: 2 });
const EXPORT = element('pharmacy.orders.export-button', {
  kind: 'ACTION',
  label: 'Botón exportar (SIMULADO)',
  defaultVisible: false,
  source: 'ADMIN',
  activeRuleCount: 1,
});
const ALL = [MODULE, ORDERS, EXPORT];

const DRAFT: UiElementDraft = {
  key: 'pharmacy.orders',
  kind: 'SCREEN',
  moduleCode: 'pharmacy',
  parentKey: 'pharmacy',
  label: 'Pedidos',
  description: null,
  defaultVisible: true,
};

/** Una señal del componente, que la prueba lee y escribe sin pasar por el DOM. */
interface Sig {
  (): unknown;
  set(v: string): void;
}

describe('UiCatalogPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;
  let confirmCalls: number;

  async function open(url = SCREEN, drafts: readonly UiElementDraft[] = []): Promise<void> {
    confirmed = true;
    confirmCalls = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/ui-catalog', component: UiCatalogPage }]),
        { provide: UI_ELEMENT_DRAFTS, useValue: drafts },
        {
          provide: DialogService,
          useValue: {
            confirmarCambios: () => {
              confirmCalls += 1;
              return Promise.resolve(confirmed);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, UiCatalogPage);
    harness.detectChanges();
  }

  /** El índice (limit 200) y la tabla (limit 50) piden lo mismo con distinto tamaño de página. */
  function flush(table: readonly UiElement[] = ALL, index: readonly UiElement[] = ALL): TestRequest {
    const requests = http.match((r) => r.url === URL);
    const tableRequest = requests.find((r) => r.request.params.get('limit') === '50')!;
    requests.find((r) => r.request.params.get('limit') === '200')?.flush({ items: index, nextCursor: null, total: index.length });
    tableRequest.flush({ items: table, nextCursor: null, total: table.length });
    harness.detectChanges();
    return tableRequest;
  }

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const byTestId = (id: string) => root().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const form = () =>
    harness.routeDebugElement!.query(By.directive(ElementFormPanel)).componentInstance as unknown as {
      moduleCode: Sig;
      kind: Sig;
      key: Sig;
      label: Sig;
      parentKey: Sig;
      chooseParent(v: string): void;
      save(): void;
      problem(field: string): string;
      saving(): boolean;
    };
  const fill = (f: ReturnType<typeof form>, over: Record<string, string> = {}) => {
    f.moduleCode.set(over['module'] ?? 'pharmacy');
    f.kind.set('FIELD');
    f.key.set(over['key'] ?? 'pharmacy.orders.note');
    f.label.set(over['label'] ?? 'Nota del pedido');
  };

  afterEach(() => http.verify());

  describe('lista', () => {
    it('dibuja cada elemento con su clave, su ruta, su tipo y origen, y lleva a sus reglas', async () => {
      await open();
      flush();
      const table = byTestId('ui-catalog-table')!.textContent!;
      expect(table).toContain('Botón exportar (SIMULADO)');
      expect(table).toContain('pharmacy.orders.export-button');
      expect(table).toContain('Acción');
      expect(table).toContain('Alta manual');
      expect(table).toContain('Oculto por omisión');
      expect(table).toContain('Visible por omisión');
      // La ruta del padre sale del índice: módulo › pantalla.
      expect(table).toContain('Farmacia (SIMULADO) › Pedidos (SIMULADO)');
      expect(table).toContain('Nivel superior del módulo');
      const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('a.catalog__rules'));
      expect(links.map((a) => a.textContent!.trim())).toEqual(['0', '2', '1']);
      expect(links[1]!.getAttribute('href')).toContain('/governance/ui-rules?element=pharmacy.orders');
    });

    it('ofrece los módulos con su conteo y deja aviso fijo de que ocultar no es seguridad', async () => {
      await open();
      flush();
      expect(byTestId('ui-catalog-modules')!.textContent).toContain('Farmacia (SIMULADO) · 3');
      expect(byTestId('visibility-notice')!.textContent).toContain('Ocultar no es proteger');
      expect(byTestId('visibility-notice')!.textContent).toContain('no conceden ni quitan acceso');
    });

    it('los filtros de la URL viajan a la API y los vacíos no', async () => {
      await open(`${SCREEN}?module=pharmacy&kind=ACTION&status=RETIRED`);
      const req = flush([EXPORT]);
      expect(req.request.params.get('module')).toBe('pharmacy');
      expect(req.request.params.get('kind')).toBe('ACTION');
      expect(req.request.params.get('status')).toBe('RETIRED');
      expect(req.request.params.has('q')).toBe(false);
    });

    it('pulsar un módulo lo pone en la URL y vuelve a pedir la primera página', async () => {
      await open();
      flush();
      root().querySelectorAll<HTMLElement>('[data-testid="ui-catalog-modules"] button')[0]!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      const again = http.match((r) => r.url === URL && r.params.get('limit') === '50' && r.params.get('module') === 'pharmacy');
      expect(again).toHaveLength(1);
      again[0]!.flush({ items: [MODULE], nextCursor: null, total: 1 });
    });

    it('sin resultados con filtros, orienta a quitarlos; sin filtros, a sincronizar o agregar', async () => {
      await open(`${SCREEN}?q=zzz`);
      flush([], ALL);
      expect(text()).toContain('Ningún elemento coincide con los filtros elegidos');
      // Vacío filtrado (T9): la salida «Quitar filtros» va dentro de la tabla, no sólo en el formulario.
      expect(byTestId('ui-catalog-table')!.textContent).toContain('Quitar filtros');
    });

    it('un catálogo vacío no queda mudo', async () => {
      await open();
      flush([], []);
      expect(text()).toContain('El catálogo está vacío');
      expect(text()).toContain('Agregar un elemento a mano');
    });

    it('un fallo de la API se cuenta con su estado, no con una tabla vacía', async () => {
      await open();
      const reqs = http.match((r) => r.url === URL);
      reqs.find((r) => r.request.params.get('limit') === '200')!.flush({ items: [], nextCursor: null, total: 0 });
      reqs
        .find((r) => r.request.params.get('limit') === '50')!
        .flush({ code: 'FORBIDDEN', message: 'No' }, { status: 403, statusText: 'Forbidden' });
      harness.detectChanges();
      expect(text()).not.toContain('El catálogo está vacío');
      expect(byTestId('ui-catalog-table')).not.toBeNull();
    });
  });

  describe('sincronizar con el código', () => {
    it('sin elementos declarados no manda nada y lo explica (un envío vacío retiraría todo)', async () => {
      await open();
      flush();
      byTestId('ui-catalog-sync')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      http.expectNone(`${URL}/sync`);
      expect(confirmCalls).toBe(0);
      expect(byTestId('ui-catalog-sync-error')!.textContent).toContain('no declara ningún elemento');
    });

    it('confirma, envía { elements } y muestra lo que pasó; después recarga el catálogo', async () => {
      await open(SCREEN, [DRAFT]);
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      flush();
      byTestId('ui-catalog-sync')!.click();
      await harness.fixture.whenStable();
      const req = http.expectOne(`${URL}/sync`);
      expect(refresh).not.toHaveBeenCalled();
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ elements: [DRAFT] });
      req.flush({ created: 1, updated: 2, retired: 3, unchanged: 4 });
      harness.detectChanges();
      expect(byTestId('ui-catalog-sync-result')!.textContent).toContain('1 nuevos · 2 actualizados · 3 retirados · 4 sin cambios');
      // Un retirado o uno nuevo oculto por omisión cambia lo que ve esta misma sesión.
      expect(refresh).toHaveBeenCalledTimes(1);
      flush(); // recarga del índice y de la tabla
    });

    it('si se arrepiente en la confirmación, no sale nada', async () => {
      await open(SCREEN, [DRAFT]);
      flush();
      confirmed = false;
      byTestId('ui-catalog-sync')!.click();
      await harness.fixture.whenStable();
      expect(confirmCalls).toBe(1);
      http.expectNone(`${URL}/sync`);
    });

    it('si la API lo rechaza, lo dice y se puede reintentar', async () => {
      await open(SCREEN, [DRAFT]);
      flush();
      byTestId('ui-catalog-sync')!.click();
      await harness.fixture.whenStable();
      http.expectOne(`${URL}/sync`).flush({ code: 'FORBIDDEN', message: 'No tiene permiso' }, { status: 403, statusText: 'Forbidden' });
      harness.detectChanges();
      expect(byTestId('ui-catalog-sync-error')!.textContent).toContain('No tiene permiso');
      expect(byTestId('ui-catalog-sync')!.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('alta manual', () => {
    async function openForm(): Promise<ReturnType<typeof form>> {
      await open(`${SCREEN}?view=add`);
      flush();
      return form();
    }

    it('antes de mandar valida lo mismo que la API y no envía nada', async () => {
      const f = await openForm();
      f.moduleCode.set('Farmacia');
      f.key.set('Pedidos Nuevos');
      f.save();
      harness.detectChanges();
      http.expectNone((r) => r.method === 'POST');
      expect(f.problem('moduleCode')).toContain('minúsculas');
      expect(f.problem('key')).toContain('minúsculas y puntos');
      expect(f.problem('label')).toContain('Indique el nombre');
    });

    it('la clave tiene que empezar por el módulo', async () => {
      const f = await openForm();
      fill(f, { key: 'laboratory.results.note' });
      f.save();
      expect(f.problem('key')).toContain('«pharmacy.»');
      http.expectNone((r) => r.method === 'POST');
    });

    it('elegir el superior adelanta el módulo y el comienzo de la clave sin pisar lo escrito', async () => {
      const f = await openForm();
      f.chooseParent('pharmacy.orders');
      expect(f.moduleCode()).toBe('pharmacy');
      expect(f.key()).toBe('pharmacy.orders.');
      f.key.set('pharmacy.orders.mine');
      f.chooseParent('pharmacy');
      expect(f.key()).toBe('pharmacy.orders.mine');
      fill(f, { key: 'pharmacy.orders.mine' });
      f.save();
      const req = http.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(req.request.body).toMatchObject({ key: 'pharmacy.orders.mine', parentKey: 'pharmacy', moduleCode: 'pharmacy' });
      req.flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });
    });

    it('manda el borrador, bloquea el doble envío y, al guardar, avisa y muestra el elemento nuevo', async () => {
      const f = await openForm();
      const refresh = vi.spyOn(TestBed.inject(UiVisibilityService), 'refresh');
      fill(f);
      f.save();
      f.save(); // segundo clic mientras envía
      const req = http.expectOne((r) => r.method === 'POST' && r.url === URL);
      expect(f.saving()).toBe(true);
      expect(req.request.body).toEqual({
        key: 'pharmacy.orders.note',
        kind: 'FIELD',
        moduleCode: 'pharmacy',
        parentKey: null,
        label: 'Nota del pedido',
        description: null,
        defaultVisible: true,
      });
      req.flush(element('pharmacy.orders.note', { label: 'Nota del pedido', source: 'ADMIN' }), { status: 201, statusText: 'Created' });
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(byTestId('ui-catalog-notice')!.textContent).toContain('Se agregó «Nota del pedido»');
      expect(refresh).toHaveBeenCalledTimes(1);
      // La lista vuelve a "Elementos" filtrada por la clave nueva.
      const reload = http.match((r) => r.url === URL && r.params.get('q') === 'pharmacy.orders.note');
      expect(reload.length).toBeGreaterThan(0);
      for (const r of reload) r.flush({ items: [], nextCursor: null, total: 0 });
      http.match((r) => r.url === URL).forEach((r) => r.flush({ items: ALL, nextCursor: null, total: 3 }));
    });

    it('una clave repetida vuelve al campo clave y lo escrito se conserva', async () => {
      const f = await openForm();
      fill(f);
      f.save();
      http.expectOne((r) => r.method === 'POST').flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe',
          details: { fields: [{ field: 'key', messages: ['Ya existe un elemento con esa clave.'] }] },
        },
        { status: 409, statusText: 'Conflict' },
      );
      harness.detectChanges();
      expect(f.problem('key')).toBe('Ya existe un elemento con esa clave.');
      expect(byTestId('element-form-error')).not.toBeNull();
      expect(f.saving()).toBe(false);
      // Lo escrito sigue en el formulario.
      const inputs = Array.from(root().querySelectorAll<HTMLInputElement>('input'));
      expect(inputs.map((i) => i.value)).toEqual(expect.arrayContaining(['pharmacy.orders.note', 'Nota del pedido']));
    });
  });
});
