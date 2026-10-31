import { HttpHeaders } from '@angular/common/http';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { crearRouterSimulado } from '../app/core/mock/handlers';
import { isMockReply, type MockMethod, type MockRouter } from '../app/core/mock/mock-router';
import { buscarUsuario, TENANT_HOSPITAL, type MockUser } from '../app/core/mock/mock-session';

/**
 * Contesta las peticiones de `HttpTestingController` con el **simulador
 * completo** (todos los handlers), como el interceptor de la maqueta.
 *
 * Lo usan las pruebas de pantalla de F4/F5, que leen de varios dominios a la
 * vez (organización, quirófanos, procedimientos, terminología, facturación):
 * armar respuestas a mano para cada uno divergiría del contrato sin aviso.
 */
export class FullMockBackend {
  private readonly router: MockRouter = crearRouterSimulado();

  constructor(
    private readonly user: MockUser = buscarUsuario('quirofano')!,
    private readonly tenant: string | null = TENANT_HOSPITAL,
  ) {}

  respond(req: TestRequest): number {
    const method = req.request.method as MockMethod;
    const url = new URL(req.request.urlWithParams, 'http://x');
    const match = this.router.match(method, url.pathname);
    if (match === null) {
      req.flush({ code: 'NOT_FOUND', message: 'sin ruta' }, { status: 404, statusText: 'Not Found' });
      return 404;
    }
    let headers = new HttpHeaders();
    for (const key of req.request.headers.keys()) headers = headers.set(key, req.request.headers.get(key)!);
    if (this.tenant !== null) headers = headers.set('X-Tenant-Id', this.tenant);
    const reply = match.handler({ method, path: url.pathname, params: match.params, query: url.searchParams, body: req.request.body, headers, user: this.user });
    if (isMockReply(reply)) {
      req.flush(reply.body as object | null, { status: reply.status, statusText: reply.status >= 400 ? 'Error' : 'OK' });
      return reply.status;
    }
    req.flush(reply as object);
    return 200;
  }

  /** Responde todo lo pendiente, en tandas. */
  respondAll(http: HttpTestingController, onChange: () => void = () => undefined, rounds = 8): void {
    for (let i = 0; i < rounds; i++) {
      const pending = http.match(() => true);
      if (pending.length === 0) return;
      for (const req of pending) this.respond(req);
      onChange();
    }
  }
}
