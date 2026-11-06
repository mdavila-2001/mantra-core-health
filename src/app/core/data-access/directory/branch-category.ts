/**
 * Branch category (model v4.2.91, `directory.branches.branch_category`): the
 * label every organization's Branches screen (pharmacy, laboratory, imaging,
 * medical organization) uses to group its sites and show them in waves.
 *
 * The API validates these three values and allows **at most one head office**
 * per organization: asking for another answers 409 (`HEAD_OFFICE_TAKEN`). The
 * list order is the order the screen offers them in.
 */
export const BRANCH_CATEGORIES = ['head_office', 'branch', 'default'] as const;
export type BranchCategory = (typeof BRANCH_CATEGORIES)[number];

/** What an old site, a CSV upload or an unclassified site carries. */
export const DEFAULT_BRANCH_CATEGORY: BranchCategory = 'default';

/** Each category's name as the screen reads it. */
export const BRANCH_CATEGORY_LABELS: Readonly<Record<BranchCategory, string>> = {
  head_office: 'Casa matriz',
  branch: 'Sucursal',
  default: 'Por defecto',
};

/** What each one means, for the dialog's select. */
export const BRANCH_CATEGORY_HINTS: Readonly<Record<BranchCategory, string>> = {
  head_office: 'La sede principal de la organización. Sólo puede haber una.',
  branch: 'Una sede más de la organización.',
  default: 'Sin clasificar todavía.',
};

/** Whether a value is one of the three categories. */
export function isBranchCategory(value: unknown): value is BranchCategory {
  return typeof value === 'string' && (BRANCH_CATEGORIES as readonly string[]).includes(value);
}

/**
 * A site's category; `default` when the API did not send one (a version older
 * than v4.2.91) or sent one the front does not know.
 */
export function branchCategoryOf(branch: { readonly category?: string }): BranchCategory {
  return isBranchCategory(branch.category) ? branch.category : DEFAULT_BRANCH_CATEGORY;
}
