#!/usr/bin/env node
/**
 * Verifica que ningún formulario sirva más de cuatro campos de una vez.
 *
 * ## Por qué hace falta un verificador y no basta la disciplina
 *
 * `MAX_CAMPOS_POR_PAGINA` vive en el contrato y `paginarCampos()` lo hace
 * cumplir — pero sólo para lo que **pasa por el motor**. Una pantalla que
 * escribe sus `<app-form-field>` a mano no lo toca, y ahí el tope no existe:
 * el 22/08/2026 había 41 formularios con más de cuatro campos en una sola
 * pantalla y **cero** usaban el motor, con el motor ya escrito y probado. Eso no
 * se arregla recordándolo; se arregla con algo que falle.
 *
 * ## Qué cuenta como un formulario
 *
 * Una plantilla con `[formGroup]` y controles dentro. Se cuentan los átomos de
 * formulario (`app-input`, `app-select`, …) y los nativos, porque el tope es
 * sobre lo que hay que contestar, no sobre cómo está construido.
 *
 * Se descuentan dos cosas, y las dos por el mismo motivo —no son campos que
 * alguien complete de corrido—:
 *
 *   - la vitrina de diseño, que muestra los átomos uno al lado del otro;
 *   - los buscadores y filtros de una tabla, que se declaran en
 *     {@link EXCEPCIONES} con su motivo escrito.
 *
 * ## Qué se acepta
 *
 * Que la plantilla use `<app-paginated-form>`, o que no llegue al tope. No se
 * acepta «tiene una barra de avance propia»: la barra sin la paginación es
 * decoración, y la paginación sin la barra deja a la persona sin saber cuánto
 * falta. El motor trae las dos y por eso es el motor lo que se exige.
 *
 * Uso: node scripts/check-form-pages.mjs
 */

import { join } from 'node:path';

import { read, repoPath, SRC_ROOT, walk } from './lib/scan.mjs';

/** El tope, espejo de `MAX_CAMPOS_POR_PAGINA`. Se comprueba que no se separen. */
const MAX_CAMPOS = 4;

/** Dónde vive el tope de verdad, para no dejar que las dos copias se separen. */
const CONTRATO = join(SRC_ROOT, 'app/shared/forms/paginated/paginated-form.types.ts');

/**
 * Plantillas que declaran controles sin ser un formulario que alguien completa.
 *
 * Cada excepción lleva su motivo escrito. Una lista sin motivos se convierte en
 * el sitio donde se esconde lo que no se quiso arreglar.
 */
const EXCEPCIONES = new Map([
  [
    'app/features/design-system-sample/design-system-sample.html',
    'la vitrina: muestra los átomos uno al lado del otro, no es un formulario',
  ],
  [
    'app/shared/components/organisms/paginated-form/paginated-form.html',
    'es el motor: sus controles son los que dibuja para otros',
  ],
  [
    'app/features/auth-providers/attribute-mappings-editor/attribute-mappings-editor.html',
    'es un repetidor: cada fila es una tarjeta con sus campos y se agrega a mano. La pantalla que lo usa sí pasa por el motor, con el editor como campo `custom`',
  ],
]);

/** Los controles que cuentan como «un campo que hay que contestar». */
const CONTROL =
  /<(app-input|app-select|app-textarea|app-checkbox|app-date-picker|app-radio-group|app-switch|app-file-input|app-reference-combobox|app-tree-select|input|select|textarea)[\s>]/g;

const problemas = [];

const contrato = read(CONTRATO);
const declarado = /MAX_CAMPOS_POR_PAGINA = (\d+)/.exec(contrato)?.[1];
if (declarado !== String(MAX_CAMPOS)) {
  problemas.push(
    `el contrato declara MAX_CAMPOS_POR_PAGINA = ${declarado} y este verificador comprueba ${MAX_CAMPOS}`,
  );
}

const plantillas = walk(SRC_ROOT, ['.html']);
let revisadas = 0;

for (const archivo of plantillas) {
  const relativa = repoPath(archivo).replace(/^src\//, '');
  if (EXCEPCIONES.has(relativa)) continue;

  const html = read(archivo);
  if (!html.includes('[formGroup]')) continue;
  if (html.includes('<app-paginated-form')) {
    revisadas += 1;
    continue;
  }

  const campos = (html.match(CONTROL) ?? []).length;
  revisadas += 1;
  if (campos > MAX_CAMPOS) {
    problemas.push(
      `'${relativa}' declara ${campos} campos en una sola pantalla y no usa <app-paginated-form>`,
    );
  }
}

if (revisadas === 0) {
  problemas.push('no se leyó ningún formulario: el lector quedó desincronizado del código');
}

if (problemas.length > 0) {
  console.error(`\n✗ check-form-pages — ${problemas.length} formulario(s) sin paginar\n`);
  for (const problema of problemas) console.error(`  ${problema}`);
  console.error('\n  Un formulario de este sistema se sirve de a una página, con un tope de');
  console.error('  cuatro campos y una barra de avance. Eso lo da <app-paginated-form>:');
  console.error('  se le pasan las páginas (paginarCampos() las arma) y el FormGroup de la');
  console.error('  pantalla. Si de verdad no es un formulario, agregalo a EXCEPCIONES con');
  console.error('  su motivo escrito.\n');
  process.exit(1);
}

console.log('✓ check-form-pages');
console.log(`  ${revisadas} formularios, ninguno pide más de ${MAX_CAMPOS} campos de una vez`);
