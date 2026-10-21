import { HttpHeaders } from '@angular/common/http';

import { publicaciones, vitrinas } from '../fixtures/comunidad';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarComunidad } from './community.handlers';

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
 * Las escrituras sociales de la maqueta, contra lo que hace la API real.
 *
 * La maqueta alternaba la reacción al repetirla y leía la clave de los `DELETE`
 * de un cuerpo que el cliente nunca manda: las dos cosas «funcionaban» en la
 * demo y no existen en el servidor. Estas pruebas fijan el contrato de la API.
 */
describe('escrituras sociales del simulador', () => {
  const router = new MockRouter();
  registrarComunidad(router);
  const call = caller(router);

  const actor = vitrinas.todos()[2]!.id;
  const otra = vitrinas.todos()[3]!.id;
  const post = publicaciones.todos().find((p) => p.reaccionDelActor[actor] === undefined)!;

  const reaccionar = (tipo: string, quien = actor) =>
    call<{ created: boolean; reactionType: string }>('PUT', '/community/reactions', {
      body: { actorProfileId: quien, reactableType: 'POST', reactableRefId: post.id, reactionType: tipo },
    });
  const propia = () => publicaciones.get(post.id)!.reaccionDelActor[actor];
  const total = () => Object.values(publicaciones.get(post.id)!.reacciones).reduce((a, b) => a + b, 0);

  describe('PUT /community/reactions — upsert, no alternancia', () => {
    it('correcto: la primera reacción es nueva y suma uno', () => {
      const antes = total();

      const r = reaccionar('LIKE');

      expect(r.body.created).toBe(true);
      expect(propia()).toBe('LIKE');
      expect(total()).toBe(antes + 1);
    });

    it('límite: repetir el MISMO tipo la deja igual (no la quita) y no suma', () => {
      const antes = total();

      const r = reaccionar('LIKE');

      expect(r.body.created).toBe(false);
      expect(propia()).toBe('LIKE');
      expect(total()).toBe(antes);
    });

    it('límite: otro tipo la cambia, el total no se mueve y `created` es false', () => {
      const antes = total();

      const r = reaccionar('LOVE');

      expect(r.body.created).toBe(false);
      expect(propia()).toBe('LOVE');
      expect(total()).toBe(antes);
    });

    it('límite: cada actor tiene su propia reacción', () => {
      const antes = total();

      reaccionar('SUPPORT', otra);

      expect(total()).toBe(antes + 1);
      expect(propia()).toBe('LOVE');
    });
  });

  describe('DELETE /community/reactions — la baja', () => {
    const quitar = (quien = actor) =>
      call<{ removed: boolean }>('DELETE', '/community/reactions', {
        query: `actorProfileId=${quien}&reactableType=POST&reactableRefId=${post.id}`,
      });

    it('correcto: quita la reacción propia y baja el total', () => {
      const antes = total();

      const r = quitar();

      expect(r.body).toEqual({ removed: true });
      expect(propia()).toBeUndefined();
      expect(total()).toBe(antes - 1);
    });

    it('límite: quitar lo que no estaba es `removed: false`, no un error', () => {
      const antes = total();

      const r = quitar();

      expect(r.status).toBe(200);
      expect(r.body).toEqual({ removed: false });
      expect(total()).toBe(antes);
    });

    it('límite: quitar la de un actor no toca la de otro', () => {
      expect(publicaciones.get(post.id)!.reaccionDelActor[otra]).toBe('SUPPORT');

      quitar();

      expect(publicaciones.get(post.id)!.reaccionDelActor[otra]).toBe('SUPPORT');
    });

    it('inválido: una publicación que no existe tampoco es error', () => {
      const r = call<{ removed: boolean }>('DELETE', '/community/reactions', {
        query: `actorProfileId=${actor}&reactableType=POST&reactableRefId=no-existe`,
      });

      expect(r.body).toEqual({ removed: false });
    });
  });

  describe('DELETE /community/follows y /bookmarks — la clave viaja por query', () => {
    const seguido = vitrinas.todos()[7]!.id;

    it('seguir, listar, dejar de seguir (por query) y no aparecer más', () => {
      call('POST', '/community/follows', {
        body: { followerProfileId: actor, followableType: 'PROFILE', followableRefId: seguido },
      });
      const lista = () =>
        call<{ items: { followableRefId: string }[] }>('GET', '/community/follows', { query: `followerProfileId=${actor}` }).body.items.map(
          (i) => i.followableRefId,
        );
      expect(lista()).toContain(seguido);

      const r = call<{ removed: boolean }>('DELETE', '/community/follows', {
        query: `followerProfileId=${actor}&followableType=PROFILE&followableRefId=${seguido}`,
      });

      expect(r.body).toEqual({ removed: true });
      expect(lista()).not.toContain(seguido);
    });

    it('límite: dejar de seguir a quien no se seguía es `removed: false`', () => {
      const r = call<{ removed: boolean }>('DELETE', '/community/follows', {
        query: `followerProfileId=${actor}&followableType=PROFILE&followableRefId=${seguido}`,
      });

      expect(r.body).toEqual({ removed: false });
    });

    it('guardar, listar, quitar (por query) y no aparecer más', () => {
      call('POST', '/community/bookmarks', {
        body: { profileId: actor, bookmarkableType: 'POST', bookmarkableRefId: post.id },
      });
      const lista = () =>
        call<{ items: { bookmarkableRefId: string }[] }>('GET', '/community/bookmarks', { query: `profileId=${actor}` }).body.items.map(
          (i) => i.bookmarkableRefId,
        );
      expect(lista()).toContain(post.id);

      const r = call<{ removed: boolean }>('DELETE', '/community/bookmarks', {
        query: `profileId=${actor}&bookmarkableType=POST&bookmarkableRefId=${post.id}`,
      });

      expect(r.body).toEqual({ removed: true });
      expect(lista()).not.toContain(post.id);
    });
  });
});
