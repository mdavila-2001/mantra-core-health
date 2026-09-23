#!/usr/bin/env node
/**
 * Compara el catálogo tipado de tokens con lo que `styles.css` declara — **en
 * las dos direcciones**.
 *
 * Las pruebas del proyecto ya cubrían un sentido: cada token declarado en
 * TypeScript existe en el CSS. Faltaba el inverso, y ése es el que se rompe sin
 * ruido: **un token declarado solo en CSS pasa desapercibido**. No rompe nada
 * —el CSS funciona igual— pero el catálogo tipado deja de ser completo, y quien
 * lo busque por autocompletado no lo encuentra. Es cómo un sistema de diseño
 * empieza a tener dos fuentes.
 *
 * Es el hallazgo M-22 / D4.
 *
 * Uso: node scripts/check-tokens.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT } from './lib/scan.mjs';

const CSS = read(join(REPO_ROOT, 'src/styles.css'));
const TIPOS = read(join(REPO_ROOT, 'src/app/core/tokens/design-tokens.types.ts'));

/**
 * Los tokens que el CSS **declara**, no los que usa.
 *
 * Solo cuenta el lado izquierdo de una declaración (`--x: valor;`). Un
 * `var(--y)` es un uso, y si `--y` no estuviera declarado el CSS ya fallaría
 * por su cuenta.
 */
function declaradosEnCss() {
  const tokens = new Set();
  const declaracion = /(^|[;{\s])(--[\w-]+)\s*:/g;

  let match;
  while ((match = declaracion.exec(CSS)) !== null) {
    tokens.add(match[2]);
  }
  return tokens;
}

/**
 * Los tokens que el catálogo tipado enumera.
 *
 * Se reconstruyen desde las constantes del archivo de tipos en vez de
 * importarlo: este script es Node plano y el archivo es TypeScript. Leer los
 * arrays `as const` con expresiones regulares alcanza porque su forma es
 * uniforme, y si dejara de serlo el script devolvería menos tokens — o sea,
 * fallaría avisando de más, nunca de menos.
 */
function listaDe(nombre) {
  const bloque = new RegExp(`${nombre}\\s*=\\s*\\[([^\\]]*)\\]`, 's').exec(TIPOS);
  if (bloque === null) return [];
  return [...bloque[1].matchAll(/['"]([^'"]+)['"]|(\d+)/g)].map((m) => m[1] ?? m[2]);
}

function objetoDe(nombre) {
  const bloque = new RegExp(`${nombre}\\s*=\\s*\\{([^}]*)\\}`, 's').exec(TIPOS);
  if (bloque === null) return [];
  return [...bloque[1].matchAll(/['"](--[\w-]+)['"]/g)].map((m) => m[1]);
}

function declaradosEnTypeScript() {
  const tokens = new Set();

  const familias = listaDe('RAMP_FAMILIES');
  const pasos = listaDe('RAMP_STEPS');
  for (const familia of familias) {
    for (const paso of pasos) tokens.add(`--c-${familia}-${paso}`);
  }

  // `COMPAT_ALIASES` entra acá aunque sea deuda declarada y no vocabulario.
  // Faltaba, y por eso este control llevaba fallando desde el PR #232: ese PR
  // declaró los siete alias en `styles.css` y los registró en el catálogo
  // tipado —las dos mitades correctas— pero no los agregó a esta lista, que es
  // por donde el script mira el catálogo. El resultado fue el peor de los dos
  // mundos: un guardarraíl en rojo permanente, que es un guardarraíl que nadie
  // lee. `DESIGN_TOKENS` sí los incluye, al final y aparte.
  for (const objeto of ['SURFACE', 'TEXT', 'BRAND', 'BORDER', 'EFFECT', 'FONT_FAMILY', 'COMPAT_ALIASES']) {
    for (const token of objetoDe(objeto)) tokens.add(token);
  }

  for (const estado of listaDe('STATUS_TYPES')) {
    for (const ranura of listaDe('STATUS_SLOTS')) tokens.add(`--st-${estado}-${ranura}`);
  }
  for (const tono of listaDe('BRAND_TONES')) {
    for (const ranura of listaDe('STATUS_SLOTS')) tokens.add(`--st-${tono}-${ranura}`);
  }

  for (const paso of listaDe('SPACING_STEPS')) tokens.add(`--sp-${paso}`);
  for (const nombre of listaDe('RADIUS_NAMES')) tokens.add(`--r-${nombre}`);
  for (const nombre of listaDe('BREAKPOINT_NAMES')) tokens.add(`--bp-${nombre}`);
  for (const nombre of listaDe('LAYER_NAMES')) tokens.add(`--z-${nombre}`);
  for (const nombre of listaDe('DURATION_NAMES')) tokens.add(`--dur-${nombre}`);
  for (const nombre of listaDe('EASING_NAMES')) tokens.add(`--ease-${nombre}`);
  for (const rol of listaDe('TYPE_ROLES')) tokens.add(`--fs-${rol}`);
  for (const rol of listaDe('LINE_HEIGHT_ROLES')) tokens.add(`--lh-${rol}`);

  return tokens;
}

const enCss = declaradosEnCss();
const enTs = declaradosEnTypeScript();

const soloCss = [...enCss].filter((token) => !enTs.has(token)).sort();
const soloTs = [...enTs].filter((token) => !enCss.has(token)).sort();

const problemas = [];

if (soloTs.length > 0) {
  problemas.push(
    `${soloTs.length} token(s) declarados en TypeScript y ausentes de styles.css:`,
    ...soloTs.map((t) => `    ${t}`),
  );
}

if (soloCss.length > 0) {
  problemas.push(
    `${soloCss.length} token(s) declarados en styles.css y ausentes del catálogo tipado:`,
    ...soloCss.map((t) => `    ${t}`),
    '  Un token que solo existe en CSS no aparece al autocompletar, así que',
    '  nadie lo usa desde código: es cómo el sistema empieza a tener dos fuentes.',
  );
}

if (problemas.length > 0) {
  console.error('\n✗ check-tokens\n');
  for (const problema of problemas) console.error(`  ${problema}`);
  console.error('');
  process.exit(1);
}

console.log('✓ check-tokens');
console.log(`  ${enTs.size} tokens, iguales en styles.css y en el catálogo tipado`);
