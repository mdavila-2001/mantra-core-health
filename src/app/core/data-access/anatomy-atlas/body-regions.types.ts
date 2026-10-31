/* ============================================================================
    Contratos del mapeo región de imagenología -> mallas del atlas 3D.

    Es la forma de `public/anatomy-atlas-3d/catalog/body-regions.json`, que
    escribe `scripts/gen-body-regions.mjs` recortando
    `docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/regiones-cuerpo-3d.json`.
    No se edita a mano: se regenera (`--check` detecta la deriva).
    ========================================================================== */

import type { AnatomyLayer } from './anatomy-atlas.types';

/** Lateralidad del catálogo de imagenología (`lateralidades[].codigo`). */
export type Laterality = 'IZQ' | 'DER' | 'BIL' | 'UNI';

/** Qué tiene el atlas para la región: sus mallas, un contenedor, una vecina o nada. */
export type BodyRegionMeshKind = 'propia' | 'contenedora' | 'referencia' | 'ninguna';

/** Cómo se llega a la región tocando el modelo. */
export type BodyRegionTouch = 'malla' | 'punto' | 'solo_select';

/** `[minx, miny, minz, maxx, maxy, maxz]` en metros, en el espacio del modelo. */
export type BodyBox = readonly [number, number, number, number, number, number];

/** Una región tal como viaja en el JSON: las mallas son posiciones en `mallas`. */
export interface BodyRegionRaw {
  readonly tipo: BodyRegionMeshKind;
  readonly tocar: BodyRegionTouch;
  readonly capa: AnatomyLayer;
  readonly capas: readonly AnatomyLayer[];
  readonly izq: readonly number[];
  readonly der: readonly number[];
  readonly centro: readonly number[];
  readonly encuadre?: {
    readonly modo: 'union' | 'interseccion';
    readonly izq: readonly (readonly number[])[];
    readonly der: readonly (readonly number[])[];
    readonly caja: { readonly izq: BodyBox; readonly der: BodyBox };
  };
}

export interface BodyRegionsFile {
  readonly version: number;
  readonly catalogo: string;
  readonly mallas: readonly string[];
  readonly regiones: Readonly<Record<string, BodyRegionRaw>>;
  /** Región por defecto de cada malla al tocarla: región -> posiciones en `mallas`. */
  readonly toque: Readonly<Record<string, readonly number[]>>;
}

/** Una región con los ids de malla ya resueltos. */
export interface BodyRegionMesh {
  readonly tipo: BodyRegionMeshKind;
  readonly tocar: BodyRegionTouch;
  readonly capa: AnatomyLayer;
  readonly capas: readonly AnatomyLayer[];
  readonly izq: readonly string[];
  readonly der: readonly string[];
  readonly centro: readonly string[];
  readonly encuadre: {
    readonly modo: 'union' | 'interseccion';
    readonly izq: readonly (readonly string[])[];
    readonly der: readonly (readonly string[])[];
    readonly caja: { readonly izq: BodyBox; readonly der: BodyBox };
  } | null;
}

/** El mapeo listo para usar. */
export interface BodyRegionMap {
  readonly regiones: Readonly<Record<string, BodyRegionMesh>>;
  /** malla -> región por defecto al tocarla. */
  readonly regionDeMalla: ReadonlyMap<string, string>;
}

/**
 * La parte del catálogo de imagenología que el selector necesita
 * (`imagenologia.json › regiones[]`). Lo demás del catálogo no entra.
 */
export interface BodyRegionCatalogEntry {
  readonly codigo: string;
  readonly nombre: string;
  readonly padre: string | null;
  readonly tipo?: string;
  readonly admite_lateralidad: boolean;
}

/** La modalidad del estudio (`imagenologia.json › modalidades[].codigo`). */
export type ImagingModalityCode = string;
