import {
  BRANCH_CATEGORY_LABELS,
  type BranchCategory,
} from '../../../core/data-access/directory/branch-category';
import { normalizarEncabezado } from '../csv-import/csv-import';
import type { BranchImportColumn } from './branch-columns';

/**
 * The optional `categoria` column of the branch CSV (v4.2.92). Only offered
 * where rows are created straight in the API (the Branches tab and the admin
 * organization record): sign-ups classify their sites on the server.
 */
export const BRANCH_CATEGORY_COLUMN: BranchImportColumn = {
  header: 'categoria',
  field: 'category',
  aliases: ['category', 'tipo', 'tipo_de_sede', 'etiqueta'],
  required: false,
  hint: 'casa matriz, sucursal o por defecto. Vacía = por defecto. Sólo una casa matriz.',
};

/** Accepted spellings per category, already normalized (lowercase, no accents, `_`). */
const SPELLINGS: Readonly<Record<BranchCategory, readonly string[]>> = {
  head_office: ['casa_matriz', 'matriz', 'casa_central', 'sede_central', 'head_office'],
  branch: ['sucursal', 'branch', 'sede'],
  default: ['por_defecto', 'defecto', 'default', 'sin_categoria'],
};

/**
 * Reads one `categoria` cell: empty means `default`; an unknown value returns
 * `null` so the row can say which values are valid.
 */
export function branchCategoryFromCell(cell: string): BranchCategory | null {
  if (cell.trim() === '') return 'default';
  const key = normalizarEncabezado(cell);
  const found = (Object.keys(SPELLINGS) as BranchCategory[]).find((category) =>
    SPELLINGS[category].includes(key),
  );
  return found ?? null;
}

/** The row error for an unknown category, naming the valid values. */
export const UNKNOWN_CATEGORY_ERROR = `La categoría tiene que ser ${Object.values(BRANCH_CATEGORY_LABELS)
  .map((label) => `«${label.toLowerCase()}»`)
  .join(', ')} (o quedar vacía).`;
