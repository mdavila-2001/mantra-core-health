import type { GlossaryNeighbor } from '@core/data-access/terminology/terminology.types';

/** Matiz del borde de las columnas: a qué parte de la ruta clínica pertenecen. */
export type RelationGroupsTone = 'findings' | 'next' | 'context';

/**
 * Qué hace un vecino al activarse: `link` abre la ficha del término;
 * `select` lo emite por `neighborSelected` (el mapa lo pasa al centro).
 */
export type RelationNavigation = 'link' | 'select';

/** Una columna de relaciones ya resuelta, lista para pintar. */
export interface RelationColumnView {
  readonly key: string;
  readonly title: string;
  /** Los vecinos a mostrar, en el orden en que se pintan. */
  readonly items: readonly GlossaryNeighbor[];
  /** Total que se anuncia junto al título; `null` si no se conoce entero. */
  readonly count: number | null;
}

/** Contexto de la plantilla opcional que se pinta al pie de cada columna. */
export interface RelationColumnFooterContext {
  readonly $implicit: RelationColumnView;
}
