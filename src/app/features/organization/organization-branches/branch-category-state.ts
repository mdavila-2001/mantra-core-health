import { computed, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import {
  BRANCH_CATEGORY_LABELS,
  branchCategoryOf,
} from '../../../core/data-access/directory/branch-category';
import type { BranchListItem } from '../../../core/data-access/directory/directory.types';
import { dataOf, empty, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import {
  BRANCH_CATEGORY_TONES,
  BRANCH_FILTER_PARAM,
  branchCategoryOptions,
  branchFilterFrom,
  branchFilterOptions,
  branchPins,
  filterBranches,
  hasPoint,
  mapUrlOf,
  type BranchFilter,
} from './branch-category-view';

/**
 * Category state of the Branches screen (v4.2.91): the chosen wave (in
 * `?categoria=`), what the table and the map show of it, and the dialog's
 * select options. Created in a component field initializer: it uses `inject`
 * and unsubscribes with the component.
 */
export class BranchCategoryState {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly labels = BRANCH_CATEGORY_LABELS;
  readonly tones = BRANCH_CATEGORY_TONES;
  readonly of = branchCategoryOf;
  readonly mapUrlOf = mapUrlOf;

  /** The wave on screen; it lives in the URL so the link keeps it. */
  readonly filter = signal<BranchFilter>(
    branchFilterFrom(this.route.snapshot.queryParamMap.get(BRANCH_FILTER_PARAM)),
  );

  private readonly loaded = computed(() => dataOf(this.branches()) ?? []);
  readonly options = computed(() => branchFilterOptions(this.loaded()));
  readonly visible = computed(() => filterBranches(this.loaded(), this.filter()));

  /** The table sees only the chosen wave; an empty wave says so. */
  readonly tableState = computed<ViewState<readonly BranchListItem[]>>(() => {
    const state = this.branches();
    const filter = this.filter();
    if (state.status !== 'ready' || filter === 'all') return state;
    const rows = this.visible();
    return rows.length > 0
      ? ready(rows)
      : empty(
          { label: 'Elija «Todas» arriba o cambie la categoría de una sede con «Editar»' },
          `No hay sedes con la etiqueta «${BRANCH_CATEGORY_LABELS[filter]}».`,
        );
  });

  /** One pin per site with an exact point, for the wave on screen. */
  readonly pins = computed(() => branchPins(this.visible()));
  readonly withoutPoint = computed(() => this.visible().filter((branch) => !hasPoint(branch)));
  readonly missingNames = computed(() =>
    this.withoutPoint().map((branch) => `«${branch.name}»`).join(', '),
  );

  private readonly headOffice = computed(
    () => this.loaded().find((branch) => branchCategoryOf(branch) === 'head_office') ?? null,
  );

  /** Dialog options: "Casa matriz" disabled if another site already is one. */
  readonly dialogOptions = computed(() =>
    branchCategoryOptions(this.headOffice(), this.editingId()),
  );

  /**
   * @param branches - State of the full list.
   * @param editingId - Site being edited in the dialog, or `null`.
   */
  constructor(
    private readonly branches: Signal<ViewState<readonly BranchListItem[]>>,
    private readonly editingId: Signal<string | null>,
  ) {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.filter.set(branchFilterFrom(params.get(BRANCH_FILTER_PARAM)));
    });
  }

  select(filter: BranchFilter): void {
    this.filter.set(filter);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [BRANCH_FILTER_PARAM]: filter === 'all' ? null : filter },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
