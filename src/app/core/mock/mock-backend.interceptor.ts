import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { from, Observable, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { apiRealForzada } from './modo-api';
import { isMockReply, type MockMethod, type MockReply, type MockRequest, type MockRouter } from './mock-router';
import { usuarioDeAccessToken } from './mock-session';

/* ============================================================================
    El backend simulado.

    Va al **final** de la cadena de interceptores: para cuando la petición llega
    acá ya pasó por trazas, tiempo de espera y credenciales, así que la
    aplicación se comporta exactamente igual que contra la API real — sólo que
    la respuesta sale de la memoria en vez de la red.

    Todo lo que no coincide con una ruta declarada cae en `respuestaGenerica`,
    que devuelve una forma plausible y lo deja anotado en la consola para que
    se vea qué falta cubrir.
    ========================================================================== */

/**
 * Los manejadores y sus fixtures pesan cerca de medio megabyte, así que se
 * cargan en un trozo aparte la primera vez que hace falta y no en el paquete
 * inicial: la aplicación arranca igual de rápido que contra la API real y el
 * presupuesto de tamaño del build sigue cumpliéndose.
 */
let router: Promise<MockRouter> | null = null;

function routerSimulado(): Promise<MockRouter> {
  router ??= import('./handlers').then((m) => m.crearRouterSimulado());
  return router;
}

export const mockBackendInterceptor: HttpInterceptorFn = (request, next) => {
  // `apiRealForzada` es el interruptor del stock de componentes: deja pasar la
  // petición a la red para poder comparar una pantalla con datos simulados y
  // con datos de verdad. Apagado por omisión y sin persistir. Ver `modo-api.ts`.
  if (!environment.mockBackend || apiRealForzada()) {
    return next(request);
  }

  const path = rutaDeApi(request.url);
  if (path === null) {
    return next(request);
  }

  return from(routerSimulado()).pipe(mergeMap((tabla) => atender(tabla, request, path)));
};

function atender(router: MockRouter, request: HttpRequest<unknown>, path: string): Observable<HttpEvent<unknown>> {
  const method = request.method.toUpperCase() as MockMethod;
  const coincidencia = router.match(method, path);
  const query = new URLSearchParams(request.params.toString());
  const user = usuarioDe(request);
  const peticion: MockRequest = {
    method,
    path,
    params: coincidencia?.params ?? {},
    query,
    body: request.body,
    headers: request.headers,
    user,
  };

  let respuesta: MockReply;
  try {
    if (coincidencia === null) {
      respuesta = respuestaGenerica(peticion);
    } else {
      const resultado = coincidencia.handler(peticion);
      respuesta = isMockReply(resultado) ? resultado : { status: 200, body: resultado };
    }
  } catch (error: unknown) {
    console.error('[mock] el manejador falló', method, path, error);
    respuesta = { status: 500, body: { statusCode: 500, message: 'Fallo del backend simulado' } };
  }

  return timer(latencia(path)).pipe(mergeMap(() => emitir(request, respuesta)));
}

function emitir(request: HttpRequest<unknown>, respuesta: MockReply): Observable<HttpEvent<unknown>> {
  const headers = new HttpHeaders({ 'x-mock-backend': '1', ...(respuesta.headers ?? {}) });
  if (respuesta.status >= 400) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: respuesta.status,
          statusText: 'Mock',
          url: request.url,
          headers,
          error: respuesta.body,
        }),
    );
  }
  return of(
    new HttpResponse({
      status: respuesta.status,
      statusText: 'OK',
      url: request.url,
      headers,
      body: adaptarCuerpo(request, respuesta.body),
    }),
  );
}

/** Un `responseType: 'blob'` espera bytes, no un objeto. */
function adaptarCuerpo(request: HttpRequest<unknown>, body: unknown): unknown {
  if (request.responseType === 'blob') {
    if (body instanceof Blob) return body;
    if (typeof body === 'string' && body.startsWith('data:')) {
      return dataUrlABlob(body);
    }
    return new Blob([typeof body === 'string' ? body : JSON.stringify(body ?? '')], {
      type: 'application/octet-stream',
    });
  }
  if (request.responseType === 'text') {
    return typeof body === 'string' ? body : JSON.stringify(body ?? '');
  }
  return body;
}

function dataUrlABlob(dataUrl: string): Blob {
  const [cabecera, contenido = ''] = dataUrl.split(',', 2);
  const tipo = /^data:([^;,]+)/.exec(cabecera ?? '')?.[1] ?? 'application/octet-stream';
  if ((cabecera ?? '').includes(';base64')) {
    const binario = atob(contenido);
    return new Blob([Uint8Array.from(binario, (c) => c.charCodeAt(0))], { type: tipo });
  }
  return new Blob([decodeURIComponent(contenido)], { type: tipo });
}

/**
 * La ruta de la API sin la raíz, o `null` si la petición no es de la API
 * (recursos estáticos, telemetría, un dominio ajeno).
 */
function rutaDeApi(url: string): string | null {
  const base = environment.apiBaseUrl.replace(/\/$/, '');
  let path: string;
  if (base !== '' && url.startsWith(base)) {
    path = url.slice(base.length);
  } else if (/^https?:\/\//.test(url)) {
    return null;
  } else {
    path = url;
  }
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.startsWith('/assets') || path.startsWith('/otel') || /\.[a-z0-9]{2,5}(\?|$)/i.test(path)) {
    return null;
  }
  return path.split('?')[0]!;
}

function usuarioDe(request: HttpRequest<unknown>) {
  const autorizacion = request.headers.get('Authorization') ?? '';
  const token = autorizacion.startsWith('Bearer ') ? autorizacion.slice(7) : null;
  return token === null ? null : (usuarioDeAccessToken(token) ?? null);
}

/** Un poco de espera, para que los estados de carga existan. */
function latencia(path: string): number {
  if (path.startsWith('/terminology')) return 40;
  return 120 + Math.floor(Math.random() * 180);
}

/**
 * Para lo que ninguna ruta cubre. Adivina la forma por el método y la
 * consulta: una lectura con `limit`/`cursor` es una página vacía; una
 * lectura suelta, un objeto vacío; una escritura, un eco con id.
 */
function respuestaGenerica(peticion: MockRequest): MockReply {
  console.warn(`[mock] sin manejador para ${peticion.method} ${peticion.path} — respuesta genérica`);
  if (peticion.method === 'GET') {
    const paginada = peticion.query.has('limit') || peticion.query.has('cursor');
    return {
      status: 200,
      body: paginada
        ? { items: [], count: 0, limit: Number(peticion.query.get('limit') ?? 20), nextCursor: null }
        : { items: [], count: 0 },
    };
  }
  if (peticion.method === 'DELETE') {
    return { status: 204, body: null };
  }
  const base = typeof peticion.body === 'object' && peticion.body !== null ? peticion.body : {};
  return {
    status: peticion.method === 'POST' ? 201 : 200,
    body: {
      id: `mock-${Date.now().toString(36)}`,
      ...base,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    },
  };
}
