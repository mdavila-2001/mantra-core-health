#!/usr/bin/env node
/**
 * Verifica que ningún texto visible le hable al usuario de vos o de tú.
 *
 * ## Por qué existe
 *
 * El 2026-10-08 el propietario pidió que toda la aplicación tratara al usuario
 * **de usted**: el voseo («Elegí tu especialidad», «te avisamos») sonaba
 * robótico y, en una app de salud, poco respetuoso. El pase masivo cambió
 * 6 656 textos en 1 045 archivos (PR #1000). Sin este control, cada rama que
 * se mezcla después vuelve a traer voseo, porque así se venía escribiendo.
 *
 * ## Qué mira
 *
 * Sólo **texto visible**: cadenas de TypeScript y texto o atributos de
 * plantillas HTML. Nunca comentarios, porque la prosa técnica del equipo no la
 * ve nadie más. Busca una lista cerrada de formas de voseo y tuteo («tenés»,
 * «elegí», «registrate», «tu», «te»…), así que no adivina: lo que marca, lo
 * marca con nombre.
 *
 * ## Qué no mira, a propósito
 *
 * - Las pruebas (`*.spec.ts`): repiten mensajes de chat de usuarios.
 * - Las publicaciones y mensajes de la comunidad en la maqueta: son la voz de
 *   los usuarios, no la de AloVida.
 * - El corpus de síntomas: son frases del paciente en primera persona.
 * - Catálogos de universidades y la clave de los stickers (`'cuidate'` es un
 *   identificador, no un texto).
 *
 * Guía completa: docs/design-system/voice-and-tone.md.
 *
 * Uso: node scripts/check-usted.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = 'src';

const EXCLUIDOS = [
  /\.spec\.ts$/,
  /comunidad\.ts$/,
  /sintomas\.datos\.ts$/,
  /corpus\.fixture/,
  /universidades/,
  /instituciones-educativas/,
  /emoji/i,
  /anatom/i,
];

/** Formas de voseo y tuteo. Lista cerrada: agregar acá lo que aparezca nuevo. */
const FORMAS = new Set(
  `
  tu tus te vos contigo tuyo tuya tuyos tuyas tú sos vas ves tienes
  abrí acabás aceptá aceptás activá activás actualizá adjuntá administrá administrás agendás agregá
  agregás ahorrás ajustá ampliá andá apagá apagás aparecés aprendé apretá aprobá armá arrastrá
  atendé atendés autorizá autorizás avisá bajá basás buscá buscás cambiá cambiás cancelá cargá
  cargás cerrá cerrás compartí compartís compará completá completás componé comprás conectá
  configurá confirmá confirmás conocés consultá contactá controlá contá contás corregí creá creés
  debés decidí decí decís definí dejá dejás delegá descansá descargá describí dictá editá ejercés
  elegí elegís emití empezá encontrá entregá entrá entrás enviás escribí escribís especificá esperá
  esperás estás estés explicá extendé firmás fumás gestioná guardá guardás habilitá hablá hacé hacés
  incluí indicá ingresá iniciá iniciás intentá leé llamá llamás llegás llevá llevás mandá mantené
  marcá marcás medí mirá mirás mostrá necesitás ofrecés pagá pagás pasá pedí pedís pegá perdés podés
  poné ponés preferís preguntá presentá presentás probá proponé publicá publicás querés quitá
  recargá rechazá recibí recibís recordá registrá registrás reintentá respondé revisá revisás sabés
  sacá salís seguí seguís seleccioná sentís soltá subí subís sumá sumás tenés terminá tocá tocás
  tomá trabajá trabajás traé uní usá usás validá vendés vení venís verificá vivís volvé volvés
  aceptaste agregaste buscaste cambiaste cargaste confirmaste creaste declaraste dejaste elegiste
  enviaste escribiste hiciste llegaste olvidaste pagaste pediste publicaste registraste quedaste
  recibiste tuviste usaste equivocaste
  acordate cuidate registrate asegurate fijate sumate comunicate contanos escribinos dejanos
  dejalo dejala cargalo usalo revisalo confirmalo escribile pedile decile contale avisale preguntale
  dale ponele quitale sumale agregale
  registrarte conectarte unirte acordarte
  `.split(/\s+/).filter(Boolean),
);

