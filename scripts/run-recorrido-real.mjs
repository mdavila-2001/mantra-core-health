/**
 * Recorrido con **usuarios reales contra la API viva**: corrida y reporte.
 *
 * Hermano de `run-recorrido.mjs`, y por las mismas razones — el reporte se
 * genera haya fallado o no, porque las pantallas que se alcanzaron a capturar
 * antes del fallo son justo las que hacen falta para entenderlo — pero con dos
 * diferencias que no son de forma:
 *
 * 1. **Comprueba la API antes de arrancar.** Sin backend, Playwright fallaría
 *    tres minutos más tarde con un error de tiempo de espera que no dice nada.
 *    Acá se dice en dos segundos y con la salida concreta.
 * 2. **Escribe en `artifacts/real/`.** El recorrido visual usa datos inventados
 *    y éste no; mezclarlos daría una galería donde no se sabe cuál es cuál.
 *
 *   node scripts/run-recorrido-real.mjs [-- <args de playwright>]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(new URL('..', import.meta.url).pathname.replace(/\/$/, ''));
const CARPETA = 'real';
const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

/** Lo que va después de `--` se le pasa a Playwright tal cual. */
function argumentosDePlaywright() {
  const argv = process.argv.slice(2);
  const corte = argv.indexOf('--');
  return corte === -1 ? argv : argv.slice(corte + 1);
}

/** Si la API responde. Es la única precondición que esta suite no puede crear. */
async function apiViva() {
  try {
    const respuesta = await fetch(`${API}/health`);
    return respuesta.ok;
  } catch {
    return false;
  }
}

function correr(comando, args, entorno) {
  const resultado = spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: entorno,
  });
  return resultado.status ?? 1;
}

async function main() {
  if (!(await apiViva())) {
    console.error(
      [
        `La API no responde en ${API}/health.`,
        '',
        'Esta suite no simula nada: necesita el backend levantado y su base con datos.',
        '',
        '  docker compose up -d postgres mongodb redis opensearch minio',
        '  corepack yarn start        # en el repositorio de la API',
        '',
        'Si la API vive en otro puerto, pasalo por E2E_API_URL.',
      ].join('\n'),
    );
    process.exit(1);
  }

  const entorno = { ...process.env, EVIDENCIAS_DIR: CARPETA };

  const codigo = correr(
    'npx',
    ['playwright', 'test', '-c', 'playwright.real.config.ts', ...argumentosDePlaywright()],
    entorno,
  );

  const hayCapturas = existsSync(resolve(RAIZ, `artifacts/${CARPETA}/manifiesto.jsonl`));
  if (hayCapturas) {
    correr('node', ['scripts/generate-recorrido-report.mjs'], entorno);
  }

  if (codigo !== 0) {
    console.error(
      hayCapturas
        ? '\nLa corrida falló. El reporte de arriba tiene lo capturado y la tabla de hallazgos.'
        : '\nLa corrida falló antes de capturar nada.',
    );
  }

  process.exit(codigo);
}

await main();
