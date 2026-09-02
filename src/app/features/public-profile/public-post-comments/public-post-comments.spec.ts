import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicComment,
  PublicPage,
} from '@core/data-access/public-directory/public-directory.types';

import { comentarioDestacado, PublicPostComments } from './public-post-comments';

function comentario(
  id: string,
  opciones: {
    replyCount?: number;
    createdAt?: string;
    displayName?: string;
    bodyText?: string;
  } = {},
): PublicComment {
  return {
    id,
    bodyText: opciones.bodyText ?? `Texto de ${id}`,
    createdAt: new Date(opciones.createdAt ?? '2026-08-01T00:00:00.000Z'),
    replyCount: opciones.replyCount ?? 0,
    author: {
      slug: `autor-${id}`,
      displayName: opciones.displayName ?? `Autor ${id}`,
      headline: null,
      avatarUrl: null,
      kind: 'PRACTITIONER',
    },
  };
}

function pagina(
  items: readonly PublicComment[],
  nextCursor: string | null = null,
): PublicPage<PublicComment> {
  return { items, nextCursor, totalHint: null, generatedAt: new Date('2026-09-01T00:00:00Z') };
}

/* ============================================================================
    El criterio de «destacado» (AC-01-13), aparte del componente.
    ========================================================================== */

describe('comentarioDestacado', () => {
  it('sin comentarios no hay destacado', () => {
    expect(comentarioDestacado([])).toBeNull();
  });

  it('sin respuestas nadie es destacado: llegar antes no es destacar', () => {
    expect(comentarioDestacado([comentario('a'), comentario('b')])).toBeNull();
  });

  it('gana el que más conversación generó', () => {
    const elegido = comentarioDestacado([
      comentario('a', { replyCount: 1 }),
      comentario('b', { replyCount: 7 }),
      comentario('c', { replyCount: 3 }),
    ]);

    expect(elegido?.id).toBe('b');
  });

  it('a igual cantidad de respuestas gana el más viejo', () => {
    const elegido = comentarioDestacado([
      comentario('nuevo', { replyCount: 2, createdAt: '2026-08-20T00:00:00.000Z' }),
      comentario('viejo', { replyCount: 2, createdAt: '2026-08-01T00:00:00.000Z' }),
    ]);

    // Estuvo más tiempo disponible para que le respondieran.
    expect(elegido?.id).toBe('viejo');
  });
});

/* ============================================================================
    El desplegable.
    ========================================================================== */

@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [PublicPostComments],
  template: '<app-public-post-comments postId="post-1" />',
})
class HostComponent {}

