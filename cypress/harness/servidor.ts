import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import express, { type RequestHandler } from 'express';

import { configuracion } from '../support/config';
import { crearApiSimulada } from './api-simulada';

/**
 * Arnés: el artefacto real de producción con la API simulada delante.
 *
 * ## Por qué contra el artefacto y no contra `ng serve`
 *
 * Cuatro rutas se prerenderizan **solo en el build**, y las cabeceras de
 * seguridad las emite **solo** el servidor de producción. Probar contra el
 * servidor de desarrollo dejaría fuera justo lo que más fácil se rompe: que el
 * HTML del servidor y el del cliente coincidan al hidratar, y que la CSP no
 * bloquee un script —si lo bloqueara, la aplicación no arrancaría, y estas
 * pruebas lo dirían—.
 *
 * ## Por qué un solo proceso
 *
 * El servidor construido exporta su manejador (`reqHandler`), así que se monta
 * dentro de un Express que primero atiende `/iam` y `/public`. No hay proxy, no
 * hay segundo puerto y no hay un proceso hijo que pueda quedar huérfano: el
 * arnés vive dentro del proceso de `setupNodeEvents` y muere con Cypress.
 */

const SALIDA = 'dist/mantra-core-health';
const ENTRADA_SERVIDOR = `${SALIDA}/server/server.mjs`;

/** Prefijos que la aplicación puede pedirle a la API (ver `proxy.conf.json`). */
const PREFIJOS_API = ['/iam', '/public', '/terminology', '/profiles', '/identity', '/common'];

export interface ArnesEnMarcha {
  readonly baseUrl: string;
  readonly detener: () => Promise<void>;
}

/**
 * Marca que deja el arnés al construir.
 *
 * Sirve para distinguir «hay un `dist/`» de «hay un `dist/` **que sirve para
 * esta suite**», que no es lo mismo y falla de forma incomprensible cuando se
 * confunden. Ver `construir()`.
 */
const MARCA = `${SALIDA}/.arnes-e2e`;

/**
 * Construye el artefacto, salvo que ya haya uno del arnés y se pida reutilizarlo.
 *
 * ## Por qué se fuerza `PUBLIC_API_BASE_URL` vacío
 *
 * Con la variable vacía la aplicación pide al **mismo origen** (`/iam/…`), que
 * es lo único que el arnés puede atender. Con la de una máquina cualquiera
 * —`.env` suele traer `API_BASE_URL=http://localhost:3000/api/v1`— el paquete
 * sale hablándole al backend real: la API simulada no ve una sola petición, el
 * login no entra y **toda la suite falla con «la URL nunca llegó a /panel»**,
 * que no menciona la causa por ningún lado.
 *
 * El entorno del proceso le gana al `.env` en `generate-env.mjs`, y ese
 * generador acepta el vacío explícitamente como «rutas relativas», así que
 * pasarla acá es suficiente y no toca el `.env` de nadie.
 *
 * ## Por qué reconstruir es el valor por defecto
 *
 * Un `dist/` viejo produce fallos incomprensibles —el HTML prerenderizado apunta
 * a fragmentos cuyo hash ya cambió, la aplicación no arranca y todas las pruebas
 * se agotan sin una sola pista—. `E2E_SKIP_BUILD=true` existe para el bucle de
 * escritura de pruebas, donde el artefacto no cambia entre corridas.
 */
function construir(): void {
  const { saltarBuild } = configuracion();
  const hayArtefacto = existsSync(resolve(process.cwd(), ENTRADA_SERVIDOR));
  const esDelArnes = existsSync(resolve(process.cwd(), MARCA));

  if (saltarBuild && hayArtefacto && esDelArnes) {
    console.log('[e2e] E2E_SKIP_BUILD=true: se reutiliza el artefacto de dist/.');
    return;
  }
  if (saltarBuild && hayArtefacto && !esDelArnes) {
    // Es el caso que más tiempo cuesta si se deja pasar: el artefacto existe,
    // arranca, sirve sus recursos… y le habla a otra API.
    console.warn(
      '[e2e] El dist/ que hay no lo construyó este arnés (le falta la marca), así que ' +
        'apuntaría a la API real en vez de a la simulada. Se reconstruye pese a E2E_SKIP_BUILD.',
    );
  }
  if (saltarBuild && !hayArtefacto) {
    console.warn('[e2e] E2E_SKIP_BUILD=true pero no hay artefacto: se construye igual.');
  }

  console.log('[e2e] Construyendo el artefacto de producción para el arnés…');
  // `shell: true` en Windows: `yarn` es un `.cmd` y sin shell `spawnSync` no lo
  // encuentra. En POSIX el binario es directamente ejecutable y da lo mismo.
  const resultado = spawnSync('yarn', ['build'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PUBLIC_API_BASE_URL: '' },
  });

  if (resultado.status !== 0) {
    rmSync(resolve(process.cwd(), MARCA), { force: true });
    throw new Error(
      `La construcción falló (código ${resultado.status ?? 'desconocido'}). ` +
        'Sin artefacto no hay nada contra qué probar.',
    );
  }

  writeFileSync(
    resolve(process.cwd(), MARCA),
    'Artefacto construido por el arnés E2E con PUBLIC_API_BASE_URL vacío (rutas relativas).\n' +
      'Si lo reconstruís con `yarn build` a mano, borrá este archivo: ya no sirve para la suite.\n',
    'utf8',
  );
}

