/**
 * Corre un comando con el montón de Node ampliado.
 *
 * `ng build` supera el límite por defecto de Node y muere por falta de memoria
 * (`JavaScript heap out of memory`); con 8 GB compila. Poner `NODE_OPTIONS` a
 * mano en cada máquina era la receta hasta ahora, y quien no la sabía veía un
 * build caído sin una palabra sobre memoria.
 *
 * Si el entorno YA fija `--max-old-space-size`, se respeta tal cual. No es un
 * detalle: el `Dockerfile` baja el montón a propósito (1536 MB) para que el
 * recolector entre antes de que el cgroup del servidor mate la construcción, y
 * un valor impuesto desde `package.json` lo pisaría.
 *
 * Uso: `node scripts/with-heap.mjs <comando> [argumentos…]`
 */

import { spawn } from 'node:child_process';

const DEFAULT_HEAP_MB = 8192;

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('[with-heap] falta el comando a ejecutar.');
  process.exit(2);
}

const current = process.env.NODE_OPTIONS ?? '';
const env = /--max-old-space-size/.test(current)
  ? process.env
  : {
      ...process.env,
      NODE_OPTIONS: `${current} --max-old-space-size=${DEFAULT_HEAP_MB}`.trim(),
    };

const child = spawn(command, args, { stdio: 'inherit', env, shell: true });
child.on('error', (error) => {
  console.error(`[with-heap] no se pudo ejecutar «${command}»: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
