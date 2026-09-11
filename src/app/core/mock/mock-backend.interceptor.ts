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
import { cuerpoDelFallo, falloPara, type FalloSimulado } from './fallos-simulados';
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

  // El fallo a propósito va **antes** de buscar el manejador: lo que se quiere
  // mirar es la pantalla contra una petición que sale mal, no el manejador
  // devolviendo un error. Apagado salvo que la sesión lo declare; ver
  // `fallos-simulados.ts`.
  const fallo = falloPara(method, path);
  if (fallo !== null) {
    return timer(latencia(path)).pipe(mergeMap(() => emitirFallo(request, path, fallo)));
  }

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

/**
 * Emite un fallo declarado por la sesión.
 *
 * `red` se distingue de los demás y no es un capricho: el estado 0 es lo que
 * `errorToViewState` lee como «la petición no llegó» (S8), y es el único que no
 * tiene cuerpo ni código de contrato. Devolver un 500 en su lugar habría
 * mostrado el aviso equivocado, que es justo lo que esto viene a poder
 * distinguir.
 */
function emitirFallo(
  request: HttpRequest<unknown>,
  path: string,
  fallo: FalloSimulado,
): Observable<HttpEvent<unknown>> {
  if (fallo.modo === 'red') {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 0,
          statusText: 'Unknown Error',
          url: request.url,
          error: new ProgressEvent('error'),
        }),
    );
  }
  const { status, body } = cuerpoDelFallo(fallo, path);
  return emitir(request, { status, body });
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
      body: adaptarCuerpo(request, desconectar(respuesta.body)),
    }),
  );
}

/**
 * Corta la referencia entre lo que el simulador guarda y lo que la pantalla
 * recibe: una copia, como la que haría un `JSON.parse` del otro lado del cable.
 *
 * ## Por qué hace falta, y qué se rompía sin esto
 *
 * Los manejadores devuelven sus objetos **en vivo** —`plantillas.find(...)`
 * devuelve el objeto del array, no una copia—. Con un backend de verdad eso es
 * imposible: la respuesta viaja como texto y se vuelve a parsear, así que cada
 * lectura entrega un objeto nuevo.
 *
 * La diferencia no es teórica. Una señal de Angular compara con `Object.is`:
 * si una pantalla relee algo que no cambió de identidad, `signal.set()` no
 * detecta cambio y **nada se recalcula**. Eso es exactamente lo que pasaba en
 * «Formularios»: se agregaba un campo, el simulador lo guardaba, la pantalla
 * releía la plantilla... y recibía el mismo objeto, así que la lista seguía
 * mostrando lo de antes. El campo aparecía recién al salir y volver a entrar.
 *
 * Peor todavía: como la pantalla se quedaba con el objeto vivo, mutarlo desde
 * un manejador le cambiaba los datos por debajo sin pasar por ninguna señal.
 *
 * Se usa `structuredClone` cuando está y `JSON` como respaldo; lo que no se
 * puede clonar —un `Blob`, un `FormData`— se deja pasar tal cual, porque son
 * justo los cuerpos que no son datos.
 */
function desconectar(body: unknown): unknown {
  if (body === null || typeof body !== 'object') return body;
  if (body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) return body;
  try {
    return structuredClone(body);
  } catch {
    try {
      return JSON.parse(JSON.stringify(body)) as unknown;
    } catch {
      // Un cuerpo que no se puede serializar se entrega como está: romper la
      // respuesta sería peor que compartir la referencia.
      return body;
    }
  }
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
