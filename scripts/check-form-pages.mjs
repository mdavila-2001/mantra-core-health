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
  [
    'app/features/agenda/agenda-create/agenda-create.html',
    'es un constructor de agenda semanal, no un cuestionario: la rejilla de días, el horario de cada uno y la vista previa de los turnos que van a salir se leen juntos, y partirlos en páginas de cuatro escondería justamente lo que hay que comparar',
  ],
]);

/**
 * Lo que **falta migrar**, con fecha y motivo.
 *
 * No es lo mismo que una excepción: una excepción dice «esto no es un
 * formulario lineal»; un pendiente dice «esto lo es y todavía no se hizo». Se
 * imprime siempre y en voz alta, y la lista **sólo puede encoger**: si una
 * pantalla de acá ya usa el motor, el verificador falla para que se la saque.
 *
 * Que no rompa el CI es deliberado: un check en rojo permanente se aprende a
 * ignorar, y entonces deja de proteger también a lo nuevo — que es lo que este
 * verificador existe para proteger.
 */
const PENDIENTES = new Map([
  [
    'app/features/auth/register-patient/register-patient.html',
    'la está reescribiendo otra rama (municipio de residencia, 22/08/2026); migrarla al motor en paralelo sería pisarse',
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
  const pendiente = PENDIENTES.has(relativa);

  if (html.includes('<app-paginated-form')) {
    revisadas += 1;
    if (pendiente) {
      problemas.push(
        `'${relativa}' ya usa el motor: sacalo de PENDIENTES para que la lista no mienta`,
      );
    }
    continue;
  }

  const campos = (html.match(CONTROL) ?? []).length;
  revisadas += 1;
  if (campos > MAX_CAMPOS && !pendiente) {
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

if (PENDIENTES.size > 0) {
  console.log(`\n  ${PENDIENTES.size} pendiente(s) de migrar:`);
  for (const [ruta, motivo] of PENDIENTES) console.log(`    ${ruta}\n      ${motivo}`);
}
