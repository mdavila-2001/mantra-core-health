import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { RequestHandler } from 'express';

/**
 * El endpoint que el navegador usa para mandar sus trazas: `/otel/v1/traces`.
 *
 * ## Por qué existe en vez de apuntar el navegador al Collector
 *
 * Cuatro motivos, en orden de peso:
 *
 *   1. **La política de seguridad de contenido no se toca.** `connect-src` se
 *      queda en `'self'`. Un Collector en otro origen obligaría a abrirla, y
 *      `src/server/security-headers.ts` es una pieza que este proyecto se tomó
 *      el trabajo de cerrar bien.
 *   2. **No hay preflight.** Mismo origen, sin CORS y sin una petición
 *      `OPTIONS` extra por cada lote de spans.
 *   3. **El Collector no se publica.** Un Collector abierto a internet es un
 *      sumidero: cualquiera puede llenarlo de spans falsos, y no tiene forma de
 *      distinguirlos.
 *   4. **Aquí se pueden poner límites.** Tamaño, tipo de contenido y método.
 *      El Collector no los impone por sí solo.
 *
 * ## Lo que este endpoint NO es
 *
 * No está autenticado, y no puede estarlo: cualquier credencial que el
 * navegador usara viajaría dentro del paquete que descarga todo el mundo. Lo
 * que lo protege es que sea barato de rechazar —método, tipo y tamaño se miran
 * antes de reenviar nada— y que delante haya un límite de tasa. Ese límite es
 * de la infraestructura, no de este archivo; el runbook dice dónde ponerlo.
 */

/** Ruta pública. Coincide con `PUBLIC_TELEMETRY_TRACES_ENDPOINT` por defecto. */
export const OTEL_TRACES_PATH = '/otel/v1/traces';

/**
 * Tope del cuerpo.
 *
 * El exportador manda como mucho 64 spans por lote; en JSON eso son decenas de
 * kilobytes. Medio megabyte deja margen de sobra y corta en seco a quien intente
 * usar esto como sumidero de datos.
 */
export const MAX_BODY_BYTES = 512 * 1024;

/**
 * Reenvía el lote al Collector y responde 202 sin esperar.
 *
 * `202 Accepted` y no `200` es literal: la aceptación es de la recepción, no
 * del procesamiento. Y no se espera al Collector a propósito — el navegador no
 * tiene nada que hacer con esa respuesta, y hacerle esperar solo le ocuparía una
 * conexión.
 */
export function otelGateway(collectorUrl: string): RequestHandler {
  const target = new URL(`${collectorUrl.replace(/\/+$/, '')}/v1/traces`);
  const send = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).setHeader('Allow', 'POST');
      res.end();
      return;
    }

    /**
     * El exportador OTLP sobre HTTP manda JSON. Rechazar el resto evita que
     * esto se convierta en un reenviador de cualquier cosa hacia una dirección
     * interna, que es la forma en que un proxy inocente se vuelve un problema.
     */
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('application/json')) {
      res.status(415).end();
      return;
    }

    const declared = Number(req.headers['content-length'] ?? '0');
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      res.status(413).end();
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      size += chunk.length;

      /**
       * `Content-Length` puede mentir o faltar (`Transfer-Encoding: chunked`).
       * Se cuenta lo que llega de verdad y se corta en cuanto pasa el tope, sin
       * esperar a tener el cuerpo entero en memoria.
       */
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        res.status(413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;

      // Se responde ya: el navegador no necesita saber qué opinó el Collector.
      res.status(202).end();

      const body = Buffer.concat(chunks);
      const forward = send(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: target.pathname,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': body.length,
          },
          timeout: 5_000,
        },
        (upstream) => {
          // El cuerpo se descarta; sin consumirlo la conexión no se libera.
          upstream.resume();
        },
      );

      /**
       * Un Collector caído no puede tumbar el servidor de la aplicación. Sin
       * estos dos manejadores, un `ECONNREFUSED` sería una excepción no
       * capturada en un socket, que en Node termina el proceso.
       */
      forward.on('error', () => undefined);
      forward.on('timeout', () => forward.destroy());

      forward.end(body);
    });
  };
}
