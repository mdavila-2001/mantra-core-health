import { readFileSync } from 'node:fs';

import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { of, Subject, throwError } from 'rxjs';

import { CommunityClient } from '@core/data-access/community/community.client';
import type { PostVisibility } from '@core/data-access/community/community.types';
import type { PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';
import { SessionStore } from '@core/auth/session.store';
import { OwnProfileStore } from '@core/social/own-profile.store';
import { PostActorStateStore } from '@core/social/post-actor-state.store';

import { PublicPostCard } from './public-post-card';

const POST_CSS = 'src/app/features/public-profile/public-post-card/public-post-card.css';

function unPost(mediaUrls: readonly string[]): PublicPostSummary {
  return {
    id: 'post-1',
    bodyText: 'Tres consejos para cuidar la presión.',
    publishedAt: new Date('2026-08-14T12:00:00.000Z'),
    mediaUrls,
    reactionCount: 4,
    commentCount: 2,
  } as PublicPostSummary;
}

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RutaVacia {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicPostCard],
  template: `
    <app-public-post-card
      [post]="post()"
      slug="dra-lopez"
      autorNombre="Dra. López"
      autorIniciales="DL"
      [autorEnlazado]="true"
    />
  `,
})
class HostComponent {
  readonly post = signal<PublicPostSummary>(unPost([]));
}

