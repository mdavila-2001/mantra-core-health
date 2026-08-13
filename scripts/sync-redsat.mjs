/* Genera src/styles/redsat.css a partir de la hoja normativa de la bóveda.
   Dos transformaciones, ninguna más:
     1. las tipografías pasan a servirse desde /redsat/tipografias/
     2. cada selector de tema oscuro de la bóveda (`data-tema="oscuro"`) gana un
        gemelo con el contrato del front (`data-theme="dark"`), para que las dos
        formas de estampar el tema pinten lo mismo. */
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN =
  '/Users/pablo/Documents/GitHub/mantra_core_technologies_health_docs/SALUD/Vistas/HTML/_assets/redsat.css';
const DESTINO = '/Users/pablo/Documents/GitHub/mantra-core-health/src/styles/redsat.css';

let css = readFileSync(ORIGEN, 'utf8').replace(/^﻿/, '');

// 1 · tipografías auto-hospedadas bajo public/
css = css.replace(/url\("tipografias\//g, 'url("/redsat/tipografias/');

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

const cabecera = `/* ============================================================================
    REDSAT v1.1 — hoja normativa del sistema de diseño.

    ARCHIVO GENERADO. No se edita a mano: se regenera desde la bóveda con
    scripts/sync-redsat.mjs. La fuente de verdad es
    SALUD/Vistas/HTML/_assets/redsat.css en el vault de documentación, que es
    la misma hoja contra la que están maquetadas las 133 vistas HTML.

    Diferencias con el original, ambas mecánicas:
      · las tipografías se sirven desde /redsat/tipografias/ (public/)
      · los selectores de tema oscuro llevan gemelo en [data-theme="dark"],
        que es el atributo que estampa ThemeService.

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
  background-image: url("/redsat/imagenes/fondo-vista.svg");
}
`;

writeFileSync(DESTINO, cabecera + css + puente, 'utf8');
console.log(`redsat.css generado · ${css.split('\n').length} líneas · ${duplicados} selectores de tema puenteados`);
