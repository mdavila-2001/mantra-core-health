import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { CommunityClient } from '@core/data-access/community/community.client';
import { FilesClient } from '@core/data-access/files/files.client';
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
    media: [],
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

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RutaVacia {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PublicPostComments],
  template: '<app-public-post-comments postId="post-1" [actorProfileId]="actor" />',
})
class HostComponent {
  actor: string | null = null;
}

describe('PublicPostComments', () => {
  let fixture: ComponentFixture<HostComponent>;
  let respuestasPedidas: string[];
  let comentariosCreados: Record<string, unknown>[];

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
    /** El perfil público de quien mira; `null` es «con sesión pero sin vitrina». */
    actor?: string | null;
    crearComentario?: (datos: Record<string, unknown>) => Observable<{ id: string }>;
  }): Promise<void> {
    respuestasPedidas = [];
    comentariosCreados = [];

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
          { path: 'my-account/profile/edit', component: RutaVacia },
          { path: 'p/:slug', component: RutaVacia },
        ]),
        { provide: PublicDirectoryClient, useValue: directorio },
        {
          provide: CommunityClient,
          useValue: {
            createComment: (datos: Record<string, unknown>) => {
              comentariosCreados.push(datos);
              return (opciones.crearComentario ?? (() => of({ id: 'nuevo-1' })))(datos);
            },
          },
        },
        { provide: FilesClient, useValue: {} },
        {
          provide: SessionStore,
          useValue: { isAuthenticated: () => opciones.conSesion === true },
        },
      ],
    }).compileComponents();

    await TestBed.inject(Router).navigateByUrl('/posts');
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.actor = opciones.actor ?? null;
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

  describe('«Responder» en línea', () => {
    const conVitrina = {
      raiz: () => of(pagina([comentario('a', { displayName: 'Dr. Ariel' })])),
      conSesion: true,
      actor: 'perfil-yo',
    };

    function campoDeRespuesta(): HTMLTextAreaElement {
      return root().querySelector<HTMLTextAreaElement>('[data-testid="reply-composer-body"]')!;
    }

    async function escribirRespuesta(texto: string): Promise<void> {
      const campo = campoDeRespuesta();
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }

    it('abre el redactor bajo el comentario y NO sale de la publicación', async () => {
      await montar(conVitrina);

      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      expect(campoDeRespuesta()).toBeTruthy();
      expect(campoDeRespuesta().placeholder).toBe('Responda a Dr. Ariel…');
      expect(TestBed.inject(Router).url).toBe('/posts');
    });

    it('volver a tocar «Responder» lo cierra', async () => {
      await montar(conVitrina);

      botones('comment-reply')[0]?.click();
      await fixture.whenStable();
      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      expect(root().querySelector('[data-testid="reply-composer"]')).toBeNull();
    });

    it('«Cancelar» lo cierra sin mandar nada', async () => {
      await montar(conVitrina);
      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      botones('reply-composer-cancel')[0]?.click();
      await fixture.whenStable();

      expect(root().querySelector('[data-testid="reply-composer"]')).toBeNull();
      expect(comentariosCreados).toEqual([]);
    });

    it('manda la respuesta con el comentario padre, relee las respuestas y suma al contador', async () => {
      await montar({
        ...conVitrina,
        respuestas: () => of(pagina([comentario('r1', { bodyText: 'Mi respuesta' })])),
      });
      botones('comment-reply')[0]?.click();
      await fixture.whenStable();
      await escribirRespuesta('  Mi respuesta  ');

      botones('reply-composer-submit')[0]?.click();
      await fixture.whenStable();

      expect(comentariosCreados).toEqual([
        {
          authorProfileId: 'perfil-yo',
          commentableRefId: 'post-1',
          bodyText: 'Mi respuesta',
          parentCommentId: 'a',
        },
      ]);
      expect(respuestasPedidas).toEqual(['a']);
      expect(root().textContent).toContain('Mi respuesta');
      expect(root().querySelector('[data-testid="reply-composer"]')).toBeNull();
      expect(botones('comment-replies-toggle')[0]?.textContent).toContain('Ocultar las respuestas');
    });

    it('si el servidor falla conserva lo escrito y dice qué hacer', async () => {
      await montar({
        ...conVitrina,
        crearComentario: () => throwError(() => new HttpErrorResponse({ status: 500 })),
      });
      botones('comment-reply')[0]?.click();
      await fixture.whenStable();
      await escribirRespuesta('No quiero perder esto');

      botones('reply-composer-submit')[0]?.click();
      await fixture.whenStable();

      expect(campoDeRespuesta().value).toBe('No quiero perder esto');
      expect(root().querySelector('[data-testid="reply-composer-error"]')?.textContent).toContain(
        'Lo escrito sigue ahí',
      );
      expect(respuestasPedidas).toEqual([]);
    });

    it('sin texto no se puede enviar: un adjunto solo no alcanza', async () => {
      await montar(conVitrina);
      botones('comment-reply')[0]?.click();
      await fixture.whenStable();
      await escribirRespuesta('   ');

      expect(botones('reply-composer-submit')[0]?.disabled).toBe(true);
    });

    it('con sesión pero sin vitrina pública lleva a crearla, no a un muro que ya no existe', async () => {
      await montar({ ...conVitrina, actor: null });

      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/my-account/profile/edit');
    });

    it('sin sesión nunca navega a /feed', async () => {
      await montar({ raiz: () => of(pagina([comentario('a')])), conSesion: false });

      botones('comment-reply')[0]?.click();
      await fixture.whenStable();

      expect(TestBed.inject(Router).url).not.toContain('/feed');
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

    it('el fallo de lectura dice qué hacer y trae el código de soporte', async () => {
      await montar({ raiz: () => throwError(() => new HttpErrorResponse({
          status: 503,
          error: { code: 'DEPENDENCY_UNAVAILABLE', message: '', correlationId: 'corr-pub', timestamp: '', path: '' },
        })) });

      expect(root().querySelector('[role="alert"]')?.textContent).toContain(
        'Vuelva a intentarlo en un momento. (Código de soporte: corr-pub)',
      );
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
