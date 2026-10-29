import { HttpErrorResponse, HttpResponse, provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import { signal, type EnvironmentProviders, type Provider } from '@angular/core';
import { of, throwError } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { registerInfrastructure } from '../../../../../core/mock/handlers/infrastructure.handlers';
import { isMockReply, MockRouter } from '../../../../../core/mock/mock-router';
import { buscarUsuario } from '../../../../../core/mock/mock-session';

/**
 * Ayuda **sólo de pruebas**: monta `HttpClient` contra el simulador de
 * infraestructura, sin red y sin latencia, para que los componentes se prueben
 * contra las mismas respuestas y los mismos errores que la maqueta — no contra
 * dobles que digan lo que la prueba quiere oír.
 *
 * Registra cada petición en `peticiones` para poder afirmar qué salió.
 */
export interface PeticionVista {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly ifMatch: string | null;
}

export function infraHttp(clave: 'superadmin' | 'medica' = 'superadmin', opciones: { fallos?: () => Record<string, number>; sinOrganizacion?: boolean } = {}): {
  readonly providers: (Provider | EnvironmentProviders)[];
  readonly peticiones: PeticionVista[];
} {
  const router = new MockRouter();
  registerInfrastructure(router);
  const usuario = buscarUsuario(clave)!;
  const peticiones: PeticionVista[] = [];

  const interceptor: HttpInterceptorFn = (req) => {
    const path = req.url.split('?')[0]!;
    const forzado = opciones.fallos?.()[`${req.method} ${path}`];
    if (forzado === 0) {
      peticiones.push({ method: req.method, url: req.urlWithParams, status: 0, body: req.body === null ? null : JSON.parse(JSON.stringify(req.body)), ifMatch: req.headers.get('If-Match') });
      return throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    }
    const match = router.match(req.method as 'GET', path);
    if (match === null) throw new Error(`Sin ruta simulada: ${req.method} ${path}`);
    const resultado = match.handler({
      method: req.method as 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(req.params.toString()),
      body: req.body,
      headers: req.headers,
      user: usuario,
    });
    const reply = isMockReply(resultado) ? resultado : { status: 200, body: resultado };
    peticiones.push({ method: req.method, url: req.urlWithParams, status: reply.status, body: req.body === null ? null : JSON.parse(JSON.stringify(req.body)), ifMatch: req.headers.get('If-Match') });
    if (reply.status >= 400) {
      return throwError(() => new HttpErrorResponse({ status: reply.status, error: reply.body }));
    }
    return of(new HttpResponse({ status: reply.status, body: structuredClone(reply.body) }));
  };

  const sesion = {
    activeTenantId: signal<string | null>(opciones.sinOrganizacion === true ? null : 'tenant-de-prueba'),
    roles: signal(usuario.roles),
  };

  return {
    providers: [provideHttpClient(withInterceptors([interceptor])), { provide: SessionStore, useValue: sesion }],
    peticiones,
  };
}