/** Formas que también son nombres propios: sólo cuentan en minúscula. */
const SOLO_MINUSCULA = new Set(['tomás', 'pará', 'dala', 'dale']);

const PALABRA = /(?<![\p{L}\p{N}_\-/.@$])(\p{L}+)(?![\p{L}\p{N}_\-/(])/gu;

function archivos(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|html)$/.test(nombre) && !EXCLUIDOS.some((re) => re.test(ruta))) salida.push(ruta);
  }
  return salida;
}

/** Tramos de cadena en TS, salteando comentarios. */
function tramosTs(texto) {
  const tramos = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto.startsWith('//', i)) {
      const fin = texto.indexOf('\n', i);
      i = fin < 0 ? texto.length : fin;
    } else if (texto.startsWith('/*', i)) {
      const fin = texto.indexOf('*/', i + 2);
      i = fin < 0 ? texto.length : fin + 1;
    } else if (`'"\``.includes(texto[i])) {
      const comilla = texto[i];
      let j = i + 1;
      while (j < texto.length && texto[j] !== comilla) {
        if (texto[j] === '\\') j++;
        else if (comilla !== '`' && texto[j] === '\n') break;
        j++;
      }
      tramos.push([i + 1, j]);
      i = j;
    }
  }
  return tramos;
}

/** El HTML entero menos sus comentarios. */
function tramosHtml(texto) {
  const tramos = [];
  let ultimo = 0;
  for (const m of texto.matchAll(/<!--[\s\S]*?-->/g)) {
    tramos.push([ultimo, m.index]);
    ultimo = m.index + m[0].length;
  }
  tramos.push([ultimo, texto.length]);
  return tramos;
}

const hallazgos = [];
for (const ruta of archivos(RAIZ)) {
  const texto = readFileSync(ruta, 'utf8');
  const tramos = ruta.endsWith('.html') ? tramosHtml(texto) : tramosTs(texto);
  for (const [desde, hasta] of tramos) {
    // `clave: 'cuidate'` nombra un sticker: es un identificador, no un texto.
    if (/\bclave\s*:\s*$/.test(texto.slice(Math.max(0, desde - 20), desde - 1))) continue;
    const tramo = texto.slice(desde, hasta);
    let anterior = '';
    for (const m of tramo.matchAll(PALABRA)) {
      const palabra = m[1];
      const minuscula = palabra.toLowerCase();
      const previa = anterior;
      anterior = minuscula;
      if (!FORMAS.has(minuscula)) continue;
      if (palabra.length > 1 && palabra === palabra.toUpperCase()) continue; // siglas: «TU», «SOS»
      if (SOLO_MINUSCULA.has(minuscula) && palabra !== minuscula) continue;
      if (minuscula === 'pedí' && previa === 'le') continue; // «Le pedí un Holter»: primera persona
      const linea = texto.slice(0, desde + m.index).split('\n').length;
      const contexto = tramo.slice(Math.max(0, m.index - 30), m.index + palabra.length + 30).replace(/\s+/g, ' ');
      hallazgos.push(`${relative('.', ruta)}:${linea}  «${palabra}»  …${contexto}…`);
    }
  }
}

if (hallazgos.length === 0) {
  console.log('check-usted: ningún texto visible en voseo ni tuteo.');
  process.exit(0);
}
console.log(`check-usted: ${hallazgos.length} texto(s) visibles le hablan al usuario de vos o de tú.\n`);
for (const h of hallazgos) console.log(`  ${h}`);
console.log('\nPáselos a usted («Elija», «Le avisamos», «su»). Guía: docs/design-system/voice-and-tone.md');
process.exit(1);
