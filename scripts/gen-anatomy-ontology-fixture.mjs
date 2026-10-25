#!/usr/bin/env node
/**
 * Arma el catálogo del atlas anatómico 3D a partir de UBERON, FMA y BodyParts3D.
 *
 * ## De dónde sale cada cosa
 *
 * - `data/anatomy-ontology/uberon-human.json` y `bodyparts3d-parts.json`, que
 *   destila `tools/anatomy-atlas-3d/extract_ontology.py` de la release de
 *   UBERON y del FMA que acompaña a BodyParts3D (procedencia y SHA-256 en
 *   `provenance.json`).
 * - `data/anatomy-ontology/netter-mapping/*.json`: el cruce de las 3 161
 *   entradas del índice de Netter con UBERON. Un cruce sólo existe si el nombre
 *   propuesto coincide con el `label` o un sinónimo EXACTO de la clase; este
 *   script lo vuelve a comprobar y descarta el que no.
 * - `data/anatomy-ontology/es/*.json`: nombre y definición en castellano. Son
 *   **traducción automática sin revisión humana** de lo que dice UBERON, y
 *   viajan rotuladas así; el texto inglés de la ontología va siempre al lado.
 * - `public/anatomy-atlas-3d/models/parts-manifest.json`: qué malla está en qué
 *   capa y si es exclusiva de un sexo (lo escribe `build_models.py`).
 *
 * - `data/anatomy-ontology/ta2.json`: el código TA2 (FIPAT) de cada ficha que
 *   se pudo cruzar por FMA, de `tools/anatomy-atlas-3d/fetch_ta2.py`.
 * - `data/anatomy-ontology/literature/`: la descripción extendida. `searched.json`
 *   dice qué fichas se buscaron en PubMed y Europe PMC
 *   (`tools/anatomy-atlas-3d/fetch_literature.py`); `R0N.json` (o `R0N-k.json`, un archivo por lote de redacción), las frases
 *   parafraseadas de los resúmenes, cada una con su PMID; `sources.json`, los
 *   datos bibliográficos de cada PMID citado. Una ficha buscada sin frases queda
 *   como `no_source`; una no buscada, `null`.
 * - `data/anatomy-ontology/images/*.json`: imágenes de Wikimedia Commons con
 *   autor y licencia leídos de su API `extmetadata`.
 *
 * ## Lo que NO trae, y por qué
 *
 * - **Afirmaciones sin cita.** Una frase de la descripción extendida sin PMID
 *   que esté en `sources.json` hace fallar al generador: no se publica.
 * - **Relaciones que UBERON no declara.** Las inversas que se publican
 *   (`incoming`) son la misma afirmación leída desde la otra punta, no una nueva.
 *
 * ## Salida
 *
 * - `public/anatomy-atlas-3d/catalog/`: `index.json` (búsqueda y shard de cada
 *   estructura), `parts.json` (malla → estructura) y `structures-NN.json`
 *   (las fichas, en 32 shards). Se bajan bajo demanda, como el glosario: no
 *   pesan en el bundle.
 * - `src/app/core/mock/fixtures/anatomy-ontology.generated.ts`: conteos,
 *   procedencia y atribuciones, que sí viajan en el código porque la pantalla
 *   las muestra antes de bajar nada.
 *
 * Uso: `yarn mock:anatomy-ontology`
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const DATOS = join(RAIZ, 'data', 'anatomy-ontology');
const CATALOGO = join(RAIZ, 'public', 'anatomy-atlas-3d', 'catalog');
const MANIFIESTO_DE_MALLAS = join(RAIZ, 'public', 'anatomy-atlas-3d', 'models', 'parts-manifest.json');
const FIXTURE = join(RAIZ, 'src', 'app', 'core', 'mock', 'fixtures', 'anatomy-ontology.generated.ts');
const SHARDS = 32;

const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

/** Lo mismo que `normalizar` de `uberon_lookup.py`: sin mayúsculas, tildes, guiones ni comas. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[-,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** FNV-1a de 32 bits: el mismo shard en el generador y en el navegador. */
export function shardDe(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % SHARDS;
}

