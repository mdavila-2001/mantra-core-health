import { HttpErrorResponse, HttpHeaders, HttpResponse, provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { of, throwError } from 'rxjs';

import { environment } from '../environments/environment';
import { ACCESS_CHALLENGE_RESOLVER } from '../app/core/access-challenge/access-challenge';
import { accessChallengeInterceptor } from '../app/core/http/access-challenge.interceptor';
import { AccessChallengeService } from '../app/features/access-governance/access-challenge/access-challenge.service';
import { contractViolations, validationFailedBody } from '../app/core/mock/contract/contract-validator';
import { crearRouterSimulado } from '../app/core/mock/handlers';
import { isMockReply, type MockMethod, type MockRequest } from '../app/core/mock/mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, type MockUser } from '../app/core/mock/mock-session';

/* ============================================================================
    El backend simulado del gobierno de accesos, **sin latencia**, para specs de componente.

    Hace lo que `mockBackendInterceptor` pero síncrono y con la persona elegida: las peticiones del componente salen por el
    `HttpClient` real, pasan por la validación de contrato (`forbidNonWhitelisted`, como la API) y las atiende el mismo
    enrutador del simulador. Así «UI → petición → respuesta → recarga → UI» se demuestra con los manejadores de verdad.

    Cada spec que lo use llama `reiniciarElGobiernoDeAccesos()` en `beforeEach` (`isolate: false`).
   ========================================================================== */

export interface PeticionAtendida {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly status: number;
  /** El `X-Approval-Id` con que llegó la petición, si lo traía. */
  readonly approvalId?: string;
}

/** Lo que el simulador atendió, en orden. Se vacía con `olvidarPeticiones()`. */
export const peticiones: PeticionAtendida[] = [];

export function olvidarPeticiones(): void {
  peticiones.length = 0;
}

export interface OpcionesDelSimulador {
  /** Pone delante `accessChallengeInterceptor`: las peticiones con `withAccessChallenge()` resuelven sus desafíos como en la aplicación. */
  readonly desafios?: boolean;
}

/** Proveedores de `HttpClient` cuyas peticiones atiende el simulador como la persona `cuenta` (`hospital_piloto`, `sofia`, `ana`…). */
export function provideGovernanceMock(cuenta: string | MockUser, opciones: OpcionesDelSimulador = {}): (Provider | EnvironmentProviders)[] {
  const router = crearRouterSimulado();
  const usuario = typeof cuenta === 'string' ? buscarUsuario(cuenta) : cuenta;
  if (usuario === undefined) throw new Error(`No existe la cuenta simulada «${typeof cuenta === 'string' ? cuenta : cuenta.displayName}».`);

  const interceptor: HttpInterceptorFn = (request) => {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    let path = base !== '' && request.url.startsWith(base) ? request.url.slice(base.length) : request.url;
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.split('?')[0]!;
    const method = request.method.toUpperCase() as MockMethod;

    const responder = (status: number, body: unknown) => {
      const approvalId = request.headers.get('X-Approval-Id');
      peticiones.push({ method, path, body: request.body, status, ...(approvalId === null ? {} : { approvalId }) });
      const headers = new HttpHeaders({ 'x-mock-backend': '1' });
      if (status >= 400) return throwError(() => new HttpErrorResponse({ status, statusText: 'Mock', url: request.url, headers, error: body }));
      return of(new HttpResponse({ status, statusText: 'OK', url: request.url, headers, body: body === null || typeof body !== 'object' ? body : structuredClone(body) }));
    };

    const rechazo = contractViolations(method, path, request.body);
    if (rechazo !== null && rechazo.length > 0) return responder(400, validationFailedBody(rechazo));

    const coincidencia = router.match(method, path);
    if (coincidencia === null) return responder(501, { statusCode: 501, code: 'NOT_IMPLEMENTED', message: `Sin manejador: ${method} ${path}` });
    const peticion: MockRequest = {
      method,
      path,
      params: coincidencia.params,
      query: new URLSearchParams(request.params.toString()),
      body: request.body,
      headers: request.headers.has('X-Tenant-Id') ? request.headers : request.headers.set('X-Tenant-Id', TENANT_HOSPITAL_PILOTO),
      user: usuario,
    };
    const resultado = coincidencia.handler(peticion);
    return isMockReply(resultado) ? responder(resultado.status, resultado.body) : responder(200, resultado);
  };

  if (opciones.desafios !== true) return [provideHttpClient(withInterceptors([interceptor]))];
  // Como en `app.config.ts`: el interceptor de desafíos va delante del simulador y quien los resuelve es `AccessChallengeService`.
  return [provideHttpClient(withInterceptors([accessChallengeInterceptor, interceptor])), { provide: ACCESS_CHALLENGE_RESOLVER, useExisting: AccessChallengeService }];
}
