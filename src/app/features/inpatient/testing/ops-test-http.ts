import { HttpErrorResponse, HttpResponse, provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import { signal, type EnvironmentProviders, type Provider } from '@angular/core';
import { of, throwError } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { registerInfrastructure } from '../../../core/mock/handlers/infrastructure.handlers';
import { registerInfrastructureOps } from '../../../core/mock/handlers/infrastructure-ops.handlers';
import { registrarPracticas } from '../../../core/mock/handlers/practice.handlers';
import { isMockReply, MockRouter } from '../../../core/mock/mock-router';
import { buscarUsuario } from '../../../core/mock/mock-session';

/**
 * Ayuda **sólo de pruebas**: monta `HttpClient` contra los simuladores de
 * infraestructura (F1) y de operación (F2) —los mismos que usa la maqueta—, sin
 * red y sin latencia, y deja forzar un fallo por ruta (`0` = sin conexión).
 */
export interface OpsRequest {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string | null>>;
}

const ERROR_BODY: Readonly<Record<number, { code: string; message: string }>> = {
  403: { code: 'FORBIDDEN', message: 'Su rol no permite esto.' },
  404: { code: 'NOT_FOUND', message: 'No encontrado' },
  500: { code: 'INTERNAL', message: 'Falla interna' },
};

export function opsHttp(options: { failures?: () => Record<string, number> } = {}): {
  readonly providers: (Provider | EnvironmentProviders)[];
  readonly requests: OpsRequest[];
} {
  const router = new MockRouter();
  registerInfrastructure(router);
  registerInfrastructureOps(router);
  registrarPracticas(router);
  const user = buscarUsuario('admin')!;
  const requests: OpsRequest[] = [];

  const record = (req: Parameters<HttpInterceptorFn>[0], status: number, body?: unknown): void => {
    requests.push({
      method: req.method,
      url: req.urlWithParams,
      status,
      body: req.body === null ? null : JSON.parse(JSON.stringify(req.body)),
      headers: { 'If-Match': req.headers.get('If-Match'), 'If-Match-Ops': req.headers.get('If-Match-Ops') },
    });
    void body;
  };

  const interceptor: HttpInterceptorFn = (req) => {
    const path = req.url.split('?')[0]!;
    const forced = options.failures?.()[`${req.method} ${path}`] ?? options.failures?.()[`${req.method} *${path.replace(/[0-9a-f-]{36}/g, ':id')}`];
    if (forced === 0) {
      record(req, 0);
      return throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }));
    }
    if (forced !== undefined) {
      record(req, forced);
      const base = ERROR_BODY[forced] ?? ERROR_BODY[500]!;
      return throwError(
        () => new HttpErrorResponse({ status: forced, error: { statusCode: forced, ...base, correlationId: 'req-forzado', timestamp: '', path } }),
      );
    }
    const match = router.match(req.method as 'GET', path);
    if (match === null) throw new Error(`Sin ruta simulada: ${req.method} ${path}`);
    const result = match.handler({
      method: req.method as 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(req.params.toString()),
      body: req.body,
      headers: req.headers,
      user,
    });
    const reply = isMockReply(result) ? result : { status: 200, body: result };
    record(req, reply.status);
    if (reply.status >= 400) return throwError(() => new HttpErrorResponse({ status: reply.status, error: reply.body }));
    return of(new HttpResponse({ status: reply.status, body: structuredClone(reply.body) }));
  };

  const session = {
    activeTenantId: signal<string | null>('tenant-de-prueba'),
    roles: signal(user.roles),
    isAuthenticated: () => true,
    userId: () => 'usuario-de-prueba',
  };

  return {
    providers: [provideHttpClient(withInterceptors([interceptor])), { provide: SessionStore, useValue: session }],
    requests,
  };
}
