#!/usr/bin/env node
/**
 * Texto largo para el glosario desde Wikipedia en español, vía Wikidata.
 *
 * El vínculo término → artículo NO se adivina por nombre: sale del Q-id de
 * Wikidata que la fila ya trae (`externalIds.wikidata`) y del enlace de sitio
 * `eswiki` que Wikidata declara para ese Q-id. Sin Q-id o sin artículo en
 * castellano, el término queda como está.
 *
 * Qué escribe: una sección `definition` por término, con el texto de la
 * introducción del artículo **verbatim** y su procedencia completa (fuente,
 * enlace permanente a la revisión, licencia CC BY-SA 4.0, fecha de obtención,
 * número de revisión). No redacta, no resume, no traduce. No pisa un artículo
 * que ya exista: si el término tiene uno, se respeta.
 *
 * Uso:
 *   node scripts/glossary-ingest-wikipedia.mjs [--categories anatomy,signs-symptoms]
 *        [--cache <carpeta>] [--limit <n>] [--dry-run]
 *
 * Idempotente: una segunda corrida no cambia nada (el artículo ya existe).
 * Con `--cache` las respuestas de las APIs se guardan y una nueva corrida no
 * vuelve a pedirlas.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { conceptIdOf } from './lib/glossary-shards.mjs';

const RAIZ = join(process.cwd(), 'public', 'glossary-seed');
const AGENTE = 'AlovidaGlossaryBot/1.0 (https://alovidasalud.arauzsoftware.com; contacto: justinsaldiasn@gmail.com)';
const LICENCIA = 'CC BY-SA 4.0';
const MIN_CARACTERES = 120;

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i === -1 ? undefined : args[i + 1];
};
const categorias = (opcion('--categories') ?? 'anatomy,signs-symptoms').split(',');
const carpetaCache = opcion('--cache');
const tope = opcion('--limit') === undefined ? Infinity : Number(opcion('--limit'));
const simulacro = args.includes('--dry-run');

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** GET JSON con reintento ante 429/5xx y una pausa entre pedidos (cortesía con la API). */
async function pedir(url, claveDeCache) {
  const archivo = carpetaCache && claveDeCache ? join(carpetaCache, `${claveDeCache}.json`) : null;
  if (archivo && existsSync(archivo)) return JSON.parse(readFileSync(archivo, 'utf8'));
  for (let intento = 0; intento < 6; intento++) {
    await dormir(900);
    const respuesta = await fetch(url, { headers: { 'User-Agent': AGENTE, Accept: 'application/json' } });
    if (respuesta.status === 429 || respuesta.status >= 500) {
      await dormir(4000 * (intento + 1));
      continue;
    }
    if (!respuesta.ok) throw new Error(`${respuesta.status} en ${url.slice(0, 120)}`);
    const datos = await respuesta.json();
    if (archivo) writeFileSync(archivo, JSON.stringify(datos));
    return datos;
  }
  throw new Error(`Sin respuesta tras reintentos: ${url.slice(0, 120)}`);
}

/** Clave de caché por contenido: cambiar `--limit` no puede servir una respuesta de otro lote. */
const huella = (grupo) => createHash('sha1').update(grupo.join('|')).digest('hex').slice(0, 16);

function trozos(lista, tamano) {
  const salida = [];
  for (let i = 0; i < lista.length; i += tamano) salida.push(lista.slice(i, i + tamano));
  return salida;
}

/** La introducción tal como la publica la API, sin los marcadores invisibles de las notas al pie. */
function limpiar(extracto) {
  return extracto
    .replace(/[​‌‍﻿]/g, '')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .filter((linea) => linea !== '')
    .join('\n\n');
}

