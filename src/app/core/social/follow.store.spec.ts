import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { FollowStore } from './follow.store';
import { OwnProfileStore } from './own-profile.store';

const pagina = (refs: string[], nextCursor: string | null = null) => ({
  items: refs.map((ref) => ({ id: `f-${ref}`, followableRefId: ref })),
  count: refs.length,
  limit: 100,
  nextCursor,
});

describe('FollowStore', () => {
  let id: ReturnType<typeof signal<string | null>>;
  let cliente: {
    listFollows: ReturnType<typeof vi.fn>;
    follow: ReturnType<typeof vi.fn>;
    unfollow: ReturnType<typeof vi.fn>;
  };

  function armar(seguidos: ReturnType<typeof pagina>[] = [pagina(['a', 'b'])]): FollowStore {
    id = signal<string | null>('yo');
    let n = 0;
    cliente = {
      listFollows: vi.fn(() => of(seguidos[Math.min(n++, seguidos.length - 1)])),
      follow: vi.fn(() => of({ id: 'nuevo' })),
      unfollow: vi.fn(() => of({ removed: true })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: cliente },
        { provide: OwnProfileStore, useValue: { id } },
      ],
    });
    const store = TestBed.inject(FollowStore);
    TestBed.tick();
    return store;
  }

  it('lee a quién sigue, una vez, con el perfil propio como seguidor', () => {
    const store = armar();

    expect(cliente.listFollows).toHaveBeenCalledTimes(1);
    expect(cliente.listFollows).toHaveBeenCalledWith({ followerProfileId: 'yo', limit: 100 });
    expect(store.cargado()).toBe(true);
    expect(store.sigue('a')).toBe(true);
    expect(store.sigue('zzz')).toBe(false);
    expect(store.total()).toBe(2);
  });

  it('recorre todas las páginas con el cursor', () => {
    const store = armar([pagina(['a'], 'c1'), pagina(['b'], 'c2'), pagina(['c'])]);

    expect(cliente.listFollows).toHaveBeenCalledTimes(3);
    expect(cliente.listFollows).toHaveBeenNthCalledWith(2, { followerProfileId: 'yo', limit: 100, cursor: 'c1' });
    expect(store.seguidos()).toEqual(['a', 'b', 'c']);
  });

  it('si la lectura falla lo dice y no afirma que no sigue a nadie', () => {
    id = signal<string | null>('yo');
    cliente = {
      listFollows: vi.fn(() => throwError(() => new Error('500'))),
      follow: vi.fn(),
      unfollow: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: cliente },
        { provide: OwnProfileStore, useValue: { id } },
      ],
    });
    const store = TestBed.inject(FollowStore);
    TestBed.tick();

    expect(store.fallo()).toBe(true);
    expect(store.cargado()).toBe(true);
  });

  describe('seguir', () => {
    it('manda el seguimiento con los tres campos y deja al perfil como seguido', () => {
      const store = armar();

      store.seguir('c').subscribe();

      expect(cliente.follow).toHaveBeenCalledWith({
        followerProfileId: 'yo',
        followableType: 'PROFILE',
        followableRefId: 'c',
      });
      expect(store.sigue('c')).toBe(true);
    });

    it('es optimista: el estado cambia antes de que el servidor conteste', () => {
      const store = armar();
      const respuesta = new Subject<{ id: string }>();
      cliente.follow.mockReturnValue(respuesta);

      store.seguir('c').subscribe();

      expect(store.sigue('c')).toBe(true);
      expect(store.ocupado('c')).toBe(true);

      respuesta.next({ id: 'x' });
      respuesta.complete();
      expect(store.ocupado('c')).toBe(false);
    });

    it('es perezoso: sin suscribirse no cambia nada ni manda nada', () => {
      const store = armar();

      store.seguir('c');

      expect(store.sigue('c')).toBe(false);
      expect(cliente.follow).not.toHaveBeenCalled();
    });

    it('si el servidor rechaza vuelve atrás y propaga el error', () => {
      const store = armar();
      cliente.follow.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      let recibido: unknown;

      store.seguir('c').subscribe({ error: (e: unknown) => (recibido = e) });

      expect(store.sigue('c')).toBe(false);
      expect(store.ocupado('c')).toBe(false);
      expect(recibido).toBeInstanceOf(HttpErrorResponse);
    });

    it('un 409 (ya lo seguía) es éxito: el estado deseado ya es el real', () => {
      const store = armar();
      cliente.follow.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      let fallo = false;

      store.seguir('c').subscribe({ error: () => (fallo = true) });

      expect(fallo).toBe(false);
      expect(store.sigue('c')).toBe(true);
    });

    it('seguir a quien ya sigue no manda nada', () => {
      const store = armar();

      store.seguir('a').subscribe();

      expect(cliente.follow).not.toHaveBeenCalled();
    });

    it('no hay doble envío: con una escritura en vuelo la segunda se rechaza', () => {
      const store = armar();
      cliente.follow.mockReturnValue(new Subject());
      store.seguir('c').subscribe();
      let rechazada = false;

      store.seguir('c').subscribe({ error: () => (rechazada = true) });

      expect(rechazada).toBe(true);
      expect(cliente.follow).toHaveBeenCalledTimes(1);
    });
  });

  describe('dejar de seguir', () => {
    it('manda la baja con los tres campos y lo quita del conjunto', () => {
      const store = armar();

      store.dejarDeSeguir('a').subscribe();

      expect(cliente.unfollow).toHaveBeenCalledWith({
        followerProfileId: 'yo',
        followableType: 'PROFILE',
        followableRefId: 'a',
      });
      expect(store.sigue('a')).toBe(false);
    });

    it('si el servidor rechaza lo vuelve a poner como seguido', () => {
      const store = armar();
      cliente.unfollow.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      store.dejarDeSeguir('a').subscribe({ error: () => undefined });

      expect(store.sigue('a')).toBe(true);
    });
  });

  it('al cerrar la sesión olvida todo: nada del usuario anterior queda', () => {
    const store = armar();

    id.set(null);
    TestBed.tick();

    expect(store.sigue('a')).toBe(false);
    expect(store.cargado()).toBe(false);
    expect(store.total()).toBe(0);
  });

  it('sin perfil propio no se puede seguir', () => {
    const store = armar();
    id.set(null);
    TestBed.tick();
    let fallo = false;

    store.seguir('c').subscribe({ error: () => (fallo = true) });

    expect(fallo).toBe(true);
  });
});
