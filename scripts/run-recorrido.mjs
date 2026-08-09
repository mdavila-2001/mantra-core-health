/**
 * Genera el recorrido visual completo: corrida y reporte, en un solo comando.
 *
 * Existe porque `yarn recorrido` encadenaba dos comandos con `&&`, y eso deja
 * dos cabos sueltos que sólo se notan cuando muerden:
 *
 * 1. **El puerto ocupado.** El servidor de una corrida anterior que quedó vivo
 *    hace fallar el arranque con un mensaje que no dice qué hacer. Acá se avisa
 *    y se ofrece la salida.
 * 2. **El reporte de una corrida que falló.** Con `&&` no se genera, y entonces
 *    no hay forma de mirar las pantallas que **sí** se capturaron antes del
 *    fallo — que es justo cuando más falta hacen.
 *
 *   node scripts/run-recorrido.mjs [--reusar-servidor] [-- <args de playwright>]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(new URL('..', import.meta.url).pathname.replace(/\/$/, ''));
const PUERTO = 4173;

/** Separa nuestras banderas de las que hay que pasarle a Playwright tal cual. */
function leerArgumentos() {
  const argv = process.argv.slice(2);
  const corte = argv.indexOf('--');
  const propios = corte === -1 ? argv : argv.slice(0, corte);
  const ajenos = corte === -1 ? [] : argv.slice(corte + 1);
  return { reusar: propios.includes('--reusar-servidor'), ajenos };
}

/**
 * Si el puerto del recorrido ya está tomado.
 *
 * `lsof` no está en todos lados, y no tenerlo no puede impedir la corrida: en
 * ese caso se sigue y, si el puerto estaba ocupado, lo dirá Playwright.
 */
function puertoOcupado() {
  const salida = spawnSync('lsof', ['-ti', `tcp:${PUERTO}`], { encoding: 'utf8' });
  if (salida.error !== undefined || salida.status === null) {
    return false;
  }
  return salida.stdout.trim() !== '';
}

function correr(comando, args, opciones = {}) {
  const resultado = spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opciones,
  });
  return resultado.status ?? 1;
}

function main() {
  const { reusar, ajenos } = leerArgumentos();

  if (puertoOcupado() && !reusar) {
    console.error(
      [
        `El puerto ${PUERTO} está ocupado y no se pidió reutilizar el servidor.`,
        '',
        'Si es un servidor viejo que quedó vivo:',
        `  lsof -ti tcp:${PUERTO} | xargs kill -9`,
        '',
        'Si es el artefacto ya construido y querés aprovecharlo:',
        '  yarn recorrido --reusar-servidor',
        '',
        'Ojo con lo segundo: el servidor lee el HTML prerenderizado al arrancar',
        'y lo guarda en memoria. Si el artefacto se reconstruyó desde entonces,',
        'ese HTML apunta a fragmentos que ya no existen y no arranca nada.',
      ].join('\n'),
    );
    process.exit(1);
  }

  const entorno = reusar
    ? { ...process.env, RECORRIDO_REUSAR_SERVIDOR: 'true' }
    : process.env;

  const codigo = correr(
    'npx',
    ['playwright', 'test', '-c', 'playwright.recorrido.config.ts', ...ajenos],
    { env: entorno },
  );

  // El reporte se genera **haya fallado o no**. Si la corrida se cortó a mitad,
  // las pantallas que alcanzó a capturar siguen siendo la evidencia que hay, y
  // no poder mirarlas por culpa del fallo sería perder dos cosas en vez de una.
  const hayCapturas = existsSync(resolve(RAIZ, 'artifacts/recorrido/manifiesto.jsonl'));
  if (hayCapturas) {
    correr('node', ['scripts/generate-recorrido-report.mjs']);
  }

  if (codigo !== 0) {
    console.error(
      hayCapturas
        ? '\nLa corrida falló. El reporte de arriba tiene lo que se alcanzó a capturar.'
        : '\nLa corrida falló antes de capturar nada.',
    );
  }

  process.exit(codigo);
}

main();
