import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CommunityClient } from '../data-access/community/community.client';
import { OwnProfileStore } from './own-profile.store';
import { PostActorStateStore } from './post-actor-state.store';

describe('PostActorStateStore', () => {
  let id: ReturnType<typeof signal<string | null>>;
  let community: { readPost: ReturnType<typeof vi.fn> };

  function armar(actor: string | null = 'yo'): PostActorStateStore {
    id = signal(actor);
    community = {
      readPost: vi.fn((postId: string) =>
        of({ id: postId, reactions: { actorReactionType: postId === 'p1' ? 'LOVE' : undefined } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityClient, useValue: community },
        { provide: OwnProfileStore, useValue: { id } },
      ],
    });
    return TestBed.inject(PostActorStateStore);
  }

  it('lee la reacción propia de cada publicación con el perfil como actor', () => {
    const store = armar();

    store.cargar(['p1', 'p2']);

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

    store.cargar(['p1']);
    store.cargar(['p1', 'p2']);

    expect(community.readPost).toHaveBeenCalledTimes(2);
  });

  it('sin perfil propio no pide nada', () => {
    const store = armar(null);

    store.cargar(['p1']);

    expect(community.readPost).not.toHaveBeenCalled();
  });

  it('lo que el usuario fijó mientras llegaba la lectura manda sobre la lectura', () => {
    const store = armar();
    community.readPost.mockReturnValue({
      subscribe: (o: { next: (v: unknown) => void }) => {
        store.fijar('p1', 'CELEBRATE');
        o.next({ reactions: { actorReactionType: 'LOVE' } });
      },
    });

    store.cargar(['p1']);

    expect(store.reaccionDe('p1')).toBe('CELEBRATE');
  });

  it('si la lectura falla no afirma nada y permite reintentar', () => {
    const store = armar();
    community.readPost.mockReturnValue(throwError(() => new Error('500')));
    store.cargar(['p1']);
    expect(store.reaccionDe('p1')).toBeUndefined();

    community.readPost.mockReturnValue(of({ reactions: { actorReactionType: 'LIKE' } }));
    store.cargar(['p1']);

    expect(store.reaccionDe('p1')).toBe('LIKE');
  });

  it('fijar(null) recuerda que la quitó', () => {
    const store = armar();

    store.fijar('p1', null);

    expect(store.reaccionDe('p1')).toBeNull();
  });

  it('olvidar borra todo (cambio de sesión)', () => {
    const store = armar();
    store.cargar(['p1']);

    store.olvidar();

    expect(store.reaccionDe('p1')).toBeUndefined();
  });
});
