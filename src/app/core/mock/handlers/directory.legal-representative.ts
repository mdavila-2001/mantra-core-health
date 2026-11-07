import { cuerpo } from '../mock-store';
import { forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';

/** The corrected name parts by tenant, over the registration data (it survives a reload of the tab). */
const corrected = new Map<string, Record<string, string>>();

/** The registration sheet of a tenant with its legal representative's corrected name applied. */
export function withCorrectedRepresentative(
  id: string,
  sheets: Readonly<Record<string, object>>,
): object {
  const sheet = sheets[id] ?? {};
  const change = corrected.get(id);
  const current = (sheet as { legalRepresentative?: object }).legalRepresentative;
  return change && current ? { ...sheet, legalRepresentative: { ...current, ...change } } : sheet;
}

/** `PATCH /tenants/:id/representatives/LEGAL_REPRESENTATIVE/name`, as the API answers it: administrators only. */
export function registerLegalRepresentative(
  router: MockRouter,
  canAdminister: (tenantId: string, request: MockRequest) => boolean | undefined,
): void {
  router.patch('/tenants/:id/representatives/LEGAL_REPRESENTATIVE/name', (request) => {
    const id = request.params['id']!;
    const body = cuerpo<{ name: string; middleName: string; lastName: string; motherLastName: string }>(request);
    if (!body.name?.trim() || !body.lastName?.trim()) {
      return validation('Falta el nombre o el apellido paterno');
    }
    if (canAdminister(id, request) === undefined) return notFound('Organización no encontrada');
    if (canAdminister(id, request) !== true) return forbidden('Se requiere ser OWNER o ADMIN de la organización');
    const parts = [body.name, body.middleName, body.lastName, body.motherLastName]
      .map((p) => p?.trim() ?? '')
      .filter(Boolean);
    corrected.set(id, { ...body, fullName: parts.join(' ') } as Record<string, string>);
    return { fullName: parts.join(' ') };
  });
}
