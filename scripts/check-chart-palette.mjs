#!/usr/bin/env node
/**
 * Valida la paleta de los gráficos con el validador de la skill `dataviz`
 * (`scripts/lib/validate_palette.js`, copiado tal cual) contra la superficie
 * REAL del proyecto, no la por defecto del guion.
 *
 * Por qué existe: la ADR-0017 copió la paleta de referencia sin revalidarla
 * contra `--bg-surface` en oscuro (petróleo #0A2B3D) y el slot 6 daba 2,98:1.
 * Frente 05 H1 (docs/trabajo/2026-10-31-portal-observabilidad-gobierno/).
 *
 * Lee `src/styles.css` como `check-contrast.mjs` (claro · oscuro por sistema ·
 * oscuro manual), resuelve `--bg-surface` por tema y mide:
 *   · categórica `--chart-1..8`, pares adyacentes;
 *   · los 3 primeros slots con `--pairs all` (tope de 3 series en dispersión);
 *   · ordinal `--chart-ord-1..4` con `--ordinal`;
 *   · los dos brazos del divergente (`neg-soft→neg`, `pos-soft→pos`) con `--ordinal`.
 *
 * Falla (exit 1) ante cualquier FAIL del validador o ante un WARN de contraste
 * (< 3:1) que no esté declarado en `RELEVO`. Un relevo declarado que ya cumple
 * también se avisa. Un WARN de CVD (banda 6–8) se informa pero no falla: el
 * validador lo permite con codificación secundaria, que `ChartPanel` ya da.
 *
 * Uso: node scripts/check-chart-palette.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT } from './lib/scan.mjs';

/*
 * El validador de la skill se copia SIN tocar (`.js` con sintaxis ESM, en un
 * paquete sin `type`): Node lo reanaliza como módulo y avisa. Se silencia sólo
 * ese aviso, durante la importación.
 */
const emitir = process.emitWarning;
process.emitWarning = (aviso, ...resto) => {
  const texto = typeof aviso === 'string' ? aviso : (aviso?.message ?? '');
  const codigo = resto[0]?.code ?? resto[1] ?? aviso?.code;
  if (codigo === 'MODULE_TYPELESS_PACKAGE_JSON' || texto.includes('MODULE_TYPELESS')) return;
  return emitir.call(process, aviso, ...resto);
};
const { validate, validateOrdinal } = await import('./lib/validate_palette.js');
process.emitWarning = emitir;

/**
 * Tokens de serie cuyo contraste (< 3:1) contra `--bg-surface` está declarado
 * como «relevo»: sólo se pueden usar con rótulo directo o tabla (ChartPanel da
 * la tabla). Claves = nombre de tema; valor = tokens.
 */
const RELEVO = {
  claro: new Set(['--chart-3', '--chart-4', '--chart-5']),
  oscuro: new Set(),
};

const CSS = read(join(REPO_ROOT, 'src/styles.css'));

function bloque(desde, hasta) {
  const inicio = CSS.indexOf(desde);
  if (inicio === -1) return new Map();
  const fin = hasta === null ? CSS.length : CSS.indexOf(hasta, inicio);
  const cuerpo = CSS.slice(inicio, fin === -1 ? CSS.length : fin);
  const tokens = new Map();
  const declaracion = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = declaracion.exec(cuerpo)) !== null) tokens.set(m[1], m[2].trim());
  return tokens;
}

const CLARO = bloque(':root {', '/* ================= modo oscuro');
const TEMAS = [
  { nombre: 'claro', modo: 'light', relevo: RELEVO.claro, tokens: CLARO },
  {
    nombre: 'oscuro · sistema',
    modo: 'dark',
    relevo: RELEVO.oscuro,
    tokens: new Map([
      ...CLARO,
      ...bloque('@media (prefers-color-scheme: dark)', '/* …y el toggle manual'),
    ]),
  },
  {
    nombre: 'oscuro · manual',
    modo: 'dark',
    relevo: RELEVO.oscuro,
    tokens: new Map([...CLARO, ...bloque(":root[data-theme='dark'] {", '/* ---- base ---- */')]),
  },
];

function resolver(valor, tokens, prof = 0) {
  if (valor === undefined || prof > 10) return null;
  const v = /^var\((--[\w-]+)\)$/.exec(valor.trim());
  if (v !== null) return resolver(tokens.get(v[1]), tokens, prof + 1);
  return valor.trim();
}

