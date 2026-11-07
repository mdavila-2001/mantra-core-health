import { branchCategoryOf } from '../../../core/data-access/directory/branch-category';
import type { BranchListItem } from '../../../core/data-access/directory/directory.types';

/** The practice and first site the registration already declared, ready to be created. */
export interface RegisteredSite {
  readonly practiceName: string;
  readonly siteName: string;
  readonly addressText: string;
  readonly latitude: number;
  readonly longitude: number;
}

const MAX_NAME = 200;
const MAX_ADDRESS = 500;

/**
 * The first site from what the registration left in `directory.branches`: the head office, or the
 * first site with a point. `null` unless it has a name, an address (the description) and a point,
 * so a half-filled site never skips the form.
 */
export function registeredSiteOf(
  organizationName: string | undefined,
  branches: readonly BranchListItem[],
): RegisteredSite | null {
  const located = branches.filter((b) => b.latitude != null && b.longitude != null);
  const site = located.find((b) => branchCategoryOf(b) === 'head_office') ?? located[0];
  const practiceName = (organizationName ?? '').trim();
  const addressText = site?.description?.trim() ?? '';
  if (
    site === undefined ||
    practiceName.length < 2 ||
    site.name.trim().length < 2 ||
    addressText.length < 2
  ) {
    return null;
  }
  return {
    practiceName: practiceName.slice(0, MAX_NAME),
    siteName: site.name.trim().slice(0, MAX_NAME),
    addressText: addressText.slice(0, MAX_ADDRESS),
    latitude: site.latitude!,
    longitude: site.longitude!,
  };
}
