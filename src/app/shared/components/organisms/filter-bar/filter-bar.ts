import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AppButton } from '../../atoms/button/button';
import { Chip } from '../../atoms/chip/chip';
import { SearchField } from '../../molecules/search-field/search-field';
import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';

/** Clave del término de búsqueda en la URL. */
export const SEARCH_PARAM = 'q';

/**
 * Un filtro de value set. **Siempre selector, nunca texto libre**: todo lo que
 * en el modelo es `*_concept_id` se elige de una lista cerrada, porque un
 * texto libre no puede resolverse a un concepto.
 */
export interface FilterDef {
  /** Clave estable; es la que viaja a la URL y al backend. */
  readonly key: string;
  readonly label: string;
  /** Opciones del value set. Vacío ⇒ el filtro se muestra deshabilitado. */
  readonly options: readonly SelectOption<string>[];
  /** Motivo visible cuando el value set no está disponible. */
  readonly unavailableReason?: string;
}

/** Un filtro activo, listo para dibujarse como chip. */
export interface ActiveFilter {
  readonly key: string;
  readonly code: string;
  readonly label: string;
}

/**
 * Barra de filtros de un listado. **La URL es la fuente de verdad**: el
 * organismo no guarda una copia del estado, lo lee de los query params y lo
 * escribe ahí. Recargar o compartir el enlace reproduce el filtrado exacto,
 * que es lo que pide el M34.
 *
 * ```html
 * <app-filter-bar [filters]="filtros" (filtersChanged)="recargar($event)" />
 * ```
 *
 * Cada chip activo muestra la **etiqueta legible** y emite el **código**: las
 * etiquetas son presentación y cambian con el value set o el idioma.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [AppButton, Chip, SearchField, Select],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'filter-bar',
  },
})
export class FilterBar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters = input<readonly FilterDef[]>([]);
  readonly searchLabel = input<string>('Buscar en el listado');

  /** Los códigos activos, incluido el término de búsqueda bajo `q`. */
  readonly filtersChanged = output<Readonly<Record<string, string>>>();

  /**
   * Estado leído de la URL. No hay copia local: si existiera, un `back` del
   * navegador dejaría la barra mostrando algo distinto de lo que se consultó.
   */
  private readonly params = toSignal(
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly searchTerm = computed(() => this.params()[SEARCH_PARAM] ?? '');

  /** Los filtros con opciones; sin ellas el value set no llegó. */
  protected isAvailable(filter: FilterDef): boolean {
    return filter.options.length > 0;
  }

  protected valueOf(filter: FilterDef): string | null {
    return this.params()[filter.key] ?? null;
  }

  /** Chips de lo activo, con la etiqueta legible del value set. */
  readonly activeFilters = computed<readonly ActiveFilter[]>(() => {
    const params = this.params();
    return this.filters()
      .map((filter) => {
        const code = params[filter.key];
        if (!code) {
          return null;
        }
        const option = filter.options.find((candidate) => candidate.value === code);
        return {
          key: filter.key,
          code,
          // Sin etiqueta en el value set se muestra el código: mentir con una
          // etiqueta inventada sería peor.
          label: `${filter.label}: ${option?.label ?? code}`,
        };
      })
      .filter((active): active is ActiveFilter => active !== null);
  });

  protected readonly hasActiveFilters = computed(
    () => this.activeFilters().length > 0 || this.searchTerm() !== '',
  );

  /** Mientras se tipea se reemplaza la entrada del historial: no se ensucia. */
  protected onSearch(term: string): void {
    this.applyParams({ [SEARCH_PARAM]: term || null }, true);
  }

  /** Elegir un filtro es una decisión: queda en el historial. */
  protected onFilterChange(filter: FilterDef, code: string | null): void {
    this.applyParams({ [filter.key]: code }, false);
  }

  protected removeFilter(active: ActiveFilter): void {
    this.applyParams({ [active.key]: null }, false);
  }

  protected clearAll(): void {
    const vacios: Record<string, null> = { [SEARCH_PARAM]: null };
    for (const filter of this.filters()) {
      vacios[filter.key] = null;
    }
    this.applyParams(vacios, false);
  }

  private applyParams(changes: Record<string, string | null>, replaceUrl: boolean): void {
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: changes,
        queryParamsHandling: 'merge',
        replaceUrl,
      })
      .then(() => this.emitCurrent());
  }

  private emitCurrent(): void {
    const activos: Record<string, string> = {};
    const term = this.searchTerm();
    if (term) {
      activos[SEARCH_PARAM] = term;
    }
    for (const active of this.activeFilters()) {
      // El CÓDIGO, no la etiqueta: es lo único estable.
      activos[active.key] = active.code;
    }
    this.filtersChanged.emit(activos);
  }
}
