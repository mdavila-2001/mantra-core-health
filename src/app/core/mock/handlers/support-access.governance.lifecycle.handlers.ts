import type {
  LifecycleCaseDetail,
  HandoverItem,
} from '../../data-access/access-governance/access-lifecycle.types';
import { privilegeWeightOf } from '../../data-access/support-access/support-atoms';
import {
  aprobaciones,
  casosDeCicloDeVida,
  excepcionesSod,
  GENTE,
  metaDeVinculo,
  TRASPASO_DE_PABLO,
} from '../fixtures/support-hospital-governance';
import { permisos, vinculos } from '../fixtures/support-hospital';
import type { FilaPermiso } from '../fixtures/support-hospital.types';
import { conflict, type MockRouter, reply, validation } from '../mock-router';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { anotar } from './support-access.core';
import { conMotivo } from './support-access.errors';
import {
  conSesion,
  esActor,
  exigirPasoExtra,
  hayRespuesta,
  lista,
  nombreDe,
  noEncontrado,
  soloAdministrador,
  textoObligatorio,
  administradorOConAtomo,
} from './support-access.governance.core';
import { coincideConLaSimulacion } from './support-access.governance.tokens';
import { atomosDe } from './support-access.governance.view';

/* ============================================================================
    Ciclo de vida: ingreso, cambio de rol o alcance, baja con traspaso, suspensión y reactivación
    (CONTRATO-GOBIERNO §8.3 D). Formas de `support-lifecycle.dto.ts`.

    Orden que el mock respeta como la API: **revoca primero, reasigna después**; un fallo del traspaso no deshace
    la baja; la reactivación solo por cuatro ojos; el cambio que sube el puntaje de privilegios más de 10 también.
   ========================================================================== */

const UMBRAL_DE_CUATRO_OJOS = 10;
const PASOS_DE_INGRESO = ['IDENTITY_VERIFIED', 'SUPERVISOR_ASSIGNED', 'CONFIDENTIALITY_ACK'];

const vivosDe = (engagementId: string): FilaPermiso[] =>
  permisos.filtrar(
    (p) => p.engagementId === engagementId && p.status === 'ACTIVE' && p.effect !== 'DENY',
  );
const puntajeDe = (engagementId: string): number =>
  privilegeWeightOf(vivosDe(engagementId).flatMap((p) => atomosDe(p)));

/** Lo que pasa cuando se aprueba un cuatro ojos que no es de una acción: reactivar, excepción SoD. */
export function ejecutarAprobacion(aprobacionId: string): Record<string, unknown> {
  const a = aprobaciones.get(aprobacionId);
  if (a === undefined) return { executed: false };
  if (a.kind === 'REACTIVATION') {
    const v = vinculos.filtrar(
      (x) => x.userId === a.subjectUserId && x.tenantId === a.tenantId && x.status === 'SUSPENDED',
    )[0];
    if (v !== undefined) vinculos.actualizar(v.id, { status: 'ACTIVE', suspendedAt: undefined });
    return { executed: v !== undefined, kind: 'REACTIVATION' };
  }
  if (a.kind === 'SOD_EXCEPTION') {
    const e = excepcionesSod.filtrar((x) => uuid(`sodex-approval-${x.id}`) === a.id)[0];
    if (e !== undefined) excepcionesSod.actualizar(e.id, { status: 'ACTIVE' });
    return { executed: e !== undefined, kind: 'SOD_EXCEPTION' };
  }
  return { executed: false };
}

function abrirCaso(
  kind: LifecycleCaseDetail['kind'],
  engagementId: string,
  abiertoPor: string,
  motivo: string,
  extras: Partial<LifecycleCaseDetail> = {},
): LifecycleCaseDetail {
  const v = vinculos.get(engagementId)!;
  return casosDeCicloDeVida.agregar({
    id: nuevoId('caso'),
    kind,
    status: 'OPEN',
    engagementId,
    subjectUserId: v.userId,
    openedByUserId: abiertoPor,
    openedAt: ahora(),
    reason: motivo,
    checklist:
      kind === 'JOINER'
        ? PASOS_DE_INGRESO.map((code) => ({
            code,
            label: code,
            required: true,
            completion: 'MANUAL',
            status: 'PENDING',
          }))
        : [],
    handover: [],
    ...extras,
  });
}

