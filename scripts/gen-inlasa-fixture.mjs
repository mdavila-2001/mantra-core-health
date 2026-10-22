/**
 * Trae el catálogo de análisis clínicos de INLASA a la maqueta:
 * `src/app/core/mock/fixtures/inlasa-tariffs.generated.ts`.
 *
 * La fuente es `ndjson/inlasa-aranceles.ndjson`, que emite el importador de la
 * API (`tools/terminology-import/import-inlasa.mjs`) desde el «Listado de
 * Servicios y Aranceles del INLASA 2026». No reescribe contenido: código,
 * nombre, nombre oficial verbatim, área y precio pasan tal cual.
 *
 * Uso:
 *   node scripts/gen-inlasa-fixture.mjs                  # ../glossary-data-build
 *   node scripts/gen-inlasa-fixture.mjs <ruta-al-build>  # otra ubicación
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = process.cwd();
const ORIGEN = resolve(process.argv[2] ?? process.env.GLOSSARY_DATA_BUILD ?? join(RAIZ, '..', 'glossary-data-build'));
const ENTRADA = join(ORIGEN, 'ndjson', 'inlasa-aranceles.ndjson');
const META = join(ORIGEN, 'ndjson', 'inlasa-aranceles.meta.json');
const SALIDA = join(RAIZ, 'src', 'app', 'core', 'mock', 'fixtures', 'inlasa-tariffs.generated.ts');

const filas = readFileSync(ENTRADA, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((linea) => JSON.parse(linea));
const meta = JSON.parse(readFileSync(META, 'utf8'));

const analisis = filas
  .map((f) => ({
    code: f.code,
    name: f.esName,
    officialName: f.officialName,
    area: f.hierarchy?.[0]?.display ?? null,
    priceBs: f.referencePrice?.amount ?? null,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

const cuerpo = `/* ============================================================================
    Análisis clínicos del «Listado de Servicios y Aranceles del INLASA 2026»
    (Instituto Nacional de Laboratorios de Salud, Ministerio de Salud y
    Deportes de Bolivia): código oficial, nombre, nombre oficial verbatim, área
    y precio de referencia en bolivianos.

    **GENERADO por \`scripts/gen-inlasa-fixture.mjs\`. No editar a mano.**
    Fuente: ${meta.url}
    Obtenido: ${meta.retrievedAt} · SHA-256 del HTML: ${meta.sha256}
    ${meta.analisisAPacientes} análisis a pacientes de ${meta.filasEnLaTabla} servicios publicados.
    ========================================================================== */

/** Un análisis de INLASA. \`priceBs\` es la cadena decimal exacta («60.00»). */
export interface AnalisisInlasa {
  readonly code: string;
  readonly name: string;
  readonly officialName: string;
  readonly area: string | null;
  readonly priceBs: string | null;
}

export const INLASA_FUENTE = ${JSON.stringify({ url: meta.url, retrievedAt: meta.retrievedAt, sha256: meta.sha256 })} as const;

export const ANALISIS_INLASA: readonly AnalisisInlasa[] = ${JSON.stringify(analisis, null, 2)};
`;
writeFileSync(SALIDA, cuerpo);
console.log(`inlasa: ${analisis.length} análisis → ${SALIDA}`);
