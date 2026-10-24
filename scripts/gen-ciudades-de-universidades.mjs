#!/usr/bin/env node
/**
 * Trae de Wikidata la ciudad de cada universidad del padrón importado y la deja
 * en caché para `gen-universidades-por-pais.mjs`.
 *
 * ## Por qué existe
 *
 * El propietario pidió (04/10/2026) que la ciudad de estudio sea un **select no
 * modificable que sale de elegir la universidad**, en todos los campos de
 * universidad. Para Bolivia la ciudad está en la lista curada; el padrón del
 * exterior (Hipo/university-domains-list) no la trae. Eligió Wikidata (CC0)
 * para completarla.
 *
 * ## Cómo se cruza
 *
 * Por **dominio web**: Hipo trae los dominios de cada universidad y Wikidata su
 * sitio oficial (P856). Es un cruce exacto, sin adivinar por parecido de
 * nombre. Si no hay dominio que case, se prueba con el nombre normalizado
 * (minúsculas, sin tildes) contra la etiqueta en español o inglés. Lo que no
 * casa por ninguno de los dos queda **sin ciudad**: no se inventa.
 *
 * La ciudad es la sede (P159), la ubicación administrativa (P131) o la
 * ubicación (P276), **sólo si es un asentamiento humano** (Q486972 o
 * subclase): así «Córdoba» la provincia no pasa por la ciudad de Río Cuarto.
 *
 * ## Qué NO trae, medido
 *
 * El dato «tiene facultad de salud»: medido sobre Argentina (04/10/2026), sólo
 * 2 de 179 universidades lo enlazan en Wikidata —ni la UBA—. Un filtro con eso
 * borraría casi todas, así que el filtro de salud sólo se aplica a Bolivia,
 * donde la lista curada lo trae con fuente.
 *
 * Uso: node scripts/gen-ciudades-de-universidades.mjs
 * Escribe `data/universidades/wikidata-ciudades.json` (fuera de git, como la
 * fuente de Hipo). Tarda: una consulta por país, en serie.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMMIT = '603e10f51b67c6553b9bca9aecc0db4c2417ed10';
const FUENTE_HIPO = resolve(raiz, 'data/universidades', `world_universities_and_domains.${COMMIT.slice(0, 7)}.json`);
const DESTINO = resolve(raiz, 'data/universidades/wikidata-ciudades.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const AGENTE = 'AloVida-catalog-builder/1.0 (https://alovidasalud.com)';
const OMITIDOS = new Set(['BO']);

if (!existsSync(FUENTE_HIPO)) {
  throw new Error('Falta la fuente de Hipo: corré antes `node scripts/gen-universidades-por-pais.mjs`.');
}

const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const host = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * La consulta de un país. `liviana` cambia el recorrido de subclases
 * (`P31/P279*` de «institución de educación superior») por la clase directa
 * de universidad: para Estados Unidos y Alemania el recorrido completo pasa
 * el minuto de Wikidata y la consulta se cae.
 */
function consulta(iso, liviana = false) {
  const clase = liviana ? 'wdt:P31 wd:Q3918' : 'wdt:P31/wdt:P279* wd:Q38723';
  return `
SELECT ?uni ?web ?nombreEs ?nombreEn (GROUP_CONCAT(DISTINCT ?ciudadEs; separator="|") AS ?ciudades) WHERE {
  ?pais wdt:P297 "${iso}" .
  ?uni ${clase} ; wdt:P17 ?pais .
  OPTIONAL { ?uni wdt:P856 ?web . }
  OPTIONAL { ?uni rdfs:label ?nombreEs . FILTER(LANG(?nombreEs) = "es") }
  OPTIONAL { ?uni rdfs:label ?nombreEn . FILTER(LANG(?nombreEn) = "en") }
  OPTIONAL {
    { ?uni wdt:P159 ?ciudad } UNION { ?uni wdt:P131 ?ciudad } UNION { ?uni wdt:P276 ?ciudad }
    ?ciudad wdt:P31/wdt:P279* wd:Q486972 .
    { ?ciudad rdfs:label ?ciudadEs . FILTER(LANG(?ciudadEs) = "es") }
  }
} GROUP BY ?uni ?web ?nombreEs ?nombreEn`;
}