const SERIE = Array.from({ length: 8 }, (_, i) => `--chart-${i + 1}`);
const ORDINAL = [1, 2, 3, 4].map((n) => `--chart-ord-${n}`);
const BRAZO_FRIO = ['--chart-div-neg-soft', '--chart-div-neg'];
const BRAZO_CALIDO = ['--chart-div-pos-soft', '--chart-div-pos'];

const fallos = [];
const salida = [];
const log = (linea = '') => salida.push(linea);

function colores(tema, tokens) {
  return tokens.map((t) => {
    const hex = resolver(tema.tokens.get(t), tema.tokens);
    if (hex === null || !/^#[0-9a-f]{6}$/i.test(hex)) {
      fallos.push(`${tema.nombre} · ${t}: no resuelve a #rrggbb (${hex})`);
      return '#000000';
    }
    return hex.toLowerCase();
  });
}

function informe(titulo, tema, nombres, hexes, resultado, { categorica, completa = false }) {
  log(`\n## ${tema.nombre} · ${titulo}`);
  log(`   ${nombres.map((n, i) => `${n}=${hexes[i]}`).join(' ')}`);
  for (const [nombre, estado, detalle] of resultado.report) {
    const glifo = { true: 'PASS', false: 'FAIL', pass: 'PASS', floor: 'WARN', fail: 'FAIL', relief: 'WARN' }[
      estado
    ];
    log(`  [${glifo}] ${nombre.padEnd(22)} ${detalle}`);
    if (glifo === 'FAIL') fallos.push(`${tema.nombre} · ${titulo} · ${nombre}: ${detalle}`);
    if (categorica && nombre === 'Contrast vs surface' && glifo === 'WARN') {
      const bajos = hexes
        .map((h, i) => ({ h, token: nombres[i] }))
        .filter(({ h }) => detalle.toLowerCase().includes(h));
      const sinDeclarar = bajos.filter(({ token }) => !tema.relevo.has(token));
      for (const { token, h } of sinDeclarar) {
        fallos.push(`${tema.nombre} · ${token} (${h}) < 3:1 sobre la superficie y no está en RELEVO`);
      }
      const sobrantes = (completa ? [...tema.relevo] : []).filter((t) => !bajos.some((b) => b.token === t));
      for (const t of sobrantes) log(`  [AVISO] ${t} está en RELEVO pero ya cumple 3:1 — sobra`);
    }
  }
  if (!resultado.ok && !fallos.length) fallos.push(`${tema.nombre} · ${titulo}: el validador falló`);
}

log('# check-chart-palette — validador de la skill `dataviz` contra la superficie real del proyecto');
log(`# fecha: ${new Date().toISOString()}`);

for (const tema of TEMAS) {
  const superficie = resolver(tema.tokens.get('--bg-surface'), tema.tokens);
  if (superficie === null || !/^#[0-9a-f]{6}$/i.test(superficie)) {
    fallos.push(`${tema.nombre}: --bg-surface no resuelve a #rrggbb (${superficie})`);
    continue;
  }
  const opts = { mode: tema.modo, surface: superficie.toLowerCase() };
  log(`\n# ===== ${tema.nombre} · superficie --bg-surface = ${superficie} =====`);

  const serie = colores(tema, SERIE);
  informe('categórica 1..8 (adyacentes)', tema, SERIE, serie, validate(serie, opts), {
    categorica: true,
    completa: true,
  });

  const tres = serie.slice(0, 3);
  informe(
    'categórica 1..3 (all-pairs: tope en dispersión)',
    tema,
    SERIE.slice(0, 3),
    tres,
    validate(tres, { ...opts, pairs: 'all' }),
    { categorica: true },
  );

  const ord = colores(tema, ORDINAL);
  informe('ordinal 1..4', tema, ORDINAL, ord, validateOrdinal(ord, opts), { categorica: false });

  for (const [titulo, tokens] of [
    ['divergente · brazo frío', BRAZO_FRIO],
    ['divergente · brazo cálido', BRAZO_CALIDO],
  ]) {
    const hexes = colores(tema, tokens);
    informe(titulo, tema, tokens, hexes, validateOrdinal(hexes, opts), { categorica: false });
  }
}

console.log(salida.join('\n'));
if (fallos.length > 0) {
  console.error('\n✗ check-chart-palette\n');
  for (const f of fallos) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}
console.log('\n✓ check-chart-palette: sin FAIL y sin WARN de contraste fuera de RELEVO');
