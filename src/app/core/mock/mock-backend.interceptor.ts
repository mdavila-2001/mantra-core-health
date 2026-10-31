import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { from, Observable, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { failureBody, failureFor, type SimulatedFailure } from './simulated-failures';
import { forcedRealApi } from './api-mode';
import { isMockReply, type MockMethod, type MockReply, type MockRequest, type MockRouter } from './mock-router';
import { bloqueoDelToken } from './mock-token-guard';
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

/** Carga diferida; el modo real no resuelve ni invoca este proveedor. */
export const MOCK_ROUTER_LOADER = new InjectionToken<() => Promise<MockRouter>>('MOCK_ROUTER_LOADER', {
  providedIn: 'root',
  factory: () => routerSimulado,
});

/**
 * El catálogo de claves del contrato (`contract/`), en su propio trozo: son
 * unos 260 kB generados desde el `openapi.json` de la API.
 */
type Validador = typeof import('./contract/contract-validator');
let validador: Promise<Validador> | null = null;

function validadorSimulado(): Promise<Validador> {
  validador ??= import('./contract/contract-validator');
  return validador;
}

export const mockBackendInterceptor: HttpInterceptorFn = (request, next) => {
  // `forcedRealApi` es el interruptor del stock de componentes: deja pasar la
  // petición a la red para poder comparar una pantalla con datos simulados y
  // con datos de verdad. Apagado por omisión y sin persistir. Ver `api-mode.ts`.
  if (!environment.mockBackend || forcedRealApi()) {
    return next(request);
  }

  const path = rutaDeApi(request.url);
  if (path === null) {
    return next(request);
  }

  return from(Promise.all([inject(MOCK_ROUTER_LOADER)(), validadorSimulado()])).pipe(
    mergeMap(([tabla, contrato]) => atender(tabla, contrato, request, path)),
  );
};

function atender(
  router: MockRouter,
  contrato: Validador,
  request: HttpRequest<unknown>,
  path: string,
): Observable<HttpEvent<unknown>> {
  const method = request.method.toUpperCase() as MockMethod;

  // El fallo a propósito va **antes** de buscar el manejador: lo que se quiere
  // mirar es la pantalla contra una petición que sale mal, no el manejador
  // devolviendo un error. Apagado salvo que la sesión lo declare; ver
  // `simulated-failures.ts`.
  const fallo = failureFor(method, path);
  if (fallo !== null) {
    return timer(latencia(path)).pipe(mergeMap(() => emitirFallo(request, path, fallo)));
  }

  // Lo que la API hace cumplir con el token antes de cualquier ruta: el alcance limitado del segundo factor
  // (403 `MFA_ENROLLMENT_REQUIRED`) y la organización que niega ahora a la persona (403 con su motivo).
  const cerrado = bloqueoDelToken(request, method, path);
  if (cerrado !== null) {
    return timer(latencia(path)).pipe(mergeMap(() => emitir(request, cerrado)));
  }

  // `forbidNonWhitelisted`, como la API: una clave que el DTO no declara es
  // un 400 acá también, y no recién en producción. Ver `contract/`.
  const rechazo = contrato.contractViolations(method, path, request.body);
  if (rechazo !== null && rechazo.length > 0) {
    console.warn(`[mock] ${method} ${path} no cumple el contrato de la API:`, rechazo.map((v) => v.messages[0]).join(' · '));
    return timer(latencia(path)).pipe(
      mergeMap(() => emitir(request, { status: 400, body: contrato.validationFailedBody(rechazo) })),
    );
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
      // Un manejador puede contestar más tarde —leer bytes guardados en
      // IndexedDB, por ejemplo—: la promesa se espera y se trata igual.
      if (resultado instanceof Promise) {
        return timer(latencia(path)).pipe(
          mergeMap(() => from(resultado as Promise<unknown>)),
          mergeMap((valor) => emitir(request, comoRespuesta(valor))),
        );
      }
      respuesta = comoRespuesta(resultado);
    }
  } catch (error: unknown) {
    console.error('[mock] el manejador falló', method, path, error);
    // Con el `code` del contrato, como el filtro de excepciones de la API: sin
    // él `readApiError` descarta el cuerpo y la pantalla no puede ramificar.
    respuesta = {
      status: 500,
      body: { statusCode: 500, code: 'INTERNAL', message: 'Fallo del backend simulado' },
    };
  }

  anotarEnElRegistro(method, path, request, respuesta);
  return timer(latencia(path)).pipe(mergeMap(() => emitir(request, respuesta)));
}

function comoRespuesta(resultado: unknown): MockReply {
  return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
}

/**
 * Registro de peticiones de la maqueta, **sólo si la sesión lo pide**
 * (`sessionStorage['mock:registrar'] = '1'`).
 *
 * La maqueta responde dentro de Angular, así que Playwright no ve ninguna
 * petición de red: sin esto, la cadena «UI → petición → respuesta» de una
 * prueba de mutación sólo se podía afirmar, no mostrar. Escrituras nada más
 * (las lecturas son ruido), con método, ruta, `If-Match`, cuerpo y estado.
 * Apagado por defecto y muere con la pestaña, igual que `mock:fallos`.
 */
