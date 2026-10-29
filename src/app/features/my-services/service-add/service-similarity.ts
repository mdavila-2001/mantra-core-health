/* ============================================================================
    Parecido entre nombres de servicio (carril 23).

    Antes de crear un servicio nuevo se busca si ya hay uno que diga lo mismo
    con otras palabras: «Control prenatal» y «Consulta de control prenatal».
    El criterio 6 de la ficha pide un mecanismo DETERMINISTA y documentado, sin
    IA ni costo externo; esto es todo lo que hace:

    1. Normaliza: minúsculas, sin tildes, sin signos, y sin las palabras que no
       distinguen un servicio («de», «la», «consulta», «servicio»…).
    2. Mide dos cosas y se queda con la mayor:
       - qué parte de las palabras del nombre más corto aparece en el otro
         (coincidencia de palabras: «control prenatal» ⊂ «consulta de control
         prenatal» = 1);
       - el coeficiente de Dice sobre trigramas de letras, que tolera errores
         de tipeo y plurales («ecografia» ~ «ecografías»).
    3. Propone los que superan `SIMILARITY_THRESHOLD`, del más parecido al
       menos, hasta `MAX_SUGGESTIONS`.

    La misma entrada da siempre el mismo resultado. No bloquea: es una
    pregunta; quien atiende decide si es distinto.
   ========================================================================== */

/** A partir de este puntaje se pregunta «¿quizás quiso decir…?». */
export const SIMILARITY_THRESHOLD = 0.6;

/** Cuántos parecidos se muestran como máximo. */
export const MAX_SUGGESTIONS = 3;

/**
 * Palabras que no distinguen un servicio de otro. Sin ellas, «Consulta de
 * nutrición» y «Consulta de cardiología» se parecerían por «consulta de».
 */
const STOP_WORDS = new Set([
  'a',
  'al',
  'con',
  'consulta',
  'de',
  'del',
  'el',
  'en',
  'la',
  'las',
  'lo',
  'los',
  'para',
  'por',
  'servicio',
  'sin',
  'un',
  'una',
  'y',
]);

/** Las palabras que cuentan, en minúsculas y sin tildes ni signos. */
export function significantWords(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function trigrams(text: string): Map<string, number> {
  const padded = `  ${text} `;
  const grams = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    const gram = padded.slice(i, i + 3);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

function diceOfTrigrams(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  let shared = 0;
  let total = 0;
  for (const [gram, count] of ga) {
    shared += Math.min(count, gb.get(gram) ?? 0);
    total += count;
  }
  for (const count of gb.values()) total += count;
  return total === 0 ? 0 : (2 * shared) / total;
}

/** Qué parte de las palabras del nombre más corto está en el otro. */
function wordContainment(a: readonly string[], b: readonly string[]): number {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length === 0) return 0;
  const set = new Set(longer);
  return shorter.filter((word) => set.has(word)).length / shorter.length;
}

/** El parecido entre dos nombres, de 0 (nada) a 1 (lo mismo). */
export function nameSimilarity(a: string, b: string): number {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const score = Math.max(
    wordContainment(wordsA, wordsB),
    diceOfTrigrams(wordsA.join(' '), wordsB.join(' ')),
  );
  return Math.round(score * 1000) / 1000;
}

/** Los servicios que se parecen al nombre nuevo, del más parecido al menos. */
export function similarServices<T extends { readonly name: string }>(
  name: string,
  existing: readonly T[],
): readonly { readonly service: T; readonly score: number }[] {
  return existing
    .map((service) => ({ service, score: nameSimilarity(name, service.name) }))
    .filter((match) => match.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name, 'es'))
    .slice(0, MAX_SUGGESTIONS);
}
