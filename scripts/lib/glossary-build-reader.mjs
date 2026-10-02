/**
 * Lee el glosario que emiten los importadores de la API en
 * `glossary-data-build/` (`shards/<categoryKey>/page-<n>.json` +
 * `shards/index.json`, esquema en `glossary-data-build/SCHEMA.md`).
 *
 * Lo comparten `scripts/glossary-shards.mjs` (copia completa, fuera de git) y
 * `scripts/glossary-seed.mjs` (la semilla commiteada): las dos salidas ven las
 * mismas filas y la misma taxonomía. No reescribe contenido.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

/** Las filas de un archivo de página, en cualquiera de las formas razonables. */
function filasDe(contenido) {
  if (Array.isArray(contenido)) return contenido;
  for (const clave of ['rows', 'items', 'terms']) {
    if (Array.isArray(contenido?.[clave])) return contenido[clave];
  }
  throw new Error('Un archivo de página no trae filas (ni arreglo ni rows/items/terms).');
}

/**
 * Nombres de categorías y etiquetas: los del índice del build si los trae; si
 * no, los de la semilla (que salen de `glossary-taxonomy.ts` del backend).
 * Una clave que no está en ninguno de los dos se nombra con la clave misma, y
 * se avisa: es preferible un rótulo feo a uno inventado.
 */
export function taxonomiaDe(filas, indice, semilla) {
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

/**
 * Las tarjetas del build y su índice. `sourceName` y `sourceLicense` no viajan
 * en la tarjeta: se completan desde `index.json#sources` por la clave `source`
 * (SCHEMA.md, esquema 2).
 *
 * @param {string} origen  carpeta `glossary-data-build/` (o la que se pase)
 * @returns {{ filas: Record<string, unknown>[], indice: Record<string, unknown> | null, shards: string }}
 */
export function leerBuildDelGlosario(origen) {
  const shards = join(origen, 'shards');
  if (!existsSync(shards)) {
    throw new Error(`No hay shards en ${shards}. Corré los importadores de glossary-data-build/ o pasá la ruta como argumento.`);
  }
  const filas = [];
  for (const categoria of readdirSync(shards, { withFileTypes: true })) {
    if (!categoria.isDirectory()) continue;
    const paginas = readdirSync(join(shards, categoria.name))
      .filter((nombre) => /^page-\d+\.json$/.test(nombre))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    for (const pagina of paginas) {
      for (const fila of filasDe(leer(join(shards, categoria.name, pagina)))) {
        filas.push({ categoryKey: categoria.name, ...fila });
      }
    }
  }
  const indice = existsSync(join(shards, 'index.json')) ? leer(join(shards, 'index.json')) : null;
  const fuentes = new Map((indice?.sources ?? []).map((f) => [f.source, f]));
  for (const fila of filas) {
    const fuente = fuentes.get(fila.source);
    if (fuente === undefined) continue;
    fila.sourceName ??= fuente.sourceName;
    fila.sourceLicense ??= fuente.license;
  }
  return { filas, indice, shards };
}
