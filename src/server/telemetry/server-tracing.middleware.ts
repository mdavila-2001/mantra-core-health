import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from '@opentelemetry/api';
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} from '@opentelemetry/semantic-conventions';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Nombre del span del render. Ver `docs/observability/angular/02-naming-conventions.md`. */
const SSR_RENDER = 'ssr.render';

/**
 * Un span por petición que renderiza el motor de Angular.
 *
 * ## Lo que hace que sirva: continúa la traza del navegador
 *
 * Si la petición trae `traceparent`, este span **cuelga de ella**. Es lo que
 * permite ver, en una sola traza, que alguien pidió una página, que el servidor
 * tardó en renderizarla y que después el navegador tardó en hidratarla. Sin
 * `propagation.extract`, el render sería una traza aparte y esa relación habría
 * que adivinarla comparando marcas de tiempo.
 *
 * ## Qué no se lee de la petición
 *
 * Ni cookies, ni `Authorization`, ni el cuerpo, ni el query string. De la URL
 * solo el `path`, y con la misma razón que en el navegador: dos rutas de esta
 * aplicación llevan un token de un solo uso en el query string, y los enlaces
 * de correo se abren contra el servidor.
 *
 * ## Qué queda fuera
 *
 * Los estáticos. El middleware se registra **después** de `express.static`, así
 * que un `.js` o una tipografía no producen span. Son la mayoría de las
 * peticiones y no dicen nada que valga un span cada una.
 */
export function serverTracingMiddleware(): RequestHandler {
  const tracer = trace.getTracer('mantra-core-health/ssr');

  return (request: Request, response: Response, next: NextFunction): void => {
    /**
     * El contexto del navegador, si vino. `propagation.extract` valida el
     * formato: una cabecera malformada —o inventada por quien llame— produce un
     * contexto vacío y la traza empieza acá, en vez de heredar un identificador
     * que no significa nada.
     */
    const parent = propagation.extract(context.active(), request.headers);

    const span = tracer.startSpan(
      SSR_RENDER,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ATTR_HTTP_REQUEST_METHOD]: request.method,
          [ATTR_URL_PATH]: pathOf(request.originalUrl),
          [ATTR_URL_SCHEME]: request.protocol,
          'app.route.template': pathOf(request.originalUrl),
        },
      },
      parent,
    );

    /**
     * `finish` en vez de `close`: `finish` se emite cuando la respuesta se
     * mandó entera, que es lo que se quiere medir. `close` llega también cuando
     * quien pidió se desconectó a mitad, y mediría hasta ese abandono.
     */
    response.on('finish', () => endSpan(span, response.statusCode));
    response.on('error', (error: Error) => {
      span.setAttribute('error.type', error.name);
      endSpan(span, response.statusCode);
    });

    /**
     * El resto de la cadena corre **dentro** del contexto del span. En Node el
     * gestor de contexto usa `AsyncLocalStorage`, así que esto sí sobrevive a
     * los `await` del render: cualquier span que se abra durante el renderizado
     * cuelga de éste sin que haya que pasarlo.
     */
    context.with(trace.setSpan(parent, span), () => next());
  };
}

function endSpan(span: Span, statusCode: number): void {
  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode);
  span.setStatus({
    /**
     * Solo el 5xx es error del servidor. Un 404 es una respuesta correcta a una
     * pregunta equivocada, y marcarlo en rojo llenaría el panel de fallos que
     * nadie puede arreglar.
     */
    code: statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
  });
  span.end();
}

/** La ruta, sin query ni fragmento. */
function pathOf(url: string): string {
  const [path = ''] = url.split('?');
  const [clean = ''] = path.split('#');
  return clean === '' ? '/' : clean;
}
