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
const PIERNA_ENTERA = ['muslo', 'rodilla', 'canilla', 'corva', 'pantorrilla', 'tobillo'];

/** Normalised word (singular and plural) → part. Words are as people write them. */
const PALABRAS: ReadonlyMap<string, Parte> = new Map(
  (
    [
      [['cabeza', 'craneo', 'cabezas'], { fijas: ['cabeza'] }],
      [['ojo', 'ojos', 'parpado', 'parpados', 'vista'], { lados: ['ojo'] }],
      [['oido', 'oidos', 'oreja', 'orejas'], { lados: ['oido'] }],
      [['nariz', 'fosa nasal'], { fijas: ['nariz'] }],
      [['boca', 'diente', 'dientes', 'muela', 'muelas', 'labio', 'labios', 'lengua', 'encia', 'encias', 'mandibula', 'quijada'], { fijas: ['boca'] }],
      [['garganta', 'amigdalas', 'anginas'], { fijas: ['garganta'] }],
      [['cuello'], { lados: ['cuello'], fijas: ['garganta'] }],
      [['nuca'], { fijas: ['nuca'] }],
      [['hombro', 'hombros'], { lados: ['hombro'] }],
      [['brazo', 'brazos'], { lados: BRAZO_ENTERO }],
      [['codo', 'codos'], { lados: ['codo'] }],
      [['antebrazo', 'antebrazos'], { lados: ['antebrazo'] }],
      [['muneca', 'munecas'], { lados: ['muneca'] }],
      [['mano', 'manos', 'dedo', 'dedos', 'palma', 'palmas'], { lados: ['mano'] }],
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
      [['ingle', 'ingles'], { lados: ['fosa-iliaca'] }],
      [['espalda'], { fijas: ['espalda'] }],
      [['omoplato', 'omoplatos', 'paleta', 'paletas'], { lados: ['omoplato'] }],
      [['columna', 'espinazo'], { fijas: ['columna-alta', 'columna-media', 'columna-lumbar'] }],
      [['cintura', 'lumbar', 'lumbares', 'rinon', 'rinones'], { lados: ['lumbar'] }],
      [['nalga', 'nalgas', 'gluteo', 'gluteos', 'pompa', 'pompas', 'trasero'], { lados: ['gluteo'] }],
      [['coxis', 'rabadilla'], { fijas: ['coxis'] }],
      [['cadera', 'caderas'], { lados: ['cadera'] }],
      [['pierna', 'piernas'], { lados: PIERNA_ENTERA }],
      [['muslo', 'muslos'], { lados: ['muslo'] }],
      [['rodilla', 'rodillas'], { lados: ['rodilla'] }],
      [['canilla', 'canillas', 'espinilla', 'espinillas'], { lados: ['canilla'] }],
      [['pantorrilla', 'pantorrillas'], { lados: ['pantorrilla'] }],
      [['tobillo', 'tobillos'], { lados: ['tobillo'] }],
      [['pie', 'pies', 'planta', 'plantas'], { lados: ['pie'] }],
      [['talon', 'talones'], { lados: ['talon'] }],
    ] as const
  ).flatMap(([palabras, parte]) => palabras.map((p) => [p, parte as Parte] as const)),
);

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
    // Two-word names first («boca del estomago», «bajo vientre»).
    const dos = `${tokens[i].texto} ${tokens[i + 1]?.texto ?? ''}`;
    const tres = `${dos} ${tokens[i + 2]?.texto ?? ''}`;
    const parte = PALABRAS.get(tres) ?? PALABRAS.get(dos) ?? PALABRAS.get(tokens[i].texto);
    if (parte === undefined || negada(tokens, negadas, i)) continue;
    const lado = parte.lados ? ladoCerca(tokens, i) : null;
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
