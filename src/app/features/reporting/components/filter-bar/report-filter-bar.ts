import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ETIQUETA_DIMENSION } from '@core/data-access/reporting/reporting-labels';
import type {
  AlcanceReporte,
  ComparacionReporte,
  DimensionFiltro,
  Moneda,
  PeriodoReporte,
} from '@core/data-access/reporting/reporting.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';
import {
  ETIQUETA_ALCANCE,
  ETIQUETA_COMPARACION,
  ETIQUETA_PERIODO,
  ReportContextStore,
} from '../../state/report-context.store';

function optionsOf<T extends string>(labels: Readonly<Record<T, string>>): readonly SelectOption<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

const PERIODS = optionsOf<PeriodoReporte>(ETIQUETA_PERIODO);
const COMPARISONS = optionsOf<ComparacionReporte>(ETIQUETA_COMPARACION);
const CURRENCIES: readonly SegmentedOption<Moneda>[] = [
  { value: 'BOB', label: 'Bs (BOB)' },
  { value: 'USD', label: 'US$ (USD)' },
];
const SCOPES: readonly SegmentedOption<AlcanceReporte>[] = [
  { value: 'plataforma', label: 'Plataforma', description: ETIQUETA_ALCANCE.plataforma },
  { value: 'organizacion', label: 'Mi organización', description: ETIQUETA_ALCANCE.organizacion },
];

/**
 * Barra de filtros globales del portal de reportería: periodo, comparación,
 * moneda y alcance, más los filtros que el usuario activó haciendo clic en un
 * gráfico. Todo vive en `ReportContextStore`: la barra solo lo muestra y lo
 * cambia, así que cualquier pestaña recalcula sin que la barra sepa de ellas.
 *
 * Los filtros activos son chips que se quitan uno a uno. Un filtro «fantasma»
 * —que cambia los números sin que se vea— es justo lo que esta barra impide.
 */
@Component({
  selector: 'app-report-filter-bar',
  imports: [Select, SegmentedControl, AppButton],
  templateUrl: './report-filter-bar.html',
  styleUrl: './report-filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportFilterBar {
  protected readonly store = inject(ReportContextStore);

  protected readonly periods = PERIODS;
  protected readonly comparisons = COMPARISONS;
  protected readonly currencies = CURRENCIES;
  protected readonly scopes = SCOPES;

  protected readonly chips = computed(() =>
    this.store.filtros().map((filter) => {
      const dimension = ETIQUETA_DIMENSION[filter.dimension];
      return {
        dimension: filter.dimension,
        label: `${dimension.charAt(0).toUpperCase()}${dimension.slice(1)}: ${filter.valor}`,
        removeLabel: `Quitar filtro ${dimension}: ${filter.valor}`,
      };
    }),
  );

  /** Lo que se anuncia al lector de pantalla cada vez que algo del contexto cambia. */
  protected readonly announcement = computed(() => {
    const count = this.store.filtros().length;
    const filters =
      count === 0 ? 'sin filtros activos' : count === 1 ? '1 filtro activo' : `${count} filtros activos`;
    return `Mostrando: ${ETIQUETA_PERIODO[this.store.periodo()]}, ${ETIQUETA_COMPARACION[this.store.comparar()].toLowerCase()}, en ${this.store.moneda()}, ${ETIQUETA_ALCANCE[this.store.alcance()].toLowerCase()}, ${filters}.`;
  });

  protected setPeriod(value: PeriodoReporte | null): void {
    if (value !== null) {
      this.store.periodo.set(value);
    }
  }

  protected setComparison(value: ComparacionReporte | null): void {
    if (value !== null) {
      this.store.comparar.set(value);
    }
  }

  protected remove(dimension: DimensionFiltro): void {
    this.store.quitarFiltro(dimension);
  }
}
