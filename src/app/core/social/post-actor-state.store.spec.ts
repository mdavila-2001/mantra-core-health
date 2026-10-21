import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { OwnProfileStore } from './own-profile.store';
import { PostActorStateStore } from './post-actor-state.store';

describe('PostActorStateStore', () => {
  let community: { readPost: ReturnType<typeof vi.fn> };
  /** El perfil propio; `null` mientras se lee o sin sesión. */
  const perfilPropio = signal<string | null>(null);

  function armar(): PostActorStateStore {
    perfilPropio.set(null);
    community = {
      readPost: vi.fn((postId: string) =>
        of({ id: postId, reactions: { actorReactionType: postId === 'p1' ? 'LOVE' : undefined } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: community },
        { provide: OwnProfileStore, useValue: { id: perfilPropio } },
      ],
    });
    return TestBed.inject(PostActorStateStore);
  }

  it('lee la reacción propia de cada publicación con el perfil como actor', () => {
    const store = armar();

    store.cargar(['p1', 'p2'], 'yo');

    expect(community.readPost).toHaveBeenCalledWith('p1', { actorProfileId: 'yo' });
    expect(store.reaccionDe('p1')).toBe('LOVE');
    // Se leyó y no reaccionó: null, no undefined.
    expect(store.reaccionDe('p2')).toBeNull();
  });

  it('antes de leer es «no se sabe» (undefined), distinto de «no reaccionó» (null)', () => {
    const store = armar();

    expect(store.reaccionDe('p1')).toBeUndefined();
  });

  it('no vuelve a pedir lo ya pedido', () => {
    const store = armar();

    store.cargar(['p1'], 'yo');
    store.cargar(['p1', 'p2'], 'yo');

    expect(community.readPost).toHaveBeenCalledTimes(2);
  });

  it('usa el actor que le pasan aunque el perfil propio todavía se esté leyendo', () => {
    // Era el defecto: el store consultaba otro store que seguía en `null`, descartaba
    // el pedido sin marcarlo y nadie volvía a pedir.
    const store = armar();

    store.cargar(['p1'], 'actor-que-llega-por-input');

    expect(community.readPost).toHaveBeenCalledWith('p1', { actorProfileId: 'actor-que-llega-por-input' });
    expect(store.reaccionDe('p1')).toBe('LOVE');
  });

  it('lo que el usuario fijó mientras llegaba la lectura manda sobre la lectura', () => {
    const store = armar();
    const lectura = new Subject<unknown>();
    community.readPost.mockReturnValue(lectura);

    store.cargar(['p1'], 'yo');
    store.fijar('p1', 'CELEBRATE');
    lectura.next({ reactions: { actorReactionType: 'LOVE' } });
    lectura.complete();

    expect(store.reaccionDe('p1')).toBe('CELEBRATE');
  });

  it('no pide más de tres lecturas a la vez', () => {
    const store = armar();
    community.readPost.mockReturnValue(new Subject());

    store.cargar(['a', 'b', 'c', 'd', 'e'], 'yo');

    expect(community.readPost).toHaveBeenCalledTimes(3);
  });

  it('si la lectura falla no afirma nada y permite reintentar', () => {
    const store = armar();
    community.readPost.mockReturnValue(throwError(() => new Error('500')));
    store.cargar(['p1'], 'yo');
    expect(store.reaccionDe('p1')).toBeUndefined();

    community.readPost.mockReturnValue(of({ reactions: { actorReactionType: 'LIKE' } }));
    store.cargar(['p1'], 'yo');

    expect(store.reaccionDe('p1')).toBe('LIKE');
  });

  it('fijar(null) recuerda que la quitó', () => {
    const store = armar();

    store.fijar('p1', null);

    expect(store.reaccionDe('p1')).toBeNull();
  });

  it('restaurar vuelve a lo anterior; si era «no se sabe», lo olvida en vez de afirmar null', () => {
    const store = armar();
    store.fijar('p1', 'LOVE');

    store.restaurar('p1', 'LIKE');
    expect(store.reaccionDe('p1')).toBe('LIKE');

    store.restaurar('p1', null);
    expect(store.reaccionDe('p1')).toBeNull();

    store.restaurar('p1', undefined);
    expect(store.reaccionDe('p1')).toBeUndefined();

    // Y como se olvidó, puede volver a pedirse.
    store.cargar(['p1'], 'yo');
    expect(community.readPost).toHaveBeenCalledWith('p1', { actorProfileId: 'yo' });
  });

  describe('cada dato es de un actor', () => {
    it('al cerrar sesión se olvida todo, aunque ninguna pantalla lo pida', () => {
      const store = armar();
      perfilPropio.set('A');
      TestBed.tick();
      store.cargar(['p1'], 'A');
      expect(store.reaccionDe('p1')).toBe('LOVE');

      perfilPropio.set(null);
      TestBed.tick();

      expect(store.reaccionDe('p1')).toBeUndefined();
      expect(store.imagenesDe('p1')).toBeUndefined();
    });

    it('la reacción de A no aparece para B, y para B se vuelve a leer con su actor', () => {
      const store = armar();
      store.cargar(['p1'], 'A');
      expect(store.reaccionDe('p1')).toBe('LOVE');

      community.readPost.mockReturnValue(of({ id: 'p1', reactions: {} }));
      store.cargar(['p1'], 'B');

      expect(community.readPost).toHaveBeenLastCalledWith('p1', { actorProfileId: 'B' });
      expect(store.reaccionDe('p1')).toBeNull();
    });

    it('una lectura en vuelo del actor anterior no escribe al llegar', () => {
      const store = armar();
      const enVuelo = new Subject<unknown>();
      community.readPost.mockReturnValueOnce(enVuelo);
      store.cargar(['p1'], 'A');

      community.readPost.mockReturnValue(new Subject());
      store.cargar(['p2'], 'B');
      enVuelo.next({ id: 'p1', reactions: { actorReactionType: 'LOVE' } });
      enVuelo.complete();

      expect(store.reaccionDe('p1')).toBeUndefined();
    });

    it('mientras el perfil propio se lee (null) no vacía lo pedido con el actor del input', () => {
      const store = armar();
      TestBed.tick();
      store.cargar(['p1'], 'yo');

      perfilPropio.set('yo');
      TestBed.tick();

      expect(store.reaccionDe('p1')).toBe('LOVE');
    });

    it('entrar con otra cuenta sin pasar por null también vacía', () => {
      const store = armar();
      perfilPropio.set('A');
      TestBed.tick();
      store.cargar(['p1'], 'A');

      perfilPropio.set('B');
      TestBed.tick();

      expect(store.reaccionDe('p1')).toBeUndefined();
    });
  });
});
