import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { SessionStore } from '../auth/session.store';
import { CommunityClient } from '../data-access/community/community.client';
import { OwnProfileStore } from './own-profile.store';

describe('OwnProfileStore', () => {
  let autenticado: ReturnType<typeof signal<boolean>>;
  let community: { getOwnProfile: ReturnType<typeof vi.fn> };

  function armar(respuesta: () => unknown = () => of({ id: 'pp-1', slug: 'yo' })): OwnProfileStore {
    autenticado = signal(true);
    community = { getOwnProfile: vi.fn(respuesta) };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: community },
        { provide: SessionStore, useValue: { isAuthenticated: autenticado } },
      ],
    });
    const store = TestBed.inject(OwnProfileStore);
    TestBed.tick();
    return store;
  }

  it('con sesión lee el perfil propio una vez', () => {
    const store = armar();

    expect(community.getOwnProfile).toHaveBeenCalledTimes(1);
    expect(store.id()).toBe('pp-1');
    expect(store.resuelto()).toBe(true);
  });

  it('sin perfil público queda resuelto y sin id: no es lo mismo que «no se sabe»', () => {
    const store = armar(() => of(null));

    expect(store.id()).toBeNull();
    expect(store.resuelto()).toBe(true);
    expect(store.fallo()).toBe(false);
  });

  it('un fallo de red se distingue de «no tiene perfil»', () => {
    const store = armar(() => throwError(() => new Error('500')));

    expect(store.fallo()).toBe(true);
    expect(store.resuelto()).toBe(true);
  });

  it('al cerrar la sesión olvida el perfil', () => {
    const store = armar();

    autenticado.set(false);
    TestBed.tick();

    expect(store.id()).toBeNull();
    expect(store.resuelto()).toBe(false);
  });

  it('la respuesta que llega tarde de una sesión que ya no es la vigente se descarta', () => {
    const tarde = new Subject<unknown>();
    const store = armar(() => tarde);

    autenticado.set(false);
    TestBed.tick();
    tarde.next({ id: 'del-usuario-anterior' });

    expect(store.id()).toBeNull();
  });

  it('actualizar reemplaza el perfil tras guardar la vitrina', () => {
    const store = armar(() => of(null));

    store.actualizar({ id: 'pp-9', slug: 'nueva' } as never);

    expect(store.id()).toBe('pp-9');
  });
});