export function registrarGobiernoCicloDeVida(router: MockRouter): void {
  /* ---- casos ------------------------------------------------------------------------------------------------------ */

  router.get('/org/lifecycle/cases', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    const kind = request.query.get('kind');
    const status = request.query.get('status');
    return lista(
      casosDeCicloDeVida
        .filtrar(
          (c) => (kind === null || c.kind === kind) && (status === null || c.status === status),
        )
        .map(({ reason: _r, checklist: _c, handover: _h, ...resumen }) => resumen),
    );
  });

  router.get('/org/lifecycle/cases/:id', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    return (
      casosDeCicloDeVida.get(request.params['id']!) ?? noEncontrado('LIFECYCLE_CASE_NOT_FOUND')
    );
  });

  router.post('/org/lifecycle/cases/:id/checklist/:code', (request) => {
    const actor = administradorOConAtomo(request, 'team.members.view');
    if (!esActor(actor)) return actor;
    const caso = casosDeCicloDeVida.get(request.params['id']!);
    if (caso === undefined) return noEncontrado('LIFECYCLE_CASE_NOT_FOUND');
    const item = caso.checklist.find((c) => c.code === request.params['code']);
    if (item === undefined) return noEncontrado('LIFECYCLE_CASE_NOT_FOUND');
    if (item.completion === 'AUTOMATIC')
      return conMotivo(409, 'Ese paso se completa solo.', 'LIFECYCLE_ITEM_AUTOMATIC');
    const checklist = caso.checklist.map((c) =>
      c.code === item.code ? { ...c, status: 'DONE', completedAt: ahora() } : c,
    );
    const completo = checklist.every((c) => c.status === 'DONE' || !c.required);
    return casosDeCicloDeVida.actualizar(caso.id, {
      checklist,
      ...(completo ? { status: 'COMPLETED' as const, completedAt: ahora() } : {}),
    });
  });

  router.post('/org/lifecycle/cases/:id/handover/assign', (request) => {
    const actor = administradorOConAtomo(request, 'team.handover.execute');
    if (!esActor(actor)) return actor;
    const caso = casosDeCicloDeVida.get(request.params['id']!);
    if (caso === undefined) return noEncontrado('LIFECYCLE_CASE_NOT_FOUND');
    const d = cuerpo<{ defaultToUserId?: string; items?: { id: string; toUserId: string }[] }>(
      request,
    );
    // Cada objeto va a quien se le dijo (`items`); el resto, a quien recibe por omisión. Sin ninguno de los dos, no hay a quién dárselo.
    const destinoDe = (id: string): string | undefined =>
      d.items?.find((i) => i.id === id)?.toUserId ?? d.defaultToUserId;
    if (caso.handover.some((h) => h.status === 'PENDING' && destinoDe(h.id) === undefined))
      return conMotivo(422, 'Elija quién recibe el trabajo.', 'HANDOVER_TARGET_INELIGIBLE');
    const handover = caso.handover.map((h) =>
      h.status === 'PENDING'
        ? {
            ...h,
            toUserId: destinoDe(h.id)!,
            status: 'REASSIGNED',
            reassignedAt: ahora(),
            reassignedByUserId: actor.user.id,
          }
        : h,
    );
    casosDeCicloDeVida.actualizar(caso.id, { handover, status: 'COMPLETED', completedAt: ahora() });
    return { caseId: caso.id, handover: { status: 'COMPLETED', pending: 0 } };
  });

  router.get('/org/lifecycle/cases/:id/export', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const caso = casosDeCicloDeVida.get(request.params['id']!);
    if (caso === undefined) return noEncontrado('LIFECYCLE_CASE_NOT_FOUND');
    return {
      case: caso,
      exportedAt: ahora(),
      sha256: uuid(caso.id).replaceAll('-', '').padEnd(64, 'c'),
    };
  });

  /* ---- sobre un vínculo -------------------------------------------------------------------------------------------- */

  router.post('/org/support-engagements/:id/identity-verification', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const v = vinculos.get(request.params['id']!);
    if (v === undefined || v.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const metodo = cuerpo<{ method?: string }>(request).method;
    if (metodo !== 'IN_PERSON' && metodo !== 'DOCUMENT_UPLOAD')
      return validation('Elija cómo se verificó la identidad.', [
        { field: 'method', message: 'use IN_PERSON o DOCUMENT_UPLOAD' },
      ]);
    metaDeVinculo.actualizar(v.id, { identidadVerificada: true });
    // Como la API: el paso `IDENTITY_VERIFIED` del caso de ingreso abierto queda hecho.
    const ingreso = casosDeCicloDeVida.filtrar(
      (c) => c.engagementId === v.id && c.kind === 'JOINER' && c.status === 'OPEN',
    )[0];
    if (ingreso !== undefined)
      casosDeCicloDeVida.actualizar(ingreso.id, {
        checklist: ingreso.checklist.map((c) =>
          c.code === 'IDENTITY_VERIFIED' ? { ...c, status: 'DONE', completedAt: ahora() } : c,
        ),
      });
    return { ok: true };
  });

  router.put('/org/support-engagements/:id/owner', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const v = vinculos.get(request.params['id']!);
    if (v === undefined || v.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const dueno = cuerpo<{ supervisorUserId?: string }>(request).supervisorUserId;
    if (typeof dueno !== 'string')
      return validation('Elija quién será responsable de la cuenta.', [
        { field: 'supervisorUserId', message: 'es obligatorio' },
      ]);
    if (dueno === v.userId)
      return conMotivo(
        422,
        'Una persona no puede ser su propia responsable de cuenta.',
        'GUARDRAIL_SELF_SUPERVISION',
      );
    metaDeVinculo.actualizar(v.id, { supervisorUserId: dueno });
    const caso = casosDeCicloDeVida.filtrar(
      (c) => c.engagementId === v.id && c.kind === 'JOINER' && c.status === 'OPEN',
    )[0];
    if (caso !== undefined) {
      const checklist = caso.checklist.map((c) =>
        c.code === 'SUPERVISOR_ASSIGNED' ? { ...c, status: 'DONE', completedAt: ahora() } : c,
      );
      casosDeCicloDeVida.actualizar(caso.id, { checklist });
    }
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'support.owner_assigned',
      `Se asignó responsable de la cuenta de ${v.personName}.`,
    );
    return { ok: true };
  });

  router.post('/me/support-engagements/:id/confidentiality-ack', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const v = vinculos.get(request.params['id']!);
    if (v === undefined || v.userId !== sesion.user.id)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    if (v.status !== 'ACTIVE')
      return conMotivo(422, 'El vínculo no está activo.', 'SUPPORT_ENGAGEMENT_NOT_ACTIVE');
    metaDeVinculo.actualizar(v.id, { compromisoDeConfidencialidad: true });
    return { ok: true, tenantId: v.tenantId, acknowledgedAt: ahora() };
  });

  router.post('/org/support-engagements/:id/move', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const v = vinculos.get(request.params['id']!);
    if (v === undefined || v.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const d = cuerpo<{
      reason?: string;
      newTemplateCode?: string;
      simulationToken?: string;
      grants?: {
        actions?: string[];
        effect?: 'ALLOW' | 'DENY';
        condition?: Record<string, unknown>;
        targetKind?: string;
        practitionerRoleAssignmentId?: string;
        healthcareServiceId?: string;
        careSpaceId?: string;
        practiceSiteId?: string;
      }[];
    }>(request);
    const motivo = textoObligatorio(d.reason, 10, 'REASON_REQUIRED');
    if (!motivo.ok) return motivo.respuesta;
    if (!Array.isArray(d.grants))
      return validation('Indique los permisos nuevos.', [
        { field: 'grants', message: 'debe ser una lista' },
      ]);
    // Con `simulationToken` lo que se mueve tiene que ser lo que se simuló con `mode: REPLACE`: el conjunto completo y la plantilla.
    if (
      typeof d.simulationToken === 'string' &&
      !coincideConLaSimulacion(d.simulationToken, v.id, {
        mode: 'REPLACE',
        templateCode: d.newTemplateCode ?? null,
        grants: d.grants.map((g) => ({
          effect: g.effect,
          actions: g.actions,
          condition: g.condition,
          targetKind: g.targetKind,
          practitionerRoleAssignmentId: g.practitionerRoleAssignmentId,
          healthcareServiceId: g.healthcareServiceId,
          careSpaceId: g.careSpaceId,
          practiceSiteId: g.practiceSiteId,
        })),
        removeGrantIds: [],
      })
    ) {
      return conMotivo(
        409,
        'Lo que va a mover no es lo que simuló (o la simulación venció). Simule de nuevo.',
        'SIMULATION_STALE',
      );
    }
    const antes = puntajeDe(v.id);
    const nuevos = d.grants.map((g) => ({ ...g, atomos: g.actions ?? [] }));
    const despues = privilegeWeightOf(nuevos.flatMap((g) => g.atomos));
    const delta = despues - antes;
    const fourEyesReasons =
      delta > UMBRAL_DE_CUATRO_OJOS
        ? ['El cambio sube el puntaje de privilegios más de 10 puntos.']
        : [];
    if (fourEyesReasons.length > 0) {
      const a = aprobaciones.agregar({
        id: nuevoId('aprobacion'),
        tenantId: actor.tenantId,
        kind: 'ENGAGEMENT_MOVE',
        status: 'PENDING',
        approverKind: 'SECOND_APPROVER',
        requesterUserId: actor.user.id,
        subjectUserId: v.userId,
        reasonText: motivo.texto,
        createdAt: ahora(),
        expiresAt: iso(1),
        summary: `Cambio de rol o alcance de ${v.personName}: el puntaje de privilegios pasa de ${antes} a ${despues}.`,
      });
      return reply(202, {
        status: 'PENDING_APPROVAL',
        approvalId: a.id,
        expiresAt: a.expiresAt,
        scoreBefore: antes,
        scoreAfter: despues,
        delta,
        fourEyesReasons,
      });
    }
    const revocados = vivosDe(v.id).map((p) => p.id);
    for (const id of revocados) permisos.actualizar(id, { status: 'REVOKED' });
    const creados = nuevos.map((g) =>
      permisos.agregar({
        id: nuevoId('permiso'),
        engagementId: v.id,
        targetKind: (g.targetKind ?? 'ALL') as never,
        expansionMode: 'DYNAMIC',
        actions: [],
        status: 'ACTIVE',
        atoms: g.atomos,
        effect: g.effect === 'DENY' ? 'DENY' : 'ALLOW',
        ...(g.condition === undefined ? {} : { condition: g.condition as never }),
        ...(g.practitionerRoleAssignmentId === undefined
          ? {}
          : { practitionerRoleAssignmentId: g.practitionerRoleAssignmentId }),
        ...(g.healthcareServiceId === undefined
          ? {}
          : { healthcareServiceId: g.healthcareServiceId }),
        ...(g.careSpaceId === undefined ? {} : { careSpaceId: g.careSpaceId }),
      }),
    );
    if (d.newTemplateCode !== undefined)
      vinculos.actualizar(v.id, { roleTemplate: d.newTemplateCode as never });
    const caso = abrirCaso('MOVER', v.id, actor.user.id, motivo.texto, {
      status: 'COMPLETED',
      completedAt: ahora(),
    });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'support.engagement_moved',
      `Se cambió el rol o alcance de ${v.personName}.`,
    );
    return {
      status: 'EXECUTED',
      scoreBefore: antes,
      scoreAfter: despues,
      delta,
      fourEyesReasons,
      grantIds: creados.map((p) => p.id),
      revokedGrantIds: revocados,
      caseId: caso.id,
    };
  });

  router.get('/org/support-engagements/:id/handover-preview', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const v = vinculos.get(request.params['id']!);
    if (v === undefined || v.tenantId !== actor.tenantId)
      return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    return vistaTraspaso(v.id);
  });

  router.post('/org/support-engagements/:id/offboard', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    return darDeBaja(
      request.params['id']!,
      cuerpo<{
        reason?: string;
        handover?: {
          defaultToUserId?: string;
          items?: { id: string; toUserId: string }[];
          supervisedTo?: string;
        } | null;
      }>(request),
      actor.tenantId,
      actor.user.id,
      nombreDe(actor.user),
    );
  });

  router.post('/org/support-engagements/:id/suspend', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    return suspender(
      request.params['id']!,
      cuerpo<{ reasonCode?: string; note?: string }>(request),
      actor.tenantId,
      actor.user.id,
      nombreDe(actor.user),
    );
  });

  router.post('/org/support-engagements/:id/reactivate', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    return reactivar(
      request.params['id']!,
      cuerpo<{ reason?: string }>(request),
      actor.tenantId,
      actor.user.id,
    );
  });
}

