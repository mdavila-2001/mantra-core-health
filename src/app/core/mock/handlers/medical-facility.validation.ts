import { isMedicalOrganizationType } from '../../data-access/directory/directory.types';
import { medicalFacilityIssues } from '../../data-access/iam/medical-facility.rules';
import { preconditionFailed, reply, type MockReply } from '../mock-router';

/**
 * Lo que el simulador responde al bloque `medicalFacility` de
 * `POST /iam/auth/register-organization`, igual que la API:
 *
 * - la forma —NIT, número de registro, director médico, direcciones y
 *   coordenadas— se valida como el `ValidationPipe`, con un **400**;
 * - con un cuerpo bien formado y un `tenantType` que no es médico es un **422**
 *   de negocio. El 400 va primero, como en la API.
 *
 * Devuelve `null` si el bloque no viene o es válido: el alta sigue su camino.
 */
export function medicalFacilityRejection(organization: {
  readonly tenantType?: string;
  readonly medicalFacility?: unknown;
}): MockReply | null {
  if (organization.medicalFacility === undefined) return null;
  // Primero la forma (400) y después el negocio (422): el `ValidationPipe` global
  // corre antes que el servicio, así que un cuerpo mal formado nunca llega a
  // preguntar si el tipo de organización admite el bloque.
  const messages = medicalFacilityIssues(organization.medicalFacility);
  if (messages.length > 0) {
    return reply(400, {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      error: 'Bad Request',
      details: { messages },
    });
  }
  if (!isMedicalOrganizationType(organization.tenantType ?? 'PAYER')) {
    return preconditionFailed(
      'El bloque medicalFacility sólo corresponde a una organización médica',
      { tenantType: organization.tenantType ?? null },
    );
  }
  return null;
}