function anotarEnElRegistro(method: MockMethod, path: string, request: HttpRequest<unknown>, respuesta: MockReply): void {
  if (method === 'GET' || typeof sessionStorage === 'undefined') return;
  try {
    if (sessionStorage.getItem('mock:registrar') !== '1') return;
    const previo: unknown = JSON.parse(sessionStorage.getItem('mock:registro') ?? '[]');
    const lista = Array.isArray(previo) ? previo.slice(-49) : [];
    lista.push({
      method,
      path,
      query: request.params.toString(),
      ifMatch: request.headers.get('If-Match'),
      // F2: los ejes operativos van con su propia versión.
      ifMatchOps: request.headers.get('If-Match-Ops'),
      body: request.body,
      status: respuesta.status,
      requestId: requestIdOf(respuesta.body),
      at: new Date().toISOString(),
    });
    sessionStorage.setItem('mock:registro', JSON.stringify(lista));
  } catch {
    // Almacenamiento lleno o bloqueado: el registro es una ayuda, no un requisito.
  }
}

/** El `requestId` (o `correlationId`) de una respuesta, para la cadena de evidencia. */
function requestIdOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as { requestId?: unknown; correlationId?: unknown };
  return typeof b.requestId === 'string' ? b.requestId : typeof b.correlationId === 'string' ? b.correlationId : null;
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
  fallo: SimulatedFailure,
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
  const { status, body } = failureBody(fallo, path);
  return emitir(request, { status, body });
}

/** Una petición que el simulador atendió, tal como la deja `window.__mockRequests`. */
export interface PeticionAtendida {
  readonly method: string;
  /** Ruta y query, sin el origen: `/surveys/insights?from=…&to=…`. */
  readonly url: string;
  readonly status: number;
  /** El cuerpo JSON enviado, o `null` si no lo había o no era JSON. */
  readonly body: unknown;
  /**
   * Lo que contestó el simulador, **solo** para el inicio de sesión y su renovación
   * (es lo único que una prueba no puede leer de otra forma: el token vive en memoria y
   * lo que demuestra qué claims llegan —el plazo de inactividad de la política de
   * sesión—) y para las rutas chicas de seguridad y de vínculos cuya **forma** es el
   * contrato con la API (dispositivos, segundo paso, redes y los vínculos de la persona).
   * El resto no se guarda: serían trescientas copias de fixtures grandes.
   */
  readonly response?: unknown;
  /** Lo que respondió, resumido: estado de la admisión, no el cuerpo entero. Solo JSON. */
  readonly respuesta?: unknown;
}

/** Las rutas de las que `window.__mockRequests` guarda también lo que contestó el simulador. */
const RESPUESTAS_RECORDADAS = /\/iam\/auth\/(login|token\/refresh)|\/org\/access\/simulate|\/iam\/me\/(devices|mfa)|\/org\/ip-access-rules|\/me\/support-engagements|\/me\/support-patients|\/me\/support-agenda|\/affiliation-invitations\/redeem/;

/** Cuántas peticiones recuerda `window.__mockRequests`: las últimas. */
const PETICIONES_RECORDADAS = 300;

/**
 * Anota la petición en `window.__mockRequests`.
 *
 * El simulador contesta dentro del navegador: no hay tráfico de red, y
 * `page.on('request')` de Playwright no ve nada. Sin este registro una prueba de
 * extremo a extremo contra el simulador no puede demostrar la mitad de «UI →
 * request → response → persistencia → recarga → UI»: qué se mandó y qué se
 * contestó. Sólo existe en el navegador y no cambia lo que recibe la pantalla.
 */
/** El cuerpo como JSON puro, o `null` si no había, era un archivo o no se pudo copiar. */
function cuerpoComoJson(cuerpo: unknown): unknown {
  if (cuerpo === null || cuerpo === undefined || cuerpo instanceof FormData) return null;
  try {
    return JSON.parse(JSON.stringify(cuerpo));
  } catch {
    return null;
  }
}

function anotarPeticion(request: HttpRequest<unknown>, status: number, cuerpoRespuesta?: unknown): void {
  if (typeof window === 'undefined') return;
  const global = window as unknown as { __mockRequests?: PeticionAtendida[] };
  const registro = (global.__mockRequests ??= []);
  const body = cuerpoComoJson(request.body);
  const base = environment.apiBaseUrl.replace(/\/$/, '');
  const url = base !== '' && request.urlWithParams.startsWith(base) ? request.urlWithParams.slice(base.length) : request.urlWithParams;
  const conRespuesta =
    RESPUESTAS_RECORDADAS.test(url) && status < 400 ? { response: cuerpoComoJson(cuerpoRespuesta) } : {};
  // Solo lo chico: guardar cada catálogo entero haría de esta lista un problema de memoria.
  const completa = cuerpoRespuesta instanceof Blob ? null : cuerpoComoJson(cuerpoRespuesta);
  const respuesta = completa !== null && JSON.stringify(completa).length <= 400_000 ? completa : null;
  registro.push({
    method: request.method.toUpperCase(),
    url,
    status,
    body,
    ...conRespuesta,
    ...(respuesta === null ? {} : { respuesta }),
  });
  if (registro.length > PETICIONES_RECORDADAS) registro.shift();
}

