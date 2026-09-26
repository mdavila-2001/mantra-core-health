/**
 * Valida las capas NDJSON de `data/glossary/` sin red, antes de generar el fixture.
 *
 * Lo que revisa, y por qué cada cosa rompe si falta:
 *
 * - **Campos obligatorios** del esquema (`00_README.md`): una fila sin `slug` no se
 *   puede enlazar; una sin `display` no se puede mostrar.
 * - **Slug único en todo el corpus**, curados incluidos. Un slug repetido entre
 *   capas produciría dos fichas con la misma URL. La única repetición admitida es
 *   contra un **curado**, que se lee como enriquecimiento (y sólo puede aportar
 *   `externalCode`, `symptomIds`, `relations` y `tagKeys`: nunca texto).
 * - **Taxonomía**: `categoryKey` y `tagKeys` tienen que existir en
 *   `glossary-taxonomy.ts`; el generador ya lo exige para los curados y la grilla
 *   se queda muda ante una categoría fantasma.
 * - **`symptomIds`** existentes en `sintomas.datos.ts`: son el puente entre lo que
 *   el motor reconoce y la enfermedad; un id inventado es una relación muerta.
 * - **Relaciones** con tipo válido y destino resoluble en el corpus completo.
 * - **`code` único por archivo**: es lo que el motor de carga masiva rechaza
 *   como duplicado (regla Q-6 del contrato).
 * - **Coherencia ICD**: toda fila ES con `codeSystem: icd10cm` tiene que caer
 *   dentro de una categoría de la capa ICD (`J45.20` → `J45`). No verifica que el
 *   código completo exista — eso lo hace `verify-external-codes.mjs` con red.
 *
 * Sale con 1 y la lista de problemas si hay alguno; con 0 y conteos si no.
 * Uso: `node scripts/check-glossary-corpus.mjs`
 */
import {
  CATEGORIAS_DE_ORDEN,
  ESTADOS_DE_REVISION,
  TIPOS_DE_RELACION,
  idsDeSintomas,
  leerCapas,
  leerSeed,
} from './lib/glosario-corpus.mjs';

const OBLIGATORIOS = [
  'code',
  'display',
  'slug',
  'codeSystem',
  'categoryKey',
  'lang',
  'enDisplay',
  'reviewStatus',
  'source',
];
const SOLO_ENRIQUECEN = new Set([
  'slug',
  'code',
  'codeSystem',
  'lang',
  'enDisplay',
  'symptomIds',
  'relations',
  'tagKeys',
  'reviewStatus',
  'source',
  'linea',
  'analysisCategory',
  'display',
  'categoryKey',
]);

const seed = await leerSeed();
const capas = leerCapas();
const sintomas = idsDeSintomas();
const clavesDeCategoria = new Set(seed.categorias.map((c) => c.key));
const clavesDeEtiqueta = new Set(seed.etiquetas.map((t) => t.key));
const curados = new Map(seed.terminos.map((t) => [t.slug, t]));

const problemas = [];
const avisar = (capa, fila, motivo) =>
  problemas.push(`${capa}:${fila.linea ?? '?'} (${fila.slug ?? fila.code ?? '?'}) ${motivo}`);

/* Primero el índice de slugs de todo el corpus, porque las relaciones de la
   primera capa pueden apuntar a la última. */
const slugs = new Set(curados.keys());
const vistosPorCapa = new Map();
for (const capa of capas) {
  for (const p of capa.problemas) problemas.push(`${capa.nombre}:${p.linea} ${p.motivo}`);
  const vistos = new Set();
  vistosPorCapa.set(capa.nombre, vistos);
  for (const fila of capa.filas) {
    if (typeof fila.slug !== 'string') continue;
    if (vistos.has(fila.slug)) avisar(capa.nombre, fila, 'slug repetido en el archivo');
    vistos.add(fila.slug);
    slugs.add(fila.slug);
  }
}
const slugsPorCapa = [...vistosPorCapa.entries()];
for (let i = 0; i < slugsPorCapa.length; i++) {
  for (let j = i + 1; j < slugsPorCapa.length; j++) {
    for (const slug of slugsPorCapa[i][1]) {
      if (slugsPorCapa[j][1].has(slug))
        problemas.push(`${slugsPorCapa[i][0]} y ${slugsPorCapa[j][0]} repiten el slug «${slug}»`);
    }
  }
}

const categoriasIcd = new Set(
  (capas.find((c) => c.nombre === 'cie10cm-categorias.generated.ndjson')?.filas ?? []).map(
    (f) => f.code,
  ),
);

