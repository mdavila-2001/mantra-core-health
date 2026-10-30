import { TestBed } from '@angular/core/testing';
import { DestroyRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { FirstStepsStore } from './first-steps.store';

describe('FirstStepsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  function crear() {
    const eventos = new Subject<unknown>();
    const router = { url: '/dashboard', events: eventos } as unknown as Router;
    const store = TestBed.inject(FirstStepsStore);
    TestBed.flushEffects();
    store.track(router, TestBed.inject(DestroyRef));
    return { store, eventos };
  }

  it('anota las rutas que se abren y las reconoce por prefijo', () => {
    const { store, eventos } = crear();
    eventos.next(new NavigationEnd(1, '/my-account/pharmacy/cart', '/my-account/pharmacy/cart'));

    expect(store.hasVisited('/my-account/pharmacy')).toBe(true);
    expect(store.hasVisited('/my-account/pharmacy-orders')).toBe(false);
    expect(store.hasVisited('/directory')).toBe(false);
  });

  it('ignora la consulta y el ancla de la dirección', () => {
    const { store, eventos } = crear();
    eventos.next(new NavigationEnd(1, '/directory?q=cardio#top', '/directory?q=cardio#top'));

    expect(store.visited()).toContain('/directory');
  });

  it('recuerda lo visitado y el cierre entre sesiones de la misma cuenta', () => {
    const { store, eventos } = crear();
    eventos.next(new NavigationEnd(1, '/directory', '/directory'));
    store.dismiss();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const otra = TestBed.inject(FirstStepsStore);
    TestBed.flushEffects();

    expect(otra.hasVisited('/directory')).toBe(true);
    expect(otra.dismissed()).toBe(true);
  });

  it('un valor corrupto en el almacenamiento no rompe nada', () => {
    localStorage.setItem('alovida.primeros-pasos.anonimo', '{no es json');
    const store = TestBed.inject(FirstStepsStore);
    TestBed.flushEffects();

    expect(store.visited()).toEqual([]);
    expect(store.dismissed()).toBe(false);
  });
});
