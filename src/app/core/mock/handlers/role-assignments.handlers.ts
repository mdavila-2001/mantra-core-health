import {
  affiliations,
  changeStatus,
  createAffiliation,
  publishedOffer,
  toRow,
  useOfferLookup,
  type StatusCode,
} from '../fixtures/role-assignments';
import { offers } from './healthcare-services.handlers';
import { conflict, forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo } from '../mock-store';
import { terminarVinculacionPropia } from './practice.handlers';

/* ============================================================================
    Afiliación médico-centro por procedimiento (CM-07). Ninguna fila llega a
    «activa» sin que actúe la otra parte: el médico acepta lo que el centro
    invitó, y el centro aprueba lo que el médico pidió. Una fila por acción.
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

/**
 * Retirarse / salir de la fila: la lista del médico mezcla dos colecciones, así
 * que se prueba primero la de sus vinculaciones propias y después `affiliations`.
 */
function terminar(request: MockRequest, desde: 'ACTIVE' | 'PENDING', desdeConcepto: StatusCode) {
  const id = request.params['roleId']!;
  const propia = terminarVinculacionPropia(id, desde, practitionerOf(request));
  if (propia === 'terminada') return { id, status: 'ROLE_ASG_ENDED' };
  if (propia === 'otra-persona') return forbidden();
  if (propia === 'estado') return conflict(`Solo se puede terminar una vinculación en ${desde}`);
  return transition(id, desdeConcepto, 'ROLE_ASG_ENDED', practitionerOf(request));
}

function practitionerOf(request: MockRequest): string | undefined {
  return request.user?.practitionerProfileId;
}

export function registerRoleAssignments(router: MockRouter): void {
  // Los procedimientos publicados son los del doble de CM-06; las sedes y el catálogo los sirve él.
  useOfferLookup((id) => offers.get(id));

  // Con la forma real de la API: una página `{ items, count, limit, nextCursor }`.
  router.get('/practices/:practiceId/role-assignments', ({ params }) => {
    const items = affiliations.filtrar((f) => f.practiceId === params['practiceId']).map(toRow);
    return { items, count: items.length, limit: items.length, nextCursor: null };
  });

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
    if (!ids.every((serviceId) => publishedOffer(practiceId, datos.practiceSiteId!, serviceId) !== undefined)) return validation('Solo se puede invitar a procedimientos que la sede publica');
    const rows = ids.map((serviceId) => createAffiliation(practiceId, datos.practiceSiteId!, serviceId, datos.practitionerProfileId!, 'ROLE_ASG_INVITED', 'PRACTICE')!);
    return { status: 201, body: { items: rows.map(toRow) } };
  });

  router.post('/practitioners/me/role-assignments/:roleId/accept', (request) =>
    transition(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_ACTIVE', practitionerOf(request)),
  );
  router.post('/practitioners/me/role-assignments/:roleId/decline', (request) =>
    transition(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_REJECTED', practitionerOf(request)),
  );
  router.post('/practitioners/me/role-assignments/:roleId/withdraw', (request) =>
    terminar(request, 'ACTIVE', 'ROLE_ASG_ACTIVE'),
  );
  router.post('/practitioners/me/role-assignments/:roleId/leave-queue', (request) =>
    terminar(request, 'PENDING', 'ROLE_ASG_PENDING'),
  );
  router.post('/role-assignments/:roleId/approve', ({ params }) => transition(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_ACTIVE'));
  router.post('/role-assignments/:roleId/reject', ({ params }) => transition(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_REJECTED'));
}
