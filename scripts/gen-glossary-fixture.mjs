/**
 * Porta el glosario médico al simulador: el catálogo curado del backend **más las
 * capas de `data/glossary/`**.
 *
 * ## Por qué existe
 *
 * El backend siembra el glosario desde dos archivos: la taxonomía
 * (`glossary-taxonomy.ts` — 12 categorías `glossary-category-*`, 15 etiquetas
 * `glossary-tag-*` y el value set paraguas) y el catálogo curado
 * (`glossary-terms.catalog.ts` — 69 términos con definición clínica, resumen
 * llano, sinónimos, relaciones tipadas y ficha de medicamento del NDC).
 *
 * El simulador servía otra cosa: siete categorías inventadas con códigos
 * `glossary-diseases`, `glossary-symptoms`… que **no existen en el backend**.
 * La pantalla filtra por el prefijo canónico (`glossary-category-*`, ver
 * `features/glossary/glossary-category-icon.ts`), así que descartaba las siete
 * y la grilla salía vacía: «El glosario todavía no tiene términos cargados».
 * Ninguna definición se veía nunca en la maqueta.
 *
 * Copiar 69 términos a mano los habría dejado desviarse en el primero que el
 * backend agregue. Esto los lee de la fuente y los escribe como fixture.
 *
 * ## Las capas (2026-09-25)
 *
 * A los curados se suman las capas NDJSON de `data/glossary/` (ver su
 * `00_README.md`: procedencia, licencias y esquema de fila):
 *
 * - `enfermedades-atencion-primaria.ndjson`: enfermedades en castellano con
 *   código ICD-10-CM, síntomas del motor (`symptomIds`) y pruebas relacionadas;
 * - `analisis-frecuentes.ndjson`: análisis con LOINC y categoría de orden;
 * - `cie10cm-categorias.generated.ndjson`: las categorías ICD-10-CM completas,
 *   en inglés y **sin definición** — no se fabrica ninguna.
 *
 * Una fila cuyo `slug` es el de un curado **enriquece** al curado (código
 * externo, síntomas, relaciones, etiquetas) y nunca pisa su texto revisado. El
 * servicio de IA (`AlovidaAIService`) copia el archivo generado con
 * `catalog:sync`; por eso todo lo que él necesita —síntomas, relaciones,
 * categoría de orden— viaja acá y no en un segundo catálogo.
 *
 * La lectura de las fuentes vive en `scripts/lib/glosario-corpus.mjs`, que
 * comparte con `check-glossary-corpus.mjs` y `verify-external-codes.mjs`: los
 * tres leen exactamente lo mismo.
 *
 * Uso: `yarn mock:glossary`
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAPAS,
  TIPOS_DE_RELACION,
  idsDeSintomas,
  leerCapas,
  leerSeed,
} from './lib/glosario-corpus.mjs';

const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'glosario.generated.ts',
);

const { categorias, etiquetas, paraguas, terminos } = await leerSeed();

if (categorias.length === 0 || etiquetas.length === 0 || terminos.length === 0) {
  throw new Error(
    'El seed del backend no devolvió taxonomía ni términos: revisá si cambió la forma de los archivos fuente.',
  );
}

const capas = leerCapas();
for (const capa of capas) {
  if (capa.problemas.length > 0) {
    const [primero] = capa.problemas;
    throw new Error(
      `${capa.nombre}:${primero.linea} ${primero.motivo} (${capa.problemas.length} problema(s); corré node scripts/check-glossary-corpus.mjs)`,
    );
  }
}
const sintomas = idsDeSintomas();

/* Las claves que el catálogo referencia tienen que existir en la taxonomía; el
   backend lo valida lanzando (`glossaryCategoryByKey`) y acá se hace lo mismo,
   porque un fixture con una categoría fantasma vuelve a dejar la grilla muda. */
const clavesDeCategoria = new Set(categorias.map((c) => c.key));
const clavesDeEtiqueta = new Set(etiquetas.map((t) => t.key));

