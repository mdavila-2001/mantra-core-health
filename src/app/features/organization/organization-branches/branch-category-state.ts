import { computed, type Signal } from '@angular/core';

import {
  BRANCH_CATEGORY_LABELS,
  branchCategoryOf,
} from '../../../core/data-access/directory/branch-category';
import type { BranchListItem } from '../../../core/data-access/directory/directory.types';
import { dataOf } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import {
  BRANCH_CATEGORY_TONES,
  branchCategoryOptions,
  branchPins,
  hasPoint,
  mapUrlOf,
} from './branch-category-view';

/**
 * Category state of the Branches screen (v4.2.91): what the table and the map
 * show and the dialog's select options. Created in a component field
 * initializer.
 */
export class BranchCategoryState {
  readonly labels = BRANCH_CATEGORY_LABELS;
  readonly tones = BRANCH_CATEGORY_TONES;
  readonly of = branchCategoryOf;
  readonly mapUrlOf = mapUrlOf;

  private readonly loaded = computed(() => dataOf(this.tableState()) ?? []);

  /** One pin per site with an exact point. */
  readonly pins = computed(() => branchPins(this.loaded()));
  readonly withoutPoint = computed(() => this.loaded().filter((branch) => !hasPoint(branch)));
  readonly missingNames = computed(() =>
    this.withoutPoint().map((branch) => `«${branch.name}»`).join(', '),
  );

  /** The current head office's name, for the CSV import's early check. */
  readonly headOfficeName = computed(() => this.headOffice()?.name ?? null);

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
    readonly tableState: Signal<ViewState<readonly BranchListItem[]>>,
    private readonly editingId: Signal<string | null>,
  ) {}
}
