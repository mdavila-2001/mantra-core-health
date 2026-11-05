/**
 * Carga reanudable de un lote NDJSON de artículos en la semilla de la maqueta.
 * La fuente se valida antes de escribir y cada cubeta se reemplaza atómicamente.
 *
 * Uso: node scripts/glossary-ingest-batch.mjs <articles.ndjson>
 *      --source nlm-medlineplus-es --license 'Dominio público (NLM)'
 *      [--policy fuentes.json] [--lang es]
 *      [--dry-run] [--checkpoint ruta.json]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const input = args.shift();
if (!input || input.startsWith('--')) throw new Error('Falta articles.ndjson.');
const option = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args[at + 1];
};
const source = option('--source');
const license = option('--license');
const policyPath = option('--policy');
const language = option('--lang');
const checkpoint = resolve(
  option('--checkpoint') ?? 'docs/trabajo/2026-10-16-glossary-ingestion/CHECKPOINT.json',
);
const dryRun = args.includes('--dry-run');
if ((!source || !license) && !policyPath)
  throw new Error('Se requieren --source y --license, o --policy.');
const policy = policyPath ? JSON.parse(readFileSync(resolve(policyPath), 'utf8')) : null;
if (policy && (!policy.sources || typeof policy.sources !== 'object'))
  throw new Error('La política requiere un mapa sources.');
for (const arg of args) {
  if (
    arg.startsWith('--') &&
    !['--source', '--license', '--policy', '--lang', '--checkpoint', '--dry-run'].includes(arg)
  ) {
    throw new Error(`Opción desconocida: ${arg}`);
  }
}

const root = resolve('public/glossary-seed');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const idBySlug = new Map();
for (const category of manifest.categories) {
  for (let page = 1; page <= category.pages; page++) {
    const path = join(root, 'shards', category.key, `page-${page}.json`);
    for (const term of JSON.parse(readFileSync(path, 'utf8'))) {
      if (idBySlug.has(term.slug)) throw new Error(`Slug repetido: ${term.slug}`);
      idBySlug.set(term.slug, term.id);
    }
  }
}
if (idBySlug.size !== manifest.total) throw new Error('La semilla no coincide con el manifiesto.');

const sourceBytes = readFileSync(resolve(input));
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
const pending = new Map();
const seen = new Set();
let accepted = 0;
let skippedNoSections = 0;
let omittedUnversionedSections = 0;
let hiddenImages = 0;
for (const [index, line] of sourceBytes.toString('utf8').split(/\r?\n/u).entries()) {
  if (line.trim() === '') continue;
  const article = JSON.parse(line);
  const slug = article.conceptRef?.slug;
  if (typeof slug !== 'string' || seen.has(slug))
    throw new Error(`Slug inválido o repetido en línea ${index + 1}: ${slug}`);
  seen.add(slug);
  const id = idBySlug.get(slug);
  if (!id) throw new Error(`El término no está en la semilla: ${slug}`);
  if (!Array.isArray(article.sections) || article.sections.length === 0) {
    if (policy) {
      skippedNoSections++;
      continue;
    }
    throw new Error(`Artículo sin secciones: ${slug}`);
  }
  for (const section of article.sections) {
    const allowed = policy?.sources[section.source];
    const sourceUrl = URL.canParse(section.sourceUrl) ? new URL(section.sourceUrl) : null;
    if (
      (policy
        ? !allowed ||
          section.license !== allowed.license ||
          !allowed.hosts.includes(sourceUrl?.hostname)
        : ![source, `${source}-pruebas`].includes(section.source) || section.license !== license) ||
      sourceUrl?.protocol !== 'https:'
    ) {
      throw new Error(`Sección con fuente, licencia o URL no admitida: ${slug}`);
    }
  }
  let sections = language
    ? article.sections.filter((section) => section.lang === language)
    : article.sections;
  if (policy) {
    const before = sections.length;
    sections = sections.filter((section) => {
      const requirement = policy.sources[section.source]?.requireVersionDate;
      return !requirement || /^\d{4}-\d{2}-\d{2}$/u.test(section.sourceVersion ?? '');
    });
    omittedUnversionedSections += before - sections.length;
  }
  if (sections.length === 0) {
    skippedNoSections++;
    continue;
  }
  const images = Array.isArray(article.images) ? article.images : [];
  hiddenImages += images.filter((image) => image.enabled !== false).length;
  const safeArticle = {
    ...article,
    sections,
    images: images.map((image) => ({ ...image, enabled: false })),
  };
  const bucket = id.slice(0, 2).toLowerCase();
  if (!pending.has(bucket)) pending.set(bucket, new Map());
  pending.get(bucket).set(id, safeArticle);
  accepted++;
}

let existing = 0;
const writes = [];
for (const [bucket, articles] of pending) {
  const path = join(root, 'mock', 'articles', `${bucket}.json`);
  const stored = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  existing += [...articles.keys()].filter((id) => Object.hasOwn(stored, id)).length;
  const combined = { ...stored, ...Object.fromEntries(articles) };
  const ordered = Object.fromEntries(
    Object.entries(combined).sort(([a], [b]) => a.localeCompare(b)),
  );
  writes.push({ path, content: JSON.stringify(ordered) });
}
const outputSha256 = createHash('sha256')
  .update(
    writes
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((item) => item.content)
      .join('\n'),
  )
  .digest('hex');
const result = {
  input: relative(process.cwd(), resolve(input)),
  sourceSha256,
  source: source ?? relative(process.cwd(), resolve(policyPath)),
  license: license ?? 'según política por fuente',
  accepted,
  skippedNoSections,
  omittedUnversionedSections,
  existing,
  newArticles: accepted - existing,
  imagesHiddenPendingReview: hiddenImages,
  buckets: writes.length,
  outputSha256,
  dryRun,
};
if (!dryRun) {
  for (const { path, content } of writes) {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${process.pid}`;
    writeFileSync(temporary, content);
    renameSync(temporary, path);
  }
  mkdirSync(dirname(checkpoint), { recursive: true });
  writeFileSync(checkpoint, `${JSON.stringify({ ...result, dryRun: false }, null, 2)}\n`);
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
