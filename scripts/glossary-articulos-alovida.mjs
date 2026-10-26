/**
 * Los artículos de autoría propia del glosario (`data/glossary/articulos/*.md`)
 * → cubetas de la maqueta (`public/glossary-seed/mock/articles/<hh>.json`).
 *
 * Un archivo Markdown por término, escrito a mano (el esquema está en
 * `data/glossary/articulos/00_README.md`). Este script lo convierte al formato
 * `GlossaryArticle` (TAREA-41 §12.3) y lo **mezcla** en las cubetas que ya
 * existen: no pisa los artículos de otras fuentes (MedlinePlus), sólo los de
 * los términos que tienen archivo acá.
 *
 * Todo texto de estos archivos es propio del equipo y está **pendiente de
 * revisión médica**: así se declara en cada sección (`source`, `license`) y no
 * se disimula. Lo que no se escribió con fuente no se presenta como si la
 * tuviera.
 *
 * Uso: node scripts/glossary-articulos-alovida.mjs [--check] [--min <palabras>] [--only a,b]
 *   --check  valida los archivos y sale con error si alguno no cumple; no escribe.
 *   --min    piso de palabras por artículo (por omisión 2000); uno más corto es error.
 *   --sin-imagen  permite artículos sin ilustración (por omisión cada artículo necesita al menos una).
 *            Es una excepción explícita y no el modo normal: se usa para los artículos de investigación
 *            de los términos que todavía no tienen una ilustración original revisada.
 *   --only   procesa sólo esos slugs (para validar un lote sin tocar el resto).
 *   --api    carpeta del repo del API (por omisión `../mantra-core-health-api` si existe): se le
 *            escribe `src/common/seed/glossary-articles.generated.ts`, de donde el seed siembra la
 *            propiedad `glossary-article` de cada término. Con `--only` no se escribe (sería parcial).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { conceptIdOf } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const ORIGEN = join(RAIZ, 'data', 'glossary', 'articulos');
const IMAGENES = join(RAIZ, 'public', 'glossary-images');
const DESTINO = join(RAIZ, 'public', 'glossary-seed', 'mock', 'articles');
const soloValidar = process.argv.includes('--check');
const opcion = (nombre) => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
};
const PISO = Number(opcion('--min') ?? 2000);
const API = resolve(opcion('--api') ?? join(RAIZ, '..', 'mantra-core-health-api'));
const SOLO = opcion('--only')?.split(',').filter(Boolean);
const SIN_IMAGEN = process.argv.includes('--sin-imagen');

/** Identificador corto de la fuente; `glossary-article.logic.ts` lo traduce a un nombre legible. */
export const FUENTE = 'alovida-curated';
export const LICENCIA_TEXTO = 'Texto original de AloVida, pendiente de revisión médica';
export const LICENCIA_IMAGEN = 'Ilustración original de AloVida';
export const AUTOR = 'Equipo AloVida';
const VERSION = '2026-10-12';

/** Las claves de sección que acepta `GlossarySectionKind`. */
const KINDS = new Set([
  'definition', 'overview', 'symptoms', 'causes', 'risk_factors', 'diagnosis', 'treatment_overview',
  'complications', 'prevention', 'prognosis', 'when_to_seek_care', 'epidemiology', 'genetics',
  'classification', 'associated_conditions', 'red_flags', 'self_care', 'location', 'structure',
  'function', 'blood_supply', 'innervation', 'clinical_relevance', 'related_structures', 'indications',
  'contraindications', 'adverse_effects', 'interactions', 'pregnancy_lactation', 'special_populations',
  'pharmacologic_class', 'presentations', 'purpose', 'preparation', 'procedure_description', 'risks',
  'interpretation', 'reference_values', 'recovery', 'alternatives', 'scope', 'conditions_treated',
  'subspecialties', 'training', 'transmission', 'side_effects', 'effects', 'benefits', 'how_it_works',
  'safe_use', 'what_to_expect', 'importance', 'considerations', 'additional_information',
]);

const VINETA = /^[•·]\s+/;

/** Palabras de un texto: lo que se cuenta para el mínimo de profundidad. */
export const palabras = (texto) => texto.split(/\s+/).filter(Boolean).length;

/** Los elementos de las listas con viñeta del texto, en orden. */
function itemsDe(texto) {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => VINETA.test(linea))
    .map((linea) => linea.replace(VINETA, ''));
}


/**
 * Lee un archivo Markdown de autoría.
 *
 * ```
 * ---
 * slug: hipertension-arterial
 * image: archivo.svg | Pie de imagen | Texto alternativo descriptivo
 * ---
 * ## [definition] Introducción
 * Párrafos…
 * ## [references]
 * - Título | https://… | Fuente
 * ```
 */
