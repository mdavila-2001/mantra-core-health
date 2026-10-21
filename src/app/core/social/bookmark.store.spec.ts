import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { BookmarkStore } from './bookmark.store';
import { OwnProfileStore } from './own-profile.store';

describe('BookmarkStore', () => {
  let id: ReturnType<typeof signal<string | null>>;
  let cliente: {
    listBookmarks: ReturnType<typeof vi.fn>;
    bookmark: ReturnType<typeof vi.fn>;
    unbookmark: ReturnType<typeof vi.fn>;
  };

  function armar(lectura = () => of({ items: [{ id: 'm1', bookmarkableRefId: 'p1' }], count: 1, limit: 100, nextCursor: null })) {
    id = signal<string | null>('yo');
    cliente = {
      listBookmarks: vi.fn(lectura),
      bookmark: vi.fn(() => of({ id: 'nuevo' })),
      unbookmark: vi.fn(() => of({ removed: true })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: cliente },
        { provide: OwnProfileStore, useValue: { id } },
      ],
    });
    const store = TestBed.inject(BookmarkStore);
    TestBed.tick();
    return store;
  }

  it('lee los marcadores del perfil propio', () => {
    const store = armar();

    expect(cliente.listBookmarks).toHaveBeenCalledWith({ profileId: 'yo', limit: 100 });
    expect(store.estaGuardada('p1')).toBe(true);
    expect(store.estaGuardada('otro')).toBe(false);
  });

  it('mientras no se leyó, «no se sabe» no se confunde con «no está guardada»', () => {
    id = signal<string | null>(null);
    cliente = { listBookmarks: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: cliente },
        { provide: OwnProfileStore, useValue: { id } },
      ],
    });
    const store = TestBed.inject(BookmarkStore);
    TestBed.tick();

    expect(store.estaGuardada('p1')).toBeNull();
  });

  it('si la lectura falla tampoco afirma nada', () => {
    const store = armar(() => throwError(() => new Error('500')));

    expect(store.fallo()).toBe(true);
    expect(store.estaGuardada('p1')).toBeNull();
  });

  it('guardar manda el marcador de tipo POST y lo deja guardado', () => {
    const store = armar();

    store.guardar('p2').subscribe();

    expect(cliente.bookmark).toHaveBeenCalledWith({
      profileId: 'yo',
      bookmarkableType: 'POST',
      bookmarkableRefId: 'p2',
    });
    expect(store.estaGuardada('p2')).toBe(true);
  });

  it('un 409 (ya estaba guardada) es éxito', () => {
    const store = armar();
    cliente.bookmark.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    let fallo = false;

    store.guardar('p2').subscribe({ error: () => (fallo = true) });

    expect(fallo).toBe(false);
    expect(store.estaGuardada('p2')).toBe(true);
  });

  it('si guardar falla vuelve atrás', () => {
    const store = armar();
    cliente.bookmark.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    store.guardar('p2').subscribe({ error: () => undefined });

    expect(store.estaGuardada('p2')).toBe(false);
  });

  it('quitar manda la baja y la saca; si falla la vuelve a poner', () => {
    const store = armar();

    store.quitar('p1').subscribe();
    expect(cliente.unbookmark).toHaveBeenCalledWith({
      profileId: 'yo',
      bookmarkableType: 'POST',
      bookmarkableRefId: 'p1',
    });
    expect(store.estaGuardada('p1')).toBe(false);

    cliente.unbookmark.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.guardar('p3').subscribe();
    store.quitar('p3').subscribe({ error: () => undefined });
    expect(store.estaGuardada('p3')).toBe(true);
  });

  it('recargar vuelve a leer', () => {
    const store = armar();

    store.recargar();

    expect(cliente.listBookmarks).toHaveBeenCalledTimes(2);
  });
});
