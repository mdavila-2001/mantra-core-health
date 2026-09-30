/**
 * El glosario en shards: el formato con el que la maqueta lo lee bajo demanda.
 *
 * Lo comparten `scripts/glossary-seed.mjs` (el conjunto semilla, commiteado en
 * `public/glossary-seed/`) y `scripts/glossary-shards.mjs` (`yarn
 * mock:glossary:shards`, que trae el glosario completo de
 * `glossary-data-build/` a `public/glossary-data/`, fuera de git). Los dos
 * producen **la misma estructura**, así que el simulador no distingue de dónde
 * vino:
 *
 * ```text
 * <destino>/
 *   manifest.json                 conteos por categoría, etiqueta y par (facetas)
 *   shards/index.json             el mismo manifiesto, en la ruta del contrato
 *   shards/<categoryKey>/page-<n>.json   500 filas: primero las que están en castellano,
 *                                        después las que sólo tienen su nombre original;
 *                                        cada grupo por esName (localeCompare 'es')
 *   mock/ids/<hh>.json            id de concepto → [categoría, página, posición]
 *   mock/order/page-<n>.json      orden alfabético global, en referencias
 *   mock/tags/<tagKey>.json       los términos de cada etiqueta, en referencias
 *   mock/search/<xx>.json         índice por las dos primeras letras de cada palabra
 * ```
 *
 * Las filas siguen el esquema de `data/glossary/00_README.md` extendido por
 * `glossary-data-build/SCHEMA.md` (imagen, atribución, licencia, fuente,
 * `drugFacts`). `normalizeRow` acepta las dos grafías del nombre (`esName` o
 * `display`) y de la definición (`definition` o `clinicalDefinitionEs`), y
 * deja pasar todo lo demás tal cual: el simulador no reescribe contenido.
 */

/** Filas por página de shard: la del contrato de `glossary-data-build/`. */
export const SHARD_PAGE_SIZE = 500;

/**
 * El mismo hash que `uuid()` de `src/app/core/mock/mock-store.ts`, portado
 * línea por línea: los ids de los términos tienen que coincidir con los que ya
 * circulaban (un enlace compartido a un término sigue sirviendo). La semilla
 * verifica la paridad al construirse.
 *
 * @param {string} seed
 * @returns {string}
 */
export function mockUuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

/** El id de concepto de un término sin id propio: la fórmula de `fixtures/glosario.ts`. */
export function conceptIdOf(slug) {
  return mockUuid(`concept-glossary-${slug}`);
}

/** Sin tildes ni mayúsculas: la misma normalización que la búsqueda de la API. */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Palabras que no abren cubeta de búsqueda: están en casi todos los nombres de
 * la CIE-10-ES («de», «del», «con», «sin»…) y su cubeta sería el corpus entero.
 * Siguen en el texto de cada término; sólo no se buscan por sí solas.
 */
export const STOPWORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'lo', 'los', 'n',
  'o', 'otra', 'otras', 'otro', 'otros', 'para', 'por', 'sin', 'su', 'sus', 'u', 'un',
  'una', 'y',
]);

/** La cubeta de una palabra: sus dos primeras letras (o la única que tiene). */
export function bucketOf(word) {
  const clave = word.slice(0, 2);
  return /^[a-z0-9]{1,2}$/.test(clave) ? clave : '_';
}

/** Las palabras de un texto normalizado. */
export function wordsOf(text) {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');
}

/**
 * Una fila de shard con los nombres canónicos que usa el simulador.
 *
 * @param {Record<string, unknown>} raw
 */
