import { recursos } from '../fixtures/agenda';
import { STATUS } from '../fixtures/concepts';
import { forbidden, notFound, type MockRouter } from '../mock-router';
import { Coleccion, cuerpo, texto } from '../mock-store';

/* Mock of v4.2.88: whether each agenda's booking requests wait for the
   practitioner. The choice survives an F5 (`sessionStorage`) so "save, reload,
   still there" can be checked; resources themselves stay read-only fixtures. */
const approvalByResource = new Coleccion<{
  readonly id: string;
  readonly requiresApproval: boolean;
}>([], 'mock.agenda.requires-approval');

/** Like the API: every agenda requires approval until its practitioner says otherwise. */
export function requiresApproval(resourceId: string): boolean {
  return approvalByResource.get(resourceId)?.requiresApproval ?? true;
}

export function registerBookingApproval(router: MockRouter): void {
  router.get('/scheduling/my-resources', (request) => {
    const tenantId = texto(request.query, 'tenantId');
    const profileId = request.user?.practitionerProfileId;
    const items = recursos
      .filtrar(
        (r) =>
          profileId !== undefined &&
          r.resourceRefId === profileId &&
          r.tenantId === tenantId &&
          r.stateConceptId === STATUS['ST-ACTIVE'],
      )
      .map((r) => ({ id: r.id, name: r.name, requiresApproval: requiresApproval(r.id) }));
    return { items };
  });

  // Same rule as the API: the practitioner edits their own agenda, scheduling
  // admins edit any, anybody else gets 403. Omitted fields are kept.
  router.patch('/scheduling/resources/:id', (request) => {
    const resource = recursos.get(request.params['id'] ?? '');
    if (resource === undefined) return notFound('Recurso no encontrado');
    const isAdmin = (request.user?.roles ?? []).some(
      (r) => r === 'SCHEDULING_ADMIN' || r === 'SUPERADMIN',
    );
    if (!isAdmin && request.user?.practitionerProfileId !== resource.resourceRefId) {
      return forbidden(
        'Esta agenda es de otro profesional: solo la administra quien atiende en ella.',
      );
    }
    const body = cuerpo<{ requiresApproval?: boolean }>(request);
    if (body.requiresApproval !== undefined) {
      approvalByResource.agregar({ id: resource.id, requiresApproval: body.requiresApproval });
    }
    return {
      id: resource.id,
      name: resource.name,
      requiresApproval: requiresApproval(resource.id),
    };
  });
}