/** Los archivos de una carpeta de datos fusionados, o `[]`/`{}` si no hay. */
function leerCarpeta(nombre, vacio) {
  const carpeta = join(DATOS, nombre);
  if (!existsSync(carpeta)) return vacio;
  const archivos = readdirSync(carpeta).filter((a) => a.endsWith('.json')).sort();
  return archivos.reduce(
    (acc, a) => {
      const datos = leerJson(join(carpeta, a));
      return Array.isArray(acc) ? acc.concat(datos) : Object.assign(acc, datos);
    },
    Array.isArray(vacio) ? [] : {},
  );
}

const RELACIONES = leerJson(join(DATOS, 'provenance.json')).relationsPublished;
/** Cómo se lee cada relación desde la otra punta. */
const INVERSAS = {
  part_of: 'tiene como parte',
  has_part: 'forma parte de',
  innervated_by: 'inerva a',
  innervates: 'inervado por',
  vessel_supplies_blood_to: 'irrigado por',
  indirectly_supplies: 'irrigado indirectamente por',
  vessel_drains_blood_from: 'drenado por',
  tributary_of: 'recibe como tributaria a',
  branching_part_of: 'tiene como rama a',
  connecting_branch_of: 'tiene como rama comunicante a',
  has_muscle_origin: 'es origen del músculo',
  has_muscle_insertion: 'es inserción del músculo',
  connected_to: 'conectado con',
  attaches_to: 'recibe la fijación de',
  adjacent_to: 'adyacente a',
};

