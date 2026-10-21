import type { FeedListItem } from '@core/data-access/community/community.types';
import type { PublicFeedPost } from '@core/data-access/public-directory/public-directory.types';
import type { ResumenDePerfil } from '@core/social/profile-summary.store';

import { deRecientes, deSiguiendo, urlDeImagenDePublicacion } from './feed-publicaciones.vista';

const publico = {
  id: 'p1',
  bodyText: 'Hola',
  publishedAt: new Date('2026-10-01T10:00:00Z'),
  mediaUrls: ['/public/media/a'],
  reactionCount: 4,
  commentCount: 2,
  authorSlug: 'dra-lopez',
  authorDisplayName: 'Dra. López Vaca',
  authorHeadline: 'Cardióloga',
  authorAvatarUrl: 'data:foto',
  authorKind: 'PRACTITIONER',
} as PublicFeedPost;

const entrada = (extra: Record<string, unknown> = {}): FeedListItem =>
  ({
    id: 'e1',
    createdAt: new Date('2026-10-02T09:00:00Z'),
    post: {
      id: 'p2',
      authorPublicProfileId: 'perfil-9',
      bodyText: 'Del feed',
      publishedAt: new Date('2026-10-03T08:00:00Z'),
      commentCount: 3,
      reactions: {
        total: 9,
        tallies: [
          { reactionType: 'LIKE', count: 6 },
          { reactionType: 'LOVE', count: 3 },
        ],
      },
      ...extra,
    },
  }) as unknown as FeedListItem;

const autor: ResumenDePerfil = {
  id: 'perfil-9',
  slug: 'dr-peña',
  kind: 'PRACTITIONER',
  displayName: 'Dr. Peña Rojas',
  headline: 'Pediatra',
  avatarUrl: 'data:otra',
  enlace: ['/p', 'dr-peña'],
};

describe('deRecientes — el feed público', () => {
  it('conserva el autor y las imágenes tal como vienen', () => {
    const v = deRecientes(publico);

    expect(v.slug).toBe('dra-lopez');
    expect(v.nombre).toBe('Dra. López Vaca');
    expect(v.iniciales).toBe('LV');
    expect(v.avatar).toBe('data:foto');
    expect(v.post.mediaUrls).toEqual(['/public/media/a']);
  });

  it('no conoce el id del autor ni el desglose: no los inventa', () => {
    const v = deRecientes(publico);

    expect(v.perfilId).toBeNull();
    expect(v.reaccionesPorTipo).toBeNull();
  });

  it('el feed público sólo sirve publicaciones públicas', () => {
    expect(deRecientes(publico).visibilidad).toBe('PUBLIC');
  });
});

describe('deSiguiendo — el feed personal', () => {
  it('arma la tarjeta con el autor resuelto', () => {
    const v = deSiguiendo(entrada(), autor, ['f-1', 'f-2'])!;

    expect(v.nombre).toBe('Dr. Peña Rojas');
    expect(v.slug).toBe('dr-peña');
    expect(v.headline).toBe('Pediatra');
    expect(v.avatar).toBe('data:otra');
    expect(v.perfilId).toBe('perfil-9');
    expect(v.post.reactionCount).toBe(9);
    expect(v.post.commentCount).toBe(3);
  });

  it('las imágenes salen del detalle y se arman como URL pública', () => {
    const v = deSiguiendo(entrada(), autor, ['f-1', 'f-2'])!;

    expect(v.post.mediaUrls).toEqual(['/public/media/f-1', '/public/media/f-2']);
    expect(urlDeImagenDePublicacion('x')).toBe('/public/media/x');
  });

  it('sin detalle leído todavía, sin imágenes (no se inventan)', () => {
    expect(deSiguiendo(entrada(), autor, undefined)!.post.mediaUrls).toEqual([]);
  });

  it('el desglose por tipo llega a la tarjeta', () => {
    expect(deSiguiendo(entrada(), autor, [])!.reaccionesPorTipo).toEqual({ LIKE: 6, LOVE: 3 });
  });

  it('sin desglose utilizable queda en null', () => {
    const v = deSiguiendo(entrada({ reactions: { total: 0, tallies: [] } }), autor, [])!;

    expect(v.reaccionesPorTipo).toBeNull();
  });

  it('un tipo sin código (concepto no resuelto) no entra al desglose', () => {
    const v = deSiguiendo(
      entrada({ reactions: { total: 2, tallies: [{ count: 2 }] } }),
      autor,
      [],
    )!;

    expect(v.reaccionesPorTipo).toBeNull();
  });

  it('mientras el autor no se resolvió se dibuja con un nombre provisional, sin romper', () => {
    const v = deSiguiendo(entrada(), undefined, [])!;

    expect(v.nombre).toBe('…');
    expect(v.slug).toBe('');
    expect(v.iniciales).toBe('');
    expect(v.perfilId).toBe('perfil-9');
  });

  it('si el autor no se pudo leer (null) tampoco rompe', () => {
    expect(deSiguiendo(entrada(), null, [])!.nombre).toBe('…');
  });

  it('la visibilidad es desconocida: no se dibuja 🌐 para algo que puede ser sólo de seguidores', () => {
    expect(deSiguiendo(entrada(), autor, [])!.visibilidad).toBeNull();
  });

  it('sin fecha de publicación usa la del reparto al feed', () => {
    const v = deSiguiendo(entrada({ publishedAt: undefined }), autor, [])!;

    expect(v.post.publishedAt).toEqual(new Date('2026-10-02T09:00:00Z'));
  });

  it('una entrada sin publicación resuelta se omite: una tarjeta vacía es peor', () => {
    const sinPost = { id: 'e2', createdAt: new Date() } as unknown as FeedListItem;

    expect(deSiguiendo(sinPost, autor, [])).toBeNull();
  });
});
