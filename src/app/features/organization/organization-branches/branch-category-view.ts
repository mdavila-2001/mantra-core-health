import {
  BRANCH_CATEGORIES,
  BRANCH_CATEGORY_HINTS,
  BRANCH_CATEGORY_LABELS,
  branchCategoryOf,
  type BranchCategory,
} from '../../../core/data-access/directory/branch-category';
import type { BranchListItem } from '../../../core/data-access/directory/directory.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { PinMap } from '../../../shared/components/organisms/map/map-pin.types';
import type { NeutralTone, Tone } from '../../../shared/components/tone/tone.types';

/**
 * What the Branches screen does with each site's category (v4.2.91): the
 * label and the map pins. Pure functions, outside the
 * component so they can be tested on their own.
 */

/**
 * Tone of the label and the pin. Color only accompanies: the category is
 * always written out (table, filter and pin popup).
 */
export const BRANCH_CATEGORY_TONES: Readonly<Record<BranchCategory, Tone | NeutralTone>> = {
  head_office: 'primary',
  branch: 'info',
  default: 'neutral',
};

/**
 * Letter on the pin face. The shared location pin ignores the tone, so the
 * round coded pin is used: letter and color both tell the category apart.
 */
export const BRANCH_CATEGORY_PIN_CODES: Readonly<Record<BranchCategory, string>> = {
  head_office: 'M',
  branch: 'S',
  default: 'D',
};

/**
 * The dialog's select options. "Casa matriz" is offered disabled when another
 * site already is one: the API would answer 409, better to say so up front.
 */
export function branchCategoryOptions(
  headOffice: BranchListItem | null,
  ownId: string | null,
): readonly SelectOption<BranchCategory>[] {
  const taken = headOffice !== null && headOffice.id !== ownId;
  return BRANCH_CATEGORIES.map((category) => ({
    value: category,
    label: BRANCH_CATEGORY_LABELS[category],
    description:
      category === 'head_office' && taken
        ? `Ya es «${headOffice.name}». Cambie primero su categoría.`
        : BRANCH_CATEGORY_HINTS[category],
    disabled: category === 'head_office' && taken,
  }));
}

/** Whether the site has its exact point. */
export function hasPoint(branch: BranchListItem): boolean {
  return Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude);
}

/**
 * Map pins: one per site with a point, at the exact point the API stored. The
 * `id` is the site code (the map must not see uuids) and the popup states its
 * category and description.
 */
export function branchPins(branches: readonly BranchListItem[]): readonly PinMap[] {
  return branches.filter(hasPoint).map((branch) => {
    const category = branchCategoryOf(branch);
    return {
      id: branch.code,
      codigo: BRANCH_CATEGORY_PIN_CODES[category],
      lat: branch.latitude as number,
      lng: branch.longitude as number,
      titulo: branch.name,
      ...(branch.description ? { subtitulo: branch.description } : {}),
      estado: {
        etiqueta: BRANCH_CATEGORY_LABELS[category],
        tono: BRANCH_CATEGORY_TONES[category],
      },
    };
  });
}

/** A map link built from the point, for a site that did not paste its own. */
export function mapUrlOf(branch: BranchListItem): string | null {
  if (branch.locationUrl) return branch.locationUrl;
  if (!hasPoint(branch)) return null;
  const { latitude: lat, longitude: lng } = branch as Required<Pick<BranchListItem, 'latitude' | 'longitude'>>;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
