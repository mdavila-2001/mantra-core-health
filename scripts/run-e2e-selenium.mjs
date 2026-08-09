/**
 * Lanzador de la suite de Selenium.
 *
 * Existe por una razón concreta: **estampar el identificador de la corrida
 * antes de que arranque Vitest**. La configuración, los trabajadores y el
 * recolector de evidencias necesitan escribir en la misma carpeta, y cada uno
 * corre en un proceso distinto. Si cada cual calculara su propia marca de
 * tiempo, las capturas de una corrida quedarían repartidas en cuatro carpetas.
 *
 * De paso genera el reporte navegable **también cuando la suite falla**, que es
 * justamente cuando hace falta mirarlo.
 *
 *   node scripts/run-e2e-selenium.mjs [--suite smoke] [argumentos de vitest…]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CONFIG = 'e2e/selenium/vitest.config.ts';

/** Suites que se pueden pedir por nombre. Son las carpetas de `specs/`. */
const SUITES = {
  smoke: 'e2e/selenium/specs/smoke',
  autenticacion: 'e2e/selenium/specs/authentication',
  navegacion: 'e2e/selenium/specs/navigation',
  formularios: 'e2e/selenium/specs/forms',
  responsive: 'e2e/selenium/specs/responsive',
  regresion: 'e2e/selenium/specs/regression',
};

/**
 * La suite crítica: lo que no puede romperse sin bloquear un despliegue.
 *
 * Es humo más autenticación más navegación. Deja fuera la regresión completa,
 * que es más lenta y cubre casos de borde: esa corre en la rama principal y
 * antes de desplegar, no en cada pull request.
 */
const CRITICA = [SUITES.smoke, SUITES.autenticacion, SUITES.navegacion, SUITES.formularios];

function argumentos() {
  const args = process.argv.slice(2);
  const rutas = [];
  const resto = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--suite') {
      const nombre = args[i + 1];
      i += 1;
      if (nombre === 'critica') {
        rutas.push(...CRITICA);
        continue;
      }
      if (!(nombre in SUITES)) {
        console.error(
          `Suite desconocida: «${nombre}». Disponibles: ${Object.keys(SUITES).join(', ')}, critica.`,
        );
        process.exit(2);
      }
      rutas.push(SUITES[nombre]);
      continue;
    }
    resto.push(args[i]);
  }

  return { rutas, resto };
}

const { rutas, resto } = argumentos();

/**
 * Identificador de la corrida: es el nombre de la carpeta de artefactos.
 *
 * Con `:` y `.` sustituidos, porque son ilegales en los nombres de archivo de
 * Windows y la carpeta se sube como artefacto de CI, donde alguien la descarga.
 */
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const artefactos = process.env.E2E_ARTIFACTS_DIR ?? 'artifacts/selenium';

const entorno = { ...process.env, E2E_RUN_ID: runId, E2E_ARTIFACTS_DIR: artefactos };

console.log(`[e2e] Corrida ${runId} → ${artefactos}/${runId}`);

const vitest = spawnSync(
  'yarn',
  ['vitest', 'run', '--config', CONFIG, ...rutas, ...resto],
  { cwd: RAIZ, stdio: 'inherit', env: entorno },
);

// El reporte se genera pase lo que pase: un fallo sin reporte obliga a leer la
// salida cruda de la terminal, que en CI ya se perdió.
const resultados = resolve(RAIZ, artefactos, runId, 'resultados.json');
if (existsSync(resultados)) {
  spawnSync('node', ['scripts/generate-e2e-report.mjs', resultados], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: entorno,
  });
} else {
  console.warn('[e2e] No se generó resultados.json: no hay reporte que construir.');
}

process.exit(vitest.status ?? 1);
