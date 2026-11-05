import type {
  DiagnosticUnitBranchRegistration,
  PharmacyBranchRegistration,
} from '../../../../core/data-access/iam/organization-branches.types';
import type { Coordinates } from '../map-location-picker/map-location-picker';
import { branchShifts, type RegistrationHours } from './opening-hours';

/** A branch row as the pharmacy and laboratory sign-ups keep it. */
export interface BranchDraftRow {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly descripcion: string;
  readonly urlUbicacion: string;
  readonly gps: Coordinates | null;
}

const optional = (row: BranchDraftRow) => ({
  ...(row.descripcion.trim() === '' ? {} : { description: row.descripcion.trim() }),
  ...(row.urlUbicacion === '' ? {} : { locationUrl: row.urlUbicacion }),
});

/** Pharmacy branches: named and placed on the map, each with its hours. */
export function pharmacyBranches(
  rows: readonly BranchDraftRow[],
  hours: RegistrationHours,
): PharmacyBranchRegistration[] {
  return rows.flatMap((row) =>
    row.nombre.trim() === '' || row.gps === null
      ? []
      : [
          {
            name: row.nombre.trim(),
            latitude: row.gps.lat,
            longitude: row.gps.lng,
            ...optional(row),
            openingHours: branchShifts(hours, row.id),
          },
        ],
  );
}

/** Laboratory branches: a nameless row does not travel yet. */
export function laboratoryBranches(
  rows: readonly BranchDraftRow[],
  hours: RegistrationHours,
): DiagnosticUnitBranchRegistration[] {
  return rows
    .filter((row) => row.nombre.trim() !== '')
    .map((row) => ({
      name: row.nombre.trim(),
      addressLines: row.direccion.trim() === '' ? [] : [row.direccion.trim()],
      ...(row.gps === null ? {} : { location: { latitude: row.gps.lat, longitude: row.gps.lng } }),
      ...optional(row),
      openingHours: branchShifts(hours, row.id),
    }));
}