function validarTaxonomia(termino, origen) {
  if (!clavesDeCategoria.has(termino.categoryKey)) {
    throw new Error(
      `«${termino.slug}» (${origen}) declara la categoría desconocida «${termino.categoryKey}».`,
    );
  }
  for (const clave of termino.tagKeys) {
    if (!clavesDeEtiqueta.has(clave)) {
      throw new Error(`«${termino.slug}» (${origen}) declara la etiqueta desconocida «${clave}».`);
    }
  }
  for (const id of termino.symptomIds ?? []) {
    // Es el puente entre lo que el motor reconoce y la enfermedad: un id
    // inventado es una relación muerta, y el servicio de IA la seguiría.
    if (!sintomas.has(id)) {
      throw new Error(`«${termino.slug}» (${origen}) declara el síntoma inexistente «${id}».`);
    }
  }
  for (const relacion of termino.relations) {
    if (!TIPOS_DE_RELACION.has(relacion.type)) {
      throw new Error(
        `«${termino.slug}» (${origen}) declara la relación de tipo desconocido «${relacion.type}».`,
      );
    }
  }
}

/* ---- 1. Los curados, verbatim, con lo que las capas les suman ------------- */

const curadosPorSlug = new Map(
  terminos.map((t) => [t.slug, { ...t, relations: [...t.relations] }]),
);

/* ---- 2. Las capas: filas nuevas, o enriquecimiento de un curado ----------- */

/** Una fila NDJSON con la forma de `TerminoDeGlosario`. */
function terminoDeFila(fila) {
  const { linea, ...f } = fila;
  const termino = {
    key: f.slug,
    slug: f.slug,
    categoryKey: f.categoryKey,
    tagKeys: f.tagKeys ?? [],
    enDisplay: f.enDisplay,
    esName: f.display,
    esSynonyms: f.esSynonyms,
    // Una fila en inglés no trae definición (el checker lo exige): queda
    // vacía a propósito, y la ficha lo dice en vez de rellenarla.
    clinicalDefinitionEs: f.definition ?? '',
    plainSummaryEs: f.plainSummaryEs ?? '',
    relations: (f.relations ?? []).map((r) => ({ type: r.type, targetSlug: r.targetSlug })),
    externalCode: { system: f.codeSystem, code: f.code },
    lang: f.lang,
    symptomIds: f.symptomIds,
    analysisCategory: f.analysisCategory,
    reviewStatus: f.reviewStatus,
    source: f.source,
  };
  return termino;
}

const conteoDeCapas = { curados: terminos.length };
const nuevos = [];
let enriquecidos = 0;

for (const capa of capas) {
  let filasNuevas = 0;
  for (const fila of capa.filas) {
    const curado = curadosPorSlug.get(fila.slug);
    if (curado !== undefined) {
      // Enriquecimiento: sólo lo estructural. El texto revisado no se toca.
      enriquecidos += 1;
      if (curado.externalCode === undefined && typeof fila.code === 'string') {
        curado.externalCode = { system: fila.codeSystem, code: fila.code };
      }
      if (Array.isArray(fila.symptomIds) && fila.symptomIds.length > 0) {
        curado.symptomIds = [...new Set([...(curado.symptomIds ?? []), ...fila.symptomIds])];
      }
      for (const relacion of fila.relations ?? []) {
        const repetida = curado.relations.some(
          (r) => r.type === relacion.type && r.targetSlug === relacion.targetSlug,
        );
        if (!repetida)
          curado.relations.push({ type: relacion.type, targetSlug: relacion.targetSlug });
      }
      if (Array.isArray(fila.tagKeys) && fila.tagKeys.length > 0) {
        curado.tagKeys = [...new Set([...curado.tagKeys, ...fila.tagKeys])];
      }
      if (fila.analysisCategory !== undefined) curado.analysisCategory = fila.analysisCategory;
      continue;
    }
    nuevos.push({ termino: terminoDeFila(fila), origen: `${capa.nombre}:${fila.linea}` });
    filasNuevas += 1;
  }
  conteoDeCapas[capa.nombre] = filasNuevas;
}

const curados = [...curadosPorSlug.values()];
for (const termino of curados) validarTaxonomia(termino, 'seed');
for (const { termino, origen } of nuevos) validarTaxonomia(termino, origen);

/* ---- 3. Relaciones: las huérfanas se omiten, con aviso -------------------- */

/* Las relaciones que apuntan a un slug inexistente se omiten, igual que hace
   `GlossarySeedService` en el backend (hay una así en la fuente curada:
   `hipertension-arterial -> control-de-signos-vitales`). Se avisa, no se
   inventa el término faltante. */
const todos = [...curados, ...nuevos.map((n) => n.termino)];
const slugs = new Set(todos.map((t) => t.slug));
if (slugs.size !== todos.length) {
  throw new Error(
    'Hay slugs repetidos entre el seed y las capas; corré node scripts/check-glossary-corpus.mjs',
  );
}
let huerfanas = 0;
const conRelaciones = todos.map((termino) => {
  const relaciones = termino.relations.filter((relacion) => {
    const existe = slugs.has(relacion.targetSlug);
    if (!existe) {
      huerfanas += 1;
      console.warn(
        `[glosario] relación omitida: ${termino.slug} -${relacion.type}-> ${relacion.targetSlug} (destino inexistente)`,
      );
    }
    return existe;
  });
  return { ...termino, relations: relaciones };
});

