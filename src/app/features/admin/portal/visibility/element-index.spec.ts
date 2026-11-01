import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { UiElement } from '../../../../core/data-access/ui-visibility/ui-visibility.types';
import { UiElementIndex } from './element-index';

const URL = '/admin/ui-visibility/elements';
const el = (key: string, parentKey: string | null, extra: Partial<UiElement> = {}): UiElement => ({
  id: key,
  key,
  kind: key.includes('.') ? 'SCREEN' : 'MODULE',
  moduleCode: key.split('.')[0]!,
  parentKey,
  label: key === 'pharmacy' ? 'Farmacia' : key,
  description: null,
  defaultVisible: true,
  source: 'CODE',
  status: 'ACTIVE',
  activeRuleCount: 0,
  ...extra,
});

describe('UiElementIndex', () => {
  let http: HttpTestingController;
  let index: UiElementIndex;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    index = TestBed.inject(UiElementIndex);
  });
  afterEach(() => http.verify());

  it('sigue el cursor hasta el final y arma módulos, rutas y opciones sólo con los activos', () => {
    index.load();
    expect(index.state().status).toBe('loading');
    const first = http.expectOne((r) => r.url === URL);
    expect(first.request.params.get('limit')).toBe('200');
    first.flush({ items: [el('pharmacy', null), el('pharmacy.orders', 'pharmacy')], nextCursor: 'c2', total: 4 });
    const second = http.expectOne((r) => r.url === URL && r.params.get('cursor') === 'c2');
    second.flush({
      items: [el('pharmacy.old', 'pharmacy', { status: 'RETIRED' }), el('lab.results', null)],
      nextCursor: null,
      total: 4,
    });
    expect(index.state().status).toBe('ready');
    expect(index.elements()).toHaveLength(4);
    expect(index.modules()).toEqual([
      { code: 'lab', total: 1, label: 'lab' },
      { code: 'pharmacy', total: 3, label: 'Farmacia' },
    ]);
    expect(index.path('pharmacy.orders')).toBe('Farmacia › pharmacy.orders');
    const options = index.options();
    expect(options.map((o) => o.value)).not.toContain('pharmacy.old');
    expect(options.find((o) => o.value === 'pharmacy.orders')).toMatchObject({ label: 'Farmacia › pharmacy.orders', description: 'pharmacy.orders' });
  });

  it('un fallo queda en el estado (no se pierde) y recargar vuelve a pedir desde cero', () => {
    index.load();
    http.expectOne((r) => r.url === URL).flush({ code: 'FORBIDDEN', message: 'no' }, { status: 403, statusText: 'Forbidden' });
    expect(index.state().status).toBe('forbidden');
    expect(index.elements()).toEqual([]);
    index.load();
    http.expectOne((r) => r.url === URL && !r.params.has('cursor')).flush({ items: [], nextCursor: null, total: 0 });
    expect(index.state().status).toBe('ready');
  });

  it('una carga nueva cancela la anterior: la respuesta vieja no pisa a la nueva', () => {
    index.load();
    const viejo = http.expectOne((r) => r.url === URL);
    index.load();
    expect(viejo.cancelled).toBe(true);
    http.expectOne((r) => r.url === URL).flush({ items: [el('a', null)], nextCursor: null, total: 1 });
    expect(index.elements().map((e) => e.key)).toEqual(['a']);
  });
});
