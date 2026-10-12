/**
 * Los artículos de autoría propia del glosario (`data/glossary/articulos/*.json`)
 * → cubetas de la maqueta (`public/glossary-seed/mock/articles/<hh>.json`).
 *
 * Un archivo por término, escrito a mano (el esquema está en
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
 * Uso: node scripts/glossary-articulos-alovida.mjs [--check]
 *   --check  valida los archivos y sale con error si alguno no cumple; no escribe.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { conceptIdOf } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const ORIGEN = join(RAIZ, 'data', 'glossary', 'articulos');
const IMAGENES = join(RAIZ, 'public', 'glossary-images');
const DESTINO = join(RAIZ, 'public', 'glossary-seed', 'mock', 'articles');
const soloValidar = process.argv.includes('--check');

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

  const imagenes = [];
  if (autoria.image !== undefined) {
    const { file, caption, altText } = autoria.image;
    if (!existsSync(join(IMAGENES, file))) falla(`la imagen ${file} no existe en public/glossary-images`);
    if (typeof altText !== 'string' || altText.trim().length < 20) falla('la imagen necesita un texto alternativo descriptivo');
    imagenes.push({
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
    });
  }

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
  const archivos = readdirSync(ORIGEN).filter((n) => n.endsWith('.json')).sort();
  const cubetas = new Map();
  let total = 0;
  for (const nombre of archivos) {
    const articulo = compilar(JSON.parse(readFileSync(join(ORIGEN, nombre), 'utf8')));
    if (`${articulo.conceptRef.slug}.json` !== nombre) {
      throw new Error(`${nombre}: el archivo debe llamarse como su slug`);
    }
    const id = conceptIdOf(articulo.conceptRef.slug);
    const hh = id.slice(0, 2).toLowerCase();
    if (!cubetas.has(hh)) cubetas.set(hh, {});
    cubetas.get(hh)[id] = articulo;
    total += palabrasDelArticulo(articulo);
    console.log(`${articulo.conceptRef.slug}: ${articulo.sections.length} secciones, ${palabrasDelArticulo(articulo)} palabras`);
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
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
