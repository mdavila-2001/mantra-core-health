#!/usr/bin/env node
/**
 * Verifica los contrastes declarados del sistema de diseño.
 *
 * Cierra el hallazgo A11Y-06: las pruebas comprobaban que los tokens
 * **existieran**, no que sus valores cumplieran. Un cambio de token podía
 * romper el contraste del modo oscuro sin que nada avisara — y de los dos
 * bloques de oscuro que `styles.css` mantiene duplicados, basta con tocar uno.
 *
 * No añade ninguna dependencia: es aritmética sobre valores que ya están en el
 * CSS. Resuelve las cadenas `var(--otro-token)` y las mezclas `rgba` sobre su
 * fondo, que es lo que hace falta para medir de verdad.
 *
 * Las excepciones E1–E3 que el sistema declara están enumeradas abajo: no se
 * ignoran, se **esperan**. Si una deja de incumplir, esto lo dice — porque una
 * excepción que ya no hace falta es deuda documental.
 *
 * Uso: node scripts/check-contrast.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT } from './lib/scan.mjs';

const CSS = read(join(REPO_ROOT, 'src/styles.css'));

// --- lectura de los tokens --------------------------------------------------

/**
 * Los tokens de un bloque, por su selector.
 *
 * `styles.css` declara tres bloques: `:root` (claro), el `@media` de oscuro por
 * preferencia del sistema, y `:root[data-theme='dark']` para la elección
 * manual. Los dos últimos están duplicados a propósito —CSS plano no permite
 * derivar uno del otro— y por eso se miden **los dos**.
 */
function bloque(desde, hasta) {
  const inicio = CSS.indexOf(desde);
  if (inicio === -1) return new Map();

  const fin = hasta === null ? CSS.length : CSS.indexOf(hasta, inicio);
  const cuerpo = CSS.slice(inicio, fin === -1 ? CSS.length : fin);

  const tokens = new Map();
  const declaracion = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = declaracion.exec(cuerpo)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

const RAMPAS = bloque(':root {', '/* ================= modo oscuro');
const CLARO = RAMPAS;
const OSCURO_SISTEMA = new Map([
  ...RAMPAS,
  ...bloque("@media (prefers-color-scheme: dark)", "/* …y el toggle manual"),
]);
const OSCURO_MANUAL = new Map([
  ...RAMPAS,
  ...bloque(":root[data-theme='dark'] {", '/* ---- base ---- */'),
]);

// --- color ------------------------------------------------------------------

/** Resuelve `var(--x)` en cadena hasta llegar a un color literal. */
function resolver(valor, tokens, profundidad = 0) {
  if (valor === undefined || profundidad > 10) return null;

  const variable = /^var\((--[\w-]+)\)$/.exec(valor.trim());
  if (variable !== null) {
    return resolver(tokens.get(variable[1]), tokens, profundidad + 1);
  }
  return valor.trim();
}

/** `#rrggbb` o `rgba(r,g,b,a)` → `{ r, g, b, a }` en 0–255 y 0–1. */
function aRgb(color) {
  if (color === null) return null;

  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex !== null) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }

  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i.exec(
    color,
  );
  if (rgba !== null) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  return null;
}

/**
 * Compone un color translúcido sobre su fondo.
 *
 * Sin esto, `--border-strong` en oscuro —que es `rgba(255,255,255,0.24)`— se
 * mediría como blanco puro y daría un contraste que nadie ve.
 */
function componer(frente, fondo) {
  if (frente.a >= 1) return frente;
  return {
    r: frente.r * frente.a + fondo.r * (1 - frente.a),
    g: frente.g * frente.a + fondo.g * (1 - frente.a),
    b: frente.b * frente.a + fondo.b * (1 - frente.a),
    a: 1,
  };
}

