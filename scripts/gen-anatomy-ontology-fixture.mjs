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
 * ## Lo que NO trae, y por qué
 *
 * - **Descripción extendida con literatura.** Exigía PubMed, Europe PMC,
 *   OpenAlex y Crossref para citar y comprobar cada afirmación, y la red de la
 *   sesión que armó esto no los alcanzaba. Queda `null`, con su motivo, y la
 *   ficha lo dice. No se escribe de memoria.
 * - **Imágenes de Wikimedia Commons.** Igual: sin la API `extmetadata` no hay
 *   autor ni licencia comprobables, así que no hay imagen.
 * - **Relaciones que UBERON no declara.** Las inversas que se publican
 *   (`incoming`) son la misma afirmación leída desde la otra punta, no una nueva.
 *
 * ## Salida
 *
 * - `public/anatomy-atlas-3d/catalog/`: `index.json` (búsqueda y shard de cada
 *   estructura), `parts.json` (malla → estructura), `composites.json`
 *   (estructura compuesta → las partes suyas que tienen malla) y
 *   `structures-NN.json` (las fichas, en 32 shards). Se bajan bajo demanda, como el glosario: no
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
/**
 * Una estructura compuesta resalta las mallas de todas sus partes, pero no las
 * de una clase abstracta: «órgano», «organismo» o «entidad anatómica» llegan a
 * 150–550 mallas, y encender medio cuerpo no le muestra nada a quien buscó una
 * estructura. Pasado este tope la estructura sigue sin pieza 3D.
 */
const MAX_MALLAS_COMPUESTAS = 120;

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

function main() {
  const uberon = leerJson(join(DATOS, 'uberon-human.json'));
  const piezas = leerJson(join(DATOS, 'bodyparts3d-parts.json'));
  const procedencia = leerJson(join(DATOS, 'provenance.json'));
  const mallas = leerJson(MANIFIESTO_DE_MALLAS);
  const mapeo = leerCarpeta('netter-mapping', []);
  const castellano = leerCarpeta('es', {});
  const netter = new Map(leerJson(join(RAIZ, 'data', 'netter-anatomia', 'entities.json')).map((e) => [e.id, e]));

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
      fma: t.fma,
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
      extendedDescription: null,
      images: [],
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
      extendedDescription: null,
      images: [],
    });
  }

  /* ---- estructuras compuestas -------------------------------------------
     «Pulmón», «pulmón derecho» o «corazón» no tienen malla propia: BodyParts3D
     dibuja sus lóbulos y cavidades. Sin esto el índice las marcaba «sin pieza
     3D» y no se resaltaba nada, aunque el modelo las contiene enteras. Una
     compuesta resalta las mallas de sus partes: lo que la ontología declara
     como «es un» o «forma parte de» (en cualquiera de los dos sentidos). */
  const hijos = new Map();
  const agregarHijo = (padre, hijo) => {
    if (!porId.has(padre) || !porId.has(hijo) || padre === hijo) return;
    const lista = hijos.get(padre) ?? new Set();
    lista.add(hijo);
    hijos.set(padre, lista);
  };
  for (const t of uberon) {
    for (const r of t.isA) agregarHijo(r.target, t.id);
    for (const r of t.relations) {
      if (r.type === 'part_of') agregarHijo(r.target, t.id);
      else if (r.type === 'has_part') agregarHijo(t.id, r.target);
    }
  }
  const compuestas = {};
  for (const t of uberon) {
    if (mallasPorEstructura.has(t.id)) continue;
    const vistos = new Set();
    const pila = [t.id];
    while (pila.length > 0) {
      for (const hijo of hijos.get(pila.pop()) ?? []) {
        if (vistos.has(hijo)) continue;
        vistos.add(hijo);
        pila.push(hijo);
      }
    }
    const miembros = [...vistos].filter((id) => mallasPorEstructura.has(id)).sort();
    const nMallas = miembros.reduce((n, id) => n + mallasPorEstructura.get(id).length, 0);
    if (nMallas > 0 && nMallas <= MAX_MALLAS_COMPUESTAS) compuestas[t.id] = miembros;
  }

  /* ---- escritura --------------------------------------------------------- */
  mkdirSync(CATALOGO, { recursive: true });
  const porShard = Array.from({ length: SHARDS }, () => ({}));
  for (const f of fichas) porShard[shardDe(f.id)][f.id] = f;
  porShard.forEach((contenido, i) =>
    writeFileSync(join(CATALOGO, `structures-${String(i).padStart(2, '0')}.json`), JSON.stringify(contenido) + '\n'),
  );
  const indice = fichas
    .map((f) => [f.id, f.labelEs, f.labelEn, f.meshes.length > 0 || f.id in compuestas ? 1 : 0])
    .sort((a, b) => (a[1] ?? a[2]).localeCompare(b[1] ?? b[2], 'es'));
  writeFileSync(join(CATALOGO, 'index.json'), JSON.stringify({ shards: SHARDS, entries: indice }) + '\n');
  writeFileSync(join(CATALOGO, 'parts.json'), JSON.stringify(partes) + '\n');
  writeFileSync(join(CATALOGO, 'composites.json'), JSON.stringify(compuestas) + '\n');
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
    compositeStructures: Object.keys(compuestas).length,
    meshesMappedToUberon: partes.filter((p) => p.match !== 'fma_only').length,
    netterEntries: cruce.total,
    netterMapped: cruce.aceptadas,
    netterUnmapped: cruce.sinCruce.length,
    netterRejected: cruce.rechazadas.length,
    netterNotReviewed: sinRevisar.length,
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
