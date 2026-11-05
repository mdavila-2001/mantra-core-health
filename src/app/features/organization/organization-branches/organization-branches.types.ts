import type { BranchListItem } from '../../../core/data-access/directory/directory.types';

/** What is typed in the dialog, still as text. */
export interface BranchForm {
  readonly name: string;
  readonly code: string;
  readonly description: string;
  readonly locationUrl: string;
}

export const EMPTY_FORM: BranchForm = { name: '', code: '', description: '', locationUrl: '' };

/** The dialog is closed, creates a new branch or edits an existing one. */
export type Editing =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly branch: BranchListItem };
