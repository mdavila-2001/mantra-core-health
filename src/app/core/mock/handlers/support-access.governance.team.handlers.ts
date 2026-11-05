import { atomMeta, SUPPORT_ATOMS } from '../../data-access/support-access/support-atoms';
import { TECHO_POR_OMISION } from '../fixtures/support-hospital-governance';
import { invitaciones, permisos, solicitudes, vinculos } from '../fixtures/support-hospital';
import type { FilaPermiso, FilaVinculo } from '../fixtures/support-hospital.types';
import { type MockReply, type MockRouter, reply, validation } from '../mock-router';
import { cuerpo, nuevoId, iso, ahora } from '../mock-store';
import {
  accionesValidas,
  anotar,
  codigoDeInvitacion,
  otorgar,
  soloObjetivo,
  vistaSolicitud,
} from './support-access.core';
import { conMotivo } from './support-access.errors';
import {
  type ActorDeGobierno,
  administradorOConAtomo,
  esActor,
  exigirPasoExtra,
  lista,
  nombreDe,
  noEncontrado,
} from './support-access.governance.core';
import {
  darDeBaja,
  reactivar,
  suspender,
  vistaTraspaso,
} from './support-access.governance.lifecycle.handlers';
import { atomosDe } from './support-access.governance.view';
import { permisosDelActor } from './support-access.governance.team.scope';

/* ============================================================================
    Administración delegada, `/org/team/*` (CONTRATO-GOBIERNO §6.4, §8.3 E): el jefe de servicio o de piso administra
    **a su gente dentro de su techo**. El administrador de seguridad pasa con modo `FULL`.

    El alcance se decide por la concesión del administrador (`SERVICE` o `LOCATION`) y su `delegationCeiling`. El mock no
    es la política: aplica solo lo que cambia lo que la pantalla muestra (404 uniforme, `otherFunctions`, 403 de techo y de alcance).
   ========================================================================== */

const DIA_MS = 86_400_000;
const patron = (pat: string, atomo: string): boolean =>
  pat.endsWith('.*') ? atomo.startsWith(pat.slice(0, -1)) : pat === atomo;

const sinAlcance = (): MockReply =>
  conMotivo(
    403,
    'Esa persona o ese permiso está fuera de lo que usted administra.',
    'ADMIN_SCOPE_EXCEEDED',
  );

/** Los permisos de un vínculo que caen dentro del alcance de quien administra (todos si es el administrador). */
function dentro(actor: ActorDeGobierno, v: FilaVinculo): { dentro: FilaPermiso[]; fuera: number } {
  const todos = permisos.filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE');
  if (actor.esAdmin) return { dentro: todos, fuera: 0 };
  const mios = permisosDelActor(actor.user.id, actor.tenantId);
  const propios = todos.filter((p) => mios.some((m) => m.cubre(p)));
  return { dentro: propios, fuera: todos.length - propios.length };
}

function miembroAdministrable(
  request: Parameters<MockRouter['get']>[1] extends (r: infer R) => unknown ? R : never,
  ...atomos: string[]
): { actor: ActorDeGobierno; v: FilaVinculo; vista: ReturnType<typeof dentro> } | MockReply {
  const actor = administradorOConAtomo(request, ...atomos);
  if (!esActor(actor)) return actor;
  const v = vinculos.get(request.params['id']!);
  if (v === undefined || v.tenantId !== actor.tenantId)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  const vista = dentro(actor, v);
  if (!actor.esAdmin && vista.dentro.length === 0)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  return { actor, v, vista };
}
const esFallo = (valor: unknown): valor is MockReply =>
  typeof valor === 'object' && valor !== null && 'status' in valor && 'body' in valor;

