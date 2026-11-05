import type { LaboratoryOrganizationRegistration } from './iam.types';

/**
 * The laboratory sign-up body (`tenantType: 'DIAGNOSTIC_CENTER'` with
 * `diagnosticUnit`). Field by field, like the rest of the client:
 * `forbidNonWhitelisted` rejects every key the DTO does not declare. Each
 * branch carries its own opening hours; the headquarters' go in
 * `organization.openingHours`.
 */
export function laboratoryBody(registration: LaboratoryOrganizationRegistration): unknown {
  const { diagnosticUnit } = registration;
  const { address } = diagnosticUnit.primarySite;
  return {
    organization: {
      code: registration.code,
      legalName: registration.legalName,
      ...(registration.tradeName === undefined ? {} : { tradeName: registration.tradeName }),
      legalEntityType: registration.legalEntityType,
      tenantType: 'DIAGNOSTIC_CENTER',
      taxIdentifier: registration.taxIdentifier,
      countryConceptId: registration.countryConceptId,
      jurisdictionConceptId: registration.jurisdictionConceptId,
      diagnosticUnit: {
        name: diagnosticUnit.name,
        diagnosticUnitTypeConceptId: diagnosticUnit.diagnosticUnitTypeConceptId,
        modalityConceptIds: [...diagnosticUnit.modalityConceptIds],
        primarySite: {
          name: diagnosticUnit.primarySite.name,
          address: {
            lines: [...address.lines],
            ...(address.latitude === undefined || address.longitude === undefined
              ? {}
              : { latitude: address.latitude, longitude: address.longitude }),
          },
        },
        ...(diagnosticUnit.branches === undefined || diagnosticUnit.branches.length === 0
          ? {}
          : {
              branches: diagnosticUnit.branches.map((branch) => ({
                name: branch.name,
                address: {
                  lines: [...branch.addressLines],
                  ...(branch.location === undefined
                    ? {}
                    : { latitude: branch.location.latitude, longitude: branch.location.longitude }),
                },
                ...(branch.description === undefined ? {} : { description: branch.description }),
                ...(branch.locationUrl === undefined ? {} : { locationUrl: branch.locationUrl }),
                ...(branch.openingHours === undefined ? {} : { openingHours: branch.openingHours }),
              })),
            }),
      },
      legalRepresentative: {
        fullName: registration.legalRepresentative.fullName,
        idNumber: registration.legalRepresentative.idNumber,
        email: registration.legalRepresentative.email,
        ...(registration.legalRepresentative.powerOfAttorneyFileId === undefined
          ? {}
          : { powerOfAttorneyFileId: registration.legalRepresentative.powerOfAttorneyFileId }),
      },
      ...(registration.legalDocuments === undefined
        ? {}
        : { legalDocuments: registration.legalDocuments }),
      ...(registration.executives === undefined ? {} : { executives: registration.executives }),
      ...(registration.openingHours === undefined
        ? {}
        : { openingHours: registration.openingHours }),
    },
    owner: {
      email: registration.owner.email,
      password: registration.owner.password,
      displayName: registration.owner.displayName,
    },
  };
}
