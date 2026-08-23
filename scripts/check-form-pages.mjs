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
const PENDIENTES = new Map([]);

/** Los controles que cuentan como «un campo que hay que contestar». */
const CONTROL =
  /<(app-input|app-select|app-textarea|app-checkbox|app-date-picker|app-radio-group|app-switch|app-file-input|app-reference-combobox|app-tree-select|input|select|textarea)[\s>]/g;

/**
 * Los grupos de una plantilla que piden más de {@link MAX_CAMPOS} de una vez.
 *
 * La cuenta es **por formulario, no por archivo**. Una pantalla puede tener más
 * de un formulario independiente —cada uno con su `<form>` y su botón de
 * enviar— y entonces nadie contesta más de cuatro cosas de corrido, que es lo
 * que la regla protege. Sumar toda la plantilla acusaba a esas pantallas de
 * algo que no hacen: el tablero de contabilidad tiene un alta de ingreso de
 * tres campos, un alta de gasto de cuatro y un filtro de práctica, y sumados
 * dan ocho.
 *
 * Lo que queda fuera de todo `<form>` se cuenta junto, en un solo grupo: es el
 * caso de las pantallas que llevan el `[formGroup]` en un `div`, que siguen
 * contándose enteras como antes. Partir la cuenta sólo puede bajar los
 * números, así que ninguna pantalla que hoy pasa empieza a fallar por esto.
 */
function gruposQueExceden(html) {
  const grupos = [];
  const formularios = html.match(/<form\b[\s\S]*?<\/form>/g) ?? [];
  formularios.forEach((formulario, indice) => {
    const campos = (formulario.match(CONTROL) ?? []).length;
    grupos.push({
      campos,
      donde: formularios.length > 1 ? `su formulario ${indice + 1} de ${formularios.length}` : 'su formulario',
    });
  });

  const fuera = html.replace(/<form\b[\s\S]*?<\/form>/g, '');
  const camposSueltos = (fuera.match(CONTROL) ?? []).length;
  if (camposSueltos > 0) {
    grupos.push({
      campos: camposSueltos,
      donde: formularios.length > 0 ? 'los campos que no están en ningún `<form>`' : 'una sola pantalla',
    });
  }

  return grupos.filter((grupo) => grupo.campos > MAX_CAMPOS);
}

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
  // Una pantalla es un formulario si declara un `FormGroup`... **o si ya usa el
  // motor**. Mirar sólo `[formGroup]` dejaba fuera justamente a las migradas
  // del todo —el motor lleva el `[formGroup]` adentro suyo— y una pantalla que
  // desaparece de la cuenta al migrarse hace que el verificador cuente cada vez
  // menos a medida que el trabajo avanza.
  if (!html.includes('[formGroup]') && !html.includes('<app-paginated-form')) continue;
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

  revisadas += 1;
  const excedidos = gruposQueExceden(html);
  if (excedidos.length > 0 && !pendiente) {
    for (const grupo of excedidos) {
      problemas.push(
        `'${relativa}' pide ${grupo.campos} campos de una vez en ${grupo.donde} y no usa <app-paginated-form>`,
      );
    }
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
