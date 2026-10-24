#!/usr/bin/env node
/**
 * Valida contra sus fuentes cada cita, identificador e imagen del atlas 3D.
 *
 * ## Qué resuelve, y contra qué
 *
 * | Qué | Contra |
 * |---|---|
 * | DOI | Crossref (`api.crossref.org/works/{doi}`); si Crossref no lo tiene, el resolvedor de doi.org (`doi.org/api/handles/{doi}`), porque hay DOI de DataCite |
 * | PMID | PubMed E-utilities (`esummary`, de a 200) |
 * | Artículo de Wikipedia | API de en.wikipedia.org (de a 50 títulos) |
 * | ISBN | Open Library (`openlibrary.org/isbn/{isbn}.json`) |
 * | URL | la propia URL: responde con estado < 400 |
 * | ID UBERON | OLS4 de EBI (`/api/ontologies/uberon/terms?obo_id=`) |
 * | ID FMA | OLS4 de EBI (`/api/ontologies/fma/terms?obo_id=`) |
 * | Licencia de cada imagen | API de Wikimedia Commons (`extmetadata`) |
 *
 * **Falla con una sola cita irresoluble** (sale con código 1). Un host que no
 * responde cuenta como irresoluble: el validador no supone que una cita está
 * bien porque no la pudo mirar.
 *
 * Además, sin red, comprueba que el catálogo salió de la release declarada:
 * SHA-256 de la entrada (si se le pasa `--uberon-obo`) y que cada id del
 * catálogo existe en `data/anatomy-ontology/uberon-human.json`. Esa parte se
 * informa aparte y NO reemplaza la resolución en línea.
 *
 * Salida: `docs/progress/evidence/anatomy-atlas/validator-<fecha>.json` y `.md`.
 *
 * Uso (detrás de un proxy, Node necesita `NODE_USE_ENV_PROXY=1`):
 *   NODE_USE_ENV_PROXY=1 node scripts/validate-anatomy-atlas.mjs [--limit N] [--uberon-obo ruta]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const CATALOGO = join(RAIZ, 'public', 'anatomy-atlas-3d', 'catalog');
const DATOS = join(RAIZ, 'data', 'anatomy-ontology');
const EVIDENCIA = join(RAIZ, 'docs', 'progress', 'evidence', 'anatomy-atlas');
const CONCURRENCIA = 8;
const ESPERA_MS = 20_000;
const AGENTE = 'mantra-core-health-anatomy-validator/1.0 (open-source health platform; validation of citations)';

const args = process.argv.slice(2);
const valor = (bandera) => {
  const i = args.indexOf(bandera);
  return i === -1 ? null : args[i + 1];
};
const LIMITE = valor('--limit') === null ? Infinity : Number(valor('--limit'));
const OBO = valor('--uberon-obo');

/* ---- lo que hay que validar ---------------------------------------------- */

function recolectar() {
  const citas = { doi: new Set(), pmid: new Set(), wikipedia: new Set(), isbn: new Set(), url: new Set() };
  const uberon = new Set();
  const fma = new Set();
  const imagenes = [];
  for (const archivo of readdirSync(CATALOGO).filter((a) => a.startsWith('structures-'))) {
    const contenido = JSON.parse(readFileSync(join(CATALOGO, archivo), 'utf8'));
    for (const ficha of Object.values(contenido)) {
      if (ficha.id.startsWith('UBERON:')) uberon.add(ficha.id);
      if (ficha.id.startsWith('FMA:')) fma.add(ficha.id);
      for (const f of ficha.fma) fma.add(`FMA:${f}`);
      for (const ref of ficha.definition?.refs ?? []) {
        if (ref.kind in citas) citas[ref.kind].add(ref.value);
      }
      for (const imagen of ficha.images ?? []) imagenes.push({ structure: ficha.id, ...imagen });
    }
  }
  const procedencia = JSON.parse(readFileSync(join(DATOS, 'provenance.json'), 'utf8'));
  for (const fuente of ['uberon', 'fma', 'bodyparts3d']) citas.doi.add(procedencia[fuente].citationDoi);
  return { citas, uberon, fma, imagenes, procedencia };
}

/* ---- red ----------------------------------------------------------------- */

async function pedir(url, opciones = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const respuesta = await fetch(url, {
      redirect: 'follow',
      ...opciones,
      signal: control.signal,
      headers: { 'user-agent': AGENTE, ...(opciones.headers ?? {}) },
    });
    return { status: respuesta.status, json: /json/.test(respuesta.headers.get('content-type') ?? '') ? await respuesta.json().catch(() => null) : null };
  } catch (error) {
    const causa = error?.cause;
    return { status: 0, error: String(causa?.message || causa?.code || error?.message || error) };
  } finally {
    clearTimeout(reloj);
  }
}