describe('PublicPostComments', () => {
  let fixture: ComponentFixture<HostComponent>;
  let respuestasPedidas: string[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botones(testId: string): HTMLButtonElement[] {
    return [...root().querySelectorAll<HTMLButtonElement>(`[data-testid="${testId}"]`)];
  }

  async function montar(opciones: {
    raiz?: () => Observable<PublicPage<PublicComment>>;
    respuestas?: (id: string) => Observable<PublicPage<PublicComment>>;
    conSesion?: boolean;
  }): Promise<void> {
    respuestasPedidas = [];

    const directorio = {
      postComments: opciones.raiz ?? (() => of(pagina([]))),
      commentReplies: (id: string) => {
        respuestasPedidas.push(id);
        return (opciones.respuestas ?? (() => of(pagina([]))))(id);
      },
    };

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: 'posts', component: RutaVacia },
          { path: 'auth', component: RutaVacia },
          { path: 'feed', component: RutaVacia },
          { path: 'p/:slug', component: RutaVacia },
        ]),
        { provide: PublicDirectoryClient, useValue: directorio },
        {
          provide: SessionStore,
          useValue: { isAuthenticated: () => opciones.conSesion === true },
        },
      ],
    }).compileComponents();

    await TestBed.inject(Router).navigateByUrl('/posts');
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  describe('el hilo (AC-01-12)', () => {
    it('cada comentario muestra el nombre visible del autor, no un identificador', async () => {
      await montar({ raiz: () => of(pagina([comentario('a', { displayName: 'Dra. López' })])) });

      // El muro con sesión escribe «Perfil a1b2c3d4» cuando no resuelve el
      // autor; acá el nombre viene en la respuesta.
      expect(root().querySelector('.comentario__autor')?.textContent?.trim()).toBe('Dra. López');
      expect(root().textContent).not.toContain('Perfil ');
    });

    it('cada comentario tiene su fecha, con datetime legible por máquina', async () => {
      await montar({
        raiz: () => of(pagina([comentario('a', { createdAt: '2026-08-14T12:00:00.000Z' })])),
      });

      expect(root().querySelector('.comentario__fecha')?.getAttribute('datetime')).toBe(
        '2026-08-14T12:00:00.000Z',
      );
    });

    it('cada comentario tiene su «Responder»', async () => {
      await montar({ raiz: () => of(pagina([comentario('a'), comentario('b')])) });

      expect(botones('comment-reply')).toHaveLength(2);
    });

    it('sin respuestas NO se ofrece «Ver N respuestas»', async () => {
      await montar({ raiz: () => of(pagina([comentario('a', { replyCount: 0 })])) });

      expect(botones('comment-replies-toggle')).toHaveLength(0);
    });

    it('con respuestas dice cuántas, y en singular cuando es una', async () => {
      await montar({ raiz: () => of(pagina([comentario('a', { replyCount: 1 })])) });

      expect(botones('comment-replies-toggle')[0]?.textContent?.trim()).toBe('Ver 1 respuesta');
    });

    it('«Ver N respuestas» las pide y las dibuja', async () => {
      await montar({
        raiz: () => of(pagina([comentario('a', { replyCount: 2 })])),
        respuestas: () => of(pagina([comentario('r1'), comentario('r2')])),
      });

      botones('comment-replies-toggle')[0]?.click();
      await fixture.whenStable();

      expect(respuestasPedidas).toEqual(['a']);
      expect(root().querySelectorAll('.comentarios__lista--respuestas .comentario')).toHaveLength(
        2,
      );
    });

    it('el botón de respuestas declara aria-expanded y lo cambia', async () => {
      await montar({
        raiz: () => of(pagina([comentario('a', { replyCount: 1 })])),
        respuestas: () => of(pagina([comentario('r1')])),
      });

      const boton = () => botones('comment-replies-toggle')[0];
      expect(boton()?.getAttribute('aria-expanded')).toBe('false');

      boton()?.click();
      await fixture.whenStable();
      expect(boton()?.getAttribute('aria-expanded')).toBe('true');
    });

    it('volver a tocarlo las cierra sin pedirlas de nuevo', async () => {
      await montar({
        raiz: () => of(pagina([comentario('a', { replyCount: 1 })])),
        respuestas: () => of(pagina([comentario('r1')])),
      });

      botones('comment-replies-toggle')[0]?.click();
      await fixture.whenStable();
      botones('comment-replies-toggle')[0]?.click();
      await fixture.whenStable();

      expect(root().querySelectorAll('.comentarios__lista--respuestas')).toHaveLength(0);
      expect(respuestasPedidas).toEqual(['a']);
    });
  });

  describe('el más destacado primero (AC-01-13)', () => {
    it('lo pone arriba y lo rotula', async () => {
      await montar({
        raiz: () =>
          of(
            pagina([
              comentario('llano', { bodyText: 'Gracias' }),
              comentario('charlado', { replyCount: 5, bodyText: 'Consulta larga' }),
            ]),
          ),
      });

      expect(root().textContent).toContain('Comentario más destacado');
      const textos = [...root().querySelectorAll('.comentario__texto')].map((p) =>
        p.textContent?.trim(),
      );
      expect(textos[0]).toBe('Consulta larga');
    });

    it('no lo repite en la lista cronológica', async () => {
      await montar({
        raiz: () =>
          of(pagina([comentario('a'), comentario('b', { replyCount: 3, bodyText: 'Único' })])),
      });

      const textos = [...root().querySelectorAll('.comentario__texto')].map((p) =>
        p.textContent?.trim(),
      );
      expect(textos.filter((t) => t === 'Único')).toHaveLength(1);
    });

    it('sin ninguno destacado no dibuja el rótulo', async () => {
      await montar({ raiz: () => of(pagina([comentario('a'), comentario('b')])) });

      expect(root().textContent).not.toContain('Comentario más destacado');
      expect(root().querySelectorAll('.comentario')).toHaveLength(2);
    });
  });

  describe('«Responder» sin sesión (AC-01-17)', () => {
    it('lleva a /auth con retorno a donde se estaba leyendo', async () => {
      await montar({ raiz: () => of(pagina([comentario('a')])), conSesion: false });

      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/auth?returnUrl=%2Fposts');
    });

    it('el botón NO se esconde por falta de sesión', async () => {
      await montar({ raiz: () => of(pagina([comentario('a')])), conSesion: false });

      expect(botones('comment-reply')).toHaveLength(1);
    });
  });

  describe('los cuatro estados', () => {
    it('sin comentarios lo dice, no deja el desplegable en blanco', async () => {
      await montar({ raiz: () => of(pagina([])) });

      expect(root().textContent).toContain('Todavía no hay comentarios visibles');
    });

    it('un fallo se anuncia y se puede reintentar', async () => {
      let falla = true;
      await montar({
        raiz: () => (falla ? throwError(() => new Error('caído')) : of(pagina([comentario('a')]))),
      });

      expect(root().querySelector('[role="alert"]')?.textContent).toContain(
        'No pudimos leer los comentarios',
      );

      falla = false;
      root().querySelector<HTMLButtonElement>('[role="alert"] ~ p button')?.click();
      await fixture.whenStable();

      expect(root().querySelectorAll('.comentario')).toHaveLength(1);
    });

    it('«Ver más comentarios» concatena en vez de reemplazar', async () => {
      let primera = true;
      await montar({
        raiz: () => {
          if (primera) {
            primera = false;
            return of(pagina([comentario('a')], 'cursor-2'));
          }
          return of(pagina([comentario('b')]));
        },
      });

      expect(root().querySelectorAll('.comentario')).toHaveLength(1);
      botones('comments-load-more')[0]?.click();
      await fixture.whenStable();

      expect(root().querySelectorAll('.comentario')).toHaveLength(2);
    });
  });
});
