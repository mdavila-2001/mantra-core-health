/**
 * Lanzador del recorrido con usuarios reales.
 *
 * Corre `cypress/e2e/real/`, que es la única suite **sin nada simulado**: crea
 * los actores contra la API viva y recorre la aplicación con sus permisos de
 * verdad. Por eso necesita el backend levantado y queda fuera de la corrida por
 * defecto.
 *
 * ## Por qué contra `ng serve` y no contra el artefacto
 *
 * **Es la diferencia entre que esta suite pruebe algo y que no pruebe nada.**
 *
 * El resto de la suite corre contra el artefacto que sirve el arnés, y ese
 * artefacto se construye con `PUBLIC_API_BASE_URL` vacío para que la aplicación
 * pida al **mismo origen** — donde el arnés le responde con su API simulada.
 * Servir esta suite desde ahí la deja hablando con el simulador: los actores se
 * crean de verdad contra `localhost:3000`, pero la pantalla que los usa recibe
 * respuestas inventadas. Da verde y no significa nada.
 *
 * Se corrió así una vez y el síntoma fue exactamente ése: el administrador
 * «entraba» al panel con credenciales que la API real rechazaba con `401`.
 *
 * `ng serve` resuelve el problema de raíz porque tiene `proxy.conf.json`: la
 * aplicación pide al mismo origen y el servidor de desarrollo reenvía `/iam`,
 * `/profiles` y compañía al backend de verdad. Es, además, lo que asumía el
 * comentario sobre la CSP en `support/real/vigilante.ts`.
 *
 *   node scripts/run-recorrido-real.mjs [-- <args de cypress>]
 *
 * El backend tiene que estar levantado **con `RATE_LIMIT_DISABLED=true`**: cada
 * spec crea sus actores contra `/iam/auth/*`, que limita a 10 por minuto.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const CARPETA = 'real';
const EVIDENCIAS = resolve(RAIZ, 'artifacts', CARPETA);
// El proxy de Angular apunta al puerto host 3125. La API escucha 3000 dentro
// de su contenedor y el execution set real publica el mapping 3125:3000.
const API = process.env.E2E_API_URL ?? 'http://localhost:3125';
const PUERTO_SERVE = process.env.E2E_SERVE_PORT ?? '4200';
const BASE_URL = `http://localhost:${PUERTO_SERVE}`;

function argumentosDeCypress() {
  const separador = process.argv.indexOf('--');
  return separador === -1 ? [] : process.argv.slice(separador + 1);
}

function correr(comando, args, entorno) {
  return spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: 'inherit',
    env: entorno,
    shell: process.platform === 'win32',
  });
}

/** Espera activa a que una dirección conteste. */
async function esperar(url, intentos, queEs) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    const respuesta = await fetch(url).catch(() => null);
    if (respuesta !== null && respuesta.ok) {
      return true;
    }
    await new Promise((listo) => setTimeout(listo, 1000));
  }
  console.error(`[recorrido-real] ${queEs} no respondió en ${url}.`);
  return false;
}

/**
 * Comprueba que la API responda **antes** de levantar nada.
 *
 * Sin esto, el fallo llega minutos después —tras compilar la aplicación— y dice
 * «no se pudo crear el paciente», que no menciona que el backend no estaba.
 */
if (!(await esperar(`${API}/health`, 3, 'La API'))) {
  console.error(
    'Levantá el backend antes de correr esta suite, o apuntá E2E_API_URL a donde esté.',
  );
  console.error(
    // H-08: cada spec crea sus propios actores y el backend limita registro y
    // login a 10 por minuto — la suite corrida de un tirón revienta en la
    // segunda spec. El backend ya honra la variable (igual que en su smoke).
    'Levantalo con RATE_LIMIT_DISABLED=true: sin eso, la suite entera no llega ni a la segunda spec.',
  );
  process.exit(2);
}

console.log('[recorrido-real] Vaciando las evidencias de la corrida anterior…');
rmSync(EVIDENCIAS, { recursive: true, force: true });
mkdirSync(EVIDENCIAS, { recursive: true });

/**
 * El servidor de desarrollo, con su proxy hacia la API real.
 *
 * `PUBLIC_API_BASE_URL` vacío es lo que hace que la aplicación pida al mismo
 * origen y el proxy pueda reenviar. Con la URL absoluta de un `.env` cualquiera
 * el navegador iría directo al backend, sin pasar por el proxy, y se toparía con
 * el origen cruzado.
 */
console.log(`[recorrido-real] Levantando ng serve en ${BASE_URL}…`);
const servidor = spawn(
  'yarn',
  ['ng', 'serve', '--port', PUERTO_SERVE, '--configuration', 'e2e-real'],
  {
    cwd: RAIZ,
    stdio: 'ignore',
    env: { ...process.env, PUBLIC_API_BASE_URL: '' },
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  },
);

const detenerServidor = () => {
  if (servidor.exitCode !== null || servidor.killed) {
    return;
  }
  if (process.platform === 'win32') {
    // `ng serve` deja hijos: sin `/T` el árbol sobrevive y el puerto queda tomado.
    spawnSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  process.kill(-servidor.pid, 'SIGTERM');
};

// Pase lo que pase: un servidor huérfano deja el puerto tomado y la corrida
// siguiente falla con un mensaje que no menciona a este proceso.
process.on('exit', detenerServidor);
process.on('SIGINT', () => process.exit(130));

// Compilar la aplicación entera lleva su tiempo la primera vez.
if (!(await esperar(BASE_URL, 180, 'El servidor de desarrollo'))) {
  process.exit(2);
}

const entorno = {
  ...process.env,
  EVIDENCIAS_DIR: CARPETA,
  // `E2E_SUITE` levanta la exclusión que deja estas specs fuera de la corrida
  // por defecto; sin ella, el `--spec` de abajo no encontraría ningún archivo.
  E2E_SUITE: 'real',
  // Los actores creados con `cy.request` tienen que usar la misma API que
  // comprobó el runner antes de compilar la aplicación.
  E2E_API_URL: API,
  // Con `E2E_BASE_URL` puesta, el arnés NO se levanta: no hay API simulada de
  // por medio y las peticiones llegan al backend por el proxy de `ng serve`.
  E2E_BASE_URL: BASE_URL,
};

const cypress = correr(
  'yarn',
  [
    'cypress',
    'run',
    '--e2e',
    // Electron, no Chrome: el lanzador con Chrome se cuelga indefinidamente en
    // esta suite (H-09, medido: 1 h 33 min sin arrancar); con Electron la misma
    // spec corre en 17–30 s.
    '--browser',
    'electron',
    '--spec',
    'cypress/e2e/real/**/*.cy.ts',
    ...argumentosDeCypress(),
  ],
  entorno,
);

if (existsSync(resolve(EVIDENCIAS, 'manifiesto.jsonl'))) {
  correr('node', ['scripts/generate-recorrido-report.mjs'], entorno);
} else {
  console.warn('[recorrido-real] No se escribió ninguna captura: no hay reporte que construir.');
}

detenerServidor();
process.exit(cypress.status ?? 1);
