import { HttpHeaders } from '@angular/common/http';

import { isMockReply, type MockRequest } from '../mock-router';
import { crearRouterSimulado } from './index';

/**
 * La pre-carga del logo del alta en el simulador. Se llama al manejador directo,
 * como `signature-and-seal.handlers.spec.ts`, para no depender de la capa HTTP.
 */
const router = crearRouterSimulado();
const ROUTE = '/iam/auth/upload-registration-logo';

function upload(body: unknown): unknown {
  const request = {
    method: 'POST',
    path: ROUTE,
    params: {},
    query: new URLSearchParams(),
    body,
    headers: new HttpHeaders(),
    user: null,
  } as unknown as MockRequest;
  return router.match('POST', ROUTE)!.handler(request);
}

function formWith(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

function fileOf(name: string, type: string, bytes: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('la pre-carga del logo del alta en el simulador', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])(
    'acepta %s sin sesión y devuelve el id a reenviar',
    (type) => {
      const response = upload(formWith(fileOf('logo', type, 1024)));

      expect(isMockReply(response) && response.status).toBe(201);
      const body = (response as { body: { fileId: string; mimeType: string } }).body;
      expect(body.fileId).not.toBe('');
      expect(body.mimeType).toBe(type);
    },
  );

  it('rechaza un PDF con 422', () => {
    const response = upload(formWith(fileOf('logo.pdf', 'application/pdf', 1024)));

    expect(isMockReply(response) && response.status).toBe(422);
  });

  it('rechaza una imagen de más de 2 MB con 413', () => {
    const response = upload(formWith(fileOf('logo.png', 'image/png', 3 * 1024 * 1024)));

    expect(isMockReply(response) && response.status).toBe(413);
  });

  it('sin archivo responde 422', () => {
    const response = upload(new FormData());

    expect(isMockReply(response) && response.status).toBe(422);
  });
});
