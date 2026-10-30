import { computed, Injectable, signal } from '@angular/core';

import type {
  AlcanceReporte,
  ComparacionReporte,
  ContextoReporte,
  DimensionFiltro,
  FiltroActivo,
  Moneda,
  PeriodoReporte,
} from '@core/data-access/reporting/reporting.types';

export const ETIQUETA_PERIODO: Readonly<Record<PeriodoReporte, string>> = {
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  ytd: 'En lo que va del año',
  '12m': 'Últimos 12 meses',
};

export const ETIQUETA_COMPARACION: Readonly<Record<ComparacionReporte, string>> = {
  ninguna: 'Sin comparar',
  'periodo-anterior': 'Contra el periodo anterior',
  'mismo-periodo-ano-anterior': 'Contra el mismo periodo del año pasado',
};

export const ETIQUETA_ALCANCE: Readonly<Record<AlcanceReporte, string>> = {
  plataforma: 'Plataforma (todas las organizaciones)',
  organizacion: 'Mi organización',
};

/**
 * El contexto de consulta del portal de reportería: lo que vale para TODAS las
 * pestañas y gráficos. Es el único dueño de los filtros por clic: un gráfico
 * emite `FiltroActivo` y este almacén decide si lo activa, lo cambia o lo quita
 * (clic en el mismo valor lo quita; en otro valor de la misma dimensión lo cambia).
 */
@Injectable({ providedIn: 'root' })
export class ReportContextStore {
  readonly periodo = signal<PeriodoReporte>('30d');
  readonly comparar = signal<ComparacionReporte>('periodo-anterior');
  readonly moneda = signal<Moneda>('BOB');
  readonly alcance = signal<AlcanceReporte>('plataforma');
  readonly filtros = signal<readonly FiltroActivo[]>([]);

  readonly contexto = computed<ContextoReporte>(() => ({
    periodo: this.periodo(),
    comparar: this.comparar(),
    moneda: this.moneda(),
    alcance: this.alcance(),
    filtros: this.filtros(),
  }));

  /** Valor filtrado de una dimensión, o `null`. Para resaltar el elemento en su gráfico. */
  seleccionDe(dimension: DimensionFiltro | undefined): string | null {
    if (dimension === undefined) {
      return null;
    }
    return this.filtros().find((f) => f.dimension === dimension)?.valor ?? null;
  }

  alternarFiltro(filtro: FiltroActivo): void {
    this.filtros.update((actuales) => {
      const previo = actuales.find((f) => f.dimension === filtro.dimension);
      const resto = actuales.filter((f) => f.dimension !== filtro.dimension);
      return previo?.valor === filtro.valor ? resto : [...resto, filtro];
    });
  }

  quitarFiltro(dimension: DimensionFiltro): void {
    this.filtros.update((actuales) => actuales.filter((f) => f.dimension !== dimension));
  }

  limpiarFiltros(): void {
    this.filtros.set([]);
  }
}
