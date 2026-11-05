import type { SearchResultItem } from '../../molecules/search-result/search-result.types';

/**
 * Un tramo rotulado de un directorio: una categoría, una especialidad, un tipo
 * de organización.
 *
 * Los cuatro directorios agrupan por algo distinto y **ninguno agrupa por
 * nada**: una grilla de trescientas tarjetas seguidas no se hojea. Un
 * directorio que de verdad no tenga con qué agrupar pasa un solo grupo con
 * `nombre` vacío, y entonces el encabezado no se dibuja.
 */
export interface GrupoDeDirectorio {
  /** Clave estable del grupo; es la del `@for` y la del `aria-labelledby`. */
  readonly id: string;
  /** El rótulo del tramo. Vacío ⇒ el directorio no agrupa y no lleva encabezado. */
  readonly nombre: string;
  readonly resultados: readonly SearchResultItem[];
}

/**
 * Cómo se nombra lo que el directorio lista, para poder contarlo en castellano.
 *
 * Existe porque «3 resultados» es lo que escribe un sistema y «3 laboratorios»
 * es lo que lee una persona. Sin las dos formas, el contador diría «1
 * laboratorios».
 */
export interface SustantivoDelDirectorio {
  readonly singular: string;
  readonly plural: string;
}

/**
 * Un orden propio del directorio, por una de las cifras de sus resultados
 * (`SearchResultItem.stats`). De mayor a menor: «Más encuentros atendidos».
 *
 * Existe porque cada directorio tiene cifras distintas —la guía de médicos
 * cuenta consultas y recetas; una farmacia, no— y el «Ordenar por» común sólo
 * sabe de nombre y de nota.
 */
export interface CriterioDeOrden {
  /** La clave en `stats` por la que se ordena. */
  readonly clave: string;
  /** Lo que dice la opción. */
  readonly etiqueta: string;
}
