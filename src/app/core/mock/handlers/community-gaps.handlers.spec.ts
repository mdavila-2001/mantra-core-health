import { HttpHeaders } from '@angular/common/http';

import { commentList, postList, showcases } from '../fixtures/community';
import { MockRouter, isMockReply, validation, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarComunidad } from './community.handlers';
import { registrarPublico } from './public.handlers';

/**
 * El estado HTTP de cada familia de rechazo sale de los ayudantes del
 * simulador y no se escribe a mano: `mockup` todavía responde las
 * precondiciones con 412 y la validación con 422, y `test` ya con 422 y 400
 * (H2.S1.M2). La prueba fija la familia, no el número de una rama.
 */
const INVALID = validation('').status;

interface Result<T> {
  readonly status: number;
  readonly body: T;
}

function caller(router: MockRouter) {
  return function call<T>(method: MockMethod, path: string, options: { body?: unknown; query?: string; user?: MockUser | null } = {}): Result<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(options.query ?? ''),
      body: options.body ?? {},
      headers: new HttpHeaders(),
      user: options.user === undefined ? buscarUsuario('medica')! : options.user,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  };
}

/**
 * `GET /community/moderation/decisions/mine` — «Mis sanciones» (AG-18, BR-27).
 *
 * - **correcto**: el sancionado ve la decisión con strike, sin datos del
 *   denunciante, y no apelable mientras haya una apelación abierta;
 * - **límite**: una decisión nueva con sujeto y severidad aparece; una sin
 *   strike (`DISMISSED`, o sin sujeto) no aparece en la lista de nadie;
 * - **inválido**: un perfil ajeno es 403 y sin `profileId` es 400.
 */
describe('GET /community/moderation/decisions/mine', () => {
  const router = new MockRouter();
  registrarComunidad(router);
  const call = caller(router);

  const sanctioned = showcases.todos()[4]!;
  /** La cuenta dueña de la vitrina sancionada: `vitrinaDeSesion` la resuelve por el id. */
  const sanctionedUser: MockUser = { ...buscarUsuario('paciente')!, id: sanctioned.targetId, patientProfileId: sanctioned.targetId };

  interface Page {
    readonly items: readonly { decisionId: string; decisionConceptId: string; rationaleText?: string | null; appealable: boolean }[];
    readonly count: number;
    readonly nextCursor: string | null;
  }

  it('correcto — el sancionado ve su decisión, y no es apelable con una apelación abierta', () => {
    const page = call<Page>('GET', '/community/moderation/decisions/mine', { query: `profileId=${sanctioned.id}`, user: sanctionedUser });

    expect(page.status).toBe(200);
    expect(page.body.count).toBe(1);
    const [decision] = page.body.items;
    expect(decision!.rationaleText).toBe('Expone información clínica de un tercero.');
    expect(decision!.appealable).toBe(false);
    expect(Object.keys(decision!)).not.toContain('decidedByUserId');
  });

  it('límite — una decisión con sujeto y severidad suma un strike; una DISMISSED no', () => {
    const queue = call<{ items: readonly { id: string }[] }>('GET', '/community/moderation/queue').body.items;
    const admin = buscarUsuario('admin')!;

    const warned = call<{ id: string; strikeId: string | null }>('POST', `/community/moderation/queue/${queue[0]!.id}/decision`, {
      user: admin,
      body: { decision: 'WARNED', rationaleText: 'Afirmación sin evidencia.', subjectProfileId: sanctioned.id, strikeSeverity: 'LOW' },
    });
    const dismissed = call<{ id: string; strikeId: string | null }>('POST', `/community/moderation/queue/${queue[1]!.id}/decision`, {
      user: admin,
      body: { decision: 'DISMISSED', rationaleText: 'No infringe.', subjectProfileId: sanctioned.id, strikeSeverity: 'LOW' },
    });
    expect(warned.body.strikeId).not.toBeNull();
    expect(dismissed.body.strikeId).toBeNull();

    const page = call<Page>('GET', '/community/moderation/decisions/mine', { query: `profileId=${sanctioned.id}`, user: sanctionedUser }).body;
    const ids = page.items.map((item) => item.decisionId);
    expect(ids[0]).toBe(warned.body.id);
    expect(ids).not.toContain(dismissed.body.id);
    expect(page.items[0]!.appealable).toBe(true);
  });

  it('límite — un perfil sin sanciones recibe una página vacía, no un error', () => {
    const medica = buscarUsuario('medica')!;
    const own = showcases.todos().find((v) => v.targetId === medica.practitionerProfileId || v.targetId === medica.id)!;

    const page = call<Page>('GET', '/community/moderation/decisions/mine', { query: `profileId=${own.id}`, user: medica });

    expect(page).toEqual({ status: 200, body: { items: [], count: 0, limit: 20, nextCursor: null } });
  });

  it('inválido — el perfil de otra persona es 403, y sin profileId no valida', () => {
    expect(call('GET', '/community/moderation/decisions/mine', { query: `profileId=${sanctioned.id}` }).status).toBe(403);
    expect(call('GET', '/community/moderation/decisions/mine', { user: sanctionedUser }).status).toBe(INVALID);
  });
});

/**
 * `GET /public/comments/:commentId/replies` — «Ver N respuestas» (AC-01-12),
 * sin sesión. Antes el mock sólo tenía una ruta anidada bajo el post que la
 * API no declara, y el cliente recibía 501.
 */
describe('GET /public/comments/:commentId/replies', () => {
  const router = new MockRouter();
  registrarPublico(router);
  const call = caller(router);

  interface PublicPage {
    readonly items: readonly { id: string; replyCount: number; author: { slug: string } }[];
    readonly nextCursor: string | null;
  }

  it('correcto — devuelve las respuestas del comentario, sin sesión', () => {
    const post = postList.todos()[0]!;
    const root = commentList.todos().find((c) => c.postId === post.id && c.parentCommentId === null)!;

    const page = call<PublicPage>('GET', `/public/comments/${root.id}/replies`, { user: null });

    expect(page.status).toBe(200);
    expect(page.body.items.map((item) => item.id)).toEqual(
      commentList.filtrar((c) => c.parentCommentId === root.id).map((c) => c.id),
    );
  });

  it('límite — el hilo raíz anuncia cuántas respuestas tiene, y un comentario sin respuestas da página vacía', () => {
    const post = postList.todos()[0]!;
    const roots = call<PublicPage>('GET', `/public/posts/${post.id}/comments`, { user: null }).body.items;
    const withReplies = roots.find((item) => item.replyCount > 0)!;
    const withoutReplies = roots.find((item) => item.replyCount === 0);

    expect(call<PublicPage>('GET', `/public/comments/${withReplies.id}/replies`, { user: null }).body.items).toHaveLength(withReplies.replyCount);
    if (withoutReplies !== undefined) {
      expect(call<PublicPage>('GET', `/public/comments/${withoutReplies.id}/replies`, { user: null }).body.items).toEqual([]);
    }
  });

  it('inválido — un comentario que no existe es 404', () => {
    expect(call('GET', '/public/comments/no-existe/replies', { user: null }).status).toBe(404);
  });
});
