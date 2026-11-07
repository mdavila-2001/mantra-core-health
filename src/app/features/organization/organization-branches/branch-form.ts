import { branchCategoryOf } from '../../../core/data-access/directory/branch-category';
import type {
  BranchChanges,
  BranchListItem,
  NewBranch,
} from '../../../core/data-access/directory/directory.types';
import {
  branchCodeFromName,
  type BranchCoordinates,
} from '../../../shared/utils/branch-import/branch-import';

import type { BranchForm } from './organization-branches.types';

/** The dialog's fields for an existing branch. */
export function formOfBranch(branch: BranchListItem): BranchForm {
  return {
    name: branch.name,
    code: branch.code,
    description: branch.description ?? '',
    locationUrl: branch.locationUrl ?? '',
    category: branchCategoryOf(branch),
  };
}

/** The point a stored branch already has, or `null`. */
export function pointOfBranch(branch: BranchListItem): BranchCoordinates | null {
  return branch.latitude != null && branch.longitude != null
    ? { latitude: branch.latitude, longitude: branch.longitude }
    : null;
}

/**
 * Body of `PATCH /tenants/{id}/branches/{branchId}`: only what changed, since a
 * missing key leaves the value as is. `point` is what the map or the link gave;
 * a point that is gone is cleared, or the pin would mark another place.
 */
export function branchChanges(
  form: BranchForm,
  branch: BranchListItem,
  point: BranchCoordinates | null,
): BranchChanges {
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
  }
  const before = pointOfBranch(branch);
  if (point?.latitude !== before?.latitude || point?.longitude !== before?.longitude) {
    changes.latitude = point?.latitude ?? null;
    changes.longitude = point?.longitude ?? null;
  }
  return changes;
}

/**
 * Body of `POST /tenants/{id}/branches`. Without a typed code, one is derived
 * from the name without repeating any of `takenCodes`.
 */
export function newBranchFrom(
  form: BranchForm,
  takenCodes: readonly string[],
  point: BranchCoordinates | null,
): NewBranch {
  const name = form.name.trim();
  const typed = form.code.trim();
  const code = typed === '' ? branchCodeFromName(name, new Set(takenCodes)) : typed;
  const description = form.description.trim();
  const locationUrl = form.locationUrl.trim();
  return {
    code,
    name,
    ...(description === '' ? {} : { description }),
    ...(locationUrl === '' ? {} : { locationUrl }),
    ...(point === null ? {} : { latitude: point.latitude, longitude: point.longitude }),
    category: form.category,
  };
}
