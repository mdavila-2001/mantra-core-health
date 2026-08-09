import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import express, { type RequestHandler } from 'express';

import { configuracion } from '../config/environment';
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
 * arnés muere con la suite.
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
 * Construye el artefacto, salvo que ya haya uno y se pida reutilizarlo.
 *
 * Reconstruir en cada corrida es la opción por defecto **a propósito**: un
 * `dist/` viejo produce fallos incomprensibles —el HTML prerenderizado apunta a
 * fragmentos cuyo hash ya cambió, la aplicación no arranca y todas las pruebas
 * se agotan sin una sola pista—. `E2E_SKIP_BUILD=true` existe para el bucle de
 * escritura de pruebas, donde el artefacto no cambia entre corridas.
 */
function construir(): void {
  const { saltarBuild } = configuracion();
  const hayArtefacto = existsSync(resolve(process.cwd(), ENTRADA_SERVIDOR));

  if (saltarBuild && hayArtefacto) {
    console.log('[e2e] E2E_SKIP_BUILD=true: se reutiliza el artefacto de dist/.');
    return;
  }
  if (saltarBuild && !hayArtefacto) {
    console.warn('[e2e] E2E_SKIP_BUILD=true pero no hay artefacto: se construye igual.');
  }

  console.log('[e2e] Construyendo el artefacto de producción…');
  const resultado = spawnSync('yarn', ['build'], { stdio: 'inherit', shell: false });

  if (resultado.status !== 0) {
    throw new Error(
      `La construcción falló (código ${resultado.status ?? 'desconocido'}). ` +
        'Sin artefacto no hay nada contra qué probar.',
    );
  }
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
 * una petición a medio terminar deja el proceso de Vitest colgado y la corrida
 * no termina nunca.
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
