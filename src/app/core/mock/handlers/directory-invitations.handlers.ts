import { STATUS } from '../fixtures/concepts';
import { notFound, unauthorized, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_NAMES } from '../mock-session';
import { ROL_TENANT, membresias, tenants } from './directory.handlers';

/* ============================================================================
    Las **invitaciones de organizaciones**, con la forma de la API
    (`directory/dto/membership-invitation.dto.ts`):

    - `POST /tenants/:id/memberships` deja la membresía **pendiente de aceptación** (en `directory.handlers.ts`);
    - `GET /tenants/me/membership-invitations` → `{ items: [{ id, tenantId, tenantName, role, invitedAt }] }`;
    - `POST /tenants/me/membership-invitations/:membershipId/accept` → `{ id, tenantId, status: 'ACTIVE' }` y
      `…/decline` → `{ …, status: 'DECLINED' }`. Aceptar o rechazar una ajena, o una que ya no está pendiente, es 404
      **igual** que si no existiera;
    - `POST /tenants/:id/memberships/:membershipId/offboard` → `{ ok: true }`: la organización retira una invitación
      pendiente antes de que la acepten (o da de baja a un miembro).

    Un rechazo termina la membresía (`ST-INACTIVE`) y el simulador no la vuelve a mostrar.
   ========================================================================== */

const PENDIENTE = STATUS['DIR_MEMBERSHIP_PENDING_ACCEPTANCE']!;

const CODIGO_DE_ROL: Readonly<Record<string, 'OWNER' | 'ADMIN' | 'STAFF'>> = {
  [ROL_TENANT.OWNER]: 'OWNER',
  [ROL_TENANT.ADMIN]: 'ADMIN',
  [ROL_TENANT.STAFF]: 'STAFF',
};

export function registrarInvitacionesDeOrganizacion(router: MockRouter): void {
  router.get('/tenants/me/membership-invitations', ({ user }) => {
    if (user === null) return unauthorized('Sesión vencida');
    const items = membresias
      .filtrar((m) => m.userId === user.id && m.statusConceptId === PENDIENTE)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        tenantName: tenants.get(m.tenantId)?.tradeName ?? TENANT_NAMES[m.tenantId] ?? 'Organización',
        role: CODIGO_DE_ROL[m.tenantRoleConceptId] ?? 'OTHER',
        invitedAt: m.createdAt,
      }));
    return { items };
  });

  const decidir = (aceptar: boolean) => (request: MockRequest) => {
    const user = request.user;
    if (user === null) return unauthorized('Sesión vencida');
    const fila = membresias.get(request.params['membershipId']!);
    // El mismo 404 si no existe, es de otra persona o ya no está pendiente: no se confirma nada.
    if (fila === undefined || fila.userId !== user.id || fila.statusConceptId !== PENDIENTE) return notFound('Invitación no encontrada');
    membresias.actualizar(fila.id, aceptar ? { statusConceptId: STATUS['ST-ACTIVE']!, startDate: new Date().toISOString().slice(0, 10) } : { statusConceptId: STATUS['ST-INACTIVE']! });
    return { id: fila.id, tenantId: fila.tenantId, status: aceptar ? 'ACTIVE' : 'DECLINED' };
  };
  router.post('/tenants/me/membership-invitations/:membershipId/accept', decidir(true));
  router.post('/tenants/me/membership-invitations/:membershipId/decline', decidir(false));

  /** La organización retira una invitación que nadie aceptó todavía. */
  router.post('/tenants/:id/memberships/:membershipId/offboard', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const fila = membresias.get(request.params['membershipId']!);
    if (fila === undefined || fila.tenantId !== request.params['id'] || fila.statusConceptId === STATUS['ST-INACTIVE']) return notFound('Membresía no encontrada');
    membresias.actualizar(fila.id, { statusConceptId: STATUS['ST-INACTIVE']!, endDate: new Date().toISOString().slice(0, 10) });
    return { ok: true };
  });
}
