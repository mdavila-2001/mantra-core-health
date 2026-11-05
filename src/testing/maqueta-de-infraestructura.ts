import { HttpHeaders } from '@angular/common/http';
import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';

import { registrarInfraestructura } from '../app/core/mock/handlers/infrastructure.handlers';
import { registrarProcedimientos } from '../app/core/mock/handlers/procedures.handlers';
import { isMockReply, MockRouter, type MockMethod } from '../app/core/mock/mock-router';
import { buscarUsuario, TENANT_HOSPITAL } from '../app/core/mock/mock-session';

/**
 * Contesta las peticiones pendientes de `HttpTestingController` con el
 * **simulador real** de F1, como lo haría el interceptor de la maqueta.
 *
 * Así las pruebas de pantalla corren contra datos con la forma del contrato
 * —catálogo, estructura, bloqueos— y no contra objetos armados a mano que
 * pueden divergir sin que nadie lo note.
 */
export class MaquetaDeInfraestructura {
  private readonly router = new MockRouter();

  constructor(
    private readonly usuario = buscarUsuario('superadmin')!,
    private readonly tenant: string | null = TENANT_HOSPITAL,
  ) {
    registrarProcedimientos(this.router);
    registrarInfraestructura(this.router);
  }

  /** Responde una petición. Devuelve el estado HTTP que se usó. */
  responder(req: TestRequest): number {
    const metodo = req.request.method as MockMethod;
    const url = new URL(req.request.urlWithParams, 'http://x');
    const match = this.router.match(metodo, url.pathname);
    if (match === null) throw new Error(`La maqueta no conoce ${metodo} ${url.pathname}`);
    let headers = new HttpHeaders();
    for (const clave of req.request.headers.keys()) headers = headers.set(clave, req.request.headers.get(clave)!);
    if (this.tenant !== null) headers = headers.set('X-Tenant-Id', this.tenant);
    const respuesta = match.handler({
      method: metodo,
      path: url.pathname,
      params: match.params,
      query: url.searchParams,
      body: req.request.body,
      headers,
      user: this.usuario,
    });
    if (isMockReply(respuesta)) {
      req.flush(respuesta.body as object | null, { status: respuesta.status, statusText: respuesta.status >= 400 ? 'Error' : 'OK' });
      return respuesta.status;
    }
    req.flush(respuesta as object);
    return 200;
  }

  /** Responde todo lo pendiente, en tandas, hasta que no quede nada. */
  responderTodo(http: HttpTestingController, alCambiar: () => void = () => undefined, vueltas = 6): void {
    for (let i = 0; i < vueltas; i++) {
      const pendientes = http.match(() => true);
      if (pendientes.length === 0) return;
      for (const req of pendientes) this.responder(req);
      alCambiar();
    }
  }
}