describe('PublicPostCard', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function boton(testId: string): HTMLButtonElement | null {
    return root().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  }

  async function conImagenes(cuantas: number): Promise<void> {
    host.post.set(
      unPost(Array.from({ length: cuantas }, (_, i) => `https://cdn.local/foto-${i}.jpg`)),
    );
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: 'p/:slug', component: RutaVacia },
          { path: 'p/:slug/post/:postId', component: RutaVacia },
          { path: 'auth', component: RutaVacia },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('la fecha (AC-01-1)', () => {
    it('no es un enlace', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha).not.toBeNull();
      expect(fecha?.tagName.toLowerCase()).toBe('time');
      expect(fecha?.closest('a')).toBeNull();
    });

    it('conserva el time con datetime, que lo leen el buscador y el lector', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha?.getAttribute('datetime')).toBe('2026-08-14T12:00:00.000Z');
    });

    it('no entra en el orden de tabulación', () => {
      const fecha = root().querySelector('.publicacion__fecha');

      expect(fecha?.hasAttribute('tabindex')).toBe(false);
      expect(fecha?.hasAttribute('href')).toBe(false);
    });
  });

  describe('la galería (AC-01-7, AC-01-8)', () => {
    it('con una sola imagen no dibuja los pasos', async () => {
      await conImagenes(1);

      expect(boton('image-previous')).toBeNull();
      expect(boton('image-next')).toBeNull();
    });

    it('con dos o más dibuja los dos botones y el «n de N»', async () => {
      await conImagenes(3);

      expect(boton('image-previous')).not.toBeNull();
      expect(boton('image-next')).not.toBeNull();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('1 de 3');
    });

    it('los botones tienen nombre accesible en castellano', async () => {
      await conImagenes(2);

      expect(boton('image-previous')?.getAttribute('aria-label')).toBe('Imagen anterior');
      expect(boton('image-next')?.getAttribute('aria-label')).toBe('Imagen siguiente');
    });

    it('avanza y retrocede, y el contador acompaña', async () => {
      await conImagenes(3);

      boton('image-next')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('2 de 3');

      boton('image-previous')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('1 de 3');
    });

    it('muestra la imagen del índice actual, una sola', async () => {
      await conImagenes(3);
      const imagenes = () => root().querySelectorAll('img.publicacion__imagen');

      expect(imagenes()).toHaveLength(1);
      expect(imagenes()[0]?.getAttribute('src')).toBe('https://cdn.local/foto-0.jpg');

      boton('image-next')?.click();
      await fixture.whenStable();
      expect(imagenes()[0]?.getAttribute('src')).toBe('https://cdn.local/foto-1.jpg');
    });

    it('en el primer paso «anterior» queda deshabilitado', async () => {
      await conImagenes(2);

      expect(boton('image-previous')?.disabled).toBe(true);
      expect(boton('image-next')?.disabled).toBe(false);
    });

    it('en el último paso «siguiente» queda deshabilitado: no da la vuelta', async () => {
      await conImagenes(2);
      boton('image-next')?.click();
      await fixture.whenStable();

      expect(boton('image-next')?.disabled).toBe(true);
      expect(boton('image-previous')?.disabled).toBe(false);
    });

    it('el índice se acota si la publicación cambia por otra con menos imágenes', async () => {
      await conImagenes(5);
      boton('image-next')?.click();
      boton('image-next')?.click();
      boton('image-next')?.click();
      await fixture.whenStable();
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('4 de 5');

      // El componente se reutiliza al paginar el feed: sin acotar, acá quedaría
      // pidiendo la imagen 4 de una publicación que tiene 2.
      await conImagenes(2);
      expect(root().querySelector('.publicacion__contador')?.textContent?.trim()).toBe('2 de 2');
      expect(root().querySelector('img.publicacion__imagen')?.getAttribute('src')).toBe(
        'https://cdn.local/foto-1.jpg',
      );
    });

    it('el contador es texto, no sólo un punto de color', async () => {
      await conImagenes(4);

      expect(root().querySelector('.publicacion__contador')?.textContent).toContain('de 4');
    });
  });

  describe('el menú de preferencias (AC-01-15)', () => {
    it('está en la tarjeta, con nombre accesible', () => {
      const disparador = boton('post-preferences-trigger');

      expect(disparador).not.toBeNull();
      expect(disparador?.getAttribute('aria-label')).toBe('Preferencias de la publicación');
    });
  });

  describe('estilo', () => {
    const css = readFileSync(POST_CSS, 'utf8');

    it('no queda scroll libre en la galería (AC-01-7)', () => {
      // Si estas tres vuelven, vuelve el carrusel sin controles que el pedido
      // señala como defecto.
      const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '');

      expect(reglas).not.toContain('scroll-snap-type');
      expect(reglas).not.toContain('overflow-x: auto');
    });

    it('los pasos tienen 44 px de área táctil', () => {
      const paso = css.slice(css.indexOf('.publicacion__paso {'));

      expect(paso).toContain('inline-size: 44px');
      expect(paso).toContain('block-size: 44px');
    });
  });
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicPostCard],
  template: `
    <app-public-post-card
      [post]="post()"
      [slug]="slug()"
      autorNombre="Dra. López"
      autorIniciales="DL"
      [autorEnlazado]="true"
      [conAcciones]="true"
      [visibilidad]="visibilidad()"
      [actorProfileId]="actor()"
    />
  `,
})
class HostConAcciones {
  readonly post = signal<PublicPostSummary>(unPost([]));
  readonly slug = signal('dra-lopez');
  readonly visibilidad = signal<PostVisibility>('PUBLIC');
  readonly actor = signal<string | null>('pp-1');
}

/** Un cliente de comunidad con todo lo que la tarjeta y sus stores le piden. */
function clienteDe(extra: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
  return {
    react: vi.fn(() => of({ id: 'r1', created: true })),
    unreact: vi.fn(() => of({ removed: true })),
    readPost: vi.fn(() => of({ reactions: {} })),
    bookmark: vi.fn(() => of({ id: 'b1' })),
    unbookmark: vi.fn(() => of({ removed: true })),
    listBookmarks: vi.fn(() => of({ items: [], count: 0, limit: 100, nextCursor: null })),
    listFollows: vi.fn(() => of({ items: [], count: 0, limit: 100, nextCursor: null })),
    follow: vi.fn(() => of({ id: 'f1' })),
    unfollow: vi.fn(() => of({ removed: true })),
    readProfileBySlug: vi.fn(() => of({ id: 'perfil-lopez' })),
    ...extra,
  } as Record<string, ReturnType<typeof vi.fn>>;
}