/* ---- 4. Escritura --------------------------------------------------------- */

/** Serializa un valor como literal TypeScript indentado. */
function literal(valor, sangria = '  ') {
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '[]';
    const partes = valor.map((v) => `${sangria}  ${literal(v, `${sangria}  `)}`);
    return `[\n${partes.join(',\n')},\n${sangria}]`;
  }
  const entradas = Object.entries(valor).filter(([, v]) => v !== undefined);
  // Una clave que no es identificador (`analisis-frecuentes.ndjson`) va entre comillas.
  const clave = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
  const partes = entradas.map(([k, v]) => `${sangria}  ${clave(k)}: ${literal(v, `${sangria}  `)}`);
  return `{\n${partes.join(',\n')},\n${sangria}}`;
}

/** Los campos de un término, en el orden en que se leen; los ausentes no se escriben. */
function camposDe(termino) {
  return {
    key: termino.key,
    slug: termino.slug,
    categoryKey: termino.categoryKey,
    tagKeys: termino.tagKeys,
    enDisplay: termino.enDisplay,
    esName: termino.esName,
    esSynonyms: termino.esSynonyms,
    clinicalDefinitionEs: termino.clinicalDefinitionEs,
    clinicalDefinitionEn: termino.clinicalDefinitionEn,
    plainSummaryEs: termino.plainSummaryEs,
    plainSummaryEn: termino.plainSummaryEn,
    relations: termino.relations.map((r) => ({ type: r.type, targetSlug: r.targetSlug })),
    drugFacts: termino.drugFacts,
    externalCode: termino.externalCode,
    lang: termino.lang,
    symptomIds: termino.symptomIds,
    analysisCategory: termino.analysisCategory,
    reviewStatus: termino.reviewStatus,
    source: termino.source,
  };
}

/* Los curados van indentados, como siempre: son pocos y se leen. Las capas
   van una por línea: son miles de filas y lo que importa de ellas es que el
   archivo siga siendo un literal que `tsc` compila rápido, no que se lea a ojo
   —para eso está el NDJSON de origen. */
const entradasCuradas = conRelaciones
  .slice(0, curados.length)
  .map((t) => literal(camposDe(t), '  '));
const entradasDeCapa = conRelaciones
  .slice(curados.length)
  .map(
    (t) =>
      `  ${JSON.stringify(Object.fromEntries(Object.entries(camposDe(t)).filter(([, v]) => v !== undefined)))}`,
  );

const resumenDeCapas = CAPAS.filter((nombre) => nombre in conteoDeCapas)
  .map((nombre) => `${conteoDeCapas[nombre]} de ${nombre}`)
  .join(', ');

