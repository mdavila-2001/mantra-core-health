import { HttpHeaders } from '@angular/common/http';

import { vitrinas } from '../fixtures/comunidad';
import { MockRouter, isMockReply, validation, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarComunidad } from './community.handlers';
import { registrarArchivos } from './files.handlers';

const INVALID = validation('').status;

/**
 * `POST /community/profiles/:id/posts` con `media[]` — las imágenes de un
 * artículo médico en la maqueta.
 *
 * - **correcto**: las imágenes subidas vuelven en el detalle con su `fileId`
 *   real, su descripción y en el orden de `ordinal` (que es a lo que apunta la
 *   referencia `imagen:N` del cuerpo);
 * - **límite**: los mismos topes que el DTO (20 000 caracteres, 20 imágenes).
 */
describe('POST /community/profiles/:id/posts con imágenes (maqueta)', () => {
  const router = new MockRouter();
  registrarArchivos(router);
  registrarComunidad(router);

  function call<T>(method: MockMethod, path: string, body: unknown = {}): { status: number; body: T } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: buscarUsuario('medica')!,
    });
    return isMockReply(result) ? { status: result.status, body: result.body as T } : { status: 200, body: result as T };
  }

  function subir(nombre: string): string {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(4)], nombre, { type: 'image/png' }));
    form.append('category', 'IMAGE');
    return call<{ id: string }>('POST', '/common/files/upload', form).body.id;
  }

  const perfil = vitrinas.todos()[0]!.id;

  it('devuelve las imágenes con su archivo, su descripción y en orden', () => {
    const a = subir('a.png');
    const b = subir('b.png');
    const creado = call<{ id: string }>('POST', `/community/profiles/${perfil}/posts`, {
      bodyText: '## Uno\n\n![B](imagen:1)\n\n![A](imagen:0)',
      hashtags: ['articulo-medico'],
      media: [
        { fileId: b, mediaRole: 'IMAGE', altText: 'B', ordinal: 1 },
        { fileId: a, mediaRole: 'IMAGE', altText: 'A', ordinal: 0 },
      ],
    });
    expect(creado.status).toBe(201);

    const detalle = call<{ media: { fileId: string; altText: string; ordinal: number }[] }>(
      'GET',
      `/community/posts/${creado.body.id}`,
    ).body;
    expect(detalle.media.map((m) => [m.fileId, m.altText, m.ordinal])).toEqual([
      [a, 'A', 0],
      [b, 'B', 1],
    ]);
  });

  it('rechaza lo que el DTO real rechaza', () => {
    const largo = call('POST', `/community/profiles/${perfil}/posts`, { bodyText: 'x'.repeat(20001) });
    expect(largo.status).toBe(INVALID);

    const media = Array.from({ length: 21 }, (_, i) => ({ fileId: `f-${i}`, ordinal: i }));
    const muchas = call('POST', `/community/profiles/${perfil}/posts`, { bodyText: 'hola', media });
    expect(muchas.status).toBe(INVALID);
  });
});