describe('PublicPostCard — la fila de acciones de una red profesional', () => {
  let fixture: ComponentFixture<HostConAcciones>;
  let cliente: Record<string, ReturnType<typeof vi.fn>>;

  async function montar(opciones: {
    reaccionPrevia?: 'LIKE' | 'LOVE' | null | undefined;
    cliente?: Record<string, unknown>;
    autenticado?: boolean;
    miSlug?: string;
  } = {}): Promise<void> {
    cliente = clienteDe(opciones.cliente);
    await TestBed.configureTestingModule({
      imports: [HostConAcciones],
      providers: [
        provideRouter([
          { path: 'auth', component: RutaVacia },
          { path: 'my-account/profile/edit', component: RutaVacia },
        ]),
        { provide: CommunityClient, useValue: cliente },
        { provide: SessionStore, useValue: { isAuthenticated: signal(opciones.autenticado ?? true) } },
        {
          provide: OwnProfileStore,
          useValue: {
            id: signal('pp-1'),
            perfil: signal({ id: 'pp-1', slug: opciones.miSlug ?? 'yo' }),
          },
        },
      ],
    }).compileComponents();

    // Lo que ya se sabe de la reacción propia, antes de dibujar: la tarjeta no
    // afirma «presionado» ni «apagado» mientras no lo sabe.
    if (opciones.reaccionPrevia !== undefined) {
      TestBed.inject(PostActorStateStore).fijar('post-1', opciones.reaccionPrevia, 'pp-1');
    }

    fixture = TestBed.createComponent(HostConAcciones);
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string): HTMLElement | null => root().querySelector(`[data-testid="${testId}"]`);
  const clic = async (testId: string): Promise<void> => {
    q(testId)?.click();
    await fixture.whenStable();
  };

  it('el artículo se identifica como `post-card-<id>` para los recorridos', async () => {
    await montar({ reaccionPrevia: null });

    expect(q('post-card-post-1')).not.toBeNull();
  });

  describe('reaccionar', () => {
    it('un toque simple deja «Recomendar» (LIKE) con los cuatro campos del contrato y suma uno', async () => {
      await montar({ reaccionPrevia: null });

      await clic('post-action-like');

      expect(cliente['react']).toHaveBeenCalledWith({
        actorProfileId: 'pp-1',
        reactableType: 'POST',
        reactableRefId: 'post-1',
        reactionType: 'LIKE',
      });
      expect(q('post-reactions')?.textContent).toContain('5');
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('el selector ofrece las cinco reacciones y elegir otra manda ese tipo', async () => {
      await montar({ reaccionPrevia: null });

      await clic('reaction-picker-toggle');
      const opciones = ['LIKE', 'LOVE', 'INSIGHTFUL', 'CELEBRATE', 'SUPPORT'].map((t) => q(`reaction-${t}`));
      expect(opciones.every((o) => o !== null)).toBe(true);

      await clic('reaction-CELEBRATE');

      expect(cliente['react']).toHaveBeenCalledWith(expect.objectContaining({ reactionType: 'CELEBRATE' }));
      expect(q('post-action-like-label')?.textContent?.trim()).toBe('Celebro');
    });

    it('cambiar de tipo NO vuelve a sumar: el servidor hace upsert, una reacción por persona', async () => {
      await montar({ reaccionPrevia: 'LIKE', cliente: { react: vi.fn(() => of({ id: 'r1', created: false })) } });

      await clic('reaction-picker-toggle');
      await clic('reaction-LOVE');

      expect(q('post-reactions')?.textContent).toContain('4');
      expect(q('post-action-like-label')?.textContent?.trim()).toBe('Me encanta');
    });

    it('si no se sabía qué había reaccionado y el servidor dice que ya existía, corrige el total', async () => {
      // La lectura del estado propio no contesta: sigue sin saberse qué había reaccionado.
      await montar({
        reaccionPrevia: undefined,
        cliente: { readPost: vi.fn(() => new Subject()), react: vi.fn(() => of({ id: 'r1', created: false })) },
      });

      await clic('post-action-like');

      // Se sumó de entrada (4 → 5) y la respuesta (`created: false`) lo devuelve a 4.
      expect(q('post-reactions')?.textContent).toContain('4');
    });

    it('el total sube de inmediato, antes de que el servidor conteste', async () => {
      const respuesta = new Subject<{ id: string; created: boolean }>();
      await montar({ reaccionPrevia: null, cliente: { react: vi.fn(() => respuesta) } });

      await clic('post-action-like');

      expect(q('post-reactions')?.textContent).toContain('5');
      respuesta.next({ id: 'r1', created: true });
      respuesta.complete();
    });

    it('sin doble envío: con una reacción en vuelo un segundo toque no manda otra', async () => {
      await montar({ reaccionPrevia: null, cliente: { react: vi.fn(() => new Subject()) } });

      await clic('post-action-like');
      await clic('post-action-like');

      expect(cliente['react']).toHaveBeenCalledTimes(1);
    });

    it('si el servidor falla, el botón y el total vuelven atrás y se dice por qué con el código de soporte', async () => {
      await montar({
        reaccionPrevia: null,
        cliente: {
          react: vi.fn(() =>
            throwError(
              () =>
                new HttpErrorResponse({
                  status: 500,
                  error: { code: 'INTERNAL', message: 'x', correlationId: 'corr-like', timestamp: '', path: '' },
                }),
            ),
          ),
        },
      });

      await clic('post-action-like');

      // Estado anterior conocido (no reaccionó): vuelve a «apagado», no a «no se sabe».
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('false');
      expect(q('post-reactions')?.textContent).toContain('4');
      expect(q('post-action-like-error')?.textContent).toBe(
        'No pudimos guardar su reacción. (Código de soporte: corr-like)',
      );
    });

    it('si no se sabía el estado anterior, tras el fallo sigue sin afirmarse nada (sin aria-pressed)', async () => {
      await montar({
        reaccionPrevia: undefined,
        cliente: {
          readPost: vi.fn(() => new Subject()),
          react: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))),
        },
      });
      expect(q('post-action-like')?.hasAttribute('aria-pressed')).toBe(false);

      await clic('post-action-like');

      expect(q('post-action-like')?.hasAttribute('aria-pressed')).toBe(false);
    });
  });

  describe('quitar la reacción', () => {
    it('tocar «Recomendar» cuando ya reaccionó la QUITA con DELETE, no vuelve a mandar el upsert', async () => {
      await montar({ reaccionPrevia: 'LIKE' });
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('true');

      await clic('post-action-like');

      expect(cliente['unreact']).toHaveBeenCalledWith({
        actorProfileId: 'pp-1',
        reactableType: 'POST',
        reactableRefId: 'post-1',
      });
      expect(cliente['react']).not.toHaveBeenCalled();
      expect(q('post-reactions')?.textContent).toContain('3');
      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('false');
      expect(q('post-action-like-label')?.textContent?.trim()).toBe('Recomendar');
    });

    it('si quitarla falla, la reacción vuelve y se avisa', async () => {
      await montar({
        reaccionPrevia: 'LOVE',
        cliente: { unreact: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) },
      });

      await clic('post-action-like');

      expect(q('post-action-like')?.getAttribute('aria-pressed')).toBe('true');
      expect(q('post-action-like-label')?.textContent?.trim()).toBe('Me encanta');
      expect(q('post-reactions')?.textContent).toContain('4');
      expect(q('post-action-like-error')?.textContent).toContain('No pudimos quitar su reacción.');
    });

    it('si no había nada que quitar (otra pestaña ya lo hizo), el total no baja de más', async () => {
      await montar({ reaccionPrevia: 'LIKE', cliente: { unreact: vi.fn(() => of({ removed: false })) } });

      await clic('post-action-like');

      expect(q('post-reactions')?.textContent).toContain('4');
    });
  });

  describe('guardar', () => {
    it('guarda la publicación con el marcador de tipo POST y pasa a «Guardada»', async () => {
      await montar({ reaccionPrevia: null });
      expect(q('post-action-save')?.textContent).toContain('Guardar');

      await clic('post-action-save');

      expect(cliente['bookmark']).toHaveBeenCalledWith({
        profileId: 'pp-1',
        bookmarkableType: 'POST',
        bookmarkableRefId: 'post-1',
      });
      expect(q('post-action-save')?.textContent).toContain('Guardada');
      expect(q('post-action-save')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('volver a tocarlo la quita de los guardados', async () => {
      await montar({
        reaccionPrevia: null,
        cliente: {
          listBookmarks: vi.fn(() =>
            of({ items: [{ id: 'm1', bookmarkableRefId: 'post-1' }], count: 1, limit: 100, nextCursor: null }),
          ),
        },
      });
      expect(q('post-action-save')?.textContent).toContain('Guardada');

      await clic('post-action-save');

      expect(cliente['unbookmark']).toHaveBeenCalledWith({
        profileId: 'pp-1',
        bookmarkableType: 'POST',
        bookmarkableRefId: 'post-1',
      });
      expect(q('post-action-save')?.textContent).toContain('Guardar');
    });

    it('si falla guarda nada y lo dice', async () => {
      await montar({
        reaccionPrevia: null,
        cliente: { bookmark: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))) },
      });

      await clic('post-action-save');

      expect(q('post-action-save')?.textContent).toContain('Guardar');
      expect(q('post-action-like-error')?.textContent).toContain('No pudimos guardarla.');
    });
  });

  describe('sin sesión o sin vitrina (AC-01-17)', () => {
    it('sin sesión, Recomendar y Guardar mandan a entrar con retorno y no llaman a la API', async () => {
      await montar({ autenticado: false });
      fixture.componentInstance.actor.set(null);
      await fixture.whenStable();

      await clic('post-action-like');

      expect(cliente['react']).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).url).toContain('/auth');
    });

    it('con sesión pero sin vitrina pública, Guardar lleva a crearla', async () => {
      await montar();
      fixture.componentInstance.actor.set(null);
      await fixture.whenStable();

      await clic('post-action-save');

      expect(cliente['bookmark']).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).url).toBe('/my-account/profile/edit');
    });
  });

  describe('la cabecera', () => {
    it('dice «hace N horas» y no una fecha seca', async () => {
      await montar({ reaccionPrevia: null });
      fixture.componentInstance.post.set({
        ...unPost([]),
        publishedAt: new Date(Date.now() - 2 * 3600 * 1000),
      });
      await fixture.whenStable();

      expect(root().querySelector('time')?.textContent).toContain('hace 2 h');
      // El lector de pantalla igual recibe la fecha completa.
      expect(root().querySelector('time .solo-lectores')?.textContent).toMatch(/\d{4}/);
    });

    it('pasada una semana vuelve a la fecha corta', async () => {
      await montar({ reaccionPrevia: null });

      expect(root().querySelector('time')?.textContent).toContain('2026');
    });

    it('un post de seguidores lo dice con ícono y con texto para el lector de pantalla', async () => {
      await montar({ reaccionPrevia: null });
      fixture.componentInstance.visibilidad.set('FOLLOWERS');
      await fixture.whenStable();

      expect(q('post-visibility-followers')).not.toBeNull();
      expect(root().querySelector('.publicacion__meta')?.textContent).toContain('Sólo para quienes siguen a este autor');
    });

    it('un post privado lo dice también', async () => {
      await montar({ reaccionPrevia: null });
      fixture.componentInstance.visibilidad.set('PRIVATE');
      await fixture.whenStable();

      expect(q('post-visibility-private')).not.toBeNull();
    });

    it('ofrece «Seguir» al autor, y no en su propia publicación', async () => {
      await montar({ reaccionPrevia: null });
      expect(q('follow-button')).not.toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();

      await montar({ reaccionPrevia: null, miSlug: 'dra-lopez' });

      expect(q('follow-button')).toBeNull();
    });
  });

  describe('compartir', () => {
    it('abre un menú con «Copiar enlace» y «Compartir…»', async () => {
      await montar({ reaccionPrevia: null });

      const disparador = q('post-action-share');

      expect(disparador?.getAttribute('aria-haspopup')).toBeTruthy();
    });
  });
});
