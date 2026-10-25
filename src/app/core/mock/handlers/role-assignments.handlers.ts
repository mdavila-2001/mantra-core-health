import {
  affiliations,
  changeStatus,
  createAffiliation,
  toRow,
  PUBLISHED_PROCEDURES,
  CM_SITES,
  type StatusCode,
} from '../fixtures/role-assignments';
import { conflict, forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo, texto } from '../mock-store';

/* ============================================================================
    Afiliación médico-centro por procedimiento (CM-07). Ninguna row llega a
    «activa» sin que actúe la other parte: el médico acepta lo que el centro
    invitó, y el centro aprueba lo que el médico pidió. Una row por acción.
    ========================================================================== */

/** Pasa la fila a `destino` solo si hoy está en `desde`; si no, 409. */
function transition(id: string, from: StatusCode, to: StatusCode, owner?: string) {
  const current = affiliations.get(id);
  if (current === undefined) return notFound('Afiliación no encontrada');
  if (owner !== undefined && current.practitionerProfileId !== owner) return forbidden();
  if (current.statusCode !== from) {
    return conflict(`Solo se puede pasar a ${to} una afiliación en ${from}; esta está en ${current.statusCode}`);
  }
  return toRow(changeStatus(id, to)!);
}

function practitionerOf(request: MockRequest): string | undefined {
  return request.user?.practitionerProfileId;
}

export function registerRoleAssignments(router: MockRouter): void {
  router.get('/practices/:practiceId/role-assignments', ({ params }) =>
    affiliations.filtrar((f) => f.practiceId === params['practiceId']).map(toRow),
  );

  router.post('/practices/:practiceId/role-assignments/invitations', (request) => {
    const practiceId = request.params['practiceId']!;
    const datos = cuerpo<{ practitionerProfileId: string; practiceSiteId: string; healthcareServiceIds: string[] }>(request);
    const ids = datos.healthcareServiceIds ?? [];
    if (datos.practitionerProfileId === undefined || datos.practiceSiteId === undefined || ids.length === 0) {
      return validation('Faltan el médico, la sede o los procedimientos');
    }
    const duplicate = ids.find((serviceId) =>
      affiliations.filtrar((f) => f.practitionerProfileId === datos.practitionerProfileId && f.healthcareServiceId === serviceId && ['ROLE_ASG_INVITED', 'ROLE_ASG_PENDING', 'ROLE_ASG_ACTIVE'].includes(f.statusCode)).length > 0,
    );
    if (duplicate !== undefined) return conflict('El médico ya tiene una afiliación vigente para ese procedimiento');
    const published = PUBLISHED_PROCEDURES.filter((p) => p.active && p.practiceId === practiceId && p.practiceSiteId === datos.practiceSiteId);
    if (!ids.every((serviceId) => published.some((p) => p.id === serviceId))) return validation('Solo se puede invitar a procedimientos que la sede publica');
    const rows = ids.map((serviceId) => createAffiliation(practiceId, datos.practiceSiteId!, serviceId, datos.practitionerProfileId!, 'ROLE_ASG_INVITED', 'PRACTICE')!);
    return { status: 201, body: { items: rows.map(toRow) } };
  });

  router.post('/practitioners/me/role-assignments/:roleId/accept', (request) =>
    transition(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_ACTIVE', practitionerOf(request)),
  );
  router.post('/practitioners/me/role-assignments/:roleId/decline', (request) =>
    transition(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_REJECTED', practitionerOf(request)),
  );
  router.post('/role-assignments/:roleId/approve', ({ params }) => transition(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_ACTIVE'));
  router.post('/role-assignments/:roleId/reject', ({ params }) => transition(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_REJECTED'));

  router.get('/practices/:practiceId/sites', ({ params }) => {
    const items = CM_SITES.filter((site) => site.practiceId === params['practiceId']);
    return { items, count: items.length };
  });

  // Mismo contrato que publica CM-06; acá solo lo que las casillas necesitan leer.
  router.get('/practices/:practiceId/healthcare-services', ({ params, query }) => {
    const site = texto(query, 'practiceSiteId');
    return { items: PUBLISHED_PROCEDURES.filter((p) => p.practiceId === params['practiceId'] && (site === null || p.practiceSiteId === site)) };
  });
}
