import {
  ATLAS_META,
  LAMINAS_ANATOMICAS,
  REGIONES_ANATOMICAS,
  type LaminaAnatomica,
} from './anatomy-atlas.generated';
import type { EntradaDeTaxonomia, TerminoDeGlosario } from './glossary.generated';

/* ============================================================================
    El índice del atlas anatómico, con la forma que ya tiene el glosario.

    Las 548 láminas entran al glosario como términos de la categoría
    **Anatomía**, que ya existe, en vez de estrenar una pantalla propia: el
    glosario ya sabe buscar, agrupar por categoría, filtrar por etiqueta y
    abrir una ficha. Una pantalla nueva habría repetido las cuatro cosas.

    Cada región del Atlas se declara como **etiqueta**, que es lo que convierte
    a 548 láminas en algo recorrible: sin ese filtro, la categoría Anatomía
    sería un muro de quinientas entradas.

    Este archivo indexa; no declara contenido. Todo texto sale de
    `anatomy-atlas.generated.ts`, y de ahí de `data/anatomy-atlas/`.
    ========================================================================== */

/** `R01` → `anatomy-region-r01`, la clave con la que el glosario la filtra. */
function regionKey(regionId: string): string {
  return `anatomy-region-${regionId.toLowerCase()}`;
}

/**
 * Las 8 regiones, como etiquetas del glosario.
 *
 * Son etiquetas y no categorías porque un término tiene **una** categoría y
 * 0..N etiquetas: la categoría de una lámina es Anatomía, y la región es la
 * faceta por la que se acota.
 */
export const REGION_LABELS: readonly EntradaDeTaxonomia[] = REGIONES_ANATOMICAS.map(
  (region) => ({
    key: regionKey(region.id),
    internalCode: `glossary-tag-${regionKey(region.id)}`,
    name: region.name,
  }),
);

/** `Cráneo: visión anterior` → `lamina-002-craneo-vision-anterior`. */
function plateSlug(lamina: LaminaAnatomica): string {
  const texto = lamina.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `lamina-${String(lamina.plate).padStart(3, '0')}-${texto}`;
}

/**
 * De dónde salió el título, dicho en castellano.
 *
 * Viaja a la ficha porque distingue lo verificado a mano de lo que leyó una
 * máquina, y quien consulta un atlas tiene derecho a saber cuál de las dos
 * está mirando.
 */
const TITLE_ORIGIN: Readonly<Record<string, string>> = {
  gold_manual: 'título verificado a mano',
  gold_ocr_title: 'título leído del encabezado de la lámina',
  derived_from_toc: 'título derivado de la tabla de contenidos',
};

function originOf(confianza: string): string {
  return TITLE_ORIGIN[confianza] ?? confianza;
}

/**
 * Una lámina como término del glosario.
 *
 * `clinicalDefinitionEs` lleva el contexto del bloque editorial **y** la
 * advertencia de qué no puede concluirse de una ilustración. Las dos cosas
 * juntas, porque separarlas dejaría la primera sonando a más de lo que es: un
 * atlas muestra dónde está algo, no qué hace ni qué lo irriga.
 */
function plateTerm(lamina: LaminaAnatomica): TerminoDeGlosario {
  const bloque =
    lamina.subregionName === '' ? lamina.regionName : `${lamina.regionName} › ${lamina.subregionName}`;

  return {
    key: lamina.id,
    slug: plateSlug(lamina),
    categoryKey: 'anatomy',
    tagKeys: lamina.regionId === null ? [] : [regionKey(lamina.regionId)],
    enDisplay: `Plate ${lamina.plate}`,
    esName: lamina.title,
    esSynonyms: [`Lámina ${lamina.plate}`],
    clinicalDefinitionEs: `${lamina.regionalContext} ${lamina.doNotInfer}`.trim(),
    plainSummaryEs:
      `Lámina ${lamina.plate} del ${ATLAS_META.source}. Bloque: ${bloque}. ` +
      `Procedencia del título: ${originOf(lamina.titleConfidence)}.`,
    relations: [],
  };
}

/** Las 548 láminas, listas para sumarse al glosario. */
export const PLATE_TERMS: readonly TerminoDeGlosario[] =
  LAMINAS_ANATOMICAS.map(plateTerm);

/** Las regiones, por si una pantalla quiere recorrerlas sin pasar por el glosario. */
export { LAMINAS_ANATOMICAS, REGIONES_ANATOMICAS, ATLAS_META };