/* ---- operaciones compartidas con `/org/team/*` ----------------------------------------------------------------------------- */

/** Lo que el vínculo tiene «en las manos»: solo Pablo tiene trabajo asignado en el piloto. */
export function vistaTraspaso(engagementId: string): {
  engagementId: string;
  items: { id: string; kind: string }[];
  counts: Record<string, number>;
} {
  const items =
    engagementId === GENTE.pablo.engagementId
      ? TRASPASO_DE_PABLO.map(({ id, kind }) => ({ id, kind }))
      : [];
  const dueno = metaDeVinculo
    .filtrar((m) => m.supervisorUserId === vinculos.get(engagementId)?.userId)
    .map((m) => ({ id: `owned-${m.id}`, kind: 'SUPERVISED_ENGAGEMENT' }));
  const todos = [...items, ...dueno];
  return {
    engagementId,
    items: todos,
    counts: todos.reduce<Record<string, number>>(
      (m, i) => ({ ...m, [i.kind]: (m[i.kind] ?? 0) + 1 }),
      {},
    ),
  };
}

export function darDeBaja(
  engagementId: string,
  d: {
    reason?: string;
    handover?: {
      defaultToUserId?: string;
      items?: { id: string; toUserId: string }[];
      supervisedTo?: string;
    } | null;
  },
  tenantId: string,
  actorId: string,
  actorNombre: string,
): ReturnType<typeof reply> | Record<string, unknown> {
  const v = vinculos.get(engagementId);
  if (v === undefined || v.tenantId !== tenantId)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  if (v.status === 'ENDED') return conflict('Esa persona ya está dada de baja.');
  const motivo = textoObligatorio(d.reason, 5, 'REASON_REQUIRED');
  if (!motivo.ok) return motivo.respuesta;
  const traspaso = vistaTraspaso(engagementId);
  const cuentas = traspaso.items.filter((i) => i.kind === 'SUPERVISED_ENGAGEMENT');
  if (d.handover !== null && cuentas.length > 0 && d.handover?.supervisedTo === undefined) {
    return conMotivo(
      422,
      'Elija quién será responsable de las cuentas que esta persona supervisaba.',
      'HANDOVER_SUPERVISOR_REQUIRED',
    );
  }
  // 1) revocar primero: el acceso termina ahora.
  const revocadoEn = ahora();
  for (const p of permisos.filtrar((x) => x.engagementId === v.id && x.status === 'ACTIVE'))
    permisos.actualizar(p.id, { status: 'REVOKED' });
  vinculos.actualizar(v.id, { status: 'ENDED', endedReason: motivo.texto });
  // 2) reasignar después.
  const propios = traspaso.items.filter((i) => i.kind !== 'SUPERVISED_ENGAGEMENT');
  // Cada objeto va a quien se le dijo en `items`; el resto, a quien recibe por omisión; sin destino queda pendiente en el caso abierto.
  const destinoDe = (id: string): string | undefined =>
    d.handover?.items?.find((i) => i.id === id)?.toUserId ?? d.handover?.defaultToUserId;
  const items: HandoverItem[] =
    d.handover === null || d.handover === undefined
      ? []
      : propios.flatMap((i) => {
          const destino = destinoDe(i.id);
          return destino === undefined
            ? []
            : [
                {
                  id: i.id,
                  kind: i.kind,
                  sourceId: i.id,
                  fromUserId: v.userId,
                  toUserId: destino,
                  status:
                    i.kind === 'CONVERSATION' && i.id === TRASPASO_DE_PABLO[2].id
                      ? 'RETURNED_TO_POOL'
                      : 'REASSIGNED',
                  reassignedAt: ahora(),
                  reassignedByUserId: actorId,
                },
              ];
        });
  for (const c of cuentas) {
    const m = metaDeVinculo.filtrar((x) => `owned-${x.id}` === c.id)[0];
    if (m !== undefined && d.handover?.supervisedTo !== undefined)
      metaDeVinculo.actualizar(m.id, { supervisorUserId: d.handover.supervisedTo });
  }
  const pendientes = propios.length - items.length;
  const caso = abrirCaso('LEAVER', v.id, actorId, motivo.texto, {
    handover: items,
    ...(pendientes === 0 ? { status: 'COMPLETED' as const, completedAt: ahora() } : {}),
  });
  anotar(
    tenantId,
    actorNombre,
    'support.engagement_offboarded',
    `Se dio de baja a ${v.personName}.`,
  );
  return {
    ok: true,
    engagementId: v.id,
    revokedAt: revocadoEn,
    caseId: caso.id,
    handover: { status: pendientes === 0 ? 'COMPLETED' : 'PENDING', pending: pendientes },
  };
}