function emitir(request: HttpRequest<unknown>, respuesta: MockReply): Observable<HttpEvent<unknown>> {
  anotarPeticion(request, respuesta.status, respuesta.body);
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

/**
 * Una tabla por prefijo, no un azar (H2.S1.M1, 2026-09-22 — R-02).
 *
 * El generador aleatorio anterior (120 a 299 ms según la tirada) hacía que
 * la misma petición tardara distinto en cada corrida: ninguna medición era
 * repetible, y un E2E veía tiempos distintos cada vez que se ejecutaba. Los
 * estados de carga
 * siguen existiendo —el comentario original tenía razón en eso—, pero ahora
 * con un valor fijo y justificado por prefijo, no con una tirada de dados.
 *
 * **Mínimo elegido (Q-E1): 40 ms.** Es el valor que ya usaba `/terminology`
 * y que la maqueta viene mostrando como espera visible desde antes de esta
 * corrección; bajar de ahí no deja ver nada, así que ningún prefijo queda
 * por debajo. `/scheduling/slots` es la ruta caliente de «elegir médico»
 * (`practitioner-availability.ts`, hasta 2 llamadas por sede): se la deja en
 * el mínimo para no multiplicar la espera por la cantidad de sedes. El resto
 * de las lecturas va un escalón arriba porque trae más forma (perfiles,
 * catálogos), y la escritura genérica un escalón más porque simula ida y
 * vuelta con persistencia.
 */
const LATENCIA_POR_PREFIJO: readonly (readonly [string, number])[] = [
  ['/terminology', 40],
  ['/scheduling/slots', 40],
  ['/profiles', 90],
  // La calle de un punto: el estado «Buscando la calle de este punto…» tiene
  // que llegar a verse (y a capturarse), como la subida de documentos. 2,5 s
  // es un supuesto, no una medición: la API real espacia las consultas a una
  // por segundo y, si el primer proveedor cae, prueba un segundo. Con 800 ms
  // la respuesta llegaba en medio de la captura.
  ['/public/geo/reverse', 2500],
  // Cada parte de una subida de resultados: con la latencia por omisión, un
  // archivo de un giga (128 partes) tardaría 15 s sólo en esperas simuladas.
  ['/diagnostics/lab/result-uploads', 25],
];

/** La subida de documentos legales necesita quedarse el tiempo suficiente en
 * «subiendo» para que el estado se vea: el simulador no emite
 * `UploadProgress`, sólo la respuesta final, así que sin esto la barra
 * pasaría de vacía a lista sin que nadie llegara a verla. */
const LATENCIA_SUBIDA_DOCUMENTO = 600;

/** El resto: ni tan rápido que no se note, ni tan lento como el azar viejo
 * llegaba a ser (hasta 299 ms). */
const LATENCIA_POR_OMISION = 120;

function latencia(path: string): number {
  if (path === '/iam/auth/upload-registration-document') return LATENCIA_SUBIDA_DOCUMENTO;
  const prefijo = LATENCIA_POR_PREFIJO.find(([p]) => path.startsWith(p));
  return prefijo === undefined ? LATENCIA_POR_OMISION : prefijo[1];
}

/**
 * Para lo que ninguna ruta cubre (H2.S1.M1, 2026-09-26).
 *
 * **Ya no inventa un éxito.** Hasta acá, una lectura sin manejador devolvía
 * una página vacía y una escritura devolvía un eco con `status: 'ACTIVE'`:
 * cualquier recorrido de la maqueta salía verde aunque la API real rechazara
 * esa misma ruta con un 404. El 501 es la forma honesta — «esto no está
 * implementado en el simulador», no «esto funcionó» — y trae el mismo `code`
 * que ramifica `errorToViewState` (S9, con el path como identificador de
 * petición) en vez de uno que la aplicación no sepa interpretar.
 *
 * La ruta faltante queda anotada en `window.__mockGaps` (cuando existe
 * `window`, es decir, en el navegador) para poder recorrer la maqueta y juntar
 * de una sola vez todo lo que el simulador todavía no cubre.
 */
function respuestaGenerica(peticion: MockRequest): MockReply {
  const ruta = `${peticion.method} ${peticion.path}`;
  console.warn(`[mock] sin manejador para ${ruta} — 501`);
  if (typeof window !== 'undefined') {
    const global = window as unknown as { __mockGaps?: Set<string> };
    global.__mockGaps ??= new Set();
    global.__mockGaps.add(ruta);
  }
  return {
    status: 501,
    body: {
      statusCode: 501,
      code: 'NOT_IMPLEMENTED_IN_MOCK',
      message: `El simulador todavía no cubre ${ruta}.`,
      error: 'Not Implemented',
      path: peticion.path,
    },
  };
}
