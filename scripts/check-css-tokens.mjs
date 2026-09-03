#!/usr/bin/env node
/**
 * Verifica que ningún `var(--token)` apunte a una variable que no existe.
 *
 * ## El defecto que esto impide
 *
 * Un token inexistente **no rompe nada de forma visible**: la declaración se
 * descarta y la propiedad cae a su valor inicial o al heredado. El resultado es
 * una pantalla que compila, pasa las pruebas y se ve mal.
 *
 * Los tres casos que motivaron este archivo, todos encontrados mirando
 * capturas y no ejecutando código:
 *
 *  - `--radius-md` en cuatro pantallas nuevas. El token real es `--r-md`, así
 *    que `border-radius` caía a `0` y las cajas quedaban con esquina cuadrada
 *    —las únicas de la aplicación—.
 *  - `--fs-sm` / `--fs-xs` / `--fs-lg`. Los reales son `--fs-caption`,
 *    `--fs-overline` y `--fs-h3`. `font-size` se heredaba del cuerpo, así que
 *    una leyenda secundaria se leía del mismo tamaño que el texto principal.
 *  - **`--st-success-border` y sus hermanos** en las vistas de mes y semana de
 *    la agenda. El real termina en `-bd`. Consecuencia: **ningún color de borde
 *    por estado se pintaba**, que es media regla de accesibilidad —«no depender
 *    sólo del color» exige que el estado se distinga, y ahí no se distinguía
 *    de ninguna forma—.
 *
 * Y hay un modo de fallo peor: `--stroke-1` dentro de un `border: var(--stroke-1)
 * solid …` invalida **el atajo entero**, no sólo esa parte. El borde desaparece.
 *
 * ## Qué exige
 *
 * Que todo `var(--x)` cumpla una de dos: que `--x` esté declarada en algún lado
 * del proyecto, o que el uso traiga **valor de reserva** (`var(--x, algo)`).
 * La reserva es la forma legítima de usar un token que otro fija en tiempo de
 * ejecución —`--raton-x`, `--avance`— o que pertenece a un tema opcional.
 *
 * No opina sobre si el token elegido es el adecuado: sólo sobre si existe.
 *
 * Uso: node scripts/check-css-tokens.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = 'src';

/**
 * Archivos que se revisan. El `.ts` y el `.html` entran porque el proyecto
 * también escribe estilos en plantillas y en `styles:` de componente.
 */
const EXTENSIONES = ['.css', '.html', '.ts'];

/**
 * Lo que no se revisa.
 *
 * Las pruebas declaran tokens falsos a propósito —para comprobar justamente
 * qué pasa cuando no existen—, así que contarlas daría un fallo permanente.
 */
const IGNORADOS = [/\.spec\.ts$/, /\.stories\.ts$/];

/**
 * Recorre un directorio y devuelve los archivos que hay que mirar.
 *
 * @param {string} dir - Directorio a recorrer.
 * @returns {string[]} Rutas de archivo.
 */
function archivosDe(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosDe(ruta));
      continue;
    }
    if (!EXTENSIONES.some((ext) => ruta.endsWith(ext))) continue;
    if (IGNORADOS.some((re) => re.test(ruta))) continue;
    salida.push(ruta);
  }
  return salida;
}

const archivos = archivosDe(RAIZ);

// Primera pasada: qué tokens existen. Se acepta cualquier declaración, esté
// donde esté — un componente puede definir los suyos en su propio `:host`.
const definidos = new Set();
for (const ruta of archivos) {
  const texto = readFileSync(ruta, 'utf8');
  for (const m of texto.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    definidos.add(m[1]);
  }
}

// Segunda pasada: qué se usa sin definir y sin reserva.
/** @type {Map<string, {archivos: Set<string>, usos: number}>} */
const huerfanos = new Map();
for (const ruta of archivos) {
  // Sin los comentarios de bloque. Un `var(--x)` dentro de un comentario no
  // pinta nada, y este archivo se documenta a sí mismo nombrando los tokens
  // rotos que lo motivaron: sin esto, el control se denuncia solo.
  const texto = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // El tercer grupo atrapa `var(--dur-${duracion})`: un nombre que se arma en
  // tiempo de ejecución. No se puede comprobar desde acá —el sufijo no existe
  // hasta que el código corre—, así que se deja pasar en vez de denunciarlo
  // como huérfano. Es el único agujero conocido de este control.
  for (const m of texto.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(,|[$][{])?/g)) {
    const [, nombre, reservaOArmado] = m;
    if (reservaOArmado || definidos.has(nombre)) continue;
    const dato = huerfanos.get(nombre) ?? { archivos: new Set(), usos: 0 };
    dato.archivos.add(relative(process.cwd(), ruta));
    dato.usos += 1;
    huerfanos.set(nombre, dato);
  }
}

if (huerfanos.size === 0) {
  console.log(
    `✓ check-css-tokens — ${definidos.size} tokens declarados, ningún var() huérfano`,
  );
  process.exit(0);
}

const total = [...huerfanos.values()].reduce((n, d) => n + d.usos, 0);
console.error(
  `\n✗ check-css-tokens — ${huerfanos.size} token(s) sin declarar, ${total} uso(s) sin valor de reserva\n`,
);

for (const [nombre, dato] of [...huerfanos].sort((a, b) => b[1].usos - a[1].usos)) {
  console.error(`  ${nombre}  (${dato.usos} uso(s))`);
  for (const archivo of [...dato.archivos].sort()) {
    console.error(`      ${archivo}`);
  }
}

console.error(`
  Un token que no existe no rompe la compilación: la declaración se descarta y
  la propiedad cae a su valor inicial. La pantalla se ve mal y las pruebas
  pasan.

  Dos salidas, y las dos son válidas:
    · usar el token real  — mirá los declarados en 'src/styles.css' y
      'src/styles/redsat.css', que son espacios de nombres distintos;
    · dar valor de reserva — 'var(--x, 12px)', para lo que se fija en tiempo
      de ejecución o pertenece a un tema opcional.
`);

process.exit(1);