export function suspender(
  engagementId: string,
  d: { reasonCode?: string; note?: string },
  tenantId: string,
  actorId: string,
  actorNombre: string,
): ReturnType<typeof reply> | Record<string, unknown> {
  const v = vinculos.get(engagementId);
  if (v === undefined || v.tenantId !== tenantId)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  if (v.status === 'SUSPENDED')
    return conMotivo(409, 'Esa persona ya está suspendida.', 'ENGAGEMENT_ALREADY_SUSPENDED');
  if (!['MANUAL', 'LEAVE', 'INVESTIGATION', 'INACTIVITY'].includes(String(d.reasonCode)))
    return validation('Elija el motivo de la suspensión.', [
      { field: 'reasonCode', message: 'use MANUAL, LEAVE, INVESTIGATION o INACTIVITY' },
    ]);
  vinculos.actualizar(v.id, { status: 'SUSPENDED', suspendedAt: ahora() });
  const caso = abrirCaso('SUSPENSION', v.id, actorId, d.note ?? String(d.reasonCode));
  anotar(tenantId, actorNombre, 'support.engagement_suspended', `Se suspendió a ${v.personName}.`);
  return { ok: true, status: 'SUSPENDED', caseId: caso.id };
}

export function reactivar(
  engagementId: string,
  d: { reason?: string },
  tenantId: string,
  actorId: string,
): ReturnType<typeof reply> | Record<string, unknown> {
  const v = vinculos.get(engagementId);
  if (v === undefined || v.tenantId !== tenantId)
    return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
  if (v.status !== 'SUSPENDED')
    return conMotivo(409, 'Esa persona no está suspendida.', 'ENGAGEMENT_NOT_SUSPENDED');
  const motivo = textoObligatorio(d.reason, 5, 'REASON_REQUIRED');
  if (!motivo.ok) return motivo.respuesta;
  const a = aprobaciones.agregar({
    id: nuevoId('aprobacion'),
    tenantId,
    kind: 'REACTIVATION',
    status: 'PENDING',
    approverKind: 'SECOND_APPROVER',
    requesterUserId: actorId,
    subjectUserId: v.userId,
    reasonText: motivo.texto,
    createdAt: ahora(),
    expiresAt: iso(1),
    summary: `Reactivar a ${v.personName}, hoy suspendida o suspendido. Sus permisos siguen intactos.`,
  });
  return reply(202, { status: 'PENDING_APPROVAL', approvalId: a.id, expiresAt: a.expiresAt });
}
