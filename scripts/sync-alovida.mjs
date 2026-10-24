/* Genera src/styles/alovida.css a partir de la hoja normativa de la bóveda.
   Tres transformaciones, ninguna más:
     1. las tipografías pasan a servirse desde /alovida/tipografias/
     2. cada selector de tema oscuro de la bóveda (`data-tema="oscuro"`) gana un
        gemelo con el contrato del front (`data-theme="dark"`), para que las dos
        formas de estampar el tema pinten lo mismo.
     3. las correcciones de contraste que la bóveda todavía no aplicó en origen
        (ver CORRECCIONES). */
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  '/Users/pablo/Documents/GitHub/mantra_core_technologies_health_docs/SALUD/Vistas/HTML/_assets/alovida.css';
const DESTINO = '/Users/pablo/Documents/GitHub/mantra-core-health/src/styles/alovida.css';

let css = readFileSync(ORIGEN, 'utf8').replace(/^﻿/, '');

// 1 · tipografías auto-hospedadas bajo public/
css = css.replace(/url\("tipografias\//g, 'url("/alovida/tipografias/');

/* 2 · puente de temas: data-tema (bóveda) ≡ data-theme (front).
   Los comentarios se apartan primero: la hoja está muy comentada en prosa, y
   una llave suelta dentro de un párrafo hacía que el barrido de selectores
   tomara texto corriente por un selector y lo reescribiera. */
const comentarios = [];
css = css.replace(/\/\*[\s\S]*?\*\//g, (bloque) => {
  comentarios.push(bloque);
  return `/*__C${comentarios.length - 1}__*/`;
});

let duplicados = 0;
css = css.replace(/([^{}@;]+)\{/g, (todo, selector) => {
  if (!selector.includes('data-tema')) return todo;
  const gemelos = selector
    .split(',')
    .filter((fragmento) => fragmento.includes('data-tema'))
    .map((fragmento) =>
      fragmento
        .replace(/data-tema="oscuro"/g, 'data-theme="dark"')
        .replace(/data-tema="claro"/g, 'data-theme="light"')
        .trim(),
    );
  if (!gemelos.length) return todo;
  duplicados += gemelos.length;
  return `${selector.trimEnd()},\n${gemelos.join(',\n')} {`;
});

css = css.replace(/\/\*__C(\d+)__\*\//g, (_, indice) => comentarios[Number(indice)]);

/* 3 · correcciones de contraste que la bóveda no aplicó en origen.
   Cada entrada es un incumplimiento MEDIDO de WCAG, no una preferencia. Se
   reaplican acá —y no a mano sobre el generado— porque el archivo se
   sobrescribe entero en cada regeneración: una corrección a mano dura hasta el
   próximo `node scripts/sync-alovida.mjs` y desaparece sin avisar.

   Una entrada se BORRA de esta lista en cuanto la bóveda corrija el valor en
   origen; si eso pasa y la entrada sigue acá, el aviso de abajo lo dice. */
const CORRECCIONES = [
  {
    token: '--aviso-tinta',
    de: '#8B6A47', // ámbar-700 · 4,46:1 sobre --aviso-bg #FBF2E8 — no llega a AA
    a: '#5E4B35', //  ámbar-800 · 7,49:1
    porque:
      'pinta .app-badge[data-tono="aviso"] (11,5 px) y .app-alert; es la misma ' +
      'corrección que styles.css ya documenta para --st-warning-fg',
    ambito: 'claro',
  },
  {
    token: '--tinta-3',
    de: '#787B7B', // 3,86:1 sobre marfil y 4,27 sobre blanco — era la excepción R1
    a: '#656768', //  el ivory-800 de v1.0 · 5,13:1 y 5,69:1
    porque:
      'es el texto terciario (ayudas de campo, migas, «opcional»); styles.css ' +
      'sube su gemelo --text-muted al mismo valor y check-contrast ya no lo exceptúa',
    ambito: 'claro',
  },
  {
    token: '--anillo-foco',
    de: 'rgba(79, 179, 169, .45)', // compuesto sobre blanco da 1,48:1 — WCAG 1.4.11 pide 3:1
    a: '#33706C', //                  el aqua-700 de v1.0, sólido · 5,71:1, y 5,16:1 sobre marfil
    porque:
      'es el anillo de foco de todo el marco; sobre el petróleo del nav manda ' +
      '--anillo-foco-nav (menta), que vive en la parte de la hoja mantenida a mano',
    ambito: 'claro',
  },
  {
    token: '--anillo-foco',
    de: 'rgba(87, 194, 183, .42)', // translúcido: su contraste depende de lo que haya debajo
    a: '#57C2B7', //                  la aguamarina nocturna, sólida · ≥6,5:1 en toda superficie oscura
    porque: 'el mismo anillo en oscuro, sin transparencia',
    ambito: 'oscuro',
  },
];

/* Los valores de origen pueden traer paréntesis y puntos (`rgba(…, .45)`): se
   escapan para que la expresión busque el texto literal. */
const literal = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let aplicadas = 0;
const noEncontradas = [];
for (const correccion of CORRECCIONES) {
  // Se ancla al valor de origen (`de`) y no sólo al token: un token que se
  // redeclara en el bloque oscuro con otro valor no se toca por accidente. Y
  // no `\b` al final: tras el `)` de un `rgba(…)` no hay límite de palabra.
  const declaracion = new RegExp(
    `(${correccion.token}\\s*:\\s*)${literal(correccion.de)}(?![0-9A-Fa-f])`,
    'i',
  );
  if (!declaracion.test(css)) {
    noEncontradas.push(correccion);
    continue;
  }
  css = css.replace(declaracion, `$1${correccion.a}`);
  aplicadas += 1;
}

const cabecera = `/* ============================================================================
    ALOVIDA v1.1 — hoja normativa del sistema de diseño.

    ARCHIVO GENERADO. No se edita a mano: se regenera desde la bóveda con
    scripts/sync-alovida.mjs. La fuente de verdad es
    SALUD/Vistas/HTML/_assets/alovida.css en el vault de documentación, que es
    la misma hoja contra la que están maquetadas las 133 vistas HTML.

    Diferencias con el original, las dos primeras mecánicas:
      · las tipografías se sirven desde /alovida/tipografias/ (public/)
      · los selectores de tema oscuro llevan gemelo en [data-theme="dark"],
        que es el atributo que estampa ThemeService.
      · ${CORRECCIONES.length} corrección(es) de contraste que la bóveda no aplicó en origen
        (${CORRECCIONES.map((c) => c.token).join(', ')}) — cada una marcada en su
        declaración. scripts/check-contrast.mjs mide esta hoja y las verifica.

    Los tokens de esta hoja (--tinta, --petroleo, --e1…--e6, --r-card…) son
    disjuntos de los de src/styles.css (--text-primary, --sp-4, --r-md…): las
    dos capas conviven y ninguna pisa a la otra.
    ========================================================================== */

`;

/* En la maqueta el fondo va escrito en el `style` del <body> de cada archivo,
   porque cada uno se abre suelto con doble clic. Acá el <body> es uno solo
   para toda la aplicación, así que la regla vive en la hoja. */
const puente = `

/* --- Puente con la aplicación ------------------------------------------- *
   Lo único que se agrega a la hoja de la bóveda, y no sale de ella: el fondo
   que allá llevaba cada archivo en su atributo \`style\`. */

body {
  background-image: url("/alovida/imagenes/fondo-vista.svg");
}
`;

writeFileSync(DESTINO, cabecera + css + puente, 'utf8');
console.log(
  `alovida.css generado · ${css.split('\n').length} líneas · ${duplicados} selectores de tema puenteados · ${aplicadas} corrección(es) de contraste`,
);
for (const correccion of CORRECCIONES) {
  if (noEncontradas.includes(correccion)) continue;
  console.log(`  ${correccion.token}: ${correccion.de} → ${correccion.a} — ${correccion.porque}`);
}

/* Una corrección que ya no encuentra su valor es una buena noticia con forma de
   aviso: significa que la bóveda lo corrigió en origen y esta entrada sobra. No
   se falla —la hoja se generó bien— pero queda dicho, porque una corrección
   fantasma es deuda que nadie vuelve a mirar. */
for (const correccion of noEncontradas) {
  console.warn(
    `  ⚠ ${correccion.token}: ya no vale ${correccion.de} en la bóveda. ` +
      `Comprobá el valor de origen y, si cumple, borrá la entrada de CORRECCIONES.`,
  );
}