export function leerMarkdown(texto, archivo = '(texto)') {
  const crudo = texto.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(crudo);
  if (m === null) throw new Error(`${archivo}: falta el encabezado «---»`);
  const autoria = { slug: undefined, sections: [], references: [], images: [] };
  for (const linea of m[1].split('\n')) {
    if (linea.trim() === '') continue;
    const i = linea.indexOf(':');
    if (i === -1) throw new Error(`${archivo}: línea de encabezado inválida «${linea}»`);
    const clave = linea.slice(0, i).trim();
    const valor = linea.slice(i + 1).trim();
    if (clave === 'slug') autoria.slug = valor;
    else if (clave === 'image') {
      const [file, caption, altText, ...resto] = valor.split('|').map((x) => x.trim());
      if (file === undefined || caption === undefined || altText === undefined || resto.length > 0) {
        throw new Error(`${archivo}: «image» lleva exactamente «archivo | pie | texto alternativo»`);
      }
      autoria.images.push({ file, caption, altText });
    } else throw new Error(`${archivo}: clave de encabezado desconocida «${clave}»`);
  }
  let actual = null;
  const cierra = () => {
    if (actual === null) return;
    const cuerpo = actual.lineas.join('\n').trim();
    if (actual.kind === 'references') {
      for (const linea of cuerpo.split('\n').filter((l) => l.trim() !== '')) {
        const [title, url, source, ...resto] = linea.replace(/^[-•]\s*/, '').split('|').map((x) => x.trim());
        if (!title || !url || !source || resto.length > 0) {
          throw new Error(`${archivo}: referencia inválida «${linea}» (título | url | fuente)`);
        }
        autoria.references.push({ title, url, source });
      }
    } else {
      autoria.sections.push({ kind: actual.kind, locator: actual.locator, text: cuerpo });
    }
    actual = null;
  };
  for (const linea of m[2].split('\n')) {
    const h = /^##\s+\[([a-z_]+)\]\s*(.*)$/.exec(linea);
    if (h !== null) {
      cierra();
      actual = { kind: h[1], locator: h[2].trim(), lineas: [] };
    } else if (actual !== null) actual.lineas.push(linea);
    else if (linea.trim() !== '') throw new Error(`${archivo}: texto antes de la primera sección «## [kind]»`);
  }
  cierra();
  return autoria;
}

/** Convierte un archivo de autoría en el artículo que sirve la API. Lanza si no cumple. */
export function compilar(autoria, hoy = VERSION) {
  const { slug } = autoria;
  const falla = (motivo) => {
    throw new Error(`${slug ?? '(sin slug)'}: ${motivo}`);
  };
  if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) falla('slug inválido');
  if (!Array.isArray(autoria.sections) || autoria.sections.length === 0) falla('sin secciones');

  const secciones = autoria.sections.map((s, i) => {
    if (!KINDS.has(s.kind)) falla(`sección ${i + 1}: kind «${s.kind}» desconocido`);
    if (typeof s.text !== 'string' || s.text.trim() === '') falla(`sección ${i + 1}: texto vacío`);
    const items = itemsDe(s.text);
    return {
      kind: s.kind,
      text: s.text.trim(),
      lang: 'es',
      ...(items.length > 0 ? { items } : {}),
      source: FUENTE,
      sourceUrl: '',
      license: LICENCIA_TEXTO,
      retrievedAt: hoy,
      sourceVersion: VERSION,
      locator: s.locator ?? '',
    };
  });

  const imagenes = (autoria.images ?? []).map(({ file, caption, altText }) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*\.svg$/.test(file)) falla(`la imagen «${file}» debe llamarse en kebab-case y ser .svg`);
    if (!existsSync(join(IMAGENES, file))) falla(`la imagen ${file} no existe en public/glossary-images`);
    if (typeof altText !== 'string' || altText.trim().length < 20) falla(`la imagen ${file} necesita un texto alternativo descriptivo`);
    return {
      url: `/glossary-images/${file}`,
      thumbUrl: `/glossary-images/${file}`,
      kind: 'diagram',
      caption: caption ?? '',
      captionLang: 'es',
      altText,
      altTextQuality: 'caption',
      author: AUTOR,
      license: LICENCIA_IMAGEN,
      licenseUrl: '',
      sourcePage: '',
      retrievedAt: hoy,
    };
  });
  if (imagenes.length === 0 && !SIN_IMAGEN) falla('el artículo necesita al menos una imagen (o pase --sin-imagen)');

  return {
    conceptRef: { system: FUENTE, code: slug, slug },
    lang: 'es',
    sections: secciones,
    images: imagenes,
    facts: (autoria.facts ?? []).map((f) => ({ label: f.label, value: f.value, source: FUENTE, sourceUrl: '' })),
    references: (autoria.references ?? []).map((r) => ({ title: r.title, url: r.url, source: r.source })),
  };
}