const archivo = `/* ============================================================================
    El glosario médico: el catálogo curado del backend más las capas de
    \`data/glossary/\`.

    **GENERADO por \`scripts/gen-glossary-fixture.mjs\`. No editar a mano.**
    Fuentes: \`glossary-taxonomy.ts\` (${categorias.length} categorías, ${etiquetas.length} etiquetas) y
    \`glossary-terms.catalog.ts\` (${curados.length} términos curados) de
    \`mantra-core-health-api/src/common/seed/\`, más ${nuevos.length} términos de las
    capas NDJSON (${resumenDeCapas}); ${enriquecidos} fila(s) de las capas
    enriquecen un curado sin pisar su texto.

    Los términos con \`lang: "en"\` no traen definición: la fuente no la publica
    y no se fabrica. Su \`clinicalDefinitionEs\` y \`plainSummaryEs\` quedan vacíos.

    Regenerar con \`yarn mock:glossary\`. El servicio de IA copia este archivo
    con \`yarn catalog:sync\` (AlovidaAIService): ahí tampoco se edita.
    ========================================================================== */

/** Una categoría o etiqueta del glosario: clave corta, código interno y nombre. */
export interface EntradaDeTaxonomia {
  readonly key: string;
  /** \`glossary-category-<key>\` o \`glossary-tag-<key>\` — lo que viaja en la URL. */
  readonly internalCode: string;
  readonly name: string;
}

/** Una relación clínica tipada hacia otro término, por su slug. */
export interface RelacionDeTermino {
  readonly type: string;
  readonly targetSlug: string;
}

/** La ficha de medicamento, verbatim del FDA NDC Directory. */
export interface FichaDeMedicamento {
  readonly sourceNdc: string;
  readonly activeIngredients: readonly string[];
  readonly dosageForm: string;
  readonly route: readonly string[];
  readonly manufacturer: string;
}

/** El código de un término en un sistema externo (\`icd10cm\`, \`loinc\`). */
export interface CodigoExterno {
  readonly system: string;
  readonly code: string;
}

/** Un término del glosario: curado del backend o de una capa de \`data/glossary/\`. */
export interface TerminoDeGlosario {
  readonly key: string;
  readonly slug: string;
  /** Clave de su única categoría. */
  readonly categoryKey: string;
  /** Claves de sus etiquetas clínicas, 0..N. */
  readonly tagKeys: readonly string[];
  readonly enDisplay: string;
  readonly esName: string;
  readonly esSynonyms?: readonly string[];
  /** Vacía cuando la fuente no publica definición (\`lang: "en"\`). */
  readonly clinicalDefinitionEs: string;
  readonly clinicalDefinitionEn?: string;
  /** Vacío cuando la fuente no publica resumen (\`lang: "en"\`). */
  readonly plainSummaryEs: string;
  readonly plainSummaryEn?: string;
  readonly relations: readonly RelacionDeTermino[];
  readonly drugFacts?: FichaDeMedicamento;
  /** Su código ICD-10-CM o LOINC, cuando lo tiene. */
  readonly externalCode?: CodigoExterno;
  /** Idioma del nombre y las definiciones. Ausente equivale a \`es\`. */
  readonly lang?: 'es' | 'en';
  /** Ids de \`symptom-check/sintomas.datos.ts\` que orientan a este término. */
  readonly symptomIds?: readonly string[];
  /** Cómo se pide como orden (\`SRQ-LAB\`, \`SRQ-IMAGING\`, \`SRQ-OTHER\`); sólo en análisis. */
  readonly analysisCategory?: 'LAB' | 'IMAGING' | 'OTHER';
  /** \`external-source\` · \`pending-medical-review\` · \`medically-reviewed\`. Ausente en los curados. */
  readonly reviewStatus?: string;
  /** Identificador corto de la fuente de la fila (ver \`data/glossary/00_README.md\`). */
  readonly source?: string;
}

/** Las ${categorias.length} categorías de la grilla. Pertenencia exclusiva: un término, una categoría. */
export const CATEGORIAS_DE_GLOSARIO: readonly EntradaDeTaxonomia[] = ${literal(
  categorias.map((c) => ({ key: c.key, internalCode: c.internalCode, name: c.name })),
  '',
)};

/** Las ${etiquetas.length} etiquetas clínicas. Un término lleva 0..N. */
export const ETIQUETAS_DE_GLOSARIO: readonly EntradaDeTaxonomia[] = ${literal(
  etiquetas.map((t) => ({ key: t.key, internalCode: t.internalCode, name: t.name })),
  '',
)};

/** El value set paraguas: todo término del glosario es miembro de éste. */
export const GLOSARIO_TODOS_LOS_TERMINOS: EntradaDeTaxonomia = ${literal(
  {
    key: paraguas.key,
    internalCode: paraguas.internalCode,
    name: paraguas.name,
  },
  '',
)};

/**
 * Cuántos términos aportó cada fuente: \`curados\` y cada archivo NDJSON. Una
 * fila que enriquece a un curado no cuenta como término nuevo.
 */
export const CONTEO_DE_CAPAS: Readonly<Record<string, number>> = ${literal(conteoDeCapas, '')};

/** Los ${conRelaciones.length} términos: primero los ${curados.length} curados, en el orden del catálogo; después las capas. */
export const TERMINOS_DE_GLOSARIO: readonly TerminoDeGlosario[] = [
${[...entradasCuradas, ...entradasDeCapa].join(',\n')},
];
`;

writeFileSync(DESTINO, archivo);

console.log(
  `[glosario] ${categorias.length} categorías · ${etiquetas.length} etiquetas · ${conRelaciones.length} términos ` +
    `(${curados.length} curados + ${nuevos.length} de las capas: ${resumenDeCapas}; ${enriquecidos} enriquecen un curado)` +
    (huerfanas > 0 ? ` · ${huerfanas} relación(es) huérfana(s) omitida(s)` : ''),
);
console.log(`[glosario] escrito ${DESTINO}`);
