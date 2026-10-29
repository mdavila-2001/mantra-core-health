import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { formatBolivianos, ReceivedAmountStore } from './received-amount-store';

describe('ReceivedAmountStore', () => {
  function create(platform = 'browser'): ReceivedAmountStore {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(ReceivedAmountStore);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('guarda por cita, con moneda y fecha, y lo lee de vuelta', () => {
    const store = create();

    expect(store.set('b-1', 150)).toBe(true);

    const saved = store.get('b-1');
    expect(saved?.amount).toBe(150);
    expect(saved?.currency).toBe('BOB');
    expect(Number.isNaN(Date.parse(saved!.savedAt))).toBe(false);
    expect(localStorage.getItem('alovida.receivedAmount.v1.b-1')).not.toBeNull();
    expect(store.get('b-2')).toBeNull();
  });

  it('clear lo borra', () => {
    const store = create();
    store.set('b-1', 10);

    store.clear('b-1');

    expect(store.get('b-1')).toBeNull();
  });

  it('ignora lo guardado con otra forma', () => {
    const store = create();
    localStorage.setItem('alovida.receivedAmount.v1.b-1', '{"amount":"x"}');
    localStorage.setItem('alovida.receivedAmount.v1.b-2', 'no es json');

    expect(store.get('b-1')).toBeNull();
    expect(store.get('b-2')).toBeNull();
  });

  it('si localStorage lanza, no rompe: lee null y set devuelve false', () => {
    const store = create();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('lleno');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(store.get('b-1')).toBeNull();
    expect(store.set('b-1', 5)).toBe(false);
    expect(() => store.clear('b-1')).not.toThrow();
  });

  it('en el servidor no toca localStorage', () => {
    const store = create('server');
    const spy = vi.spyOn(Storage.prototype, 'setItem');

    expect(store.set('b-1', 5)).toBe(false);
    expect(store.get('b-1')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('formatBolivianos usa dos decimales y coma decimal', () => {
    expect(formatBolivianos(150)).toBe('150,00');
  });
});
