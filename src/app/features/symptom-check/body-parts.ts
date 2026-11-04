/* ============================================================================
    Body parts named in the free text, as zones of the figure (2026-11-03).

    The figure used to light only what a recognised *symptom* points to: «me
    duele la rodilla derecha» lit both knees, and a part named without a known
    symptom lit nothing. Here the words that name a part are read directly,
    with their side («derecha», «izquierdo», «los dos») and their negation
    («no me duele la rodilla» lights nothing).

    Ids are the figure's own (`body-zones.generated.ts`). A side-able part
    without a side gives both sides; a wide word («espalda», «panza», «pierna»)
    gives its coarse zone, which lights every fine zone cut from it.
    ========================================================================== */

import { negatedBrackets, normalizar, tokenize, type Token } from './text';

/** `lados`: fine-id prefixes that take `-der`/`-izq`. `fijas`: ids as they are. */
interface Parte {
  readonly lados?: readonly string[];
  readonly fijas?: readonly string[];
}

const BRAZO_ENTERO = ['brazo', 'codo', 'antebrazo', 'muneca'];
const MUSLO_ENTERO = ['muslo', 'muslo-interno', 'muslo-posterior'];
const PIERNA_ENTERA = [...MUSLO_ENTERO, 'rodilla', 'canilla', 'corva', 'pantorrilla', 'tobillo'];
/** «dedo del pie» / «dedo de la mano»: read by `dedosDe`, not by a single word. */
const DEDOS_DEL_PIE: Parte = { lados: ['dedos-pie'] };
const DEDOS_DE_LA_MANO: Parte = { lados: ['dedos'] };

/** Normalised word (singular and plural) → part. Words are as people write them. */
const PALABRAS: ReadonlyMap<string, Parte> = new Map(
  (
    [
      [['cabeza', 'craneo', 'cabezas'], { fijas: ['cabeza'] }],
      [['coronilla', 'cuero cabelludo', 'mollera'], { fijas: ['coronilla'] }],
      [['frente'], { fijas: ['frente'] }],
      [['sien', 'sienes'], { lados: ['sien'] }],
      [['mejilla', 'mejillas', 'cachete', 'cachetes', 'pomulo', 'pomulos'], { lados: ['mejilla'] }],
      [['mandibula', 'mandibulas', 'quijada'], { lados: ['mandibula'] }],
      [['menton', 'barbilla'], { fijas: ['menton'] }],
      [['ojo', 'ojos', 'parpado', 'parpados', 'vista'], { lados: ['ojo'] }],
      [['oido', 'oidos', 'oreja', 'orejas'], { lados: ['oido'] }],
      [['nariz', 'fosa nasal'], { fijas: ['nariz'] }],
      [['boca', 'diente', 'dientes', 'muela', 'muelas', 'labio', 'labios', 'lengua', 'encia', 'encias'], { fijas: ['boca'] }],
      [['garganta', 'amigdalas', 'anginas'], { fijas: ['garganta'] }],
      [['cuello'], { lados: ['cuello'], fijas: ['garganta'] }],
      [['nuca'], { fijas: ['nuca'] }],
      [['clavicula', 'claviculas'], { lados: ['clavicula'] }],
      [['axila', 'axilas', 'sobaco', 'sobacos'], { lados: ['axila'] }],
      [['hombro', 'hombros'], { lados: ['hombro'] }],
      [['brazo', 'brazos'], { lados: BRAZO_ENTERO }],
      [['codo', 'codos'], { lados: ['codo'] }],
      [['antebrazo', 'antebrazos'], { lados: ['antebrazo'] }],
      [['muneca', 'munecas'], { lados: ['muneca'] }],
      [['mano', 'manos', 'palma', 'palmas'], { lados: ['mano', 'dedos'] }],
      [['dedo', 'dedos', 'pulgar', 'pulgares'], { lados: ['dedos'] }],
      [['pecho', 'torax'], { lados: ['pecho'], fijas: ['esternon'] }],
      [['esternon'], { fijas: ['esternon'] }],
      [['seno', 'senos', 'mama', 'mamas', 'teta', 'tetas'], { lados: ['pecho'] }],
      [['costilla', 'costillas', 'costado', 'costados'], { lados: ['hipocondrio'] }],
      [['estomago', 'boca del estomago'], { fijas: ['epigastrio'] }],
      [['higado', 'vesicula'], { fijas: ['hipocondrio-der'] }],
      [['ombligo'], { fijas: ['periumbilical'] }],
      [['panza', 'barriga', 'abdomen', 'guata', 'tripa', 'tripas'], { fijas: ['estomago', 'abdomen'] }],
      [['vientre', 'bajo vientre', 'vejiga', 'utero', 'ovario', 'ovarios'], { fijas: ['hipogastrio'] }],
      [['apendice'], { fijas: ['fosa-iliaca-der'] }],
      [['ingle', 'ingles'], { lados: ['ingle'] }],
      [['espalda'], { fijas: ['espalda'] }],
      [['omoplato', 'omoplatos', 'paleta', 'paletas'], { lados: ['omoplato'] }],
      [['columna', 'espinazo'], { fijas: ['columna-alta', 'columna-media', 'columna-lumbar'] }],
      [['cintura', 'lumbar', 'lumbares', 'rinon', 'rinones'], { lados: ['lumbar'] }],
      [['nalga', 'nalgas', 'gluteo', 'gluteos', 'pompa', 'pompas', 'trasero'], { lados: ['gluteo'] }],
      [['coxis', 'rabadilla'], { fijas: ['coxis'] }],
      [['cadera', 'caderas'], { lados: ['cadera'] }],
      [['pierna', 'piernas'], { lados: PIERNA_ENTERA }],
      [['muslo', 'muslos'], { lados: MUSLO_ENTERO }],
      [['entrepierna'], { lados: ['muslo-interno'] }],
      [['rodilla', 'rodillas'], { lados: ['rodilla'] }],
      [['canilla', 'canillas', 'espinilla', 'espinillas'], { lados: ['canilla'] }],
      [['pantorrilla', 'pantorrillas'], { lados: ['pantorrilla'] }],
      [['tobillo', 'tobillos'], { lados: ['tobillo'] }],
      [['pie', 'pies', 'planta', 'plantas'], { lados: ['pie', 'dedos-pie', 'talon'] }],
      [['empeine', 'empeines'], { lados: ['pie'] }],
      [['talon', 'talones'], { lados: ['talon'] }],
    ] as const
  ).flatMap(([palabras, parte]) => palabras.map((p) => [p, parte as Parte] as const)),
);

