import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { allowedHostsFromEnv } from './server/allowed-hosts';
import { artefactosInexistentesDan404 } from './server/build-assets';
import {
  collectInlineScriptHashes,
  securityHeaders,
  sourceIndexScriptHashes,
} from './server/security-headers';
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
 *
 * `sourceIndexScriptHashes` se suma al recorrido del artefacto, no lo
 * reemplaza (AG49-FT01-003): bajo `ng serve --ssr` no hay ningún
 * `browserDistFolder` real que `collectInlineScriptHashes` pueda recorrer —el
 * bundle de desarrollo no escribe nada a disco— y el script anti-parpadeo del
 * tema quedaba bloqueado por la CSP en cualquier ruta sin prerenderizar. En un
 * build de producción es una entrada redundante (mismo hash que ya aporta el
 * recorrido del artefacto); en `ng serve` es la única fuente que existe. Ver
 * el porqué completo en `sourceIndexScriptHashes`.
 */
const cabecerasComunes = {
  apiBaseUrl: process.env['PUBLIC_API_BASE_URL'] ?? '',
  inlineScriptHashes: [
    ...new Set([
      ...collectInlineScriptHashes(browserDistFolder),
      ...sourceIndexScriptHashes(process.cwd()),
    ]),
  ],
};

/**
 * Dos juegos de cabeceras, armados una sola vez, y la petición elige.
 *
 * Lo único que los separa es `upgrade-insecure-requests`, que solo corresponde
 * si la página ya viaja cifrada. Emitirla sobre HTTP rompe la página entera:
 * el navegador pide cada subrecurso por `https` contra un servidor que no habla
 * TLS. `localhost` está exento del ascenso, así que eso no se ve trabajando en
 * la propia máquina y sí en cuanto alguien abre la aplicación desde otra
 * —`yarn start:lan`, una demo por IP, una tablet en la misma red—.
 *
 * Se arman los dos al arrancar y no uno por petición porque la parte cara son
 * los hashes de los scripts en línea, que no cambian mientras el proceso viva.
 */
const headersHttps = securityHeaders(cabecerasComunes);
const headersHttp = securityHeaders({ ...cabecerasComunes, upgradeInsecureRequests: false });

/**
 * `x-forwarded-proto` antes que `request.secure` porque en producción el TLS lo
 * termina el proxy de adelante: al servidor la conexión le llega en claro, y sin
 * mirar la cabecera creería que toda la producción es HTTP.
 */
function vieneCifrada(request: express.Request): boolean {
  const reenviado = request.headers['x-forwarded-proto'];
  const primero = Array.isArray(reenviado) ? reenviado[0] : reenviado;
  if (primero !== undefined && primero !== '') {
    return primero.split(',')[0]?.trim() === 'https';
  }
  return request.protocol === 'https' || request.secure;
}

app.use((request, response, next) => {
  const headers = vieneCifrada(request) ? headersHttps : headersHttp;
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
 * Un artefacto de la construcción que no existe **es un 404**.
 *
 * Va pegado a `express.static` a propósito: lo que llega acá es lo que el
 * servidor de estáticos no encontró, y sin esta regla seguía hasta el motor de
 * Angular, que devolvía la aplicación entera con un 200. El navegador intentaba
 * parsear ese HTML como módulo y se quejaba de
 * `Failed to fetch dynamically imported module` — un mensaje que manda a buscar
 * el problema al lado del cliente, donde no está.
 *
 * Ver `server/build-assets.ts`.
 */
app.use(artefactosInexistentesDan404());

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
  /**
   * El HTML **no se cachea**; los artefactos con hash en el nombre, un año.
   *
   * Sin esta cabecera el navegador aplica su caché heurística sobre el
   * `index.html`, así que después de cada redespliegue el tester seguía
   * ejecutando el `main-*.js` de la versión anterior y pidiendo `chunk-*.js`
   * que ya no existen. La aplicación quedaba rota hasta un recargado forzado,
   * y el único síntoma era un error de importación de módulo.
   *
   * `no-cache` no significa «no guardar»: el navegador se queda la copia y la
   * **revalida** en cada visita, así que sigue habiendo 304 y no se paga la
   * descarga de nuevo. Lo que se elimina es servir HTML viejo sin preguntar.
   */
  res.setHeader('Cache-Control', 'no-cache');

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
