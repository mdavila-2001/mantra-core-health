#!/usr/bin/env node
/**
 * Verifica que toda operación que un cliente de `core/data-access` llama
 * tenga un manejador en el backend simulado (H2.S1.M4, 2026-09-26).
 *
 * ## Qué defecto impide
 *
 * Con `respuestaGenerica` convertido en 501 (H2.S1.M1), una llamada del
 * cliente sin manejador ya no finge un éxito: la pantalla que la use
 * muestra el estado de error. Eso es lo que se quiere que pase — pero sólo
 * cuando es una brecha **conocida** (un endpoint que la API todavía no tiene,
 * documentado en el informe de brechas). Un manejador que se **borra** o un
 * cliente **nuevo** que llama algo que nadie implementó todavía en el
 * simulador tienen que denunciarse en CI, no descubrirse recorriendo la
 * maqueta a mano.
 *
 * ## Alcance deliberadamente acotado — mock ↔ cliente, no mock ↔ API real
 *
 * El diseño completo del inventario (BR-02 del informe de brechas del
 * 2026-09-24) cruza tres lados —cliente, mock y un snapshot de la API real,
 * sincronizado clonando `mantra-core-health-redesa-api`— con extracción por
 * AST de TypeScript. Ese tercer lado excede el alcance de este encargo (no
 * toca otro repositorio ni agrega `scripts/api-inventory/**`): lo que sigue
 * es el cruce **cliente ↔ mock**, que ya alcanza para que el CI falle si
 * aparece una ruta sin manejador. La reconciliación contra la API real queda
 * para el prompt BR-02 completo.
 *
 * ## Cómo empareja
 *
 * Compara por segmentos, igual que `MockRouter.match`: dos patrones empatan
 * si tienen el mismo número de segmentos y, en cada posición, son literales
 * iguales o **cualquiera de los dos** es un parámetro (`:id` del cliente
 * contra `:conversationId` del mock, por ejemplo — los nombres no tienen por
 * qué coincidir). Un `*` final del mock absorbe el resto.
 *
 * Uso: node scripts/check-mock-vs-client.mjs [--json]
 */

import { join } from 'node:path';

import { read, SRC_ROOT, scanEndpoints, walk } from './lib/scan.mjs';

/**
 * Las operaciones que hoy llama algún cliente y el simulador todavía no
 * cubre — verificadas una por una contra `core/mock/handlers/` el
 * 2026-09-26, no copiadas del informe de brechas: las 21 que el informe del
 * 2026-09-24 documentaba (anexo D, TX-05 · CV-05) **ya tienen manejador**
 * (cerradas por BR-07/11/12/18/19/23 en los dos días intermedios), así que
 * ninguna de ellas entra acá — si alguna reapareciera, este script la
 * reportaría como «sin manejador y sin registrar», que es la señal correcta.
 *
 * Cada entrada tiene que **borrarse** en el mismo PR que le agregue el
 * manejador (mismo criterio de trinquete que propone BR-02 §4): sin eso, una
 * brecha cerrada se queda invisible en la allowlist para siempre.
 */
const CONOCIDAS = [
  // `community.client.ts` pide el detalle de una conversación; el mock sólo
  // tiene la lista, la creación y sus mensajes — AG-26 del informe de brechas.
  { method: 'GET', endpoint: '/community/conversations/:conversationId', prompt: 'AG-26 (sin asignar)' },
  // Ninguna handler de `/loyalty/*`: no existe `loyalty.handlers.ts`. La
  // billetera de puntos sigue mostrando su estado vacío (`loyaltyDemo`).
  { method: 'GET', endpoint: '/loyalty/me', prompt: 'sin asignar' },
  { method: 'GET', endpoint: '/loyalty/me/points', prompt: 'sin asignar' },
  { method: 'POST', endpoint: '/loyalty/me/points/redeem', prompt: 'sin asignar' },
  // Alias muerto documentado por BR-02: el cliente llama la ruta corta, el
  // mock sólo tiene la anidada bajo el post (`/public/posts/:id/comments/…`).
  { method: 'GET', endpoint: '/public/comments/:commentId/replies', prompt: 'AG-26 (sin asignar)' },
  // D-G del informe de brechas: «mostrador del médico» — ¿vía hold sumando
  // PRACTITIONER, o `appointments/direct`? Hoy ninguno de los dos cierra el
  // camino de `walk-in` que el cliente ya llama.
  { method: 'POST', endpoint: '/scheduling/appointments/walk-in', prompt: 'D-G (decisión del propietario)' },
];

