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
 * El mecanismo de excepciones sigue (un par puede declarar `excepcion`, y si
 * deja de incumplir esto lo dice), pero hoy NO hay ninguna: E3, R2 y R3 —los
 * bordes de control y el petróleo en oscuro— se cerraron el 2026-10-11
 * subiendo los tokens, sin bajar ningún umbral.
 *
 * Mide **las dos hojas**, no una:
 *
 *   · `src/styles.css`        — ALOVIDA v1.0, el banco de componentes Angular.
 *   · `src/styles/alovida.css` — ALOVIDA v1.1, la hoja de la bóveda. Pinta el
 *     armazón de TODAS las pantallas y las 141 portadas de `features/alovida/`.
 *
 * La segunda no se medía, y ahí reapareció un defecto que la primera ya había
 * corregido: ámbar-700 sobre ámbar-50 da 4,46:1 y no llega a AA. En v1.0 lo
 * cazó este mismo script y se subió al 800; en la hoja de la bóveda vivió sin
 * que nadie lo viera, pintando badges de 11,5 px. Un guardarraíl que sólo mira
 * una de las dos hojas del sistema de diseño no es un guardarraíl.
 *
 * También mide el **anillo de foco** (WCAG 1.4.11: 3:1 contra lo que lo rodea).
 * Era aguamarina al 45 %, y compuesto sobre blanco daba 1,48:1: el script no
 * lo miraba porque sólo tenía pares de texto. Y mide contra el **marfil**
 * (#F6F3ED), que ya no es un token de superficie de ninguna de las dos hojas
 * —la página es blanca desde el 2026-09-10— pero sigue pintando secciones de la
 * bóveda, y es el peor caso de la tinta terciaria.
 *
 * Uso: node scripts/check-contrast.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT } from './lib/scan.mjs';

const CSS = read(join(REPO_ROOT, 'src/styles.css'));
const CSS_ALOVIDA = read(join(REPO_ROOT, 'src/styles/alovida.css'));

// --- lectura de los tokens --------------------------------------------------

/**
 * Los tokens de un bloque, por su selector.
 *
 * `styles.css` declara tres bloques: `:root` (claro), el `@media` de oscuro por
 * preferencia del sistema, y `:root[data-theme='dark']` para la elección
 * manual. Los dos últimos están duplicados a propósito —CSS plano no permite
 * derivar uno del otro— y por eso se miden **los dos**.
 */
