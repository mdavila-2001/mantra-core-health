import { branchCategoryOf } from '../../../core/data-access/directory/branch-category';
import type {
  BranchChanges,
  BranchListItem,
  NewBranch,
} from '../../../core/data-access/directory/directory.types';
import {
  branchCodeFromName,
  coordinatesFromMapUrl,
} from '../../../shared/utils/branch-import/branch-import';

import type { BranchForm } from './organization-branches.types';

/**
 * Body of `PATCH /tenants/{id}/branches/{branchId}`: only what changed, since a
 * missing key leaves the value as is. A new location link re-derives the
 * point; a link without a point clears it, or the pin would mark another place.
 */
export function branchChanges(form: BranchForm, branch: BranchListItem): BranchChanges {
  const name = form.name.trim();
  const description = form.description.trim();
  const locationUrl = form.locationUrl.trim();
  const changes: { -readonly [K in keyof BranchChanges]: BranchChanges[K] } = {};
  if (name !== branch.name) {
    changes.name = name;
  }
  if (form.category !== branchCategoryOf(branch)) {
    changes.category = form.category;
  }
  if (description !== (branch.description ?? '')) {
    changes.description = description === '' ? null : description;
  }
  if (locationUrl !== (branch.locationUrl ?? '')) {
    changes.locationUrl = locationUrl === '' ? null : locationUrl;
    // The old point belonged to the old link: replace or clear it.
    const point = locationUrl === '' ? null : coordinatesFromMapUrl(locationUrl);
    changes.latitude = point?.latitude ?? null;
    changes.longitude = point?.longitude ?? null;
  }
  return changes;
}

/**
 * Body of `POST /tenants/{id}/branches`. Without a typed code, one is derived
 * from the name without repeating any of `takenCodes`.
 */
export function newBranchFrom(form: BranchForm, takenCodes: readonly string[]): NewBranch {
  const name = form.name.trim();
  const typed = form.code.trim();
  const code = typed === '' ? branchCodeFromName(name, new Set(takenCodes)) : typed;
  const description = form.description.trim();
  const locationUrl = form.locationUrl.trim();
  const point = locationUrl === '' ? null : coordinatesFromMapUrl(locationUrl);
  return {
    code,
    name,
    ...(description === '' ? {} : { description }),
    ...(locationUrl === '' ? {} : { locationUrl }),
    ...(point === null ? {} : { latitude: point.latitude, longitude: point.longitude }),
    category: form.category,
  };
}