/** Words that may sit between «dedo» and «pie»/«mano»: «dedo gordo del pie», «dedos de la mano». */
const ENLACE_DE_DEDO = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'mi', 'mis', 'gordo', 'chico', 'chiquito', 'menique']);

/** «dedo … pie» or «dedo … mano» in the same sentence: whose fingers, up to which word. */
function dedosDe(tokens: readonly Token[], i: number): { parte: Parte; fin: number } | null {
  if (!['dedo', 'dedos', 'pulgar'].includes(tokens[i].texto)) return null;
  for (let k = i + 1; k <= i + 5 && k < tokens.length && tokens[k].frase === tokens[i].frase; k += 1) {
    if (['pie', 'pies'].includes(tokens[k].texto)) return { parte: DEDOS_DEL_PIE, fin: k };
    if (['mano', 'manos'].includes(tokens[k].texto)) return { parte: DEDOS_DE_LA_MANO, fin: k };
    if (!ENLACE_DE_DEDO.has(tokens[k].texto)) return null;
  }
  return null;
}

/** The part at token `i` and the index of its last word, or null («de frente» is not the forehead). */
function parteEn(tokens: readonly Token[], i: number): { parte: Parte; fin: number } | null {
  const dedos = dedosDe(tokens, i);
  if (dedos !== null) return dedos;
  for (const largo of [3, 2, 1]) {
    const frase = tokens.slice(i, i + largo).map((t) => t.texto);
    const parte = frase.length === largo ? PALABRAS.get(frase.join(' ')) : undefined;
    if (parte === undefined) continue;
    if (frase[0] === 'frente' && !['la', 'mi', 'su'].includes(tokens[i - 1]?.texto ?? '')) return null;
    return { parte, fin: i + largo - 1 };
  }
  return null;
}

