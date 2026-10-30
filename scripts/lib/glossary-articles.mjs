/**
 * Los artículos enciclopédicos del glosario en cubetas, para la maqueta.
 *
 * Entrada: líneas de `articles.ndjson` (TAREA-41 §12.3) y la tabla slug → id de
 * concepto del glosario. Salida: `mock/articles/<hh>.json`, con `<hh>` los dos
 * primeros hex del id —las mismas cubetas que `mock/ids` y `mock/incoming`—, y
 * cada cubeta es `{ [conceptId]: artículo }`. La ficha de un término baja ~1/256
 * del conjunto, no el conjunto.
 *
 * El contenido pasa tal cual: este módulo no redacta ni recorta nada. Un
 * artículo cuyo `conceptRef.slug` no está en el glosario se informa y se deja
 * fuera (§12.3: no se crean términos nuevos).
 */

/**
 * @param {Iterable<string>} lineas líneas de `articles.ndjson`
 * @param {ReadonlyMap<string, string>} idPorSlug
 * @returns {{ archivos: Map<string, Record<string, unknown>>, escritos: number, sinTermino: string[] }}
 */
export function cubetasDeArticulos(lineas, idPorSlug) {
  const archivos = new Map();
  const sinTermino = [];
  let escritos = 0;
  for (const linea of lineas) {
    if (linea.trim() === '') continue;
    const articulo = JSON.parse(linea);
    const slug = articulo?.conceptRef?.slug;
    const id = typeof slug === 'string' ? idPorSlug.get(slug) : undefined;
    if (id === undefined) {
      sinTermino.push(String(slug));
      continue;
    }
    const ruta = `mock/articles/${id.slice(0, 2).toLowerCase()}.json`;
    if (!archivos.has(ruta)) archivos.set(ruta, {});
    archivos.get(ruta)[id] = articulo;
    escritos += 1;
  }
  return { archivos, escritos, sinTermino };
}
