#!/usr/bin/env node
// =============================================================================
// Fixture del simulador · subconjunto REAL del catálogo universal de
// medicamentos (CIMA e INVIMA), para que el modal «Nuevo producto» se pruebe
// contra datos de verdad y no contra nombres inventados.
//
// Lee los NDJSON que escribe `build-medicine-catalog.mjs` (repo de la API) en
// `glossary-data-build/ndjson/` y emite
// `src/app/core/mock/fixtures/medication-catalog.generated.ts`.
//
// Selección determinista (misma entrada → mismo archivo):
//   · por cada medicamento del vademécum del simulador, hasta 4 productos de CIMA
//     y 2 de INVIMA con el mismo ATC nivel 5 (primero con foto, después por código);
//   · 1 CIMA revocado/suspendido por cada 3 medicamentos, para ejercitar el
//     estado «no seleccionable»;
//   · 12 productos de CIMA fuera del vademécum, para mostrar un catálogo que
//     no se agota en lo que el simulador sabe recetar.
//
// El ATC que une cada medicamento del simulador con el catálogo es un dato de
// la clasificación ATC de la OMS; el script imprime el nombre oficial del ATC
// que encontró en la fuente para que se pueda contrastar a ojo.
//
// Uso: node scripts/build-catalog-fixture.mjs [--build-dir <glossary-data-build>]
// =============================================================================

import { createReadStream, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dirIndex = args.indexOf('--build-dir');
const BUILD_DIR = resolve(
  dirIndex >= 0 ? args[dirIndex + 1] : (process.env.GLOSSARY_BUILD_DIR ?? join(ROOT, '..', 'glossary-data-build')),
);
const OUT = join(ROOT, 'src/app/core/mock/fixtures/medication-catalog.generated.ts');

/** Medicamento del vademécum del simulador → ATC nivel 5 (clasificación ATC de la OMS). */
const MEDICATION_ATC = {
  'MED-ENALAPRIL': 'C09AA02',
  'MED-LOSARTAN': 'C09CA01',
  'MED-METFORMINA': 'A10BA02',
  'MED-ATORVASTATINA': 'C10AA05',
  'MED-AMOXICILINA': 'J01CA04',
  'MED-IBUPROFENO': 'M01AE01',
  'MED-PARACETAMOL': 'N02BE01',
  'MED-OMEPRAZOL': 'A02BC01',
  'MED-SALBUTAMOL': 'R03AC02',
  'MED-LEVOTIROXINA': 'H03AA01',
  'MED-SERTRALINA': 'N06AB06',
  'MED-LORATADINA': 'R06AX13',
  'MED-SULFATO-FERROSO': 'B03AA07',
  'MED-CIPROFLOXACINO': 'J01MA02',
  'MED-INSULINA-NPH': 'A10AC01',
};
const PER_ATC = { cima: 4, invima: 2 };
const EXTRAS = 12;
const MAX_PRESENTATIONS = 4;

async function readNdjson(path) {
  if (!existsSync(path)) {
    throw new Error(`Falta ${path}. Corré primero build-medicine-catalog.mjs en el repo de la API.`);
  }
  const rows = [];
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) if (line.trim() !== '') rows.push(JSON.parse(line));
  return rows;
}

const byPhotoThenCode = (a, b) =>
  (b.photos.length > 0) - (a.photos.length > 0) || a.code.localeCompare(b.code);

/** Lo que el simulador necesita de un registro del catálogo. */
function trim(record, medicationCode) {
  const presentations = record.presentations.filter((p) => p.active !== false).slice(0, MAX_PRESENTATIONS);
  const photo = record.photos[0] ?? null;
  return {
    id: record.id,
    source: record.source,
    sourceName: record.sourceName,
    code: record.code,
    display: record.display,
    holder: record.holder,
    strengthText: record.strengthText,
    dosageForm: record.dosageForm,
    requiresPrescription: record.requiresPrescription,
    generic: record.generic,
    activeIngredients: record.activeIngredients,
    atc: record.atc,
    presentations: presentations.length > 0 ? presentations : record.presentations.slice(0, 1),
    regulatoryStatus: record.regulatoryStatus,
    selectable: record.selectable,
    photo: photo === null ? null : { url: photo.url, thumbUrl: photo.thumbUrl, attribution: photo.attribution },
    sourceUrl: record.sourceUrl,
    medicationCode,
  };
}

const cima = await readNdjson(join(BUILD_DIR, 'ndjson', 'medicines-cima.ndjson'));
const invima = await readNdjson(join(BUILD_DIR, 'ndjson', 'medicines-invima.ndjson'));
const bySource = { cima, invima };

const chosen = new Map();
const add = (record, medicationCode) => {
  if (!chosen.has(record.id)) chosen.set(record.id, trim(record, medicationCode));
};

const atcToCode = new Map(Object.entries(MEDICATION_ATC).map(([code, atc]) => [atc, code]));
let medicationIndex = 0;
for (const [medicationCode, atc] of Object.entries(MEDICATION_ATC)) {
  medicationIndex += 1;
  for (const [source, limit] of Object.entries(PER_ATC)) {
    const matches = bySource[source]
      .filter((r) => r.selectable && r.strengthText !== null && r.atc.includes(atc) && r.presentations.length > 0)
      .sort(byPhotoThenCode);
    matches.slice(0, limit).forEach((r) => add(r, medicationCode));
    if (matches.length === 0) console.warn(`SIN productos ${source} para ${medicationCode} (${atc})`);
  }
  if (medicationIndex % 3 === 0) {
    const retired = cima
      .filter((r) => !r.selectable && r.atc.includes(atc))
      .sort((a, b) => a.code.localeCompare(b.code))[0];
    if (retired !== undefined) add(retired, medicationCode);
  }
}

const extras = cima
  .filter((r) => r.selectable && r.atc.length > 0 && !r.atc.some((a) => atcToCode.has(a)) && r.strengthText !== null)
  .filter((r) => r.presentations.length > 0)
  .sort(byPhotoThenCode)
  .filter((_, i) => i % 97 === 0)
  .slice(0, EXTRAS);
extras.forEach((r) => add(r, null));

const items = [...chosen.values()];
const body = `// ARCHIVO GENERADO por scripts/build-catalog-fixture.mjs — no editar a mano.
// Subconjunto REAL de CIMA (AEMPS) e INVIMA, ver el encabezado del script.
import type { CatalogProduct } from '../../data-access/pharmacy/pharmacy.types';

/** \`medicationCode\` es el medicamento del vademécum del simulador que comparte ATC nivel 5. */
export interface CatalogFixtureRow extends CatalogProduct {
  readonly medicationCode: string | null;
}

export const CATALOGO_MEDICAMENTOS: readonly CatalogFixtureRow[] = ${JSON.stringify(items, null, 2)};
`;
writeFileSync(OUT, body);
console.log(`${items.length} productos → ${OUT}`);
for (const [medicationCode, atc] of Object.entries(MEDICATION_ATC)) {
  const sample = cima.find((r) => r.atc.includes(atc));
  console.log(`${medicationCode.padEnd(20)} ${atc}  ${items.filter((i) => i.medicationCode === medicationCode).length} prod.  ATC en CIMA: ${sample ? sample.display.slice(0, 40) : '—'}`);
}
