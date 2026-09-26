/**
 * Baja el catálogo oficial ICD-10-CM de CMS y escribe sus categorías de tres
 * caracteres como capa del glosario (`data/glossary/cie10cm-categorias.generated.ndjson`).
 *
 * ## Por qué esta fuente y no la API del NLM
 *
 * El importador de la API (`tools/terminology-import/import-icd10cm.mjs`) enumera
 * los 74 719 códigos hoja con el Clinical Table Search Service del NLM, que es
 * excelente para eso pero **no devuelve las categorías de tres caracteres**: para
 * `S72` responde `S72.001A`, `S72.001B`… y nunca la fila «S72 — Fracture of femur».
 * Las categorías con su título oficial sólo están en el archivo «tabular order»
 * que publica CMS con cada año fiscal, y ése es el que se lee acá.
 *
 * ## Qué se escribe y qué no
 *
 * Sólo código y título oficial, en inglés, con `lang: "en"` y sin `definition`:
 * la fuente no trae definiciones y no se fabrican (regla 97.4). El propósito de
 * esta capa es que el servicio de IA conozca el espacio completo de códigos y
 * nunca invente uno, no que la maqueta muestre fichas ricas — para eso están las
 * capas ES de `data/glossary/`.
 *
 * ## Procedencia
 *
 * Al lado del NDJSON se escribe `cie10cm-categorias.generated.meta.json` con la
 * URL, la fecha de descarga, el SHA-256 del archivo de texto leído y el conteo:
 * es lo que permite auditar de dónde salió cada fila (regla 97.4.2).
 *
 * Uso: `node scripts/fetch-icd10cm-categories.mjs [--year 2026]`
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const argumentos = process.argv.slice(2);
const anio = argumentos.includes('--year') ? argumentos[argumentos.indexOf('--year') + 1] : '2026';
const URL_ZIP = `https://www.cms.gov/files/zip/${anio}-code-descriptions-tabular-order.zip`;
const NOMBRE_TXT = `icd10cm_order_${anio}.txt`;
const DESTINO_DIR = join(process.cwd(), 'data', 'glossary');
const DESTINO = join(DESTINO_DIR, 'cie10cm-categorias.generated.ndjson');
const META = join(DESTINO_DIR, 'cie10cm-categorias.generated.meta.json');

/**
 * Extrae un archivo de un ZIP leyendo el directorio central.
 *
 * Node no trae un lector de ZIP y no vale la pena una dependencia por 2 MB una
 * vez al año: el formato es fijo (PKWARE APPNOTE §4.3) y el archivo de CMS usa
 * sólo los métodos «almacenado» (0) y «deflate» (8).
 */
function extraerDelZip(zip, nombre) {
  const FIRMA_FIN = 0x06054b50;
  const FIRMA_CENTRAL = 0x02014b50;
  const FIRMA_LOCAL = 0x04034b50;
  let fin = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error('El ZIP no tiene directorio central (¿descarga incompleta?).');
  const entradas = zip.readUInt16LE(fin + 10);
  let cursor = zip.readUInt32LE(fin + 16);
  for (let n = 0; n < entradas; n++) {
    if (zip.readUInt32LE(cursor) !== FIRMA_CENTRAL)
      throw new Error('Entrada del directorio central corrupta.');
    const metodo = zip.readUInt16LE(cursor + 10);
    const comprimido = zip.readUInt32LE(cursor + 20);
    const largoNombre = zip.readUInt16LE(cursor + 28);
    const largoExtra = zip.readUInt16LE(cursor + 30);
    const largoComentario = zip.readUInt16LE(cursor + 32);
    const offsetLocal = zip.readUInt32LE(cursor + 42);
    const nombreEntrada = zip.toString('utf8', cursor + 46, cursor + 46 + largoNombre);
    cursor += 46 + largoNombre + largoExtra + largoComentario;
    if (nombreEntrada !== nombre) continue;
    if (zip.readUInt32LE(offsetLocal) !== FIRMA_LOCAL) throw new Error('Cabecera local corrupta.');
    const inicio =
      offsetLocal + 30 + zip.readUInt16LE(offsetLocal + 26) + zip.readUInt16LE(offsetLocal + 28);
    const datos = zip.subarray(inicio, inicio + comprimido);
    if (metodo === 0) return Buffer.from(datos);
    if (metodo === 8) return inflateRawSync(datos);
    throw new Error(`Método de compresión ${metodo} no admitido para ${nombre}.`);
  }
  throw new Error(`El ZIP no contiene ${nombre}.`);
}

/**
 * Una línea del «tabular order» (layout de `icd10OrderFiles.pdf`, ancho fijo):
 * 1-5 orden · 7-13 código sin punto · 15 nivel (0 cabecera, 1 facturable) ·
 * 17-76 descripción corta · 78+ descripción larga.
 */
function leerFila(linea) {
  return {
    code: linea.slice(6, 13).trim(),
    level: linea[14],
    long: linea.slice(77).trim(),
  };
}

console.log(`[icd10cm] descargando ${URL_ZIP}`);
const respuesta = await fetch(URL_ZIP);
if (!respuesta.ok) throw new Error(`CMS respondió HTTP ${respuesta.status}`);
const zip = Buffer.from(await respuesta.arrayBuffer());
const texto = extraerDelZip(zip, NOMBRE_TXT);
const sha256 = createHash('sha256').update(texto).digest('hex');

const filas = texto
  .toString('latin1')
  .split(/\r?\n/)
  .filter((linea) => linea.trim() !== '')
  .map(leerFila);

/* Categoría = código de exactamente tres caracteres, sea cabecera (`S72`) o
   facturable por sí mismo (`I10`). Las de cuatro o más son subcategorías y
   hojas, que quedan fuera de esta capa a propósito. */
const categorias = filas
  .filter((fila) => fila.code.length === 3)
  .sort((a, b) => a.code.localeCompare(b.code));

if (categorias.length < 1_500) {
  throw new Error(
    `Se esperaban ~1 900 categorías y se leyeron ${categorias.length}: cambió el layout.`,
  );
}

const lineas = categorias.map((fila) =>
  JSON.stringify({
    code: fila.code,
    display: fila.long,
    slug: `icd10cm-${fila.code.toLowerCase()}`,
    codeSystem: 'icd10cm',
    categoryKey: 'disease',
    tagKeys: [],
    lang: 'en',
    enDisplay: fila.long,
    reviewStatus: 'external-source',
    source: `cms-icd10cm-fy${anio}-order-file`,
  }),
);

mkdirSync(DESTINO_DIR, { recursive: true });
writeFileSync(DESTINO, `${lineas.join('\n')}\n`);
writeFileSync(
  META,
  `${JSON.stringify(
    {
      source: 'CMS — ICD-10-CM Code Descriptions in Tabular Order',
      url: URL_ZIP,
      file: NOMBRE_TXT,
      fiscalYear: anio,
      license: 'U.S. federal government work (CMS/NCHS), public domain',
      retrievedAt: new Date().toISOString(),
      sha256,
      rowsInFile: filas.length,
      categories: categorias.length,
      generator: 'scripts/fetch-icd10cm-categories.mjs',
    },
    null,
    2,
  )}\n`,
);

console.log(
  `[icd10cm] ${categorias.length} categorías de ${filas.length} filas · sha256 ${sha256.slice(0, 12)}…`,
);
console.log(`[icd10cm] escrito ${DESTINO}`);
