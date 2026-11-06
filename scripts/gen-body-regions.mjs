#!/usr/bin/env node
/**
 * Genera `src/app/core/data-access/anatomy-atlas/body-regions.data.ts`: de qué
 * región del catálogo de imagenología (`imaging-body-structure`) es cada pieza
 * del atlas 3D.
 *
 * ## De dónde sale
 *
 * Del catálogo versionado de la API, **no inventado aquí**:
 * `src/modules/study_catalog/data/regiones-cuerpo-3d.json` de
 * `mantra-core-health-api` (sha256 en su `SHA256SUMS`), que enlaza cada una de
 * las 156 regiones con sus estructuras UBERON y sus mallas FMA/BodyParts3D. El
 * front sólo guarda la parte que necesita el selector de la orden: el nombre y
 * si la región tiene lado, de malla a región y de estructura a región (sólo
 * cuando la estructura pertenece a UNA región de malla propia: una ambigua no
 * se resuelve, se deja elegir al médico).
 *
 * Uso: `node scripts/gen-body-regions.mjs [ruta/al/regiones-cuerpo-3d.json]`
 * (por defecto, el de `../mantra-core-health-api`). Lo que se genera cambia sólo
 * cuando cambia el catálogo; no se edita a mano.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORIGEN = process.argv[2] ?? fileURLToPath(new URL('../../mantra-core-health-api/src/modules/study_catalog/data/regiones-cuerpo-3d.json', import.meta.url));
const IMAGENOLOGIA = ORIGEN.replace('regiones-cuerpo-3d.json', 'imagenologia.json');
const SALIDA = fileURLToPath(new URL('../src/app/core/data-access/anatomy-atlas/body-regions.data.ts', import.meta.url));

const crudo = readFileSync(ORIGEN);
const data = JSON.parse(crudo.toString('utf8'));
const catalogo = JSON.parse(readFileSync(IMAGENOLOGIA, 'utf8'));

const regions = Object.fromEntries(data.regiones.map((r) => [r.region, { name: r.nombre, lateral: r.lateral }]));
const meshToRegion = Object.fromEntries(Object.entries(data.toque_malla_a_region).sort(([a], [b]) => a.localeCompare(b)));

const duenos = new Map();
for (const r of data.regiones.filter((x) => x.tipo_malla === 'propia')) {
  for (const s of r.structureIds) duenos.set(s, [...(duenos.get(s) ?? []), r.region]);
}
const structureToRegion = Object.fromEntries([...duenos].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]).sort(([a], [b]) => a.localeCompare(b)));
const modalities = Object.fromEntries(catalogo.modalidades.map((m) => [m.codigo, m.nombre]));

const salida = `/* GENERADO por scripts/gen-body-regions.mjs. No editar a mano.
   Fuente: mantra-core-health-api · src/modules/study_catalog/data/regiones-cuerpo-3d.json
   (catálogo de imagenología ${data.catalogo.version}, ${data.catalogo.regiones} regiones; sha256 ${createHash('sha256').update(crudo).digest('hex')}). */

/** Las regiones del catálogo \`imaging-body-structure\`: código → nombre y si admite lado. El concepto es \`IMG_REGION_<código>\`. */
export const BODY_REGIONS: Readonly<Record<string, { readonly name: string; readonly lateral: boolean }>> = ${JSON.stringify(regions)};

/** De la malla tocada en el atlas (id de BodyParts3D o HuBMAP) a su región. */
export const MESH_TO_REGION: Readonly<Record<string, string>> = ${JSON.stringify(meshToRegion)};

/** De una estructura (UBERON/FMA) a su región, sólo si pertenece a una única región de malla propia. */
export const STRUCTURE_TO_REGION: Readonly<Record<string, string>> = ${JSON.stringify(structureToRegion)};

/** Las modalidades del catálogo (código → nombre); el concepto es \`IMG_MODALITY_<código>\`. */
export const IMAGING_MODALITIES: Readonly<Record<string, string>> = ${JSON.stringify(modalities)};
`;
writeFileSync(SALIDA, salida);
console.log(`✓ ${Object.keys(regions).length} regiones · ${Object.keys(meshToRegion).length} mallas · ${Object.keys(structureToRegion).length} estructuras → ${SALIDA}`);