/** El motivo de un pedido fallido: estado HTTP y, si no hubo respuesta, el error de red. */
const motivo = (r) => (r.status ? `HTTP ${r.status}` : `sin respuesta (${r.error ?? 'desconocido'})`);

/** Corre `tarea` sobre cada elemento con concurrencia acotada. */
async function enParalelo(elementos, tarea) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCIA, elementos.length) }, async () => {
      while (siguiente < elementos.length) {
        const i = siguiente++;
        resultados[i] = await tarea(elementos[i]);
      }
    }),
  );
  return resultados;
}

const tope = (conjunto) => [...conjunto].sort().slice(0, LIMITE);
const lotes = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

async function validarDoi(doi) {
  const crossref = await pedir(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (crossref.status === 200) return { id: doi, ok: true, via: 'crossref' };
  const handle = await pedir(`https://doi.org/api/handles/${encodeURIComponent(doi)}`);
  const ok = handle.status === 200 && handle.json?.responseCode === 1;
  return { id: doi, ok, via: ok ? 'doi.org' : null, detail: ok ? null : `crossref ${motivo(crossref)}, doi.org ${motivo(handle)}` };
}

async function validarPmids(pmids) {
  const salida = [];
  for (const lote of lotes(pmids, 200)) {
    const r = await pedir(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${lote.join(',')}`);
    for (const id of lote) {
      const doc = r.json?.result?.[id];
      const ok = r.status === 200 && doc !== undefined && doc.error === undefined;
      salida.push({ id, ok, via: ok ? 'pubmed' : null, detail: ok ? null : r.status === 200 ? doc?.error ?? 'sin registro' : motivo(r) });
    }
  }
  return salida;
}

async function validarWikipedia(titulos) {
  const salida = [];
  for (const lote of lotes(titulos, 50)) {
    const r = await pedir(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(lote.map((t) => t.replace(/_/g, ' ')).join('|'))}`,
    );
    const paginas = Object.values(r.json?.query?.pages ?? {});
    const normal = new Map((r.json?.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redir = new Map((r.json?.query?.redirects ?? []).map((n) => [n.from, n.to]));
    for (const t of lote) {
      let titulo = t.replace(/_/g, ' ');
      titulo = normal.get(titulo) ?? titulo;
      titulo = redir.get(titulo) ?? titulo;
      const pagina = paginas.find((p) => p.title === titulo);
      const ok = r.status === 200 && pagina !== undefined && pagina.missing === undefined && pagina.invalid === undefined;
      salida.push({ id: t, ok, via: ok ? 'wikipedia' : null, detail: ok ? null : r.status === 200 ? 'artículo inexistente' : motivo(r) });
    }
  }
  return salida;
}

async function validarIsbn(isbn) {
  const r = await pedir(`https://openlibrary.org/isbn/${encodeURIComponent(isbn.replace(/[^0-9Xx]/g, ''))}.json`);
  return { id: isbn, ok: r.status === 200, via: r.status === 200 ? 'openlibrary' : null, detail: r.status === 200 ? null : motivo(r) };
}

async function validarUrl(url) {
  let r = await pedir(url, { method: 'HEAD' });
  if (r.status === 405 || r.status === 403 || r.status === 0) r = await pedir(url);
  const ok = r.status > 0 && r.status < 400;
  return { id: url, ok, via: ok ? 'http' : null, detail: ok ? null : motivo(r) };
}

async function validarTermino(ontologia, id) {
  const r = await pedir(`https://www.ebi.ac.uk/ols4/api/ontologies/${ontologia}/terms?obo_id=${encodeURIComponent(id)}`);
  const ok = r.status === 200 && (r.json?._embedded?.terms?.length ?? 0) > 0;
  return { id, ok, via: ok ? 'ols4' : null, detail: ok ? null : r.status === 200 ? 'término inexistente' : motivo(r) };
}

async function validarImagen(imagen) {
  const r = await pedir(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(imagen.file)}`,
  );
  const pagina = Object.values(r.json?.query?.pages ?? {})[0];
  const meta = pagina?.imageinfo?.[0]?.extmetadata;
  const licencia = meta?.LicenseShortName?.value ?? null;
  const ok = r.status === 200 && licencia !== null && licencia === imagen.license;
  return { id: imagen.file, ok, via: ok ? 'commons' : null, detail: ok ? null : r.status === 200 ? `licencia en Commons: ${licencia}` : motivo(r) };
}

/* ---- sin red --------------------------------------------------------------- */

function comprobacionesLocales(uberon, procedencia) {
  const locales = [];
  const humanos = new Set(JSON.parse(readFileSync(join(DATOS, 'uberon-human.json'), 'utf8')).map((t) => t.id));
  const faltan = [...uberon].filter((id) => !humanos.has(id));
  locales.push({ check: 'cada id UBERON del catálogo está en el extracto de la release', ok: faltan.length === 0, detail: `${uberon.size - faltan.length}/${uberon.size}` });
  if (OBO !== null && existsSync(OBO)) {
    const sha = createHash('sha256').update(readFileSync(OBO)).digest('hex');
    locales.push({ check: `SHA-256 de ${OBO} igual al de provenance.json`, ok: sha === procedencia.uberon.sha256, detail: sha });
  }
  return locales;
}

/* ---- principal ------------------------------------------------------------- */

async function main() {
  const inicio = new Date();
  const { citas, uberon, fma, imagenes, procedencia } = recolectar();
  const grupos = {};
  grupos.doi = await enParalelo(tope(citas.doi), validarDoi);
  grupos.pmid = await validarPmids(tope(citas.pmid));
  grupos.wikipedia = await validarWikipedia(tope(citas.wikipedia));
  grupos.isbn = await enParalelo(tope(citas.isbn), validarIsbn);
  grupos.url = await enParalelo(tope(citas.url), validarUrl);
  grupos.uberon = await enParalelo(tope(uberon), (id) => validarTermino('uberon', id));
  grupos.fma = await enParalelo(tope(fma), (id) => validarTermino('fma', id));
  grupos.imagenes = await enParalelo(imagenes.slice(0, LIMITE), validarImagen);

  const resumen = Object.fromEntries(
    Object.entries(grupos).map(([k, v]) => [k, { total: v.length, ok: v.filter((r) => r.ok).length, fallidas: v.filter((r) => !r.ok).length }]),
  );
  const fallidas = Object.entries(grupos).flatMap(([k, v]) => v.filter((r) => !r.ok).map((r) => ({ tipo: k, ...r })));
  const locales = comprobacionesLocales(uberon, procedencia);
  const aprobado = fallidas.length === 0;
  const informe = {
    startedAt: inicio.toISOString(),
    finishedAt: new Date().toISOString(),
    limit: Number.isFinite(LIMITE) ? LIMITE : null,
    totalsInCatalog: {
      doi: citas.doi.size,
      pmid: citas.pmid.size,
      wikipedia: citas.wikipedia.size,
      isbn: citas.isbn.size,
      url: citas.url.size,
      uberon: uberon.size,
      fma: fma.size,
      images: imagenes.length,
    },
    summary: resumen,
    passed: aprobado,
    localChecks: locales,
    failures: fallidas,
  };

  mkdirSync(EVIDENCIA, { recursive: true });
  const sello = inicio.toISOString().replace(/[:]/g, '-').replace(/\..*/, '');
  writeFileSync(join(EVIDENCIA, `validator-${sello}.json`), JSON.stringify(informe, null, 1) + '\n');
  const filas = Object.entries(resumen).map(([k, v]) => `| ${k} | ${v.total} | ${v.ok} | ${v.fallidas} |`).join('\n');
  const motivos = {};
  for (const f of fallidas) motivos[`${f.tipo}: ${f.detail}`] = (motivos[`${f.tipo}: ${f.detail}`] ?? 0) + 1;
  const md = `# Validador del atlas anatómico 3D — ${inicio.toISOString()}

Resultado: **${aprobado ? 'APROBADO' : 'FALLIDO'}** (${fallidas.length} irresolubles).${Number.isFinite(LIMITE) ? ` Corrida acotada a ${LIMITE} por grupo.` : ''}

| Grupo | Validadas | Resueltas | Irresolubles |
|---|---|---|---|
${filas}

## Motivos de fallo (agrupados)

${Object.entries(motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => `- ${n} × ${m}`).join('\n') || '- ninguno'}

## Comprobaciones sin red (no reemplazan la resolución en línea)

${locales.map((l) => `- ${l.ok ? '✔' : '✘'} ${l.check} — ${l.detail}`).join('\n')}

Detalle por cita: \`validator-${sello}.json\`.
`;
  writeFileSync(join(EVIDENCIA, `validator-${sello}.md`), md);
  console.log(md);
  process.exit(aprobado ? 0 : 1);
}

main();
