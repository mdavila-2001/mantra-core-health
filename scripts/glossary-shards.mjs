/**
 * Trae el glosario completo de `glossary-data-build/` a la maqueta:
 * `public/glossary-data/`, que va en `.gitignore` porque pesa.
 *
 * Lee los shards que emiten los importadores (`shards/<categoryKey>/page-<n>.json`
 * y `shards/index.json`, esquema en `glossary-data-build/SCHEMA.md`) y escribe
 * la misma estructura que la semilla, más los índices que el simulador usa
 * para buscar, filtrar por etiqueta y abrir una ficha por id sin bajar el
 * corpus entero (ver `scripts/lib/glossary-shards.mjs`). No reescribe
 * contenido: cada fila pasa tal cual.
 *
 * Uso:
 *   yarn mock:glossary:shards                  # ../glossary-data-build
 *   yarn mock:glossary:shards <ruta-al-build>  # otra ubicación
 *
 * Sin `public/glossary-data/`, la maqueta sirve la semilla
 * (`public/glossary-seed/`, `yarn mock:glossary:seed`).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { buildGlossaryDataset } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const ORIGEN = resolve(process.argv[2] ?? process.env.GLOSSARY_DATA_BUILD ?? join(RAIZ, '..', 'glossary-data-build'));
const SHARDS = join(ORIGEN, 'shards');
const DESTINO = join(RAIZ, 'public', 'glossary-data');

if (!existsSync(SHARDS)) {
  console.error(
    `No hay shards en ${SHARDS}. Corré los importadores de glossary-data-build/ o pasá la ruta como argumento.`,
  );
  process.exit(1);
}

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

/** Las filas de un archivo de página, en cualquiera de las formas razonables. */
function filasDe(contenido) {
  if (Array.isArray(contenido)) return contenido;
  for (const clave of ['rows', 'items', 'terms']) {
    if (Array.isArray(contenido?.[clave])) return contenido[clave];
  }
  throw new Error('Un archivo de página no trae filas (ni arreglo ni rows/items/terms).');
}

const filas = [];
for (const categoria of readdirSync(SHARDS, { withFileTypes: true })) {
  if (!categoria.isDirectory()) continue;
  const paginas = readdirSync(join(SHARDS, categoria.name))
    .filter((nombre) => /^page-\d+\.json$/.test(nombre))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  for (const pagina of paginas) {
    for (const fila of filasDe(leer(join(SHARDS, categoria.name, pagina)))) {
      filas.push({ categoryKey: categoria.name, ...fila });
    }
  }
}

/**
 * Nombres de categorías y etiquetas: los del índice del build si los trae; si
 * no, los de la semilla (que salen de `glossary-taxonomy.ts` del backend).
 * Una clave que no está en ninguno de los dos se nombra con la clave misma, y
 * se avisa: es preferible un rótulo feo a uno inventado.
 */
function taxonomiaDe(indice, semilla) {
  const lista = (valor) =>
    Array.isArray(valor)
      ? valor
      : valor && typeof valor === 'object'
        ? Object.entries(valor).map(([key, v]) => ({ key, ...(typeof v === 'object' ? v : {}) }))
        : [];
  const nombre = (entrada, deSemilla) => entrada.name ?? entrada.nombre ?? deSemilla?.name;

  const categoriasSemilla = new Map((semilla?.categories ?? []).map((c) => [c.key, c]));
  const etiquetasSemilla = new Map((semilla?.tags ?? []).map((t) => [t.key, t]));

  const claves = new Set(filas.map((f) => f.categoryKey));
  const categorias = new Map();
  for (const entrada of lista(indice?.categories)) {
    categorias.set(entrada.key, { ...entrada, name: nombre(entrada, categoriasSemilla.get(entrada.key)) });
  }
  for (const [key, c] of categoriasSemilla) if (!categorias.has(key)) categorias.set(key, c);
  for (const key of claves) {
    if (!categorias.has(key) || categorias.get(key).name === undefined) {
      console.warn(`Aviso: la categoría «${key}» no tiene nombre en el índice ni en la semilla.`);
      categorias.set(key, { key, name: key });
    }
  }

  const etiquetas = new Map();
  for (const entrada of lista(indice?.tags)) {
    etiquetas.set(entrada.key, { ...entrada, name: nombre(entrada, etiquetasSemilla.get(entrada.key)) ?? entrada.key });
  }
  for (const [key, t] of etiquetasSemilla) if (!etiquetas.has(key)) etiquetas.set(key, t);
  for (const fila of filas) {
    for (const key of fila.tagKeys ?? []) {
      if (!etiquetas.has(key)) {
        console.warn(`Aviso: la etiqueta «${key}» no tiene nombre en el índice ni en la semilla.`);
        etiquetas.set(key, { key, name: key });
      }
    }
  }

  const limpiar = ({ key, internalCode, name, description }) => ({
    key,
    ...(internalCode ? { internalCode } : {}),
    name,
    ...(description ? { description } : {}),
  });
  return {
    categories: [...categorias.values()].filter((c) => claves.has(c.key)).map(limpiar),
    tags: [...etiquetas.values()].map(limpiar),
  };
}

const indice = existsSync(join(SHARDS, 'index.json')) ? leer(join(SHARDS, 'index.json')) : null;

// `sourceName` y `sourceLicense` no viajan en la tarjeta: se leen de
// `index.json#sources` por la clave `source` (SCHEMA.md, esquema 2).
const fuentes = new Map((indice?.sources ?? []).map((f) => [f.source, f]));
for (const fila of filas) {
  const fuente = fuentes.get(fila.source);
  if (fuente === undefined) continue;
  fila.sourceName ??= fuente.sourceName;
  fila.sourceLicense ??= fuente.license;
}
const rutaSemilla = join(RAIZ, 'public', 'glossary-seed', 'manifest.json');
const semilla = existsSync(rutaSemilla) ? leer(rutaSemilla) : null;

const archivos = buildGlossaryDataset(filas, { ...taxonomiaDe(indice, semilla), source: 'glossary-data-build' });

rmSync(DESTINO, { recursive: true, force: true });
let bytes = 0;
for (const [ruta, contenido] of archivos) {
  const destino = join(DESTINO, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  const texto = JSON.stringify(contenido);
  bytes += Buffer.byteLength(texto);
  writeFileSync(destino, texto);
}
// Las filas completas (`detail/<slug>.json`: ficha técnica de CIMA, guías de
// MedlinePlus) se copian tal cual; la maqueta las pide sólo al abrir la ficha.
const DETALLE = join(SHARDS, 'detail');
let detalles = 0;
if (existsSync(DETALLE)) {
  mkdirSync(join(DESTINO, 'detail'), { recursive: true });
  for (const nombre of readdirSync(DETALLE)) {
    if (!nombre.endsWith('.json')) continue;
    const texto = readFileSync(join(DETALLE, nombre));
    bytes += texto.length;
    writeFileSync(join(DESTINO, 'detail', nombre), texto);
    detalles += 1;
  }
}

console.log(
  `glossary-data: ${detalles} fichas completas en detail/.`,
);
console.log(
  `glossary-data: ${filas.length} términos de ${ORIGEN}, ${archivos.size} archivos, ${(bytes / 1024 / 1024).toFixed(1)} MB → public/glossary-data/`,
);