/** Every word (or phrase) read as a body part. */
export const BODY_PART_WORDS: readonly string[] = [...PALABRAS.keys()];

/** How far (in words, same sentence) a side word can be from its part. */
const ALCANCE = 4;

type Lado = 'der' | 'izq' | 'ambos';

function ladoDe(texto: string): Lado | null {
  if (texto.startsWith('derech')) return 'der';
  if (texto.startsWith('izquierd')) return 'izq';
  if (texto === 'ambos' || texto === 'ambas') return 'ambos';
  return null;
}

/** The side said around token `i`: after it first («rodilla derecha»), then before («lado derecho del pecho»). */
function ladoCerca(tokens: readonly Token[], i: number): Lado | null {
  for (const paso of [1, 2, 3, ALCANCE, -1, -2, -3, -ALCANCE]) {
    const t = tokens[i + paso];
    if (t === undefined || t.frase !== tokens[i].frase) continue;
    // A side word past another part belongs to that one («mano derecha y pie»),
    // unless it is the same part said again («el dedo de la mano izquierda»).
    const propia = PALABRAS.get(tokens[i].texto);
    const entre = paso > 1 ? tokens.slice(i + 1, i + paso) : [];
    if (entre.some((x) => PALABRAS.has(x.texto) && PALABRAS.get(x.texto) !== propia)) continue;
    const lado = ladoDe(t.texto);
    if (lado !== null) return lado;
    if (t.texto === 'dos' && tokens[i + paso - 1]?.texto.startsWith('l')) return 'ambos'; // «los dos», «las dos»
  }
  return null;
}

/** Words that say the part hurts or bothers: what a negation must deny to rule it out. */
const MOLESTIA = /^(duel|dol|molest|pic|ard|pasa)/;

/**
 * Negated only when what is denied is the complaint: «no me duele la rodilla»
 * rules the knee out, but «no puedo mover el brazo» or «no siento la mano» are
 * complaints about that very part.
 */
function negada(tokens: readonly Token[], tramos: readonly (readonly [number, number])[], i: number): boolean {
  return tramos.some(
    ([desde, hasta]) => i > desde && i <= hasta && tokens.slice(desde + 1, i).some((t) => MOLESTIA.test(t.texto)),
  );
}

/**
 * The figure zones named in `texto`, in reading order and without repeats.
 * Negated mentions («no me duele la rodilla») are left out.
 */
export function bodyPartsIn(texto: string): readonly string[] {
  const normalizado = normalizar(texto);
  const tokens = tokenize(normalizado);
  const negadas = negatedBrackets(tokens);
  const zonas = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    const hallada = parteEn(tokens, i);
    if (hallada === null) continue;
    const { parte, fin } = hallada;
    const desde = i;
    i = fin; // a phrase's own words are not read again («boca del estómago», «dedo del pie»)
    if (negada(tokens, negadas, desde)) continue;
    // The side goes after the whole name («dedo del pie derecho») or before it.
    const lado = parte.lados ? (ladoCerca(tokens, fin) ?? ladoCerca(tokens, desde)) : null;
    for (const prefijo of parte.lados ?? []) {
      if (lado !== 'izq') zonas.add(`${prefijo}-der`);
      if (lado !== 'der') zonas.add(`${prefijo}-izq`);
    }
    // A sided mention narrows: «lado derecho del pecho» is not the sternum too.
    if (lado === null || lado === 'ambos') parte.fijas?.forEach((id) => zonas.add(id));
  }
  return [...zonas];
}

/**
 * What the figure lights: the parts named in the text, plus the symptom zones
 * they do not already narrow. «me duele la rodilla derecha» names
 * `rodilla-der`, so the symptom's coarse `rodillas` (both knees) is dropped;
 * «me duele la rodilla y ando triste» keeps «animo», which no part narrows.
 *
 * `madreDe` gives the coarse zone a fine one was cut from.
 */
export function withNamedParts(
  nombradas: readonly string[],
  deLosSintomas: readonly string[],
  madreDe: (id: string) => string | undefined,
): readonly string[] {
  const cubiertas = new Set(nombradas.flatMap((id) => [id, madreDe(id) ?? id]));
  return [...new Set([...nombradas, ...deLosSintomas.filter((id) => !cubiertas.has(id))])];
}
