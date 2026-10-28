import { medicalFacilityIssues } from '../../data-access/iam/medical-facility.rules';
import { preconditionFailed, reply, type MockReply } from '../mock-router';

/**
 * Los cinco tipos de organización médica, los únicos para los que el bloque
 * `organization.medicalFacility` tiene sentido (contrato del 28/10/2026).
 */
export const MEDICAL_TENANT_TYPES: readonly string[] = [
  'HOSPITAL',
  'CLINIC',
  'MEDICAL_OFFICE',
  'NURSING',
  'HEALTH_OTHER',
];

/**
 * Lo que el simulador responde al bloque `medicalFacility` de
 * `POST /iam/auth/register-organization`, igual que la API:
 *
 * - con cualquier `tenantType` que no sea médico es un **422** de negocio;
 * - la forma —NIT, número de registro, director médico, direcciones y
 *   coordenadas— se valida como el `ValidationPipe`, con un **400**.
 *
 * Devuelve `null` si el bloque no viene o es válido: el alta sigue su camino.
 */
export function medicalFacilityRejection(organization: {
  readonly tenantType?: string;
  readonly medicalFacility?: unknown;
}): MockReply | null {
  if (organization.medicalFacility === undefined) return null;
  if (!MEDICAL_TENANT_TYPES.includes(organization.tenantType ?? 'PAYER')) {
    return preconditionFailed(
      'El bloque medicalFacility sólo corresponde a una organización médica',
      { tenantType: organization.tenantType ?? null },
    );
  }
  const messages = medicalFacilityIssues(organization.medicalFacility);
  if (messages.length === 0) return null;
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    error: 'Bad Request',
    details: { messages },
  });
}