const conteos = {};
for (const capa of capas) {
  const codigos = new Set();
  conteos[capa.nombre] = { filas: capa.filas.length, enriquecen: 0 };
  for (const fila of capa.filas) {
    for (const campo of OBLIGATORIOS) {
      if (typeof fila[campo] !== 'string' || fila[campo].trim() === '')
        avisar(capa.nombre, fila, `falta «${campo}»`);
    }
    if (typeof fila.code === 'string') {
      if (codigos.has(fila.code)) avisar(capa.nombre, fila, `code repetido «${fila.code}»`);
      codigos.add(fila.code);
    }
    if (!clavesDeCategoria.has(fila.categoryKey))
      avisar(capa.nombre, fila, `categoría desconocida «${fila.categoryKey}»`);
    for (const tag of fila.tagKeys ?? []) {
      if (!clavesDeEtiqueta.has(tag)) avisar(capa.nombre, fila, `etiqueta desconocida «${tag}»`);
    }
    if (!ESTADOS_DE_REVISION.has(fila.reviewStatus))
      avisar(capa.nombre, fila, `reviewStatus inválido «${fila.reviewStatus}»`);
    if (fila.lang !== 'es' && fila.lang !== 'en')
      avisar(capa.nombre, fila, `lang inválido «${fila.lang}»`);
    if (
      fila.lang === 'en' &&
      typeof fila.definition === 'string' &&
      fila.definition.trim() !== ''
    ) {
      avisar(
        capa.nombre,
        fila,
        'una fila en inglés no puede traer definición: no hay fuente para ella',
      );
    }
    const curado = curados.get(fila.slug);
    if (
      curado === undefined &&
      fila.lang === 'es' &&
      (typeof fila.plainSummaryEs !== 'string' || fila.plainSummaryEs.trim() === '')
    ) {
      avisar(capa.nombre, fila, 'falta «plainSummaryEs»');
    }
    for (const id of fila.symptomIds ?? []) {
      if (!sintomas.has(id)) avisar(capa.nombre, fila, `síntoma inexistente «${id}»`);
    }
    for (const relacion of fila.relations ?? []) {
      if (!TIPOS_DE_RELACION.has(relacion.type))
        avisar(capa.nombre, fila, `tipo de relación inválido «${relacion.type}»`);
      if (!slugs.has(relacion.targetSlug))
        avisar(
          capa.nombre,
          fila,
          `relación ${relacion.type} a un slug inexistente «${relacion.targetSlug}»`,
        );
    }
    if (fila.analysisCategory !== undefined && !CATEGORIAS_DE_ORDEN.has(fila.analysisCategory)) {
      avisar(capa.nombre, fila, `analysisCategory inválida «${fila.analysisCategory}»`);
    }
    if (
      (fila.categoryKey === 'lab' ||
        fila.categoryKey === 'imaging' ||
        fila.categoryKey === 'diagnostic-test') &&
      fila.analysisCategory === undefined &&
      fila.lang === 'es'
    ) {
      avisar(
        capa.nombre,
        fila,
        'un análisis necesita «analysisCategory» para poder pedirse como orden',
      );
    }
    if (fila.codeSystem === 'icd10cm' && fila.lang === 'es' && categoriasIcd.size > 0) {
      const categoria = String(fila.code).replace('.', '').slice(0, 3);
      if (!categoriasIcd.has(categoria))
        avisar(
          capa.nombre,
          fila,
          `el código «${fila.code}» no cae en ninguna categoría ICD-10-CM conocida`,
        );
    }
    if (curado !== undefined) {
      conteos[capa.nombre].enriquecen += 1;
      for (const campo of Object.keys(fila)) {
        if (!SOLO_ENRIQUECEN.has(campo))
          avisar(
            capa.nombre,
            fila,
            `enriquece al curado «${fila.slug}» pero trae «${campo}», que es texto revisado y no se pisa`,
          );
      }
    }
  }
}

if (problemas.length > 0) {
  console.error(`[glosario] ${problemas.length} problema(s):`);
  for (const p of problemas.slice(0, 80)) console.error(`  - ${p}`);
  if (problemas.length > 80) console.error(`  … y ${problemas.length - 80} más`);
  process.exit(1);
}

console.log(`[glosario] curados: ${seed.terminos.length} · síntomas del motor: ${sintomas.size}`);
for (const [nombre, c] of Object.entries(conteos)) {
  console.log(
    `[glosario] ${nombre}: ${c.filas} filas${c.enriquecen > 0 ? ` (${c.enriquecen} enriquecen un curado)` : ''}`,
  );
}
console.log('[glosario] 0 problemas');