export function normalizeRow(raw) {
  const esName = String(raw.esName ?? raw.display ?? '').trim();
  const slug = String(raw.slug ?? '').trim();
  if (esName === '' || slug === '') {
    throw new Error(`Fila sin nombre o sin slug: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  const categoryKey = String(raw.categoryKey ?? '').trim();
  if (categoryKey === '') throw new Error(`«${slug}» no declara categoryKey.`);
  const definition = String(raw.definition ?? raw.clinicalDefinitionEs ?? '').trim();
  const plainSummaryEs = String(raw.plainSummaryEs ?? '').trim();
  const { display: _display, clinicalDefinitionEs: _cd, ...resto } = raw;
  return {
    ...resto,
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : conceptIdOf(slug),
    slug,
    esName,
    categoryKey,
    tagKeys: Array.isArray(raw.tagKeys) ? raw.tagKeys.map(String) : [],
    lang: raw.lang === 'en' ? 'en' : 'es',
    definition,
    plainSummaryEs,
    relations: Array.isArray(raw.relations) ? raw.relations : [],
  };
}

const collator = new Intl.Collator('es');

/**
 * Construye el conjunto completo de archivos a partir de las filas.
 *
 * @param {ReadonlyArray<Record<string, unknown>>} rawRows - Filas en cualquier orden.
 * @param {{
 *   categories: ReadonlyArray<{ key: string, internalCode?: string, name: string, description?: string }>,
 *   tags: ReadonlyArray<{ key: string, internalCode?: string, name: string }>,
 *   source: string,
 * }} taxonomy - Nombres de categorías y etiquetas, y de dónde vienen las filas.
 * @returns {Map<string, unknown>} Ruta relativa → contenido JSON.
 */
export function buildGlossaryDataset(rawRows, taxonomy) {
  const rows = rawRows.map(normalizeRow);

  const porSlug = new Map();
  const porId = new Map();
  for (const row of rows) {
    if (porSlug.has(row.slug)) throw new Error(`Slug repetido: «${row.slug}».`);
    if (porId.has(row.id)) throw new Error(`Id repetido: «${row.id}» («${row.slug}»).`);
    porSlug.set(row.slug, row);
    porId.set(row.id, row);
  }

  const categorias = new Map(taxonomy.categories.map((c) => [c.key, c]));
  const etiquetas = new Map(taxonomy.tags.map((t) => [t.key, t]));
  for (const row of rows) {
    if (!categorias.has(row.categoryKey)) {
      throw new Error(`«${row.slug}» declara la categoría desconocida «${row.categoryKey}».`);
    }
    row.tagKeys = row.tagKeys.filter((clave) => etiquetas.has(clave));
    // Las relaciones viajan resueltas: el simulador no carga el corpus para
    // saber a qué id apunta un slug. Una huérfana se descarta, no se inventa.
    row.relations = row.relations.flatMap((relacion) => {
      const destino = porSlug.get(relacion.targetSlug);
      return destino === undefined
        ? []
        : [{ ...relacion, targetId: destino.id, targetName: destino.esName }];
    });
  }

  // Castellano primero: una categoría con 1 918 categorías ICD-10-CM en inglés
  // no puede empezar su primera página con ellas. Mismo criterio que la API
  // (sin designación en castellano, al final) y que `justin/glosario-correcciones`.
  const enIngles = (row) => (row.lang === 'en' ? 1 : 0);
  const ordenar = (a, b) =>
    enIngles(a) - enIngles(b) ||
    collator.compare(a.esName, b.esName) ||
    collator.compare(a.slug, b.slug);
  rows.sort(ordenar);

  const archivos = new Map();
  const referencia = new Map();
  const categoriasDelManifiesto = [];

  for (const categoria of taxonomy.categories) {
    const suyas = rows.filter((row) => row.categoryKey === categoria.key);
    const paginas = Math.ceil(suyas.length / SHARD_PAGE_SIZE);
    for (let p = 0; p < paginas; p++) {
      const pagina = suyas.slice(p * SHARD_PAGE_SIZE, (p + 1) * SHARD_PAGE_SIZE);
      pagina.forEach((row, idx) => referencia.set(row.id, [categoria.key, p + 1, idx]));
      archivos.set(`shards/${categoria.key}/page-${p + 1}.json`, pagina);
    }
    const porEtiqueta = {};
    for (const row of suyas) {
      for (const clave of row.tagKeys) porEtiqueta[clave] = (porEtiqueta[clave] ?? 0) + 1;
    }
    categoriasDelManifiesto.push({
      key: categoria.key,
      internalCode: categoria.internalCode ?? `glossary-category-${categoria.key}`,
      name: categoria.name,
      ...(categoria.description ? { description: categoria.description } : {}),
      count: suyas.length,
      translatedCount: suyas.filter((row) => row.lang !== 'en').length,
      pages: paginas,
      tags: porEtiqueta,
    });
  }

  const etiquetasDelManifiesto = taxonomy.tags.map((etiqueta) => ({
    key: etiqueta.key,
    internalCode: etiqueta.internalCode ?? `glossary-tag-${etiqueta.key}`,
    name: etiqueta.name,
    count: rows.filter((row) => row.tagKeys.includes(etiqueta.key)).length,
    translatedCount: rows.filter((row) => row.lang !== 'en' && row.tagKeys.includes(etiqueta.key))
      .length,
  }));

  const manifiesto = {
    version: 1,
    source: taxonomy.source,
    generatedAt: new Date().toISOString(),
    pageSize: SHARD_PAGE_SIZE,
    total: rows.length,
    translatedTotal: rows.filter((row) => row.lang !== 'en').length,
    categories: categoriasDelManifiesto,
    tags: etiquetasDelManifiesto,
  };
  archivos.set('manifest.json', manifiesto);
  archivos.set('shards/index.json', manifiesto);

  // id → dónde está. En cubetas por los dos primeros hex del id: la ficha de
  // un término abierta por enlace baja ~1/256 del índice, no el índice entero.
  const ids = {};
  for (const [id, ref] of referencia) {
    const cubeta = id.slice(0, 2);
    (ids[cubeta] ??= {})[id] = ref;
  }
  for (const [cubeta, contenido] of Object.entries(ids)) {
    archivos.set(`mock/ids/${cubeta}.json`, contenido);
  }

  // El orden alfabético global, para «Todos los términos» sin categoría.
  const orden = rows.map((row) => referencia.get(row.id));
  for (let p = 0; p * SHARD_PAGE_SIZE < orden.length; p++) {
    archivos.set(
      `mock/order/page-${p + 1}.json`,
      orden.slice(p * SHARD_PAGE_SIZE, (p + 1) * SHARD_PAGE_SIZE),
    );
  }

  for (const etiqueta of taxonomy.tags) {
    const suyas = rows.filter((row) => row.tagKeys.includes(etiqueta.key));
    if (suyas.length > 0) {
      archivos.set(`mock/tags/${etiqueta.key}.json`, suyas.map((row) => referencia.get(row.id)));
    }
  }

  // Índice de búsqueda por inicial de palabra: un término entra en la cubeta
  // de cada inicial de las palabras de su nombre, sus sinónimos y su código.
  // Buscar «presion alta» abre sólo la cubeta «p» y exige que cada palabra
  // buscada sea el principio de alguna palabra del término.
  const cubetas = new Map();
  for (const row of rows) {
    // Las palabras sin repetir: el índice guarda qué palabras tiene cada
    // término, no su texto, y así pesa una fracción.
    const palabras = [
      ...new Set(
        [row.esName, ...(row.esSynonyms ?? []), row.enDisplay ?? '', row.code ?? ''].flatMap(
          wordsOf,
        ),
      ),
    ];
    const texto = palabras.join(' ');
    const claves = new Set(
      palabras.filter((palabra) => !STOPWORDS.has(palabra)).map(bucketOf),
    );
    const entrada = [...referencia.get(row.id), texto, row.tagKeys.join(' ')];
    for (const clave of claves) {
      if (!cubetas.has(clave)) cubetas.set(clave, []);
      cubetas.get(clave).push(entrada);
    }
  }
  for (const [clave, entradas] of cubetas) archivos.set(`mock/search/${clave}.json`, entradas);
  // La lista de cubetas: una búsqueda de una sola letra abre las que empiezan
  // por ella, y ninguna pide un archivo que no existe.
  manifiesto.searchBuckets = [...cubetas.keys()].sort();

  return archivos;
}
