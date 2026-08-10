/**
 * Lanzador del recorrido visual.
 *
 * Corre la suite `cypress/e2e/recorrido/`, que **no entra** en la corrida por
 * defecto: captura cientos de imágenes y tarda minutos, así que arrastrarla en
 * cada cambio haría que nadie corriera las pruebas.
 *
 * Hace tres cosas que no se pueden dejar libradas a quien lo invoque:
 *
 *  1. **Fija `EVIDENCIAS_DIR`** para que las capturas caigan en
 *     `artifacts/recorrido/` y no pisen las del recorrido con usuarios reales.
 *  2. **Vacía las evidencias de la corrida anterior.** Sin esto, una pantalla
 *     que dejó de existir seguiría apareciendo en el reporte con la captura de
 *     la corrida pasada, y nadie lo notaría: el reporte se arma leyendo el
 *     directorio, no comparando contra nada.
 *  3. **Genera el reporte también cuando la suite falla**, que es justamente
 *     cuando hace falta mirarlo.
 *
 *   node scripts/run-recorrido.mjs [-- <args de cypress>]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const CARPETA = 'recorrido';
const EVIDENCIAS = resolve(RAIZ, 'artifacts', CARPETA);

/** Lo que venga después de `--` se le pasa tal cual a Cypress. */
function argumentosDeCypress() {
  const separador = process.argv.indexOf('--');
  return separador === -1 ? [] : process.argv.slice(separador + 1);
}

function correr(comando, args, entorno) {
  return spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: 'inherit',
    env: entorno,
    // `yarn` es un `.cmd` en Windows y sin shell no se encuentra.
    shell: process.platform === 'win32',
  });
}

console.log('[recorrido] Vaciando las evidencias de la corrida anterior…');
rmSync(EVIDENCIAS, { recursive: true, force: true });
mkdirSync(EVIDENCIAS, { recursive: true });

// `E2E_SUITE` levanta la exclusión que deja estas specs fuera de la corrida
// por defecto; sin ella, el `--spec` de abajo no encontraría ningún archivo.
const entorno = { ...process.env, EVIDENCIAS_DIR: CARPETA, E2E_SUITE: "recorrido" };

const cypress = correr(
  'yarn',
  [
    'cypress',
    'run',
    '--e2e',
    '--browser',
    'chrome',
    '--spec',
    'cypress/e2e/recorrido/**/*.cy.ts',
    ...argumentosDeCypress(),
  ],
  entorno,
);

// El reporte se genera pase lo que pase: un recorrido a medias sigue teniendo
// capturas que mirar, y son las que explican dónde se cortó.
if (existsSync(resolve(EVIDENCIAS, 'manifiesto.jsonl'))) {
  correr('node', ['scripts/generate-recorrido-report.mjs'], entorno);
} else {
  console.warn('[recorrido] No se escribió ninguna captura: no hay reporte que construir.');
}

process.exit(cypress.status ?? 1);
