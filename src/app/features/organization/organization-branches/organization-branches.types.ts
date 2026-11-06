import {
  DEFAULT_BRANCH_CATEGORY,
  type BranchCategory,
} from '../../../core/data-access/directory/branch-category';
import type { BranchListItem } from '../../../core/data-access/directory/directory.types';

/** What is typed in the dialog, still as text. */
export interface BranchForm {
  readonly name: string;
  readonly code: string;
  readonly description: string;
  readonly locationUrl: string;
  /** Head office, branch or default (v4.2.91). */
  readonly category: BranchCategory;
}

export const EMPTY_FORM: BranchForm = {
  name: '',
  code: '',
  description: '',
  locationUrl: '',
  category: DEFAULT_BRANCH_CATEGORY,
};

/** The dialog is closed, creates a new branch or edits an existing one. */
export type Editing =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly branch: BranchListItem };
