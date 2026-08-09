import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { allowedHostsFromEnv } from './server/allowed-hosts';
import { collectInlineScriptHashes, securityHeaders } from './server/security-headers';
import { OTEL_TRACES_PATH, otelGateway } from './server/telemetry/otel-gateway';
import { serverTelemetryConfig } from './server/telemetry/server-telemetry.config';
import { serverTracingMiddleware } from './server/telemetry/server-tracing.middleware';
import { startServerTelemetry } from './server/telemetry/server-telemetry';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * El motor de renderizado, con los hosts que este despliegue acepta.
 *
 * `angular.json` declara los que se conocen al construir —`localhost`,
 * `127.0.0.1`, `mantra-core-health.local` y el nombre del servicio en compose—
 * y `SSR_ALLOWED_HOSTS` **suma** el dominio público, que cambia por entorno y
 * no se sabe al compilar.
 *
 * Sin el dominio en alguna de las dos listas el servidor no falla: responde 200
 * degradando a renderizado de cliente. Es decir, se pierde el SSR **en
 * silencio**. Ver `server/allowed-hosts.ts`.
 */
const angularApp = new AngularNodeAppEngine({ allowedHosts: [...allowedHostsFromEnv()] });

/**
 * Telemetría del servidor.
 *
 * Se arranca **lo primero**, antes de registrar ningún middleware: el SDK tiene
 * que estar instalado antes de que exista la primera petición que trazar.
 *
 * Apagada salvo que `OTEL_SSR_ENABLED=true`. Con ella apagada esto es una
 * lectura de variables de entorno y nada más — no se registra el middleware, no
 * se abre ninguna conexión y el servidor se comporta como antes.
 */
const telemetry = serverTelemetryConfig();
const telemetryHandle = startServerTelemetry(telemetry);

/**
 * Cabeceras de seguridad, en **todas** las respuestas.
 *
 * Van antes que los estáticos a propósito: un `.js` servido sin `nosniff` es
 * tan interesante para un atacante como un HTML.
 *
 * Los hashes de los scripts en línea se recolectan **una vez, al arrancar**,
 * recorriendo el artefacto ya construido. Hacerlo por petición costaría leer y
 * parsear HTML en cada respuesta para un valor que no cambia mientras el
 * proceso viva.
 *
 * `PUBLIC_API_BASE_URL` es lo único que cambia entre despliegues: vacío —lo
 * recomendado— deja `connect-src 'self'`; con un dominio distinto lo agrega.
 * Es la misma variable que compila el paquete, así que las dos mitades no se
 * pueden separar.
 */
const headers = securityHeaders({
  apiBaseUrl: process.env['PUBLIC_API_BASE_URL'] ?? '',
  inlineScriptHashes: collectInlineScriptHashes(browserDistFolder),
});

app.use((_request, response, next) => {
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  next();
});

/**
 * El endpoint al que el navegador manda sus trazas.
 *
 * Va **antes** que los estáticos y que el motor de Angular, porque es lo único
 * que tiene que responder rápido y sin tocar nada más. Y va condicionado: sin
 * telemetría no existe la ruta, así que un despliegue sin Collector no expone
 * un reenviador hacia una dirección interna que nadie configuró.
 *
 * Ver `server/telemetry/otel-gateway.ts` para por qué el navegador no habla
 * directamente con el Collector.
 */
if (telemetryHandle !== null) {
  /**
   * `all` y no `post`: con `post`, un `GET /otel/v1/traces` se escurría hasta
   * el motor de Angular y devolvía la aplicación entera renderizada con un 200.
   * Verificado y corregido — el endpoint responde 405 y nada más.
   */
  app.all(OTEL_TRACES_PATH, otelGateway(telemetry.collectorUrl));
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Traza de la petición, **después** de los estáticos.
 *
 * El orden es la decisión: un `.js` o una tipografía servidos por
 * `express.static` no producen span. Son la mayoría de las peticiones y no
 * dicen nada que valga un span cada una. Lo que sí se traza es lo que llega al
 * motor de Angular, que es donde ocurre el render.
 */
if (telemetryHandle !== null) {
  app.use(serverTracingMiddleware());
}

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });

  /**
   * Cierre limpio de la telemetría.
   *
   * Sin esto, al reiniciar el servidor el proceso muere con la cola de spans
   * llena y se pierden las trazas de justo antes del reinicio — que son
   * exactamente las que explican por qué se reinició.
   *
   * `once` y no `on`: dos señales seguidas no deben disparar dos cierres.
   */
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void telemetryHandle?.shutdown().finally(() => process.exit(0));
    });
  }
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