function bloque(desde, hasta, css = CSS) {
  const inicio = css.indexOf(desde);
  if (inicio === -1) return new Map();

  const fin = hasta === null ? css.length : css.indexOf(hasta, inicio);
  const cuerpo = css.slice(inicio, fin === -1 ? css.length : fin);

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

/**
 * El marfil de marca (`--c-ivory-500`). No es la superficie de ningún tema,
 * así que se mide como fondo literal y **sólo en claro**: en oscuro no hay
 * marfil detrás de nada.
 */
const MARFIL = '#F6F3ED';

/** El fondo de un par: un token del tema, o un color literal. */
function fondoDe(par, tokens) {
  return par.fondo.startsWith('#') ? par.fondo : resolver(tokens.get(par.fondo), tokens);
}

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
 *
 * `soloEn` limita un par a un tema: el marfil sólo existe en claro.
 */
const PARES = [
  { tinta: '--text-primary', fondo: '--bg-surface', nivel: 4.5 },
  { tinta: '--text-secondary', fondo: '--bg-surface', nivel: 4.5 },
  // Las excepciones son **por tema**: E3 solo aplica al
  // oscuro. Declararlas globales taparía un incumplimiento en el tema donde la
  // excepción no rige, que es justo lo que este script existe para evitar.
  //
  // `--text-muted` ya no tiene excepción: era E1 (neutral-300, 3,86:1 sobre
  // marfil) y pasó a ivory-800. Se mide contra las cuatro superficies y el
  // marfil, porque su peor caso nunca fue la tarjeta.
  { tinta: '--text-muted', fondo: '--bg-surface', nivel: 4.5 },
  { tinta: '--text-muted', fondo: '--bg-surface-alt', nivel: 4.5 },
  { tinta: '--text-muted', fondo: '--bg-inset', nivel: 4.5 },
  { tinta: '--text-muted', fondo: MARFIL, nivel: 4.5, soloEn: 'claro' },
  // El anillo de foco es un componente de interfaz: 3:1 contra lo que lo rodea.
  { tinta: '--focus-ring', fondo: '--bg-base', nivel: 3 },
  { tinta: '--focus-ring', fondo: '--bg-surface', nivel: 3 },
  { tinta: '--focus-ring', fondo: '--bg-surface-alt', nivel: 3 },
  { tinta: '--focus-ring', fondo: '--bg-inset', nivel: 3 },
  { tinta: '--focus-ring', fondo: MARFIL, nivel: 3, soloEn: 'claro' },
  { tinta: '--brand-primary', fondo: '--bg-surface', nivel: 4.5 },
  // Borde de control: 3:1 (WCAG 1.4.11) contra TODA superficie donde vive un
  // campo. Era la excepción E3 en oscuro (velo al 24 %, 2,15:1); se cerró
  // subiendo el velo al 40 %, y se mide también la superficie alta (peor caso).
  { tinta: '--border-strong', fondo: '--bg-base', nivel: 3 },
  { tinta: '--border-strong', fondo: '--bg-surface', nivel: 3 },
  { tinta: '--border-strong', fondo: '--bg-surface-alt', nivel: 3 },
  { tinta: '--border-strong', fondo: '--bg-inset', nivel: 3 },
  { tinta: '--st-success-fg', fondo: '--st-success-bg', nivel: 4.5 },
  { tinta: '--st-warning-fg', fondo: '--st-warning-bg', nivel: 4.5 },
  { tinta: '--st-error-fg', fondo: '--st-error-bg', nivel: 4.5 },
  { tinta: '--st-info-fg', fondo: '--st-info-bg', nivel: 4.5 },
  { tinta: '--st-primary-fg', fondo: '--st-primary-bg', nivel: 4.5 },
  { tinta: '--st-secondary-fg', fondo: '--st-secondary-bg', nivel: 4.5 },
  { tinta: '--st-tertiary-fg', fondo: '--st-tertiary-bg', nivel: 4.5 },
];

const TEMAS = [
  { nombre: 'claro', tokens: CLARO },
  { nombre: 'oscuro · sistema', tokens: OSCURO_SISTEMA },
  { nombre: 'oscuro · manual', tokens: OSCURO_MANUAL },
];

// --- la hoja de la bóveda (ALOVIDA v1.1) -------------------------------------

/* El bloque claro es el `:root` de la sección «1 · Tokens»; el oscuro es el
   gemelo [data-theme="dark"] que sync-alovida.mjs genera. El oscuro se apila
   sobre el claro porque redeclara los colores pero no las medidas. */
const ALOVIDA_CLARO = bloque(':root {', '/* --- 2 · Base', CSS_ALOVIDA);
const ALOVIDA_OSCURO = new Map([
  ...ALOVIDA_CLARO,
  ...bloque(':root[data-theme="dark"] {', '/* La imagen de fondo', CSS_ALOVIDA),
]);

/**
 * Los pares de la hoja de la bóveda.
 *
 * A diferencia de v1.0, la tinta se mide contra **las tres superficies** y no
 * sólo contra la tarjeta: es la lección que `identidad-visual.md` Parte 8 deja
 * escrita —«un token se mide contra *todas* las superficies, no contra la
 * base»— y es la que destapa que `--tinta-3` sobre marfil está peor que sobre
 * blanco.
 *
 * Esta hoja ya no tiene excepciones. `R1` (`--tinta-3` en claro) se cerró
 * subiendo el token a #656768; `R2` (borde de control en oscuro, 2,47:1) y
 * `R3` (petróleo en oscuro) se cerraron el 2026-10-11 — ver abajo.
 */

/* R3 (cerrada) · `--petroleo` en OSCURO estaba sobrecargado: era la TINTA de
   `a[app-link]` (≥4,5:1 contra la superficie) y el RELLENO del botón primario
   (≥4,5:1 con #fff encima), umbrales que se mueven en sentido contrario. Con
   #12719F el enlace daba 3,09:1 sobre la tarjeta. Se partió en dos:

     · `--petroleo`          tinta   · oscuro #4FA8D6 → 6,92 página · 6,29 tarjeta
     · `--petroleo-relleno`  relleno · oscuro #12719F → 5,40 con blanco encima

   En claro los dos valen #0B557E. Se miden los dos trabajos por separado; el
   relleno contra #FFFFFF literal, porque el contraste es simétrico. */
const PARES_ALOVIDA = [
  { tinta: '--tinta', fondo: '--sup-tarjeta', nivel: 4.5 },
  { tinta: '--tinta', fondo: '--sup-pagina', nivel: 4.5 },
  { tinta: '--tinta', fondo: '--sup-inset', nivel: 4.5 },
  { tinta: '--tinta-2', fondo: '--sup-tarjeta', nivel: 4.5 },
  { tinta: '--tinta-2', fondo: '--sup-pagina', nivel: 4.5 },
  { tinta: '--tinta-3', fondo: '--sup-tarjeta', nivel: 4.5 },
  { tinta: '--tinta-3', fondo: '--sup-pagina', nivel: 4.5 },
  { tinta: '--tinta-3', fondo: '--sup-inset', nivel: 4.5 },
  { tinta: '--tinta-3', fondo: MARFIL, nivel: 4.5, soloEn: 'claro' },
  { tinta: '--tinta-marca', fondo: '--sup-tarjeta', nivel: 4.5 },
  { tinta: '--petroleo', fondo: '--sup-pagina', nivel: 4.5 },
  { tinta: '--petroleo', fondo: '--sup-tarjeta', nivel: 4.5 },
  { tinta: '--petroleo', fondo: '--sup-inset', nivel: 4.5 },
  { tinta: '--petroleo-relleno', fondo: '#FFFFFF', nivel: 4.5 },
  { tinta: '--borde-ctrl', fondo: '--sup-pagina', nivel: 3 },
  { tinta: '--borde-ctrl', fondo: '--sup-tarjeta', nivel: 3 },
  { tinta: '--borde-ctrl', fondo: '--sup-inset', nivel: 3 },
  { tinta: '--ok-tinta', fondo: '--ok-bg', nivel: 4.5 },
  { tinta: '--aviso-tinta', fondo: '--aviso-bg', nivel: 4.5 },
  { tinta: '--error-tinta', fondo: '--error-bg', nivel: 4.5 },
  { tinta: '--info-tinta', fondo: '--info-bg', nivel: 4.5 },
  { tinta: '--neutro-tinta', fondo: '--neutro-bg', nivel: 4.5 },
  // Anillo de foco: 3:1 (WCAG 1.4.11). En el nav manda `--anillo-foco-nav`:
  // en oscuro el nav es petróleo y el anillo general ahí desaparece. Detrás
  // del nav va `--nav-carril` (marfil en claro, petróleo-x en oscuro).
  { tinta: '--anillo-foco', fondo: '--sup-pagina', nivel: 3 },
  { tinta: '--anillo-foco', fondo: '--sup-tarjeta', nivel: 3 },
  { tinta: '--anillo-foco', fondo: '--sup-inset', nivel: 3 },
  { tinta: '--anillo-foco', fondo: MARFIL, nivel: 3, soloEn: 'claro' },
  { tinta: '--anillo-foco-nav', fondo: '--sup-nav', nivel: 3 },
  { tinta: '--anillo-foco-nav', fondo: '--nav-carril', nivel: 3 },
];

const TEMAS_ALOVIDA = [
  { nombre: 'claro', tokens: ALOVIDA_CLARO },
  { nombre: 'oscuro', tokens: ALOVIDA_OSCURO },
];

const HOJAS = [
  { nombre: 'src/styles.css · ALOVIDA v1.0', temas: TEMAS, pares: PARES },
  { nombre: 'src/styles/alovida.css · ALOVIDA v1.1 (bóveda)', temas: TEMAS_ALOVIDA, pares: PARES_ALOVIDA },
];

// --- comprobación -----------------------------------------------------------

const fallos = [];
const excepcionesResueltas = [];
const filas = [];

for (const hoja of HOJAS) {
  filas.push('', `  ── ${hoja.nombre}`);
  for (const tema of hoja.temas) {
    for (const par of hoja.pares) {
      if (par.soloEn !== undefined && par.soloEn !== tema.nombre) continue;
      const donde = `${hoja.nombre} · ${tema.nombre}`;
      const fondoRgb = aRgb(fondoDe(par, tema.tokens));
      let tintaRgb = aRgb(resolver(tema.tokens.get(par.tinta), tema.tokens));

      if (fondoRgb === null || tintaRgb === null) {
        fallos.push(`${donde} · ${par.tinta} sobre ${par.fondo}: token ilegible`);
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
          `${donde} · ${par.tinta} sobre ${par.fondo}: ` +
            `${ratio.toFixed(2)}:1, por debajo de ${par.nivel}:1`,
        );
      }

      if (cumple && excepcion !== undefined) {
        excepcionesResueltas.push(
          `${donde} · ${par.tinta} sobre ${par.fondo}: ${ratio.toFixed(2)}:1 ` +
            `ya cumple — la excepción ${excepcion} sobra`,
        );
      }
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
  `  ${filas.filter((f) => f.startsWith('  ✓') || f.startsWith('  ·') || f.startsWith('  ✗')).length} ` +
    `combinaciones medidas en ${HOJAS.length} hojas · sin excepciones declaradas`,
);