/** Restos de wikitexto que la API dejó pasar: un texto así se descarta, no se arregla a mano. */
function tieneMarcado(texto) {
  return /\{\{|\[\[|<ref|&nbsp;|^==/m.test(texto);
}

function esDesambiguacion(texto) {
  return /\b(puede referirse a|pueden referirse a|puede hacer referencia a|hace referencia a varios)\b/i.test(
    texto.slice(0, 200),
  );
}

// ── 1. Las filas candidatas: con Q-id de Wikidata y sin artículo previo ───────
const manifiesto = JSON.parse(readFileSync(join(RAIZ, 'manifest.json'), 'utf8'));
const existentes = new Map();
const rutaDeCubeta = (hh) => join(RAIZ, 'mock', 'articles', `${hh}.json`);
for (const archivo of readdirSync(join(RAIZ, 'mock', 'articles'))) {
  existentes.set(archivo.replace('.json', ''), JSON.parse(readFileSync(join(RAIZ, 'mock', 'articles', archivo), 'utf8')));
}
const conArticulo = new Set([...existentes.values()].flatMap((cubeta) => Object.keys(cubeta)));

const candidatas = [];
for (const categoria of manifiesto.categories.filter((c) => categorias.includes(c.key))) {
  const carpeta = join(RAIZ, 'shards', categoria.key);
  for (const archivo of readdirSync(carpeta).filter((a) => /^page-\d+\.json$/.test(a))) {
    for (const fila of JSON.parse(readFileSync(join(carpeta, archivo), 'utf8'))) {
      const qid = fila.externalIds?.wikidata;
      if (typeof qid !== 'string' || !/^Q\d+$/.test(qid)) continue;
      const id = conceptIdOf(fila.slug);
      if (conArticulo.has(id)) continue;
      candidatas.push({ fila, id, qid });
    }
  }
}
const lote = candidatas.slice(0, tope);
console.log(`${lote.length} términos con Q-id y sin artículo (de ${candidatas.length})`);

if (carpetaCache) mkdirSync(carpetaCache, { recursive: true });

// ── 2. Q-id → título del artículo en castellano (enlace de sitio de Wikidata) ─
const tituloPorQid = new Map();
for (const grupo of trozos([...new Set(lote.map((c) => c.qid))], 50)) {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({
      action: 'wbgetentities',
      ids: grupo.join('|'),
      props: 'sitelinks',
      sitefilter: 'eswiki',
      format: 'json',
    });
  const datos = await pedir(url, `wd-${huella(grupo)}`);
  for (const [qid, entidad] of Object.entries(datos.entities ?? {})) {
    const titulo = entidad?.sitelinks?.eswiki?.title;
    if (typeof titulo === 'string') tituloPorQid.set(qid, titulo);
  }
}
console.log(`${tituloPorQid.size} Q-id con artículo en Wikipedia en español`);

// ── 3. Título → introducción, con la revisión que se leyó ─────────────────────
const paginaPorTitulo = new Map();
const titulos = [...new Set(tituloPorQid.values())];
for (const grupo of trozos(titulos, 20)) {
  const url =
    'https://es.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      inprop: 'url',
      exintro: '1',
      explaintext: '1',
      exlimit: '20',
      titles: grupo.join('|'),
      redirects: '1',
      format: 'json',
      formatversion: '2',
    });
  const datos = await pedir(url, `wp-${huella(grupo)}`);
  const redirigidos = new Map((datos.query?.redirects ?? []).map((r) => [r.from, r.to]));
  const normalizados = new Map((datos.query?.normalized ?? []).map((r) => [r.from, r.to]));
  const porTituloFinal = new Map((datos.query?.pages ?? []).map((p) => [p.title, p]));
  for (const pedido of grupo) {
    const normal = normalizados.get(pedido) ?? pedido;
    const final = redirigidos.get(normal) ?? normal;
    const pagina = porTituloFinal.get(final);
    if (pagina && !pagina.missing) paginaPorTitulo.set(pedido, pagina);
  }
}

// ── 4. Artículos nuevos, con procedencia por sección ──────────────────────────
const ahora = new Date().toISOString();
const nuevos = new Map();
let descartados = { corto: 0, desambiguacion: 0, marcado: 0, sinPagina: 0 };
for (const { fila, id, qid } of lote) {
  const titulo = tituloPorQid.get(qid);
  const pagina = titulo === undefined ? undefined : paginaPorTitulo.get(titulo);
  if (pagina === undefined) {
    descartados.sinPagina++;
    continue;
  }
  const texto = limpiar(pagina.extract ?? '');
  if (texto.length < MIN_CARACTERES) {
    descartados.corto++;
    continue;
  }
  if (esDesambiguacion(texto)) {
    descartados.desambiguacion++;
    continue;
  }
  if (tieneMarcado(texto)) {
    descartados.marcado++;
    continue;
  }
  const permanente = `https://es.wikipedia.org/w/index.php?title=${encodeURIComponent(pagina.title.replace(/ /g, '_'))}&oldid=${pagina.lastrevid}`;
  nuevos.set(id, {
    conceptRef: { system: fila.codeSystem, code: fila.code, slug: fila.slug },
    lang: 'es',
    sections: [
      {
        kind: 'definition',
        lang: 'es',
        text: texto,
        source: 'Wikipedia en español',
        sourceUrl: permanente,
        license: LICENCIA,
        retrievedAt: ahora,
        sourceVersion: String(pagina.lastrevid),
        locator: 'introducción',
      },
    ],
    images: [],
    facts: [],
    references: [
      {
        title: `«${pagina.title}», en Wikipedia, la enciclopedia libre (revisión ${pagina.lastrevid})`,
        url: permanente,
        source: 'Wikipedia en español',
      },
      { title: `${qid}, en Wikidata`, url: `https://www.wikidata.org/wiki/${qid}`, source: 'Wikidata' },
    ],
  });
}
console.log(`artículos nuevos: ${nuevos.size}`, descartados);

// ── 5. Escritura: se mezcla en las cubetas sin tocar lo que ya había ──────────
if (simulacro) {
  console.log('--dry-run: no se escribió nada');
  process.exit(0);
}
const porCubeta = new Map();
for (const [id, articulo] of nuevos) {
  const hh = id.slice(0, 2).toLowerCase();
  if (!porCubeta.has(hh)) porCubeta.set(hh, {});
  porCubeta.get(hh)[id] = articulo;
}
for (const [hh, agregados] of porCubeta) {
  const cubeta = existentes.get(hh) ?? {};
  for (const [id, articulo] of Object.entries(agregados)) cubeta[id] ??= articulo;
  writeFileSync(rutaDeCubeta(hh), JSON.stringify(cubeta));
}
console.log(`cubetas escritas: ${porCubeta.size}`);
