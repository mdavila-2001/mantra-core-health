/**
 * Recorrido de navegador de la red social al estilo LinkedIn (plan
 * `docs/trabajo/2026-10-21-red-social-linkedin/PLAN.md`).
 *
 * Corre, en serie y contra un `ng serve` con el simulador, los recorridos de
 * cada hito que viven en `playwright/red-social/`:
 *
 * - H3 · Inicio `/posts` en tres columnas, Recientes / Siguiendo, perfil mini.
 * - H4 · «Crear publicación» en modal, con imagen, borrador y foco.
 * - H5 · La tarjeta: Seguir, cinco reacciones, comentar y responder en línea,
 *   compartir, guardar, tiempo relativo.
 * - H6 · Mi red (Siguiendo / Sugerencias) y Guardados, con persistencia; y
 *   «Seguir» en la ficha pública.
 * - H7 · Avisos sociales con el nombre de quien actuó y su destino.
 * - H8 · El grupo «Mi red social» del rail y sus contadores sin leer.
 * - H9 · La publicación propia no pública queda primera.
 *
 * Cada recorrido imprime sus ✔/✘ y deja capturas en su carpeta. Uno a la vez:
 * un solo navegador por vez en la máquina de desarrollo.
 *
 * Uso: `node playwright/red-social-linkedin.mjs [urlBase] [carpetaSalida]`
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4311';
const OUT = process.argv[3] ?? 'docs/frontend/evidence/red-social-linkedin';
const AQUI = dirname(fileURLToPath(import.meta.url));
const FOTO = join(AQUI, 'red-social', 'foto-prueba.png');

const RECORRIDOS = [
  ['h3-inicio', []],
  ['h4-modal', [FOTO]],
  ['h5-tarjeta', []],
  ['h6-red-y-guardados', []],
  ['h6-ficha-seguir', []],
  ['h7-avisos', []],
  ['h8-rail', []],
  ['h9-publicacion-propia', []],
];

let verdes = 0;
let total = 0;
const fallidos = [];

for (const [nombre, extra] of RECORRIDOS) {
  const salida = join(OUT, nombre);
  mkdirSync(salida, { recursive: true });
  process.stdout.write(`\n── ${nombre} ──\n`);
  const corrida = spawnSync(
    process.execPath,
    [join(AQUI, 'red-social', `${nombre}.mjs`), BASE, salida, ...extra],
    { encoding: 'utf8', timeout: 900_000 },
  );
  const texto = `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  process.stdout.write(texto);
  const bien = (texto.match(/^✔/gm) ?? []).length;
  const mal = (texto.match(/^✘/gm) ?? []).length;
  verdes += bien;
  total += bien + mal;
  if (mal > 0 || corrida.status !== 0) fallidos.push(nombre);
}

process.stdout.write(`\n${verdes}/${total} en verde${fallidos.length ? ` — con fallos: ${fallidos.join(', ')}` : ''}\n`);
process.exit(fallidos.length === 0 ? 0 : 1);