/** Carga el manejador del servidor construido. */
async function manejadorDelArtefacto(): Promise<RequestHandler> {
  const ruta = resolve(process.cwd(), ENTRADA_SERVIDOR);
  if (!existsSync(ruta)) {
    throw new Error(`No existe ${ENTRADA_SERVIDOR}. ¿Falló la construcción?`);
  }

  const modulo: unknown = await import(pathToFileURL(ruta).href);
  const manejador = (modulo as { reqHandler?: RequestHandler }).reqHandler;

  if (typeof manejador !== 'function') {
    throw new Error(
      `${ENTRADA_SERVIDOR} no exporta «reqHandler». Revisá el final de src/server.ts.`,
    );
  }
  return manejador;
}

/**
 * Levanta el arnés y devuelve cómo apagarlo.
 *
 * El apagado cierra las conexiones vivas además del socket de escucha: sin eso,
 * una petición a medio terminar deja el proceso colgado y la corrida no termina
 * nunca.
 */
export async function levantarArnes(): Promise<ArnesEnMarcha> {
  const config = configuracion();

  construir();

  const app = express();

  // La API simulada va **primero**: si el manejador de Angular viera `/iam/...`
  // devolvería el HTML de la aplicación con estado 200, y el cliente fallaría
  // al interpretarlo como JSON con un error que no menciona la causa.
  app.use(crearApiSimulada());

  // Cualquier otra ruta de API que la aplicación pida y el arnés no simule
  // tiene que decirlo con claridad, no caer en el renderizador.
  app.use((req, res, next) => {
    if (!PREFIJOS_API.some((prefijo) => req.path.startsWith(prefijo))) {
      next();
      return;
    }
    console.warn(`[e2e] Endpoint no simulado: ${req.method} ${req.path}`);
    res.status(404).json({
      code: 'NOT_FOUND',
      message: `El arnés E2E no simula ${req.method} ${req.path}.`,
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  });

  app.use(await manejadorDelArtefacto());

  const servidor: Server = await new Promise((resolver, rechazar) => {
    const instancia = app.listen(config.puerto, '127.0.0.1');
    instancia.once('listening', () => resolver(instancia));
    instancia.once('error', (fallo: NodeJS.ErrnoException) => {
      rechazar(
        fallo.code === 'EADDRINUSE'
          ? new Error(
              `El puerto ${config.puerto} está ocupado. Cerrá lo que lo use o ` +
                'exportá E2E_PORT con otro.',
            )
          : fallo,
      );
    });
  });

  const baseUrl = `http://127.0.0.1:${config.puerto}`;
  await esperarSalud(baseUrl);
  console.log(`[e2e] Arnés escuchando en ${baseUrl}`);

  return {
    baseUrl,
    detener: () =>
      new Promise<void>((resolver) => {
        servidor.closeAllConnections();
        servidor.close(() => resolver());
      }),
  };
}

/**
 * Espera activa a que el arnés responda.
 *
 * Que `listen` haya resuelto no significa que el renderizador esté listo: la
 * primera petición es la que termina de inicializarlo.
 */
export async function esperarSalud(
  baseUrl: string,
  ruta = '/__e2e__/salud',
  intentos = 60,
): Promise<void> {
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      const respuesta = await fetch(`${baseUrl}${ruta}`);
      if (respuesta.ok) {
        return;
      }
    } catch {
      // Todavía no atiende: se reintenta hasta agotar los intentos.
    }
    await new Promise((resolver) => setTimeout(resolver, 250));
  }
  throw new Error(`No hubo respuesta en ${baseUrl}${ruta}.`);
}
