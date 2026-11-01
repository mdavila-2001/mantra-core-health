#!/usr/bin/env node
/**
 * Guardián de colores sueltos: ningún color literal fuera de las hojas de tokens.
 *
 * Portado del gate `sin-colores-sueltos` de ATLAS (la app del cliente falla con
 * cualquier `#hex`/`rgba(` fuera de `src/theme/`) y adaptado a Angular sin
 * Tailwind: la única fuente de color son las 188 custom properties de
 * `src/styles.css` y `src/styles/*.css`. Un componente pide `var(--st-error-fg)`;
 * si escribe `#b42318`, el modo oscuro y el contraste medido por
 * `check-contrast.mjs` dejan de cubrirlo, y nadie se entera.
 *
 * ## Por qué es un RATCHET y no un «cero»
 *
 * Alovida ya tenía deuda cuando se portó el gate. Fallar por toda ella obligaría
 * a un barrido masivo de UI, que está prohibido (skill `alovida-ui`). Así que el
 * gate congela lo que hay en `scripts/baselines/colores-sueltos.json`
 * (recuento por archivo) y falla sólo si:
 *   - un archivo NUEVO trae colores literales, o
 *   - un archivo con deuda trae MÁS de los que tenía.
 * Cuando se baja la deuda, `--actualizar` baja el techo (nunca lo sube sin
 * decirlo: el diff del JSON se revisa en el PR).
 *
 * ## Qué se mira
 *   - `src/app/**` : `.css`, `.html` y `.ts` (estilos en línea, plantillas, `[style.color]`).
 *   - Exentos: hojas de tokens (`src/styles.css`, `src/styles/*.css`), specs, `*.generated.ts`,
 *     y los generadores de PDF (`shared/utils/**` con «pdf»), que copian la paleta en RGB porque
 *     jsPDF no lee CSS (ver `docs/design-system/paper.md`; su deriva la vigila otra prueba).
 *   - Una línea con `colores-sueltos:ok` queda fuera (motivo obligatorio en el comentario).
 *
 * Uso:
 *   node scripts/check-colores-sueltos.mjs              # compuerta (exit 1 si empeora)
 *   node scripts/check-colores-sueltos.mjs --lista      # lista priorizada de la deuda
 *   node scripts/check-colores-sueltos.mjs --actualizar # reescribe el baseline
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { read, repoPath, REPO_ROOT, SRC_ROOT, walk } from './lib/scan.mjs';

const BASELINE = join(REPO_ROOT, 'scripts/baselines/colores-sueltos.json');
const args = new Set(process.argv.slice(2));

const HEX = /(?<![\w&#"'=/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNC = /\b(?:rgba?|hsla?)\(\s*\d/gi;
const CONTEXTO_COLOR = /color|background|fill|stroke|border|shadow|gradient|outline|style|bg|tint/i;

function esExento(ruta) {
  return (
    /\.spec\.ts$/.test(ruta) ||
    /\.generated\.ts$/.test(ruta) ||
    /\.data\.ts$/.test(ruta) ||
    (/shared\/utils\//.test(ruta) && /pdf/i.test(ruta)) ||
    /\/testing\//.test(ruta)
  );
}

/** Recuento de colores literales por archivo, con la primera línea de cada uno. */
function medir() {
  const filas = [];
  for (const archivo of walk(join(SRC_ROOT, 'app'), ['.css', '.html', '.ts'])) {
    const ruta = repoPath(archivo);
    if (esExento(ruta)) continue;
    const esCss = ruta.endsWith('.css');
    const textoOriginal = read(archivo);
    const texto = textoOriginal.replace(/\/\*(?![\s\S]*?colores-sueltos:ok)[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    let n = 0;
    const muestras = [];
    texto.split('\n').forEach((linea, i) => {
      if (linea.includes('colores-sueltos:ok')) return;
      if (!esCss && !CONTEXTO_COLOR.test(linea)) return;
      const hallazgos = [...(linea.match(HEX) ?? []), ...(linea.match(FUNC) ?? [])];
      if (hallazgos.length === 0) return;
      n += hallazgos.length;
      if (muestras.length < 3) muestras.push(`${i + 1}: ${linea.trim().slice(0, 100)}`);
    });
    if (n > 0) filas.push({ ruta, n, muestras });
  }
  return filas.sort((a, b) => b.n - a.n);
}

const filas = medir();
const total = filas.reduce((s, f) => s + f.n, 0);

if (args.has('--lista')) {
  console.log(`${total} colores literales en ${filas.length} archivos (más deuda primero):\n`);
  for (const f of filas) {
    console.log(`${String(f.n).padStart(5)}  ${f.ruta}`);
    for (const m of f.muestras) console.log(`         ${m}`);
  }
  process.exit(0);
}

const actual = Object.fromEntries(filas.map((f) => [f.ruta, f.n]));

if (args.has('--actualizar')) {
  writeFileSync(BASELINE, JSON.stringify(actual, null, 2) + '\n');
  console.log(`baseline reescrito: ${total} colores en ${filas.length} archivos`);
  process.exit(0);
}

const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const peor = filas.filter((f) => f.n > (base[f.ruta] ?? 0));
const mejor = Object.keys(base).filter((r) => (actual[r] ?? 0) < base[r]);

if (peor.length > 0) {
  console.error(`\n✗ check-colores-sueltos — ${peor.length} archivo(s) con más colores literales que su techo\n`);
  for (const f of peor) {
    console.error(`  ${f.ruta}: ${f.n} (techo ${base[f.ruta] ?? 0})`);
    for (const m of f.muestras) console.error(`      ${m}`);
  }
  console.error('\n  Usá un token (`var(--st-error-fg)`, `var(--brand-primary)`…); ver docs/design-system/tokens.md.');
  console.error('  Si falta el token, se agrega en styles.css con su par de contraste en check-contrast.mjs.\n');
  process.exit(1);
}
console.log(`✓ check-colores-sueltos — ${total} colores literales heredados en ${filas.length} archivos, ninguno nuevo`);
if (mejor.length > 0) console.log(`  (${mejor.length} archivo(s) bajaron su deuda: corré --actualizar para bajar el techo)`);