/** Las referencias de una definición, clasificadas por si son citas comprobables o rastro de curaduría. */
function clasificarReferencia(ref) {
  if (/^PMID:\d+$/i.test(ref)) return { kind: 'pmid', value: ref.replace(/^PMID:/i, '') };
  if (/^DOI:/i.test(ref)) return { kind: 'doi', value: ref.replace(/^DOI:/i, '') };
  if (/^https?:\/\/(dx\.)?doi\.org\//i.test(ref)) return { kind: 'doi', value: ref.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') };
  if (/^ISBN:/i.test(ref)) return { kind: 'isbn', value: ref.replace(/^ISBN:/i, '') };
  if (/^wikipedia:/i.test(ref)) return { kind: 'wikipedia', value: ref.replace(/^wikipedia:/i, '') };
  if (/orcid\.org\//i.test(ref)) return { kind: 'curator', value: ref };
  if (/^https?:\/\//i.test(ref)) return { kind: 'url', value: ref };
  return { kind: 'xref', value: ref };
}

/** Los aspectos de la descripción extendida, en el orden en que se muestran. */
const ASPECTOS = ['situation', 'parts', 'relations', 'irrigation', 'innervation', 'function', 'clinical'];

/** Lo que se buscó, lo que se redactó y la bibliografía citada. */
function leerLiteratura() {
  const carpeta = join(DATOS, 'literature');
  if (!existsSync(join(carpeta, 'searched.json'))) return { buscadas: new Map(), frases: {}, fuentes: {} };
  const buscadas = new Map(leerJson(join(carpeta, 'searched.json')).structures.map((b) => [b.id, b]));
  const fuentes = leerJson(join(carpeta, 'sources.json'));
  const frases = {};
  for (const a of readdirSync(carpeta).filter((a) => /^R\d\d(-\d+)?\.json$/.test(a)).sort()) Object.assign(frases, leerJson(join(carpeta, a)));
  for (const [id, d] of Object.entries(frases)) {
    if (!buscadas.has(id)) throw new Error(`literatura: ${id} tiene frases pero no figura en searched.json`);
    for (const f of d.sentences) {
      if (!ASPECTOS.includes(f.aspect)) throw new Error(`literatura: ${id} usa un aspecto desconocido «${f.aspect}»`);
      if (!f.es?.trim()) throw new Error(`literatura: ${id} tiene una frase vacía`);
      if (!f.cites?.length) throw new Error(`literatura: ${id} tiene una frase sin cita: «${f.es}»`);
      for (const c of f.cites) if (!fuentes[c]) throw new Error(`literatura: ${id} cita ${c}, que no está en sources.json`);
    }
  }
  return { buscadas, frases, fuentes };
}

/** La descripción extendida de una ficha: `null` si no se buscó, `no_source` si la búsqueda no dio con qué. */
function descripcionExtendida(id, { buscadas, frases, fuentes }) {
  if (!buscadas.has(id)) return null;
  const d = frases[id];
  const oraciones = [...(d?.sentences ?? [])].sort((a, b) => ASPECTOS.indexOf(a.aspect) - ASPECTOS.indexOf(b.aspect));
  const citadas = [...new Set(oraciones.flatMap((o) => o.cites))];
  const cubiertos = new Set(oraciones.map((o) => o.aspect));
  return {
    status: oraciones.length > 0 ? 'described' : 'no_source',
    sentences: oraciones.map((o) => ({ aspect: o.aspect, es: o.es, cites: o.cites })),
    missingAspects: ASPECTOS.filter((a) => !cubiertos.has(a)),
    sources: citadas.map((c) => ({ id: c, ...fuentes[c] })),
    searchedQuery: buscadas.get(id).query,
  };
}

function main() {
  const uberon = leerJson(join(DATOS, 'uberon-human.json'));
  const piezas = leerJson(join(DATOS, 'bodyparts3d-parts.json'));
  const procedencia = leerJson(join(DATOS, 'provenance.json'));
  const mallas = leerJson(MANIFIESTO_DE_MALLAS);
  const mapeo = leerCarpeta('netter-mapping', []);
  const castellano = leerCarpeta('es', {});
  const netter = new Map(leerJson(join(RAIZ, 'data', 'netter-anatomia', 'entities.json')).map((e) => [e.id, e]));
  // xrefs FMA que UBERON declara y que la FMA servida por OLS4 no tiene: se
  // publican aparte, sin enlace, y no cuentan como FMA de la ficha.
  const fmaInexistentes = new Set(
    existsSync(join(DATOS, 'fma-not-found.json')) ? leerJson(join(DATOS, 'fma-not-found.json')).ids : [],
  );
  const ta2 = existsSync(join(DATOS, 'ta2.json')) ? leerJson(join(DATOS, 'ta2.json')) : { mapped: {}, unmapped: [], source: null };
  const literatura = leerLiteratura();
  const imagenes = leerCarpeta('images', {});

  const porId = new Map(uberon.map((t) => [t.id, t]));
  const nombresExactos = new Map(
    uberon.map((t) => [t.id, new Set([t.label, ...t.exactSynonyms].map(normalizar))]),
  );

  /* ---- el cruce con Netter, comprobado de nuevo -------------------------- */
  const netterPorEstructura = new Map();
  const cruce = { total: netter.size, revisadas: mapeo.length, aceptadas: 0, rechazadas: [], sinCruce: [] };
  const vistas = new Set();
  for (const m of mapeo) {
    if (!netter.has(m.netterId) || vistas.has(m.netterId)) {
      cruce.rechazadas.push({ netterId: m.netterId, motivo: 'entrada desconocida o repetida' });
      continue;
    }
    vistas.add(m.netterId);
    if (m.uberon === null) {
      cruce.sinCruce.push({ netterId: m.netterId, name: m.name, reason: m.reason });
      continue;
    }
    const exactos = nombresExactos.get(m.uberon);
    if (!exactos || !m.matchedText || !exactos.has(normalizar(m.matchedText))) {
      cruce.rechazadas.push({ netterId: m.netterId, motivo: `«${m.matchedText}» no es label ni sinónimo exacto de ${m.uberon}` });
      continue;
    }
    cruce.aceptadas++;
    const e = netter.get(m.netterId);
    const lista = netterPorEstructura.get(m.uberon) ?? [];
    // Sólo la referencia (qué láminas): el texto del índice es de la obra de
    // Elsevier y trae fragmentos de su cabecera leídos por OCR; no se publica.
    lista.push({ netterId: e.id, plates: e.plates, matchKind: m.matchKind });
    netterPorEstructura.set(m.uberon, lista);
  }
  const sinRevisar = [...netter.keys()].filter((id) => !vistas.has(id));

  /* ---- las mallas, por estructura ---------------------------------------- */
  const piezaPorMalla = new Map(piezas.map((p) => [p.meshId, p]));
  const mallasPorEstructura = new Map();
  const partes = [];
  for (const [meshId, malla] of Object.entries(mallas.parts)) {
    const pieza = piezaPorMalla.get(meshId);
    const structureId = pieza.uberon[0] ?? (pieza.fma ? `FMA:${pieza.fma}` : `BP3D:${meshId}`);
    const lado = /\bright\b/i.test(pieza.label) ? 'right' : /\bleft\b/i.test(pieza.label) ? 'left' : null;
    partes.push({
      meshId,
      layer: malla.layer,
      sex: malla.sex,
      structureId,
      shard: shardDe(structureId),
      side: lado,
      labelEn: pieza.label,
      match: pieza.uberonMatch ?? 'fma_only',
    });
    const lista = mallasPorEstructura.get(structureId) ?? [];
    lista.push(meshId);
    mallasPorEstructura.set(structureId, lista);
  }

  /* ---- las fichas -------------------------------------------------------- */
  const entrantes = new Map();
  for (const t of uberon) {
    for (const r of t.relations) {
      if (!porId.has(r.target)) continue;
      const lista = entrantes.get(r.target) ?? [];
      lista.push({ type: r.type, source: t.id });
      entrantes.set(r.target, lista);
    }
  }
  const nombreEs = (id) => castellano[id]?.labelEs ?? null;
  const nombreEn = (id) => porId.get(id)?.label ?? null;

  const fichas = uberon.map((t) => {
    const es = castellano[t.id];
    return {
      id: t.id,
      labelEn: t.label,
      labelEs: es?.labelEs ?? null,
      synonymsEn: t.exactSynonyms,
      fma: t.fma.filter((f) => !fmaInexistentes.has(f)),
      fmaNotFound: t.fma.filter((f) => fmaInexistentes.has(f)),
      regions: t.regions,
      definition: t.definition
        ? {
            en: t.definition,
            es: es?.definitionEs ?? null,
            refs: t.definitionRefs.map(clasificarReferencia),
          }
        : null,
      isA: t.isA.map((r) => ({ target: r.target, labelEn: r.targetLabel, labelEs: nombreEs(r.target), inCatalog: r.inSubset })),
      relations: t.relations.map((r) => ({
        type: r.type,
        name: RELACIONES[r.type],
        target: r.target,
        labelEn: r.targetLabel,
        labelEs: nombreEs(r.target),
        inCatalog: r.inSubset,
      })),
      incoming: (entrantes.get(t.id) ?? []).map((r) => ({
        type: r.type,
        name: INVERSAS[r.type],
        source: r.source,
        labelEn: nombreEn(r.source),
        labelEs: nombreEs(r.source),
      })),
      netter: netterPorEstructura.get(t.id) ?? [],
      meshes: mallasPorEstructura.get(t.id) ?? [],
      ta2: ta2.mapped[t.id] ?? null,
      extendedDescription: descripcionExtendida(t.id, literatura),
      images: imagenes[t.id] ?? [],
    };
  });

  // Las piezas que el FMA nombra y UBERON no cruza: ficha mínima, sólo con lo
  // que dice el FMA (nombre) y BodyParts3D (de qué forma parte).
  for (const p of partes) {
    if (porId.has(p.structureId) || fichas.some((f) => f.id === p.structureId)) continue;
    const pieza = piezaPorMalla.get(p.meshId);
    fichas.push({
      id: p.structureId,
      labelEn: pieza.fmaLabel ?? pieza.label,
      labelEs: castellano[p.structureId]?.labelEs ?? null,
      synonymsEn: [],
      fma: pieza.fma ? [pieza.fma] : [],
      fmaNotFound: [],
      regions: [],
      definition: null,
      isA: [],
      relations: pieza.conventionalPartOf.map((padre) => ({
        type: 'bp3d_part_of',
        name: 'forma parte de (partonomía de BodyParts3D)',
        target: padre,
        labelEn: piezaPorMalla.get(padre)?.label ?? null,
        labelEs: null,
        inCatalog: false,
      })),
      incoming: [],
      netter: [],
      meshes: mallasPorEstructura.get(p.structureId) ?? [],
      ta2: ta2.mapped[p.structureId] ?? null,
      extendedDescription: descripcionExtendida(p.structureId, literatura),
      images: imagenes[p.structureId] ?? [],
    });
  }

  /* ---- escritura --------------------------------------------------------- */
  mkdirSync(CATALOGO, { recursive: true });
  const porShard = Array.from({ length: SHARDS }, () => ({}));
  for (const f of fichas) porShard[shardDe(f.id)][f.id] = f;
  porShard.forEach((contenido, i) =>
    writeFileSync(join(CATALOGO, `structures-${String(i).padStart(2, '0')}.json`), JSON.stringify(contenido) + '\n'),
  );
  const indice = fichas
    .map((f) => [f.id, f.labelEs, f.labelEn, f.meshes.length > 0 ? 1 : 0])
    .sort((a, b) => (a[1] ?? a[2]).localeCompare(b[1] ?? b[2], 'es'));
  writeFileSync(join(CATALOGO, 'index.json'), JSON.stringify({ shards: SHARDS, entries: indice }) + '\n');
  writeFileSync(join(CATALOGO, 'parts.json'), JSON.stringify(partes) + '\n');
  writeFileSync(
    join(DATOS, 'netter-mapping-report.json'),
    JSON.stringify({ ...cruce, sinRevisar }, null, 1) + '\n',
  );

  /* ---- estructuras exclusivas de cada sexo ------------------------------- */
  const padres = new Map(uberon.map((t) => [t.id, [...t.isA.map((r) => r.target), ...t.relations.filter((r) => r.type === 'part_of').map((r) => r.target)]]));
  const alcanza = (id, raices, vistos = new Set()) => {
    if (raices.has(id)) return true;
    if (vistos.has(id)) return false;
    vistos.add(id);
    return (padres.get(id) ?? []).some((p) => alcanza(p, raices, vistos));
  };
  // UBERON cuelga el útero de «internal genitalia», que no tiene sexo: con la
  // sola raíz del sistema reproductor femenino, útero y cuello quedaban
  // afuera. Por eso las raíces son también los órganos exclusivamente
  // femeninos. La mama no entra: existe en los dos sexos.
  const RAICES_FEMENINAS = new Set([
    'UBERON:0000474', // female reproductive system
    'UBERON:0000995', // uterus
    'UBERON:0000992', // ovary
    'UBERON:0000993', // oviduct
    'UBERON:0003889', // fallopian tube
    'UBERON:0000996', // vagina
    'UBERON:0000997', // mammalian vulva
  ]);
  const femeninas = uberon.filter((t) => alcanza(t.id, RAICES_FEMENINAS)).map((t) => t.id);

  const relaciones = fichas.reduce((n, f) => n + f.relations.length, 0);
  const definiciones = fichas.filter((f) => f.definition).length;
  const meta = {
    uberonRelease: procedencia.uberon.release,
    structures: fichas.length,
    uberonStructures: uberon.length,
    fmaOnlyStructures: fichas.length - uberon.length,
    relations: relaciones,
    definitions: definiciones,
    definitionsEs: fichas.filter((f) => f.definition?.es).length,
    labelsEs: fichas.filter((f) => f.labelEs).length,
    meshes: partes.length,
    meshesMappedToUberon: partes.filter((p) => p.match !== 'fma_only').length,
    netterEntries: cruce.total,
    netterMapped: cruce.aceptadas,
    netterUnmapped: cruce.sinCruce.length,
    netterRejected: cruce.rechazadas.length,
    netterNotReviewed: sinRevisar.length,
    ta2Vocabulary: ta2.source?.vocabulary ?? null,
    ta2Crosswalk: ta2.source?.crosswalk ?? null,
    ta2Mapped: fichas.filter((f) => f.ta2).length,
    ta2Unmapped: fichas.filter((f) => !f.ta2).length,
    literatureSearched: fichas.filter((f) => f.extendedDescription).length,
    literatureDescribed: fichas.filter((f) => f.extendedDescription?.status === 'described').length,
    literatureNoSource: fichas.filter((f) => f.extendedDescription?.status === 'no_source').length,
    literatureSentences: fichas.reduce((n, f) => n + (f.extendedDescription?.sentences.length ?? 0), 0),
    literatureSourcesCited: new Set(fichas.flatMap((f) => f.extendedDescription?.sources.map((s) => s.id) ?? [])).size,
    images: fichas.reduce((n, f) => n + f.images.length, 0),
    structuresWithImages: fichas.filter((f) => f.images.length > 0).length,
    femaleOnlyStructures: femeninas.length,
    femaleOnlyWithMesh: femeninas.filter((id) => mallasPorEstructura.has(id)).length,
  };

  const ts = `/* ============================================================================
    El catálogo del atlas anatómico 3D: conteos, procedencia y atribuciones.

    **GENERADO por \`scripts/gen-anatomy-ontology-fixture.mjs\`. No editar a mano.**
    Las fichas no viajan acá: están en \`public/anatomy-atlas-3d/catalog/\` y se
    bajan bajo demanda. Este archivo trae lo que la pantalla muestra antes de
    bajar nada: de dónde sale cada cosa y con qué licencia.

    Regla: nada que la fuente no diga se completa. Los nombres y definiciones en
    castellano son traducción automática sin revisión humana, y se rotulan así.

    Regenerar con \`yarn mock:anatomy-ontology\`.
    ========================================================================== */

/** Una fuente del atlas y cómo hay que atribuirla. */
export interface FuenteDelAtlas3d {
  readonly name: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attribution: string;
  readonly citationDoi: string;
}

export const ATLAS_3D_META = ${JSON.stringify(meta, null, 2)} as const;

export const ATLAS_3D_SOURCES: readonly FuenteDelAtlas3d[] = ${JSON.stringify(
    [
      {
        name: 'BodyParts3D',
        license: procedencia.bodyparts3d.license,
        licenseUrl: procedencia.bodyparts3d.licenseUrl,
        attribution: procedencia.bodyparts3d.attribution,
        citationDoi: procedencia.bodyparts3d.citationDoi,
      },
      {
        name: `UBERON (${procedencia.uberon.release})`,
        license: procedencia.uberon.license,
        licenseUrl: procedencia.uberon.licenseUrl,
        attribution: procedencia.uberon.citation,
        citationDoi: procedencia.uberon.citationDoi,
      },
      {
        name: 'Foundational Model of Anatomy (FMA)',
        license: procedencia.fma.license,
        licenseUrl: procedencia.fma.licenseUrl,
        attribution: procedencia.fma.citation,
        citationDoi: procedencia.fma.citationDoi,
      },
    ],
    null,
    2,
  )};

/** Estructuras femeninas que el modelo no tiene: no existe malla libre para ellas. */
export const ATLAS_3D_FEMALE_ONLY_IDS: readonly string[] = ${JSON.stringify(femeninas)};
`;
  writeFileSync(FIXTURE, ts);
  console.log(JSON.stringify(meta, null, 1));
}

main();
