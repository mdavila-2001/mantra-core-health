/**
 * Porta el glosario médico curado del backend al simulador.
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
 * ## Cómo lee TypeScript sin compilar el backend
 *
 * Los dos archivos fuente son literales puros más algunos derivadores de id que
 * acá no hacen falta (el simulador deriva los suyos con `uuid()`). Se les quitan
 * los `import`, se stubean los identificadores que quedan colgando, se
 * transpilan con el esbuild que ya trae Angular y se importan.
 *
 * Uso: `yarn mock:glossary`
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { transformSync } from 'esbuild';

const SEED = join(process.cwd(), '..', 'mantra-core-health-api', 'src', 'common', 'seed');
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'glosario.generated.ts',
);

/** Identificadores que los archivos fuente importan y que acá no hacen falta. */
const STUBS = `
const deterministicId = (clave) => clave;
const valueSetId = (clave) => clave;
const valueSetVersionId = (clave) => clave;
const valueSetMemberId = (clave) => clave;
const valueSetCanonicalUrl = (clave) => clave;
const GLOSSARY_ALL_TERMS_CODE = 'glossary-all-terms';
`;

const temporal = mkdtempSync(join(tmpdir(), 'glosario-'));

/** Transpila un archivo del seed y lo importa como módulo ESM. */
async function leer(nombre) {
  const fuente = readFileSync(join(SEED, `${nombre}.ts`), 'utf8')
    // Los `import` multilínea del seed apuntan a módulos del backend que acá no
    // existen; los identificadores que aportan están stubeados arriba.
    .replace(/^import[\s\S]*?from\s+'[^']+';$/gm, '');
  const { code } = transformSync(STUBS + fuente, { loader: 'ts', format: 'esm' });
  const destino = join(temporal, `${nombre}.mjs`);
  writeFileSync(destino, code);
  return import(pathToFileURL(destino).href);
}

const taxonomia = await leer('glossary-taxonomy');
const catalogo = await leer('glossary-terms.catalog');

const categorias = taxonomia.GLOSSARY_CATEGORIES;
const etiquetas = taxonomia.GLOSSARY_TAGS;
const terminos = catalogo.GLOSSARY_TERMS;

rmSync(temporal, { recursive: true, force: true });

if (categorias.length === 0 || etiquetas.length === 0 || terminos.length === 0) {
  throw new Error(
    'El seed del backend no devolvió taxonomía ni términos: revisá si cambió la forma de los archivos fuente.',
  );
}

/* Las claves que el catálogo referencia tienen que existir en la taxonomía; el
   backend lo valida lanzando (`glossaryCategoryByKey`) y acá se hace lo mismo,
   porque un fixture con una categoría fantasma vuelve a dejar la grilla muda. */
const clavesDeCategoria = new Set(categorias.map((c) => c.key));
const clavesDeEtiqueta = new Set(etiquetas.map((t) => t.key));
const slugs = new Set(terminos.map((t) => t.slug));

for (const termino of terminos) {
  if (!clavesDeCategoria.has(termino.categoryKey)) {
    throw new Error(`«${termino.slug}» declara la categoría desconocida «${termino.categoryKey}».`);
  }
  for (const clave of termino.tagKeys) {
    if (!clavesDeEtiqueta.has(clave)) {
      throw new Error(`«${termino.slug}» declara la etiqueta desconocida «${clave}».`);
    }
  }
}

/* Las relaciones que apuntan a un slug inexistente se omiten, igual que hace
   `GlossarySeedService` en el backend (hay una así en la fuente curada:
   `hipertension-arterial -> control-de-signos-vitales`). Se avisa, no se
   inventa el término faltante. */
let huerfanas = 0;
const conRelaciones = terminos.map((termino) => {
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

/** Serializa un valor como literal TypeScript indentado. */
function literal(valor, sangria = '  ') {
  if (typeof valor === 'string') return JSON.stringify(valor);
  if (Array.isArray(valor)) {
    if (valor.length === 0) return '[]';
    const partes = valor.map((v) => `${sangria}  ${literal(v, `${sangria}  `)}`);
    return `[\n${partes.join(',\n')},\n${sangria}]`;
  }
  const entradas = Object.entries(valor).filter(([, v]) => v !== undefined);
  const partes = entradas.map(([k, v]) => `${sangria}  ${k}: ${literal(v, `${sangria}  `)}`);
  return `{\n${partes.join(',\n')},\n${sangria}}`;
}

const entradasDeTermino = conRelaciones.map((termino) =>
  literal(
    {
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
    },
    '  ',
  ),
);

const archivo = `/* ============================================================================
    El glosario médico curado, portado del backend.

    **GENERADO por \`scripts/gen-glossary-fixture.mjs\`. No editar a mano.**
    La fuente son \`glossary-taxonomy.ts\` (${categorias.length} categorías, ${etiquetas.length} etiquetas) y
    \`glossary-terms.catalog.ts\` (${conRelaciones.length} términos curados) de
    \`mantra-core-health-api/src/common/seed/\`.

    Regenerar con \`yarn mock:glossary\`.
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

/** Un término curado, tal como lo declara el seed del backend. */
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
  readonly clinicalDefinitionEs: string;
  readonly clinicalDefinitionEn?: string;
  readonly plainSummaryEs: string;
  readonly plainSummaryEn?: string;
  readonly relations: readonly RelacionDeTermino[];
  readonly drugFacts?: FichaDeMedicamento;
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
    key: taxonomia.GLOSSARY_ALL_TERMS.key,
    internalCode: taxonomia.GLOSSARY_ALL_TERMS.internalCode,
    name: taxonomia.GLOSSARY_ALL_TERMS.name,
  },
  '',
)};

/** Los ${conRelaciones.length} términos curados, en el orden del catálogo fuente. */
export const TERMINOS_DE_GLOSARIO: readonly TerminoDeGlosario[] = [
${entradasDeTermino.join(',\n')},
];
`;

writeFileSync(DESTINO, archivo);

console.log(
  `[glosario] ${categorias.length} categorías · ${etiquetas.length} etiquetas · ${conRelaciones.length} términos` +
    (huerfanas > 0 ? ` · ${huerfanas} relación(es) huérfana(s) omitida(s)` : ''),
);
console.log(`[glosario] escrito ${DESTINO}`);