/** Las palabras de un artículo compilado: secciones más pie de imagen. */
export const palabrasDelArticulo = (articulo) =>
  articulo.sections.reduce((n, s) => n + palabras(s.text), 0);

function main() {
  const archivos = readdirSync(ORIGEN)
    .filter((n) => n.endsWith('.md') && n !== '00_README.md')
    .filter((n) => SOLO === undefined || SOLO.includes(n.replace(/\.md$/, '')))
    .sort();
  const cubetas = new Map();
  const paraLaApi = {};
  let total = 0;
  const cortos = [];
  for (const nombre of archivos) {
    const articulo = compilar(leerMarkdown(readFileSync(join(ORIGEN, nombre), 'utf8'), nombre));
    if (`${articulo.conceptRef.slug}.md` !== nombre) {
      throw new Error(`${nombre}: el archivo debe llamarse como su slug`);
    }
    const n = palabrasDelArticulo(articulo);
    if (n < PISO) cortos.push(`${articulo.conceptRef.slug} (${n})`);
    const id = conceptIdOf(articulo.conceptRef.slug);
    const hh = id.slice(0, 2).toLowerCase();
    if (!cubetas.has(hh)) cubetas.set(hh, {});
    cubetas.get(hh)[id] = articulo;
    paraLaApi[articulo.conceptRef.slug] = articulo;
    total += n;
    console.log(`${articulo.conceptRef.slug}: ${articulo.sections.length} secciones, ${articulo.images.length} imágenes, ${n} palabras`);
  }
  if (cortos.length > 0) {
    console.error(`glossary-articulos-alovida: bajo el piso de ${PISO} palabras: ${cortos.join(', ')}`);
    process.exit(1);
  }
  if (soloValidar) {
    console.log(`glossary-articulos-alovida: ${archivos.length} archivos válidos, ${total} palabras.`);
    return;
  }
  mkdirSync(DESTINO, { recursive: true });
  for (const [hh, nuevos] of cubetas) {
    const ruta = join(DESTINO, `${hh}.json`);
    const existentes = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : {};
    writeFileSync(ruta, JSON.stringify({ ...existentes, ...nuevos }));
  }
  console.log(`glossary-articulos-alovida: ${archivos.length} artículos en ${cubetas.size} cubetas → ${DESTINO}`);
  if (SOLO === undefined) escribirParaLaApi(paraLaApi);
  else console.log('glossary-articulos-alovida: con --only no se regenera el archivo del API.');
}

/**
 * El archivo que siembra el API: un literal de texto JSON por slug.
 *
 * Es un `JSON.parse` perezoso y no un objeto literal a propósito: 80 artículos de
 * ~70 KB como literal de objeto hacen lento al compilador de TypeScript, y como texto
 * son sólo cadenas. El API los valida y los parsea en `glossary-articles.catalog.ts`.
 */
export function textoParaLaApi(articulos) {
  const filas = Object.keys(articulos)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(JSON.stringify(articulos[slug]))},`);
  return [
    '/* ============================================================================',
    '   Los artículos enciclopédicos de autoría propia del glosario, serializados.',
    '',
    '   **GENERADO por `scripts/glossary-articulos-alovida.mjs` del front',
    '   (`mantra-core-health`). No editar a mano**: la fuente son los archivos',
    '   `data/glossary/articulos/*.md` de ese repositorio.',
    '',
    '   Todo el texto es original del equipo y está pendiente de revisión médica.',
    '   ========================================================================== */',
    '',
    '/** Un artículo `GlossaryArticle` serializado como JSON, por slug del término. */',
    'export const GLOSSARY_ARTICLES_JSON: Readonly<Record<string, string>> = {',
    ...filas,
    '};',
    '',
  ].join('\n');
}

function escribirParaLaApi(articulos) {
  const carpeta = join(API, 'src', 'common', 'seed');
  if (!existsSync(carpeta)) {
    console.log(`glossary-articulos-alovida: no hay repo del API en ${API}; se omite el archivo del API (--api <carpeta>).`);
    return;
  }
  const destino = join(carpeta, 'glossary-articles.generated.ts');
  writeFileSync(destino, textoParaLaApi(articulos));
  console.log(`glossary-articulos-alovida: ${Object.keys(articulos).length} artículos → ${destino}`);
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
