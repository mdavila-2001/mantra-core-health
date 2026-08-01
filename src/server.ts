import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { collectInlineScriptHashes, securityHeaders } from './server/security-headers';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

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
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
