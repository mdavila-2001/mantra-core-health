/**
 * Inventario reproducible de la semilla pública y de salidas F9 en NDJSON.
 * No publica contenido ni equipara una referencia bibliográfica con revisión médica.
 *
 * Uso: node scripts/glossary-publication-audit.mjs --articles ruta/articles.ndjson
 *      [--articles otra/ruta/articles.ndjson] [--out informe.json] [--require-target]
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const TARGET_WORDS = 150_000;
const args = process.argv.slice(2);
const articlePaths = [];
let outputPath;
let requireTarget = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--articles' && args[index + 1]) articlePaths.push(resolve(args[++index]));
  else if (args[index] === '--out' && args[index + 1]) outputPath = resolve(args[++index]);
  else if (args[index] === '--require-target') requireTarget = true;
  else throw new Error(`Argumento desconocido o incompleto: ${args[index]}`);
}

const seedRoot = resolve('public/glossary-seed');
const manifest = JSON.parse(readFileSync(`${seedRoot}/manifest.json`, 'utf8'));
const words = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().split(/\s+/u).length : 0;
const terms = new Map();
for (const category of manifest.categories) {
  for (let page = 1; page <= category.pages; page++) {
    const path = `${seedRoot}/shards/${category.key}/page-${page}.json`;
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    for (const row of rows) {
      if (terms.has(row.slug)) throw new Error(`Slug repetido en la semilla: ${row.slug}`);
      terms.set(row.slug, {
        slug: row.slug,
        conceptId: row.id,
        category: category.key,
        definitionWords: words(row.definition),
        articleWords: 0,
        articleRows: 0,
        articleImages: 0,
        termImage: Boolean(row.imageUrl),
        approvedTermImage: row.properties?.image_review_status === 'approved',
        source: row.source ?? null,
      });
    }
  }
}
if (terms.size !== manifest.total) {
  throw new Error(`La semilla declara ${manifest.total} términos, pero tiene ${terms.size}.`);
}

const unknownArticleSlugs = new Set();
const articleFiles = [];
for (const path of articlePaths) {
  if (!existsSync(path)) throw new Error(`No existe el NDJSON: ${path}`);
  let rows = 0;
  let invalid = 0;
  for await (const line of createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  })) {
    if (line.trim() === '') continue;
    rows++;
    const article = JSON.parse(line);
    const slug = article.conceptRef?.slug;
    const term = terms.get(slug);
    if (term === undefined) {
      unknownArticleSlugs.add(String(slug));
      continue;
    }
    const sections = Array.isArray(article.sections) ? article.sections : [];
    const articleWords = sections.reduce((sum, section) => sum + words(section.text), 0);
    const imageCount = Array.isArray(article.images) ? article.images.length : 0;
    term.articleRows++;
    if (articleWords > term.articleWords) {
      term.articleWords = articleWords;
      term.articleImages = imageCount;
    }
    if (sections.some((section) => !section.source || !section.sourceUrl || !section.license))
      invalid++;
  }
  articleFiles.push({
    path: relative(process.cwd(), path),
    rows,
    rowsWithMissingProvenance: invalid,
  });
}

const rows = [...terms.values()].sort((a, b) => a.slug.localeCompare(b.slug));
const summary = {
  manifestGeneratedAt: manifest.generatedAt,
  targetWordsPerDefinition: TARGET_WORDS,
  seedTerms: terms.size,
  definitionsWithText: rows.filter((row) => row.definitionWords > 0).length,
  definitionsEmpty: rows.filter((row) => row.definitionWords === 0).length,
  definitionsAtTarget: rows.filter((row) => row.definitionWords === TARGET_WORDS).length,
  definitionsBelowTarget: rows.filter((row) => row.definitionWords < TARGET_WORDS).length,
  articlesPresent: rows.filter((row) => row.articleRows > 0).length,
  articlesMissing: rows.filter((row) => row.articleRows === 0).length,
  articlesAtOrAboveTarget: rows.filter((row) => row.articleWords >= TARGET_WORDS).length,
  articlesWithImage: rows.filter((row) => row.articleImages > 0).length,
  termsWithImage: rows.filter((row) => row.termImage).length,
  termsWithApprovedImage: rows.filter((row) => row.approvedTermImage).length,
  duplicateArticleSlugs: rows.filter((row) => row.articleRows > 1).length,
  unknownArticleSlugs: unknownArticleSlugs.size,
  longestDefinition: rows.reduce(
    (best, row) =>
      row.definitionWords > best.words ? { slug: row.slug, words: row.definitionWords } : best,
    { slug: null, words: 0 },
  ),
  longestArticle: rows.reduce(
    (best, row) =>
      row.articleWords > best.words ? { slug: row.slug, words: row.articleWords } : best,
    { slug: null, words: 0 },
  ),
  articleFiles,
};
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ summary, unknownArticleSlugs: [...unknownArticleSlugs].sort(), terms: rows }, null, 2)}\n`,
  );
}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (requireTarget && summary.definitionsAtTarget !== summary.seedTerms) process.exitCode = 1;
