import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { timeout, catchError, throwError, TimeoutError, type Observable } from 'rxjs';

import { ACCESS_CHALLENGE } from '../access-challenge/access-challenge';

/**
 * Cuánto se espera una respuesta antes de darla por perdida.
 *
 * Treinta segundos es generoso para una API que responde en milisegundos, y
 * corto comparado con el minuto largo que un navegador aguanta por su cuenta.
 * La diferencia importa: sin timeout, una API que acepta la conexión y no
 * contesta deja la interfaz en S2 —cargando— indefinidamente, que es el peor
 * estado posible porque no ofrece nada que hacer.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * La subida de archivos aguanta más: un documento de 10 MB por una conexión
 * móvil no cabe en treinta segundos, y cortarla sería fallar por impaciencia
 * algo que iba bien.
 */
export const UPLOAD_TIMEOUT_MS = 120_000;

/** Rutas que necesitan más margen del habitual. */
const RUTAS_LENTAS: readonly string[] = ['/common/files/upload'];

/**
 * Pone un límite de espera a toda petición y traduce el vencimiento a algo que
 * la aplicación ya sabe mostrar.
 *
 * ## Por qué un `HttpErrorResponse` con estado 0
 *
 * `timeout` de RxJS emite un `TimeoutError`, que `errorToViewState` no
 * reconocería: caería en el `unexpectedError` genérico —S9— y pediría un
 * identificador de petición que no existe, porque la petición nunca terminó.
 *
 * Traducirlo a un `HttpErrorResponse` con `status: 0` lo mete por el camino que
 * ya existe: **S8, sin conexión, con botón de reintentar**. Que es exactamente
 * lo que pasó desde el punto de vista de quien mira la pantalla — la respuesta
 * no llegó.
 *
 * ## Sobre la cancelación
 *
 * No hace falta código: `HttpClient` cancela la petición cuando se cierra la
 * suscripción, y Angular cierra las de un componente destruido si se usa
 * `takeUntilDestroyed` o el pipe `async`. Lo que este interceptor agrega es el
 * caso que ninguna de esas cosas cubre: la petición que **nadie cancela porque
 * la pantalla sigue ahí, esperando**.
 */
export const timeoutInterceptor: HttpInterceptorFn = (request, next) => {
  // Las peticiones marcadas con `withAccessChallenge()` pueden esperar a una **persona** (motivo, código de la app
  // autenticadora, aprobación de otra persona: minutos). Su límite lo pone `accessChallengeInterceptor` alrededor de
  // cada ida a la red y no de la espera del diálogo (F1): si el límite cubriera el diálogo, se destruiría a los 30 s,
  // se perdería la aprobación y la pantalla diría «sin conexión».
  if (request.context.get(ACCESS_CHALLENGE) !== null) return next(request);
  return conLimiteDeEspera(request, next(request));
};

/** El límite de espera de una petición (más largo para las subidas de archivos). */
export function limiteDeEsperaMs(request: HttpRequest<unknown>): number {
  return RUTAS_LENTAS.some((ruta) => request.url.includes(ruta))
    ? UPLOAD_TIMEOUT_MS
    : DEFAULT_TIMEOUT_MS;
}

/**
 * Pone el límite de espera a **una ida a la red** y traduce el vencimiento a `HttpErrorResponse` de estado 0. Lo usa
 * `timeoutInterceptor` para toda petición y `accessChallengeInterceptor` para cada `next(req)` de las marcadas.
 */
export function conLimiteDeEspera<T extends HttpEvent<unknown>>(
  request: HttpRequest<unknown>,
  respuesta: Observable<T>,
): Observable<T> {
  const limite = limiteDeEsperaMs(request);
  return respuesta.pipe(
    timeout(limite),
    catchError((error: unknown) => {
      if (error instanceof TimeoutError) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              statusText: 'Timeout',
              url: request.url,
              error: new Error(`La petición superó los ${limite / 1000} segundos.`),
            }),
        );
      }
      return throwError(() => error);
    }),
  );
}