export function registrarGobiernoEquipo(router: MockRouter): void {
  router.get('/org/team/capabilities', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    if (actor.esAdmin)
      return { mode: 'FULL', atoms: SUPPORT_ATOMS.map((a) => a.code), assignScopes: [] };
    return {
      mode: 'DELEGATED',
      atoms: [...actor.atomos].filter((a) => a.startsWith('team.') || a.startsWith('audit.')),
      assignScopes: permisosDelActor(actor.user.id, actor.tenantId).map((m) => ({
        target: m.objetivo,
        ceiling: { ...TECHO_POR_OMISION },
      })),
    };
  });

  router.get('/org/team/members', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    const items = vinculos
      .filtrar((v) => v.tenantId === actor.tenantId && v.userId !== actor.user.id)
      .flatMap((v) => {
        const vista = dentro(actor, v);
        if (!actor.esAdmin && vista.dentro.length === 0) return [];
        return [
          {
            engagementId: v.id,
            userId: v.userId,
            personName: v.personName,
            roleTemplateCode: v.roleTemplate,
            status: v.status,
            grants: vista.dentro.map(vistaDeGrant),
            otherFunctions: vista.fuera,
          },
        ];
      });
    return lista(items);
  });

  router.get('/org/team/members/:id', (request) => {
    const m = miembroAdministrable(request, 'team.members.view');
    if (esFallo(m)) return m;
    return {
      engagementId: m.v.id,
      userId: m.v.userId,
      personName: m.v.personName,
      roleTemplateCode: m.v.roleTemplate,
      status: m.v.status,
      grants: m.vista.dentro.map(vistaDeGrant),
      otherFunctions: m.vista.fuera,
    };
  });

  router.post('/org/team/members/:id/grants', (request) => {
    const m = miembroAdministrable(request, 'team.grants.assign');
    if (esFallo(m)) return m;
    const { actor, v } = m;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const d = cuerpo<{
      actions?: string[];
      targetKind?: string;
      healthcareServiceId?: string;
      careSpaceId?: string;
      practitionerRoleAssignmentId?: string;
      validTo?: string;
      effect?: string;
      condition?: Record<string, unknown>;
    }>(request);
    if (!Array.isArray(d.actions) || d.actions.length === 0)
      return validation('El permiso necesita al menos una acción.', [
        { field: 'actions', message: 'elija al menos una acción' },
      ]);
    if (!actor.esAdmin) {
      if (v.userId === actor.user.id)
        return conMotivo(403, 'No puede darse permisos a usted mismo.', 'GUARDRAIL_SELF_ADMIN');
      if (
        permisos
          .filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE')
          .some((p) => atomosDe(p).includes('team.grants.assign'))
      )
        return conMotivo(
          403,
          'No puede darle permisos de administración a otra persona que administra.',
          'GUARDRAIL_PEER_ADMIN',
        );
      const permitidos = TECHO_POR_OMISION.allowAtoms;
      if (d.actions.some((a) => !permitidos.some((pat) => patron(pat, a))))
        return conMotivo(403, 'Eso excede lo que usted puede dar.', 'ADMIN_CEILING_EXCEEDED');
      if (
        d.validTo !== undefined &&
        new Date(d.validTo).getTime() - Date.now() > TECHO_POR_OMISION.maxValidDays * DIA_MS
      )
        return conMotivo(403, 'Eso excede lo que usted puede dar.', 'ADMIN_CEILING_EXCEEDED');
      const objetivo = { healthcareServiceId: d.healthcareServiceId, careSpaceId: d.careSpaceId };
      const cubierto = permisosDelActor(actor.user.id, actor.tenantId).some((x) =>
        x.cubreObjetivo(objetivo),
      );
      if (!cubierto) return sinAlcance();
    }
    if (d.actions.some((a) => atomMeta(a)?.sensitivity === 'CRITICAL' && d.validTo === undefined))
      return conMotivo(
        422,
        'Un permiso crítico necesita fecha de vencimiento.',
        'GUARDRAIL_CRITICAL_REQUIRES_EXPIRY',
      );
    const fila = permisos.agregar({
      id: nuevoId('permiso'),
      engagementId: v.id,
      targetKind: (d.targetKind ?? 'SERVICE') as never,
      expansionMode: 'DYNAMIC',
      actions: [],
      status: 'ACTIVE',
      atoms: d.actions,
      effect: d.effect === 'DENY' ? 'DENY' : 'ALLOW',
      ...(d.healthcareServiceId === undefined
        ? {}
        : { healthcareServiceId: d.healthcareServiceId }),
      ...(d.careSpaceId === undefined ? {} : { careSpaceId: d.careSpaceId }),
      ...(d.practitionerRoleAssignmentId === undefined
        ? {}
        : { practitionerRoleAssignmentId: d.practitionerRoleAssignmentId }),
      ...(d.validTo === undefined ? {} : { validTo: d.validTo }),
      ...(d.condition === undefined ? {} : { condition: d.condition as never }),
    });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'grant.created',
      `Se agregó un permiso a ${v.personName}.`,
    );
    return reply(201, { id: fila.id, status: 'ACTIVE' });
  });

  router.patch('/org/team/members/:id/grants', (request) => {
    const m = miembroAdministrable(request, 'team.grants.assign', 'team.grants.revoke');
    if (esFallo(m)) return m;
    const d = cuerpo<{ grantId?: string; revoke?: boolean; actions?: string[] }>(request);
    const grant = m.vista.dentro.find((p) => p.id === d.grantId);
    if (grant === undefined)
      return m.vista.fuera > 0 ? sinAlcance() : noEncontrado('SUPPORT_GRANT_NOT_FOUND');
    if (!m.actor.esAdmin && !m.actor.atomos.has('team.grants.assign') && d.revoke !== true)
      return conMotivo(
        403,
        'Con el permiso de quitar solo puede reducir.',
        'ADMIN_CEILING_EXCEEDED',
      );
    if (d.revoke === true) permisos.actualizar(grant.id, { status: 'REVOKED' });
    else if (d.actions !== undefined) permisos.actualizar(grant.id, { atoms: d.actions });
    return { ok: true };
  });

  router.post('/org/team/members/:id/recertify', (request) => {
    const m = miembroAdministrable(request, 'team.engagement.recertify');
    if (esFallo(m)) return m;
    vinculos.actualizar(m.v.id, {
      lastConfirmedAt: ahora(),
      lastConfirmedBy: 'ORGANIZATION',
      nextRecertificationAt: iso(365),
    });
    return { ok: true };
  });

  router.post('/org/team/members/:id/suspend', (request) => {
    const m = miembroAdministrable(request, 'team.engagement.suspend');
    if (esFallo(m)) return m;
    if (m.vista.fuera > 0) return sinAlcance();
    return suspender(
      m.v.id,
      cuerpo<{ reasonCode?: string; note?: string }>(request),
      m.actor.tenantId,
      m.actor.user.id,
      nombreDe(m.actor.user),
    );
  });

  router.post('/org/team/members/:id/reactivate', (request) => {
    const m = miembroAdministrable(request, 'team.engagement.reactivate');
    if (esFallo(m)) return m;
    return reactivar(
      m.v.id,
      cuerpo<{ reason?: string }>(request),
      m.actor.tenantId,
      m.actor.user.id,
    );
  });

  router.post('/org/team/members/:id/offboard', (request) => {
    const m = miembroAdministrable(request, 'team.engagement.end');
    if (esFallo(m)) return m;
    if (m.vista.fuera > 0) return sinAlcance();
    return darDeBaja(
      m.v.id,
      cuerpo<{
        reason?: string;
        handover?: {
          defaultToUserId?: string;
          items?: { id: string; toUserId: string }[];
          supervisedTo?: string;
        } | null;
      }>(request),
      m.actor.tenantId,
      m.actor.user.id,
      nombreDe(m.actor.user),
    );
  });

  router.get('/org/team/members/:id/handover-preview', (request) => {
    const m = miembroAdministrable(request, 'team.handover.execute');
    if (esFallo(m)) return m;
    return vistaTraspaso(m.v.id);
  });

  router.post('/org/team/invitations', (request) => {
    const actor = administradorOConAtomo(request, 'team.invitations.create');
    if (!esActor(actor)) return actor;
    const d = cuerpo<{
      kind?: string;
      maxUses?: number;
      expiresInDays?: number;
      roleTemplateCode?: string;
    }>(request);
    if (
      !actor.esAdmin &&
      d.roleTemplateCode !== undefined &&
      !TECHO_POR_OMISION.templates.includes(d.roleTemplateCode as never)
    )
      return conMotivo(403, 'Eso excede lo que usted puede dar.', 'ADMIN_CEILING_EXCEEDED');
    const fila = invitaciones.agregar({
      id: nuevoId('invitacion'),
      tenantId: actor.tenantId,
      kind: d.kind === 'PRACTITIONER' ? 'PRACTITIONER' : 'SUPPORT_STAFF',
      code: codigoDeInvitacion(),
      status: 'ACTIVE',
      maxUses: d.maxUses ?? 1,
      usedCount: 0,
      expiresAt: iso(d.expiresInDays ?? 7),
      createdAt: ahora(),
      ...(d.roleTemplateCode === undefined ? {} : { roleTemplateCode: d.roleTemplateCode }),
    } as never);
    return reply(201, fila);
  });

  router.get('/org/team/requests', (request) => {
    const actor = administradorOConAtomo(request, 'team.requests.decide');
    if (!esActor(actor)) return actor;
    const mios = actor.esAdmin ? [] : permisosDelActor(actor.user.id, actor.tenantId);
    const items = solicitudes
      .filtrar((r) => r.tenantId === actor.tenantId && r.status === 'PENDING')
      .flatMap((r) => {
        const pendientes = r.items.filter((i) => i.decision === 'PENDING');
        const propios = actor.esAdmin
          ? pendientes
          : pendientes.filter((i) => mios.some((m) => m.cubreObjetivo(i)));
        return propios.length === 0
          ? []
          : [
              {
                ...vistaSolicitud(r),
                items: propios,
                otherItems: pendientes.length - propios.length,
              },
            ];
      });
    return lista(items);
  });

  router.post('/org/team/requests/:id/decision', (request) => {
    const actor = administradorOConAtomo(request, 'team.requests.decide');
    if (!esActor(actor)) return actor;
    const r = solicitudes.get(request.params['id']!);
    if (r === undefined || r.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_REQUEST_NOT_FOUND');
    const d = cuerpo<{
      items?: {
        itemId: string;
        decision: 'APPROVED' | 'ADJUSTED' | 'REJECTED';
        actions?: unknown;
        comment?: string;
      }[];
    }>(request);
    if (!Array.isArray(d.items) || d.items.length === 0)
      return validation('Decida al menos un ítem.', [
        { field: 'items', message: 'cada ítem necesita su decisión' },
      ]);
    for (const v of d.items) {
      if (v.decision === 'ADJUSTED' && accionesValidas(v.actions) === null)
        return validation('Un ítem ajustado necesita las acciones que sí se conceden.', [
          { field: 'items', message: 'faltan las acciones del ajuste' },
        ]);
    }
    // Lo aprobado (o ajustado) crea el permiso en el vínculo de quien pidió, como en `/org/support-engagement-requests/:id/decision`.
    const vinculo =
      r.parentEngagementId === undefined
        ? vinculos.filtrar(
            (x) =>
              x.userId === r.requesterUserId && x.tenantId === r.tenantId && x.status === 'ACTIVE',
          )[0]
        : vinculos.get(r.parentEngagementId);
    const otorgados: string[] = [];
    const items = r.items.map((i) => {
      const v = d.items!.find((x) => x.itemId === i.id);
      if (v === undefined) return i;
      const base = {
        ...i,
        decision: v.decision,
        ...(v.comment === undefined ? {} : { decisionComment: v.comment }),
      };
      if (v.decision === 'REJECTED' || vinculo === undefined) return base;
      const permiso = otorgar(
        vinculo,
        soloObjetivo(i),
        v.decision === 'ADJUSTED' ? accionesValidas(v.actions)! : i.proposedActions,
        'DYNAMIC',
      );
      otorgados.push(permiso.id);
      return { ...base, resultingGrantId: permiso.id };
    });
    const sigue = items.some((i) => i.decision === 'PENDING');
    solicitudes.actualizar(r.id, {
      items,
      status: sigue
        ? 'PENDING'
        : items.every((i) => i.decision === 'REJECTED')
          ? 'REJECTED'
          : items.some((i) => i.decision === 'REJECTED')
            ? 'PARTIAL'
            : 'APPROVED',
      ...(sigue ? {} : { decidedAt: ahora() }),
    });
    const pendingItemIds = items.filter((i) => i.decision === 'PENDING').map((i) => i.id);
    return {
      requestId: r.id,
      status: sigue ? 'PENDING' : 'APPROVED',
      grantIds: otorgados,
      ...(pendingItemIds.length === 0 ? {} : { pendingItemIds }),
    };
  });
}

function vistaDeGrant(p: FilaPermiso): Record<string, unknown> {
  return {
    id: p.id,
    targetKind: p.targetKind,
    atoms: atomosDe(p),
    ...(p.practitionerRoleAssignmentId === undefined
      ? {}
      : { practitionerRoleAssignmentId: p.practitionerRoleAssignmentId }),
    ...(p.healthcareServiceId === undefined ? {} : { healthcareServiceId: p.healthcareServiceId }),
    ...(p.careSpaceId === undefined ? {} : { careSpaceId: p.careSpaceId }),
    ...(p.practiceSiteId === undefined ? {} : { practiceSiteId: p.practiceSiteId }),
    ...(p.validTo === undefined ? {} : { validTo: p.validTo }),
  };
}
