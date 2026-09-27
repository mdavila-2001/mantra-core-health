/**
 * Lectura compartida del glosario: el seed curado del backend y las capas NDJSON
 * de `data/glossary/`.
 *
 * Lo usan `gen-glossary-fixture.mjs` (genera el fixture), `check-glossary-corpus.mjs`
 * (valida sin red) y `verify-external-codes.mjs` (verifica códigos con red). Vive
 * aparte para que los tres lean **exactamente lo mismo**: un validador que
 * parseara distinto del generador no validaría nada.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { transformSync } from 'esbuild';

export const SEED = join(process.cwd(), '..', 'mantra-core-health-api', 'src', 'common', 'seed');
export const CORPUS = join(process.cwd(), 'data', 'glossary');
export const TABLA_DE_SINTOMAS = join(
  process.cwd(),
  'src',
  'app',
  'features',
  'symptom-check',
  'sintomas.datos.ts',
);

/** Las capas, en el orden en que se leen. El orden importa sólo para los mensajes. */
export const CAPAS = [
  'enfermedades-atencion-primaria.ndjson',
  'analisis-frecuentes.ndjson',
  'cie10cm-categorias.generated.ndjson',
];

export const TIPOS_DE_RELACION = new Set([
  'RELATED_TERM',
  'DISEASE',
  'PROCEDURE',
  'TREATMENT',
  'ANATOMY',
  'DIAGNOSTIC_TEST',
]);

export const CATEGORIAS_DE_ORDEN = new Set(['LAB', 'IMAGING', 'OTHER']);
export const ESTADOS_DE_REVISION = new Set([
  'external-source',
  'pending-medical-review',
  'medically-reviewed',
]);

/** Identificadores que los archivos del seed importan y que acá no hacen falta. */
const STUBS = `
const deterministicId = (clave) => clave;
const valueSetId = (clave) => clave;
const valueSetVersionId = (clave) => clave;
const valueSetMemberId = (clave) => clave;
const valueSetCanonicalUrl = (clave) => clave;
const GLOSSARY_ALL_TERMS_CODE = 'glossary-all-terms';
`;

/**
 * Lee la taxonomía y el catálogo curado del backend sin compilarlo: quita los
 * `import`, stubea lo que queda colgando y transpila con el esbuild de Angular.
 */
export async function leerSeed() {
  const temporal = mkdtempSync(join(tmpdir(), 'glosario-'));
  async function leer(nombre) {
    const fuente = readFileSync(join(SEED, `${nombre}.ts`), 'utf8').replace(
      /^import[\s\S]*?from\s+'[^']+';$/gm,
      '',
    );
    const { code } = transformSync(STUBS + fuente, { loader: 'ts', format: 'esm' });
    const destino = join(temporal, `${nombre}.mjs`);
    writeFileSync(destino, code);
    return import(pathToFileURL(destino).href);
  }
  try {
    const taxonomia = await leer('glossary-taxonomy');
    const catalogo = await leer('glossary-terms.catalog');
    return {
      categorias: taxonomia.GLOSSARY_CATEGORIES,
      etiquetas: taxonomia.GLOSSARY_TAGS,
      paraguas: taxonomia.GLOSSARY_ALL_TERMS,
      terminos: catalogo.GLOSSARY_TERMS,
    };
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

/**
 * Una capa NDJSON: una fila por línea. Las líneas vacías se ignoran; una línea
 * que no es JSON se devuelve como problema con su número, nunca se lanza — el
 * que llama decide si eso aborta.
 */
export function leerCapa(nombre) {
  const ruta = join(CORPUS, nombre);
  let texto;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    return { nombre, filas: [], problemas: [{ linea: 0, motivo: `no existe ${ruta}` }] };
  }
  const filas = [];
  const problemas = [];
  texto.split(/\r?\n/).forEach((linea, indice) => {
    if (linea.trim() === '') return;
    try {
      filas.push({ linea: indice + 1, ...JSON.parse(linea) });
    } catch (error) {
      problemas.push({ linea: indice + 1, motivo: `JSON inválido: ${error.message}` });
    }
  });
  return { nombre, filas, problemas };
}

/** Todas las capas presentes en `data/glossary/`, en el orden de {@link CAPAS}. */
export function leerCapas() {
  const presentes = new Set(readdirSync(CORPUS).filter((f) => f.endsWith('.ndjson')));
  return CAPAS.filter((nombre) => presentes.has(nombre)).map(leerCapa);
}

/** Los ids de la tabla curada de síntomas del front, tal como los conoce el motor. */
export function idsDeSintomas() {
  const fuente = readFileSync(TABLA_DE_SINTOMAS, 'utf8');
  return new Set([...fuente.matchAll(/^\s*id: '([^']+)'/gm)].map((m) => m[1]));
}
