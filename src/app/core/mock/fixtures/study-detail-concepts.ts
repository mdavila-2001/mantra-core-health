import { BODY_REGIONS, IMAGING_MODALITIES } from '../../data-access/anatomy-atlas/body-regions.data';
import { conjunto, define } from './concepts';

/* ============================================================================
    Catálogos del detalle de la orden de estudios en el DOBLE (maqueta).

    Modalidad y región son el catálogo REAL de imagenología de la API
    (`imagenologia.json` / `regiones-cuerpo-3d.json`, versión 2026-10-31), copiado
    por el generador con su procedencia. El tipo de hueso es **sintético**: los
    cinco clásicos, sin fuente registrada; el real lo siembra el modelo
    (`bone-type`) y no se presenta como catálogo oficial. La muestra y el lado reutilizan los que ya tenía la maqueta
    (`VS_SPECIMEN_TYPE`, `VS_CONDITION_LATERALITY`).
    ========================================================================== */

conjunto('VS_SERVICE_REQUEST_IMAGING_MODALITY', 'Modalidad del estudio de imagen', 'Del catálogo de imagenología de la API (maqueta).');
export const IMAGING_MODALITY = define(
  'VS_SERVICE_REQUEST_IMAGING_MODALITY',
  Object.entries(IMAGING_MODALITIES).map(([code, name]) => [`IMG_MODALITY_${code}`, name] as const),
);

/* Las 156 regiones del catálogo `imaging-body-structure` de la API, con sus códigos (`IMG_REGION_<región>`), tal como
   las generó `scripts/gen-body-regions.mjs` desde `regiones-cuerpo-3d.json`: así la pieza que se toca en el 3D se
   cruza con la misma tabla que usará la API real. */
conjunto('VS_IMAGING_BODY_STRUCTURE', 'Región del cuerpo del estudio de imagen', 'Del catálogo de imagenología de la API (maqueta).');
export const IMAGING_BODY_STRUCTURE = define(
  'VS_IMAGING_BODY_STRUCTURE',
  Object.entries(BODY_REGIONS).map(([code, region]) => [`IMG_REGION_${code}`, region.name] as const),
);

/** Las regiones únicas, que no admiten lado (la API responde 422 `LATERALITY_NOT_APPLICABLE`). */
export const UNPAIRED_BODY_SITES: readonly string[] = Object.entries(BODY_REGIONS)
  .filter(([, region]) => !region.lateral)
  .map(([code]) => `IMG_REGION_${code}`);

conjunto('VS_IMAGING_BONE_TYPE', 'Tipo de hueso', 'Sintético (maqueta). El real (UBERON) lo siembra el modelo.');
export const IMAGING_BONE_TYPE = define('VS_IMAGING_BONE_TYPE', [
  ['IMG_BONE_LONG', 'Hueso largo'],
  ['IMG_BONE_SHORT', 'Hueso corto'],
  ['IMG_BONE_FLAT', 'Hueso plano'],
  ['IMG_BONE_IRREGULAR', 'Hueso irregular'],
  ['IMG_BONE_SESAMOID', 'Hueso sesamoideo'],
]);
