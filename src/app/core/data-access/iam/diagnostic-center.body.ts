import type { DiagnosticCenterRegistration } from './iam.types';

/**
 * El cuerpo del alta de un laboratorio o centro de imagenología.
 *
 * Campo por campo y no con un `...registration`, por lo mismo que el resto del
 * cliente: `forbidNonWhitelisted` rechaza toda clave que el DTO no declare.
 */
export function cuerpoDeCentroDiagnostico(registration: DiagnosticCenterRegistration): unknown {
  const { diagnosticUnit } = registration;
  const { address } = diagnosticUnit.primarySite;
  return {
    organization: {
      code: registration.code,
      legalName: registration.legalName,
      legalEntityType: registration.legalEntityType,
      ...(registration.tradeName === undefined ? {} : { tradeName: registration.tradeName }),
      tenantType: 'DIAGNOSTIC_CENTER',
      ...(registration.timeZone === undefined ? {} : { timeZone: registration.timeZone }),
      countryConceptId: registration.countryConceptId,
      jurisdictionConceptId: registration.jurisdictionConceptId,
      diagnosticUnit: {
        diagnosticUnitTypeConceptId: diagnosticUnit.diagnosticUnitTypeConceptId,
        modalityConceptIds: [...diagnosticUnit.modalityConceptIds],
        primarySite: {
          name: diagnosticUnit.primarySite.name,
          ...(diagnosticUnit.primarySite.timeZone === undefined
            ? {}
            : { timeZone: diagnosticUnit.primarySite.timeZone }),
          address: {
            lines: [...address.lines],
            ...(address.latitude === undefined || address.longitude === undefined
              ? {}
              : { latitude: address.latitude, longitude: address.longitude }),
          },
        },
      },
      legalDocuments: registration.legalDocuments,
      ...(registration.legalRepresentative === undefined
        ? {}
        : { legalRepresentative: registration.legalRepresentative }),
      ...(registration.executives === undefined ? {} : { executives: registration.executives }),
    },
    owner: {
      email: registration.owner.email,
      password: registration.owner.password,
      displayName: registration.owner.displayName,
    },
  };
}