async function preguntar(iso) {
  try {
    return await preguntarCon(consulta(iso));
  } catch {
    return preguntarCon(consulta(iso, true));
  }
}

async function preguntarCon(sparql) {
  const cuerpo = new URLSearchParams({ query: sparql });
  for (let intento = 1; intento <= 3; intento += 1) {
    const respuesta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': AGENTE },
      body: cuerpo,
    });
    if (respuesta.ok) return (await respuesta.json()).results.bindings;
    if (respuesta.status !== 429 && respuesta.status < 500) {
      throw new Error(`Wikidata respondió ${respuesta.status}`);
    }
    await new Promise((listo) => setTimeout(listo, 5000 * intento));
  }
  throw new Error('Wikidata no respondió');
}

const hipo = JSON.parse(readFileSync(FUENTE_HIPO, 'utf8'));
const porPais = new Map();
for (const fila of hipo) {
  const iso = String(fila.alpha_two_code ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso) || OMITIDOS.has(iso)) continue;
  if (!porPais.has(iso)) porPais.set(iso, []);
  porPais.get(iso).push({ nombre: String(fila.name ?? '').trim(), dominios: fila.domains ?? [] });
}

// Reanudable: una corrida cortada a la mitad no vuelve a preguntar los países
// que ya tiene. Para regenerar desde cero, borrar el archivo de destino.
const resultado = existsSync(DESTINO)
  ? JSON.parse(readFileSync(DESTINO, 'utf8'))
  : { fuente: 'Wikidata (CC0) vía query.wikidata.org', generado: new Date().toISOString(), paises: {} };
const fallidos = [];
let conCiudad = 0;
let total = 0;

for (const [iso, universidades] of [...porPais.entries()].sort()) {
  if (resultado.paises[iso] !== undefined) {
    total += universidades.length;
    conCiudad += Object.keys(resultado.paises[iso]).length;
    continue;
  }
  let filas;
  try {
    filas = await preguntar(iso);
  } catch (error) {
    fallidos.push(`${iso}: ${error.message}`);
    continue;
  }
  const porHost = new Map();
  const porNombre = new Map();
  for (const fila of filas) {
    const ciudades = (fila.ciudades?.value ?? '').split('|').filter(Boolean);
    if (ciudades.length === 0) continue;
    const sitio = fila.web ? host(fila.web.value) : null;
    if (sitio) porHost.set(sitio, ciudades);
    for (const clave of ['nombreEs', 'nombreEn']) {
      if (fila[clave]) porNombre.set(normalizar(fila[clave].value), ciudades);
    }
  }
  const ciudadesDelPais = {};
  for (const { nombre, dominios } of universidades) {
    total += 1;
    let ciudades;
    for (const dominio of dominios) {
      const limpio = dominio.toLowerCase().replace(/^www\./, '');
      ciudades = porHost.get(limpio) ?? [...porHost.entries()].find(([h]) => h.endsWith(`.${limpio}`))?.[1];
      if (ciudades) break;
    }
    ciudades ??= porNombre.get(normalizar(nombre));
    if (ciudades) {
      ciudadesDelPais[nombre] = [...new Set(ciudades)].sort((a, b) => a.localeCompare(b, 'es'));
      conCiudad += 1;
    }
  }
  resultado.paises[iso] = ciudadesDelPais;
  writeFileSync(DESTINO, JSON.stringify(resultado, null, 1));
  process.stdout.write(`${iso}:${Object.keys(ciudadesDelPais).length}/${universidades.length} `);
}

resultado.resumen = { universidades: total, conCiudad, paisesFallidos: fallidos };
writeFileSync(DESTINO, JSON.stringify(resultado, null, 1));
console.log(`\n· ${conCiudad}/${total} universidades con ciudad · fallidos: ${fallidos.length}`);
for (const f of fallidos) console.log(`  - ${f}`);