/** Los manejadores del simulador: método y patrón, leídos de `router.<verbo>('/…'`. */
function scanMockHandlers() {
  const handlers = [];
  const declaracion = /router\s*\.\s*(get|post|put|patch|delete)\s*\(\s*[`']([^`']+)[`']/g;

  for (const file of walk(join(SRC_ROOT, 'app/core/mock/handlers'), ['.ts'])) {
    if (file.endsWith('.spec.ts')) continue;
    const source = read(file);
    let match;
    while ((match = declaracion.exec(source)) !== null) {
      handlers.push({ method: match[1].toUpperCase(), pattern: match[2] });
    }
  }
  return handlers;
}

function segmentos(ruta) {
  return ruta.split('?')[0].split('/').filter(Boolean);
}

/** Mismo criterio que `MockRouter.match`: literal=literal, o cualquiera de los dos es parámetro. */
function empata(patronMock, endpointCliente) {
  const a = segmentos(patronMock);
  const b = segmentos(endpointCliente);

  if (a.at(-1) === '*') {
    const prefijo = a.slice(0, -1);
    if (b.length < prefijo.length) return false;
    return prefijo.every((seg, i) => seg.startsWith(':') || seg === b[i]);
  }

  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.startsWith(':') || b[i].startsWith(':') || seg === b[i]);
}

const operaciones = scanEndpoints();
const manejadores = scanMockHandlers();
const modoJson = process.argv.includes('--json');

const sinManejador = operaciones.filter(
  (op) => !manejadores.some((h) => h.method === op.method && empata(h.pattern, op.endpoint)),
);

const yaCubiertas = CONOCIDAS.filter(
  (c) => !sinManejador.some((op) => op.method === c.method && op.endpoint === c.endpoint),
);
const nuevasSinManejador = sinManejador.filter(
  (op) => !CONOCIDAS.some((c) => c.method === op.method && c.endpoint === op.endpoint),
);

if (modoJson) {
  console.log(
    JSON.stringify({ operaciones: operaciones.length, manejadores: manejadores.length, sinManejador, nuevasSinManejador, yaCubiertas }, null, 2),
  );
} else if (nuevasSinManejador.length > 0 || yaCubiertas.length > 0) {
  console.error(`\n✗ check-mock-vs-client\n`);
  if (nuevasSinManejador.length > 0) {
    console.error(`  ${nuevasSinManejador.length} operación(es) sin manejador y SIN registrar en CONOCIDAS:\n`);
    for (const op of nuevasSinManejador) {
      console.error(`    ${op.method} ${op.endpoint}  (${op.client}, ${op.path})`);
    }
    console.error(
      '\n  Con el mock honesto (H2.S1.M1) esto responde 501: la pantalla que lo llame\n' +
        '  va a mostrar el estado de error. Si es una brecha conocida, agregala a\n' +
        '  CONOCIDAS con su prompt; si no, escribile el manejador.\n',
    );
  }
  if (yaCubiertas.length > 0) {
    console.error(`  ${yaCubiertas.length} entrada(s) de CONOCIDAS que ya tienen manejador — hay que borrarlas:\n`);
    for (const c of yaCubiertas) {
      console.error(`    ${c.method} ${c.endpoint}  (${c.prompt})`);
    }
    console.error('');
  }
  process.exit(1);
} else {
  console.log('✓ check-mock-vs-client');
  console.log(
    `  ${operaciones.length} operaciones de core/data-access · ${manejadores.length} manejadores del mock · ` +
      `${sinManejador.length} sin manejador, las ${sinManejador.length} ya conocidas y con prompt propio`,
  );
}