/** Luminancia relativa, WCAG 2.x §relative luminance. */
function luminancia({ r, g, b }) {
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(frente, fondo) {
  const a = luminancia(frente);
  const b = luminancia(fondo);
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

// --- pares a comprobar ------------------------------------------------------

/**
 * `nivel` es el mínimo de WCAG 2.2 AA: 4,5 para texto normal y 3 para texto
 * grande y para componentes de interfaz (§1.4.3 y §1.4.11).
 *
 * `excepcion` nombra las que el sistema declara en `identidad-visual.md` Parte
 * 8.2. Se esperan: si una **deja** de incumplir, el script lo dice.
 */
const PARES = [
  { tinta: '--text-primary', fondo: '--bg-surface', nivel: 4.5 },
  { tinta: '--text-secondary', fondo: '--bg-surface', nivel: 4.5 },
  // Las excepciones son **por tema**: E1 solo aplica al claro y E3 solo al
  // oscuro. Declararlas globales taparía un incumplimiento en el tema donde la
  // excepción no rige, que es justo lo que este script existe para evitar.
  { tinta: '--text-muted', fondo: '--bg-surface', nivel: 4.5, excepcion: { claro: 'E1' } },
  { tinta: '--brand-primary', fondo: '--bg-surface', nivel: 4.5 },
  {
    tinta: '--border-strong',
    fondo: '--bg-surface',
    nivel: 3,
    excepcion: { 'oscuro · sistema': 'E3', 'oscuro · manual': 'E3' },
  },
  { tinta: '--st-success-fg', fondo: '--st-success-bg', nivel: 4.5 },
  { tinta: '--st-warning-fg', fondo: '--st-warning-bg', nivel: 4.5 },
  { tinta: '--st-error-fg', fondo: '--st-error-bg', nivel: 4.5 },
  { tinta: '--st-info-fg', fondo: '--st-info-bg', nivel: 4.5 },
  { tinta: '--st-primary-fg', fondo: '--st-primary-bg', nivel: 4.5 },
  { tinta: '--st-secondary-fg', fondo: '--st-secondary-bg', nivel: 4.5 },
];

const TEMAS = [
  { nombre: 'claro', tokens: CLARO },
  { nombre: 'oscuro · sistema', tokens: OSCURO_SISTEMA },
  { nombre: 'oscuro · manual', tokens: OSCURO_MANUAL },
];

// --- comprobación -----------------------------------------------------------

const fallos = [];
const excepcionesResueltas = [];
const filas = [];

for (const tema of TEMAS) {
  for (const par of PARES) {
    const fondoRgb = aRgb(resolver(tema.tokens.get(par.fondo), tema.tokens));
    let tintaRgb = aRgb(resolver(tema.tokens.get(par.tinta), tema.tokens));

    if (fondoRgb === null || tintaRgb === null) {
      fallos.push(`${tema.nombre} · ${par.tinta} sobre ${par.fondo}: token ilegible`);
      continue;
    }

    tintaRgb = componer(tintaRgb, fondoRgb);
    const ratio = contraste(tintaRgb, fondoRgb);
    const cumple = ratio >= par.nivel;
    const excepcion = par.excepcion?.[tema.nombre];

    filas.push(
      `  ${cumple ? '✓' : excepcion ? '·' : '✗'} ${tema.nombre.padEnd(18)} ` +
        `${par.tinta.padEnd(20)} sobre ${par.fondo.padEnd(20)} ` +
        `${ratio.toFixed(2).padStart(6)}:1  (mín. ${par.nivel})` +
        (excepcion ? `  ← ${excepcion}` : ''),
    );

    if (!cumple && excepcion === undefined) {
      fallos.push(
        `${tema.nombre} · ${par.tinta} sobre ${par.fondo}: ` +
          `${ratio.toFixed(2)}:1, por debajo de ${par.nivel}:1`,
      );
    }

    if (cumple && excepcion !== undefined) {
      excepcionesResueltas.push(
        `${tema.nombre} · ${par.tinta} sobre ${par.fondo}: ${ratio.toFixed(2)}:1 ` +
          `ya cumple — la excepción ${excepcion} sobra`,
      );
    }
  }
}

// --- informe ----------------------------------------------------------------

console.log(fallos.length > 0 ? '\n✗ check-contrast\n' : '✓ check-contrast');
for (const fila of filas) console.log(fila);

if (excepcionesResueltas.length > 0) {
  console.log('');
  for (const nota of excepcionesResueltas) console.log(`  ⚠ ${nota}`);
}

if (fallos.length > 0) {
  console.error('');
  for (const fallo of fallos) console.error(`  ✗ ${fallo}`);
  console.error('');
  process.exit(1);
}

console.log('');
console.log(
  `  ${filas.length} combinaciones medidas · las excepciones E1–E3 se esperan, no se ignoran`,
);
