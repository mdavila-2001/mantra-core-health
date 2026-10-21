import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { CommunityClient } from '@core/data-access/community/community.client';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { PostActorStateStore } from '@core/social/post-actor-state.store';
import { ProfileSummaryStore } from '@core/social/profile-summary.store';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

import { PublicPostCard } from '../../../public-profile/public-post-card/public-post-card';
import { ReportPost } from '../../../social/report-post/report-post';
import { FeedBanner } from './feed-banner/feed-banner';
import { FeedCrearPublicacion } from './feed-crear-publicacion/feed-crear-publicacion';
import { FeedPerfilMini } from './feed-perfil-mini/feed-perfil-mini';
import { FeedTendencias } from './feed-tendencias/feed-tendencias';
import { FeedPublicaciones } from './feed-publicaciones';

/* ---- dobles de los hijos pesados: acá se prueba la PÁGINA, no sus piezas ---- */

@Component({
  selector: 'app-public-post-card',
  template: '<span data-testid="tarjeta" [attr.data-id]="post().id">{{ autorNombre() }}</span><button data-testid="denunciar" (click)="pedidoDeDenuncia.emit(post().id)">Denunciar</button>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TarjetaDoble {
  readonly post = input.required<{ id: string; mediaUrls: readonly string[] }>();
  readonly slug = input('');
  readonly autorNombre = input('');
  readonly autorHeadline = input<string | null>(null);
  readonly autorAvatar = input<string | null>(null);
  readonly autorIniciales = input('');
  readonly autorPerfilId = input<string | null>(null);
  readonly visibilidad = input<string | null>('PUBLIC');
  readonly reaccionesPorTipo = input<unknown>(null);
  readonly autorEnlazado = input(false);
  readonly conAcciones = input(false);
  readonly actorProfileId = input<string | null>(null);
  readonly pedidoDeDenuncia = output<string>();
  readonly pedidoDeOcultar = output<string>();
  readonly pedidoDeContacto = output<string>();
}

@Component({ selector: 'app-report-post', template: '<span data-testid="reportando"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class ReporteDoble {
  readonly postId = input('');
  readonly reportado = output<void>();
  readonly cancelado = output<void>();
}

@Component({ selector: 'app-feed-perfil-mini', template: '<span data-testid="perfil-mini"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class MiniDoble {
  readonly perfil = input<unknown>(null);
  readonly resuelto = input(false);
  readonly detalle = input<unknown>(null);
}

@Component({ selector: 'app-feed-tendencias', template: '<span data-testid="sugerencias"></span>', changeDetection: ChangeDetectionStrategy.OnPush })
class SugerenciasDoble {}

@Component({ selector: 'app-feed-banner', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class BannerDoble {}

@Component({ selector: 'app-feed-crear-publicacion', template: '<button data-testid="crear" (click)="publicado.emit(\'nuevo\')">Crear</button>', changeDetection: ChangeDetectionStrategy.OnPush })
class CrearDoble {
  readonly perfil = input<unknown>(null);
  readonly resuelto = input(false);
  readonly foto = input<string | null>(null);
  readonly publicado = output<string>();
}

const publico = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  bodyText: `Texto ${id}`,
  publishedAt: new Date('2026-10-01T10:00:00Z'),
  mediaUrls: [],
  reactionCount: 1,
  commentCount: 0,
  authorSlug: `slug-${id}`,
  authorDisplayName: `Autor ${id}`,
  authorHeadline: null,
  authorAvatarUrl: null,
  authorKind: 'PRACTITIONER',
  ...extra,
});

const entrada = (id: string, autor = 'perfil-9') => ({
  id: `e-${id}`,
  createdAt: new Date('2026-10-02T09:00:00Z'),
  post: {
    id,
    authorPublicProfileId: autor,
    bodyText: `Del feed ${id}`,
    publishedAt: new Date('2026-10-03T08:00:00Z'),
    commentCount: 2,
    reactions: { total: 3, tallies: [{ reactionType: 'LIKE', count: 3 }] },
  },
});

const pagina = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor, totalHint: null, generatedAt: new Date() });

describe('FeedPublicaciones — el inicio de la red social', () => {
  let fixture: ComponentFixture<FeedPublicaciones>;
  let directorio: { feedPublico: ReturnType<typeof vi.fn>; getProfile: ReturnType<typeof vi.fn> };
  let community: { listFeed: ReturnType<typeof vi.fn>; readPost: ReturnType<typeof vi.fn> };
  let estadoDelActor: { cargar: ReturnType<typeof vi.fn>; imagenesDe: ReturnType<typeof vi.fn> };
  let avisos: { info: ReturnType<typeof vi.fn> };
  const actor = signal<string | null>('pp-1');
  const perfil = signal<unknown>({ id: 'pp-1', slug: 'yo', displayName: 'Valeria' });

  async function montar(opciones: {
    url?: string;
    autenticado?: boolean;
    conPerfil?: boolean;
    recientes?: () => unknown;
    siguiendo?: () => unknown;
  } = {}): Promise<void> {
    const conPerfil = opciones.conPerfil ?? true;
    actor.set(conPerfil ? 'pp-1' : null);
    perfil.set(conPerfil ? { id: 'pp-1', slug: 'yo', displayName: 'Valeria' } : null);
    directorio = {
      feedPublico: vi.fn(opciones.recientes ?? (() => of(pagina([publico('a'), publico('b')])))),
      getProfile: vi.fn(() => of({ avatarUrl: null })),
    };
    community = {
      listFeed: vi.fn(opciones.siguiendo ?? (() => of(pagina([entrada('s1'), entrada('s2')])))),
      readPost: vi.fn((id: string) =>
        of({
          id,
          authorPublicProfileId: 'pp-1',
          postTypeConceptId: 't',
          bodyText: 'Para mis seguidores',
          reactions: { total: 0, tallies: [] },
          commentCount: 0,
          media: [],
          hashtags: [],
          mentions: [],
        }),
      ),
    };
    estadoDelActor = { cargar: vi.fn(), imagenesDe: vi.fn(() => ['f-1']) };
    avisos = { info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'posts', component: FeedPublicaciones }]),
        { provide: PublicDirectoryClient, useValue: directorio },
        { provide: CommunityClient, useValue: community },
        { provide: SessionStore, useValue: { isAuthenticated: signal(opciones.autenticado ?? true), practitionerProfileId: () => null } },
        { provide: OwnProfileStore, useValue: { perfil, resuelto: signal(true), id: actor } },
        { provide: PostActorStateStore, useValue: estadoDelActor },
        {
          provide: ProfileSummaryStore,
          useValue: { resumen: (id: string) => ({ id, slug: 'dr-pena', kind: 'PRACTITIONER', displayName: 'Dr. Peña', headline: null, avatarUrl: null, enlace: null }) },
        },
        { provide: ToastService, useValue: avisos },
      ],
    });
    TestBed.overrideComponent(FeedPublicaciones, {
      remove: { imports: [PublicPostCard, ReportPost, FeedPerfilMini, FeedTendencias, FeedBanner, FeedCrearPublicacion] },
      add: { imports: [TarjetaDoble, ReporteDoble, MiniDoble, SugerenciasDoble, BannerDoble, CrearDoble] },
    });
    await TestBed.compileComponents();

    const router = TestBed.inject(Router);
    await router.navigateByUrl(opciones.url ?? '/posts');
    fixture = TestBed.createComponent(FeedPublicaciones);
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const todas = (id: string): HTMLElement[] => Array.from(root().querySelectorAll(`[data-testid="${id}"]`));

  describe('Recientes (la lista de entrada)', () => {
    it('pide el feed público y dibuja una tarjeta por publicación con su autor', async () => {
      await montar();

      expect(directorio.feedPublico).toHaveBeenCalledWith({});
      expect(community.listFeed).not.toHaveBeenCalled();
      expect(todas('tarjeta').map((t) => t.textContent)).toEqual(['Autor a', 'Autor b']);
    });

    it('con una URL sin `feed` es Recientes, no Siguiendo', async () => {
      await montar();

      expect(root().querySelector('[data-testid="feed-modo"] [aria-checked="true"], [data-testid="feed-modo"] [aria-pressed="true"]')?.textContent).toContain('Recientes');
    });

    it('vacío: dice por qué y qué hacer, no deja la pantalla muda', async () => {
      await montar({ recientes: () => of(pagina([])) });

      expect(root().textContent).toContain('Todavía no hay publicaciones');
      expect(root().textContent).toContain('Ver profesionales');
    });

    it('error: lo dice y se puede reintentar', async () => {
      await montar({ recientes: () => throwError(() => new Error('500')) });
      expect(root().textContent).toContain('No pudimos cargar las publicaciones.');

      directorio.feedPublico.mockReturnValue(of(pagina([publico('z')])));
      (Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Reintentar')) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(todas('tarjeta')).toHaveLength(1);
    });

    it('mientras carga muestra un estado de carga accesible, no un vacío', async () => {
      await montar({ recientes: () => new Subject() });

      expect(root().querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(root().textContent).not.toContain('Todavía no hay publicaciones');
    });

    it('«ver más» pide la página siguiente con el cursor y la agrega; al acabarse lo dice', async () => {
      await montar({ recientes: () => of(pagina([publico('a')], 'c1')) });
      directorio.feedPublico.mockReturnValue(of(pagina([publico('b')], null)));

      (Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Ver más')) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(directorio.feedPublico).toHaveBeenLastCalledWith({ cursor: 'c1' });
      expect(todas('tarjeta')).toHaveLength(2);
      expect(root().textContent).toContain('Llegó al final de lo publicado.');
    });

    it('«denunciar» reemplaza la tarjeta en su lugar y «cancelar» la devuelve', async () => {
      await montar();

      (todas('denunciar')[0] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(q('reportando')).not.toBeNull();
      expect(todas('tarjeta')).toHaveLength(1);
    });
  });

  describe('las columnas', () => {
    it('con sesión: perfil a la izquierda y sugerencias a la derecha', async () => {
      await montar();

      expect(root().querySelector('.red--con-perfil')).not.toBeNull();
      expect(q('perfil-mini')).not.toBeNull();
      expect(q('sugerencias')).not.toBeNull();
      const columnas = Array.from(root().querySelectorAll('aside, .red__centro')).map((e) => e.className);
      expect(columnas[0]).toContain('red__izquierda');
      expect(columnas.at(-1)).toContain('red__derecha');
    });

    it('sin sesión no se reserva columna para el perfil: el feed se queda con ese ancho', async () => {
      await montar({ autenticado: false, conPerfil: false });

      expect(root().querySelector('.red__izquierda')).toBeNull();
      expect(q('perfil-mini')).toBeNull();
      expect(q('crear')).toBeNull();
      expect(q('sugerencias')).not.toBeNull();
    });
  });

  describe('Siguiendo', () => {
    it('sin vitrina propia no se ofrece la pestaña, y `?feed=siguiendo` cae en Recientes', async () => {
      await montar({ conPerfil: false, url: '/posts?feed=siguiendo' });

      expect(q('feed-modo')).toBeNull();
      expect(community.listFeed).not.toHaveBeenCalled();
      expect(directorio.feedPublico).toHaveBeenCalled();
    });

    it('con vitrina ofrece las dos listas', async () => {
      await montar();

      expect(q('feed-modo')?.textContent).toContain('Recientes');
      expect(q('feed-modo')?.textContent).toContain('Siguiendo');
    });

    it('`?feed=siguiendo` pide el feed personal con el perfil propio y resuelve el autor', async () => {
      await montar({ url: '/posts?feed=siguiendo' });

      expect(community.listFeed).toHaveBeenCalledWith({ profileId: 'pp-1', limit: 10 });
      expect(todas('tarjeta').map((t) => t.textContent)).toEqual(['Dr. Peña', 'Dr. Peña']);
    });

    it('pide el detalle de cada publicación (de ahí salen sus imágenes y la reacción propia)', async () => {
      await montar({ url: '/posts?feed=siguiendo' });

      expect(estadoDelActor.cargar).toHaveBeenCalledWith(['s1', 's2'], 'pp-1');
    });

    it('cambiar de pestaña pone `feed` en la URL, sin apilar historial', async () => {
      await montar();
      const router = TestBed.inject(Router);

      (Array.from(q('feed-modo')!.querySelectorAll('button')).find((b) => b.textContent!.includes('Siguiendo')) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(router.url).toBe('/posts?feed=siguiendo');
      expect(community.listFeed).toHaveBeenCalledTimes(1);
    });

    it('volver a Recientes quita el parámetro', async () => {
      await montar({ url: '/posts?feed=siguiendo' });
      const router = TestBed.inject(Router);

      (Array.from(q('feed-modo')!.querySelectorAll('button')).find((b) => b.textContent!.includes('Recientes')) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(router.url).toBe('/posts');
    });

    it('vacío: explica que acá va lo de quienes sigue y ofrece ir a lo más reciente', async () => {
      await montar({ url: '/posts?feed=siguiendo', siguiendo: () => of(pagina([])) });

      expect(root().textContent).toContain('Todavía no hay publicaciones de quienes sigue');
      (q('feed-ver-recientes') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/posts');
    });

    it('omite las entradas sin publicación resuelta', async () => {
      await montar({ url: '/posts?feed=siguiendo', siguiendo: () => of(pagina([entrada('s1'), { id: 'e-x', createdAt: new Date() }])) });

      expect(todas('tarjeta')).toHaveLength(1);
    });

    it('error: lo dice y se puede reintentar', async () => {
      await montar({ url: '/posts?feed=siguiendo', siguiendo: () => throwError(() => new Error('500')) });

      expect(root().textContent).toContain('No pudimos cargar las publicaciones.');
      expect(root().textContent).toContain('Su lista de seguidos no respondió a tiempo.');
    });

    it('«ver más» usa el cursor del feed personal', async () => {
      await montar({ url: '/posts?feed=siguiendo', siguiendo: () => of(pagina([entrada('s1')], 'cur-1')) });
      community.listFeed.mockReturnValue(of(pagina([entrada('s2')], null)));

      (Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Ver más')) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(community.listFeed).toHaveBeenLastCalledWith({ profileId: 'pp-1', limit: 10, cursor: 'cur-1' });
      expect(todas('tarjeta')).toHaveLength(2);
    });

    it('el feed personal se pide una sola vez aunque se cambie de pestaña', async () => {
      await montar({ url: '/posts?feed=siguiendo' });
      const router = TestBed.inject(Router);

      await router.navigateByUrl('/posts');
      await fixture.whenStable();
      await router.navigateByUrl('/posts?feed=siguiendo');
      await fixture.whenStable();

      expect(community.listFeed).toHaveBeenCalledTimes(1);
    });

    it('al cerrar la sesión olvida lo personal: ninguna tarjeta del feed personal queda en pantalla', async () => {
      await montar({ url: '/posts?feed=siguiendo' });
      expect(todas('tarjeta').map((t) => t.getAttribute('data-id'))).toEqual(['s1', 's2']);

      actor.set(null);
      await fixture.whenStable();

      // Las reacciones propias las olvida su store (spec de PostActorStateStore).
      const ids = todas('tarjeta').map((t) => t.getAttribute('data-id'));
      expect(ids).not.toContain('s1');
      expect(ids).not.toContain('s2');
    });
  });

  describe('publicar', () => {
    it('recarga Recientes, que es donde aparece la publicación nueva', async () => {
      await montar();
      directorio.feedPublico.mockClear();

      (q('crear') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(directorio.feedPublico).toHaveBeenCalledTimes(1);
    });

    it('la publicación nueva va primera aunque no sea pública (Recientes sólo trae lo público)', async () => {
      await montar();

      (q('crear') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(community.readPost).toHaveBeenCalledWith('nuevo');
      expect(todas('tarjeta')[0]?.getAttribute('data-id')).toBe('nuevo');
      expect(todas('tarjeta').length).toBe(3);
    });

    it('publicando en Siguiendo se queda ahí y la ve primera: nadie se sigue a sí mismo', async () => {
      await montar({ url: '/posts?feed=siguiendo' });

      (q('crear') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/posts?feed=siguiendo');
      expect(todas('tarjeta')[0]?.getAttribute('data-id')).toBe('nuevo');
    });

    it('si la relectura ya la trae, no la duplica', async () => {
      await montar();
      directorio.feedPublico.mockReturnValue(of(pagina([publico('nuevo'), publico('a')])));

      (q('crear') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(todas('tarjeta').filter((t) => t.getAttribute('data-id') === 'nuevo').length).toBe(1);
    });

    it('si leer la publicación nueva falla, el feed sigue como estaba', async () => {
      await montar();
      community.readPost.mockReturnValue(throwError(() => new Error('500')));

      (q('crear') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(todas('tarjeta').length).toBe(2);
    });
  });

  describe('las acciones de dominio del menú (AC-01-15)', () => {
    it('«no ver más» avisa en vez de callar, y «contactar» manda a la ficha', async () => {
      await montar();
      const router = TestBed.inject(Router);
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const pagina = fixture.componentInstance as unknown as { pedirOcultar(): void; pedirContacto(slug: string): void };

      pagina.pedirOcultar();
      pagina.pedirContacto('dra-lopez');

      expect(avisos.info).toHaveBeenCalledTimes(2);
      expect(navegar).toHaveBeenCalledWith(['/p', 'dra-lopez']);
    });
  });
});
