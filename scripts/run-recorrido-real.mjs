/**
 * Lanzador del recorrido con usuarios reales.
 *
 * Corre `cypress/e2e/real/`, que es la única suite **sin nada simulado**: crea
 * los actores contra la API viva y recorre la aplicación con sus permisos de
 * verdad. Por eso necesita el backend levantado y queda fuera de la corrida por
 * defecto.
 *
 * Fija `EVIDENCIAS_DIR=real` para que sus capturas no pisen las del recorrido
 * visual: mezclarlas dejaría un reporte donde no se sabe cuál salió de datos
 * inventados y cuál de datos reales.
 *
 *   node scripts/run-recorrido-real.mjs [-- <args de cypress>]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const CARPETA = 'real';
const EVIDENCIAS = resolve(RAIZ, 'artifacts', CARPETA);
const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

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

/**
 * Comprueba que la API responda **antes** de construir nada.
 *
 * Sin esto, el fallo llega quince minutos después —tras el build y el arranque
 * del arnés— y dice «no se pudo crear el paciente», que no menciona que el
 * backend no estaba levantado.
 */
const salud = await fetch(`${API}/health`).catch(() => null);
if (salud === null || !salud.ok) {
  console.error(
    `[recorrido-real] La API no responde en ${API}/health.\n` +
      'Levantá el backend antes de correr esta suite, o apuntá E2E_API_URL a donde esté.',
  );
  process.exit(2);
}

console.log('[recorrido-real] Vaciando las evidencias de la corrida anterior…');
rmSync(EVIDENCIAS, { recursive: true, force: true });
mkdirSync(EVIDENCIAS, { recursive: true });

// `E2E_SUITE` levanta la exclusión que deja estas specs fuera de la corrida
// por defecto; sin ella, el `--spec` de abajo no encontraría ningún archivo.
const entorno = { ...process.env, EVIDENCIAS_DIR: CARPETA, E2E_SUITE: "real" };

const cypress = correr(
  'yarn',
  [
    'cypress',
    'run',
    '--e2e',
    '--browser',
    'chrome',
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

process.exit(cypress.status ?? 1);
