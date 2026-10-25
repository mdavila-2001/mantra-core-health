import {
  afiliaciones,
  cambiarEstado,
  crearAfiliacion,
  filaDeAfiliacion,
  PROCEDIMIENTOS_PUBLICADOS,
  SEDES_CM,
  type CodigoDeEstado,
} from '../fixtures/role-assignments';
import { conflict, forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo, texto } from '../mock-store';

/* ============================================================================
    Afiliación médico-centro por procedimiento (CM-07). Ninguna fila llega a
    «activa» sin que actúe la otra parte: el médico acepta lo que el centro
    invitó, y el centro aprueba lo que el médico pidió. Una fila por acción.
    ========================================================================== */

/** Pasa la fila a `destino` solo si hoy está en `desde`; si no, 409. */
function transicion(id: string, desde: CodigoDeEstado, destino: CodigoDeEstado, dueno?: string) {
  const actual = afiliaciones.get(id);
  if (actual === undefined) return notFound('Afiliación no encontrada');
  if (dueno !== undefined && actual.practitionerProfileId !== dueno) return forbidden();
  if (actual.statusCode !== desde) {
    return conflict(`Solo se puede pasar a ${destino} una afiliación en ${desde}; esta está en ${actual.statusCode}`);
  }
  return filaDeAfiliacion(cambiarEstado(id, destino)!);
}

function delMedico(request: MockRequest): string | undefined {
  return request.user?.practitionerProfileId;
}

export function registerRoleAssignments(router: MockRouter): void {
  router.get('/practices/:practiceId/role-assignments', ({ params }) =>
    afiliaciones.filtrar((f) => f.practiceId === params['practiceId']).map(filaDeAfiliacion),
  );

  router.post('/practices/:practiceId/role-assignments/invitations', (request) => {
    const practiceId = request.params['practiceId']!;
    const datos = cuerpo<{ practitionerProfileId: string; practiceSiteId: string; healthcareServiceIds: string[] }>(request);
    const ids = datos.healthcareServiceIds ?? [];
    if (datos.practitionerProfileId === undefined || datos.practiceSiteId === undefined || ids.length === 0) {
      return validation('Faltan el médico, la sede o los procedimientos');
    }
    const repetido = ids.find((idServicio) =>
      afiliaciones.filtrar((f) => f.practitionerProfileId === datos.practitionerProfileId && f.healthcareServiceId === idServicio && ['ROLE_ASG_INVITED', 'ROLE_ASG_PENDING', 'ROLE_ASG_ACTIVE'].includes(f.statusCode)).length > 0,
    );
    if (repetido !== undefined) return conflict('El médico ya tiene una afiliación vigente para ese procedimiento');
    const publicados = PROCEDIMIENTOS_PUBLICADOS.filter((p) => p.active && p.practiceId === practiceId && p.practiceSiteId === datos.practiceSiteId);
    if (!ids.every((idServicio) => publicados.some((p) => p.id === idServicio))) return validation('Solo se puede invitar a procedimientos que la sede publica');
    const filas = ids.map((idServicio) => crearAfiliacion(practiceId, datos.practiceSiteId!, idServicio, datos.practitionerProfileId!, 'ROLE_ASG_INVITED', 'PRACTICE')!);
    return { status: 201, body: { items: filas.map(filaDeAfiliacion) } };
  });

  router.post('/practitioners/me/role-assignments/:roleId/accept', (request) =>
    transicion(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_ACTIVE', delMedico(request)),
  );
  router.post('/practitioners/me/role-assignments/:roleId/decline', (request) =>
    transicion(request.params['roleId']!, 'ROLE_ASG_INVITED', 'ROLE_ASG_REJECTED', delMedico(request)),
  );
  router.post('/role-assignments/:roleId/approve', ({ params }) => transicion(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_ACTIVE'));
  router.post('/role-assignments/:roleId/reject', ({ params }) => transicion(params['roleId']!, 'ROLE_ASG_PENDING', 'ROLE_ASG_REJECTED'));

  router.get('/practices/:practiceId/sites', ({ params }) => {
    const items = SEDES_CM.filter((sede) => sede.practiceId === params['practiceId']);
    return { items, count: items.length };
  });

  // Mismo contrato que publica CM-06; acá solo lo que las casillas necesitan leer.
  router.get('/practices/:practiceId/healthcare-services', ({ params, query }) => {
    const sede = texto(query, 'practiceSiteId');
    return { items: PROCEDIMIENTOS_PUBLICADOS.filter((p) => p.practiceId === params['practiceId'] && (sede === null || p.practiceSiteId === sede)) };
  });
}
