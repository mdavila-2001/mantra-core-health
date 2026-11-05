import type {
  Campaign,
  CampaignDraft,
  ReviewItem,
} from '../../data-access/access-governance/access-reviews.types';
import {
  ADMIN_PRINCIPAL,
  campanas,
  itemsDeRevision,
} from '../fixtures/support-hospital-governance';
import { permisos, vinculos } from '../fixtures/support-hospital';
import { atomMeta } from '../../data-access/support-access/support-atoms';
import { type MockRouter, reply, validation } from '../mock-router';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { anotar } from './support-access.core';
import { conMotivo } from './support-access.errors';
import {
  administradorOConAtomo,
  conSesion,
  esActor,
  exigirPasoExtra,
  hayRespuesta,
  lista,
  nombreDe,
  noEncontrado,
  soloAdministrador,
} from './support-access.governance.core';
import { atomosDe } from './support-access.governance.view';

/* ============================================================================
    Campañas de certificación y bandeja del revisor (CONTRATO-GOBIERNO §8.3 F). Formas de `access-reviews.dto.ts`.

    Reglas que el mock sí hace cumplir porque cambian la pantalla: el comentario obligatorio en ALTA y CRÍTICA y al
    revocar; el ajuste que solo reduce; el masivo solo de bajo riesgo y todo o nada; un ítem ajeno es 404 uniforme.
   ========================================================================== */

const DECISIONES = ['CERTIFY', 'REVOKE', 'ADJUST'];
const EVIDENCIA_QUE_SE_VE = (i: ReviewItem & { readonly reviewerUserId: string }): ReviewItem => {
  const { reviewerUserId: _r, ...visible } = i;
  return visible;
};
const sinEvidencia = (i: ReviewItem & { readonly reviewerUserId: string }): ReviewItem => {
  const { evidence: _e, evidenceHash: _h, ...resto } = EVIDENCIA_QUE_SE_VE(i);
  return resto;
};

/** Los ítems que una campaña genera hoy: un ítem por concesión viva con átomos de sensibilidad media o más. */
function itemsDeUnaCampania(campaignId: string, minimo: string | undefined): ReviewItem[] {
  const rango: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const piso = rango[minimo ?? 'LOW'] ?? 1;
  return permisos
    .filtrar((p) => p.status === 'ACTIVE' && p.effect !== 'DENY' && atomosDe(p).length > 0)
    .flatMap((p) => {
      const v = vinculos.get(p.engagementId);
      if (v === undefined || v.status !== 'ACTIVE') return [];
      const top = Math.max(
        ...atomosDe(p).map((a) => rango[atomMeta(a)?.sensitivity ?? 'LOW'] ?? 1),
      );
      if (top < piso) return [];
      return [
        {
          id: uuid(`item-${campaignId}-${p.id}`),
          campaignId,
          engagementId: v.id,
          grantId: p.id,
          subjectUserId: v.userId,
          subjectName: v.personName,
          reviewerKind: 'ADMIN',
          state: 'PENDING',
          dueAt: iso(14),
          escalated: false,
          reminderCount: 0,
          maxSensitivity: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][top - 1] ??
            'LOW') as ReviewItem['maxSensitivity'],
        },
      ];
    });
}

export function registrarGobiernoCampanas(router: MockRouter): void {
  /* ---- campañas (organización) -------------------------------------------------------------------------------------- */

  router.get('/org/access-reviews/campaigns', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    return lista(campanas.todos());
  });

  router.post('/org/access-reviews/campaigns/preview', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const d = cuerpo<CampaignDraft>(request);
    if (d.scope === undefined)
      return validation('Elija el alcance de la campaña.', [
        { field: 'scope', message: 'es obligatorio' },
      ]);
    const items = itemsDeUnaCampania('preview', d.filters?.minSensitivity).map((i) => ({
      engagementId: i.engagementId,
      subjectUserId: i.subjectUserId,
      ...(i.grantId === undefined ? {} : { grantId: i.grantId }),
      reviewerKind: i.reviewerKind,
      reviewerUserIds: [ADMIN_PRINCIPAL.userId],
      ...(i.maxSensitivity === undefined ? {} : { maxSensitivity: i.maxSensitivity }),
      suggestRevoke: false,
    }));
    return {
      total: items.length,
      byReviewerKind: { ADMIN: items.length },
      withoutReviewer: 0,
      items,
    };
  });

  router.post('/org/access-reviews/campaigns', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const d = cuerpo<CampaignDraft>(request);
    if (
      typeof d.name !== 'string' ||
      d.name.trim() === '' ||
      typeof d.dueAt !== 'string' ||
      d.scope === undefined ||
      d.kind === undefined
    ) {
      return validation('La campaña necesita nombre, tipo, alcance y fecha de vencimiento.', [
        { field: 'name', message: 'complete los datos' },
      ]);
    }
    if (itemsDeUnaCampania('preview', d.filters?.minSensitivity).length === 0)
      return conMotivo(
        422,
        'Con ese alcance y esos filtros no hay nada que revisar.',
        'REVIEW_SCOPE_EMPTY',
      );
    if (
      campanas.filtrar((c) => c.name === d.name && (c.status === 'DRAFT' || c.status === 'OPEN'))
        .length > 0
    )
      return conMotivo(409, 'Ya existe una campaña igual en curso.', 'REVIEW_CAMPAIGN_DUPLICATE');
    const fila: Campaign = {
      id: nuevoId('campana'),
      name: d.name.trim(),
      kind: d.kind,
      status: 'DRAFT',
      scope: d.scope,
      ...(d.filters === undefined ? {} : { filters: d.filters }),
      dueAt: d.dueAt,
      graceDays: d.graceDays ?? 7,
      reminderDaysBefore: d.reminderDaysBefore ?? [7, 3, 1],
      escalateAfterDays: d.escalateAfterDays ?? 3,
      uncertifiedAction: d.uncertifiedAction ?? 'UNCERTIFIED_REVOKE',
      ownerUserId: actor.user.id,
    };
    campanas.agregar(fila);
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'access_review.campaign_created',
      `Se creó la campaña «${fila.name}».`,
    );
    // La API real contesta solo `{ id }` (`ResourceCreatedDto`); el detalle se pide con `GET …/:id`.
    return reply(201, { id: fila.id });
  });

  router.get('/org/access-reviews/campaigns/:id', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    return campanas.get(request.params['id']!) ?? noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
  });

  router.patch('/org/access-reviews/campaigns/:id', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    if (c.status !== 'DRAFT')
      return conMotivo(409, 'La campaña ya no es un borrador.', 'REVIEW_CAMPAIGN_NOT_DRAFT');
    return campanas.actualizar(c.id, cuerpo<Partial<Campaign>>(request));
  });

  router.post('/org/access-reviews/campaigns/:id/launch', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    if (c.status !== 'DRAFT')
      return conMotivo(409, 'La campaña ya no es un borrador.', 'REVIEW_CAMPAIGN_NOT_DRAFT');
    const items = itemsDeUnaCampania(c.id, c.filters?.minSensitivity);
    for (const i of items)
      itemsDeRevision.agregar({
        ...i,
        campaignName: c.name,
        reviewerUserId: ADMIN_PRINCIPAL.userId,
        evidence: {
          summary: `${i.subjectName ?? 'La persona'} tiene acceso vigente.`,
          generatedAt: ahora(),
          atoms: [],
          usage90d: [],
          openAlerts: 0,
          sodFindings: [],
          aboveCeiling: false,
          lastCertifiedAt: null,
        },
        evidenceHash: uuid(i.id).replaceAll('-', '').padEnd(64, '0'),
      });
    campanas.actualizar(c.id, { status: 'OPEN', launchedAt: ahora() });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'access_review.campaign_launched',
      `Se lanzó la campaña «${c.name}».`,
    );
    return { ok: true, items: items.length, withoutReviewer: 0 };
  });

  router.post('/org/access-reviews/campaigns/:id/close', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    if (c.status !== 'OPEN')
      return conMotivo(409, 'La campaña no está abierta.', 'REVIEW_CAMPAIGN_NOT_OPEN');
    const pendientes = itemsDeRevision.filtrar(
      (i) => i.campaignId === c.id && i.state === 'PENDING',
    );
    const revocar = c.uncertifiedAction === 'UNCERTIFIED_REVOKE';
    for (const i of pendientes) {
      itemsDeRevision.actualizar(i.id, {
        state: revocar ? 'AUTO_REVOKED' : 'SKIPPED',
        decidedAt: ahora(),
        comment: revocar ? 'No certificada en la campaña.' : 'Escalada al cierre.',
      });
      if (revocar && i.grantId !== undefined) permisos.actualizar(i.grantId, { status: 'REVOKED' });
    }
    campanas.actualizar(c.id, { status: 'CLOSED', closedAt: ahora() });
    return {
      ok: true,
      autoRevoked: revocar ? pendientes.length : 0,
      skipped: revocar ? 0 : pendientes.length,
    };
  });

  router.post('/org/access-reviews/campaigns/:id/cancel', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    if (c.status === 'CLOSED' || c.status === 'CANCELLED')
      return conMotivo(409, 'La campaña ya terminó.', 'REVIEW_CAMPAIGN_NOT_OPEN');
    return campanas.actualizar(c.id, { status: 'CANCELLED', cancelledAt: ahora() });
  });

  router.get('/org/access-reviews/campaigns/:id/items', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    return lista(itemsDeRevision.filtrar((i) => i.campaignId === c.id).map(sinEvidencia));
  });

  router.get('/org/access-reviews/campaigns/:id/results', (request) => {
    const actor = administradorOConAtomo(request, 'team.campaigns.manage');
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    const items = itemsDeRevision.filtrar((i) => i.campaignId === c.id);
    const contar = (clave: (i: ReviewItem) => string): Record<string, number> =>
      items.reduce<Record<string, number>>(
        (m, i) => ({ ...m, [clave(i)]: (m[clave(i)] ?? 0) + 1 }),
        {},
      );
    const pendientes = items.filter((i) => i.state === 'PENDING').length;
    return {
      total: items.length,
      byDecision: contar((i) => i.state),
      byReviewerKind: contar((i) => i.reviewerKind),
      bySensitivity: contar((i) => i.maxSensitivity ?? 'LOW'),
      pending: pendientes,
      coveragePercent:
        items.length === 0 ? 100 : Math.round(((items.length - pendientes) / items.length) * 100),
      meanResponseHours: 30,
      autoRevokedItemIds: items.filter((i) => i.state === 'AUTO_REVOKED').map((i) => i.id),
    };
  });

  router.get('/org/access-reviews/campaigns/:id/export', (request) => {
    const actor = soloAdministrador(request);
    if (!esActor(actor)) return actor;
    const c = campanas.get(request.params['id']!);
    if (c === undefined) return noEncontrado('REVIEW_CAMPAIGN_NOT_FOUND');
    // Como la API real: sin `format` el archivo sale en JSON.
    // Como la API real: el motivo es un CÓDIGO (sin él, 422 EXPORT_REASON_REQUIRED) y exportar pide el paso extra reciente.
    const motivo = request.query.get('reasonCode');
    if (
      motivo === null ||
      !['AUDIT_REVIEW', 'REGULATORY', 'INTERNAL_CONTROL', 'INCIDENT', 'OTHER'].includes(motivo)
    )
      return conMotivo(422, 'Diga para qué exporta.', 'EXPORT_REASON_REQUIRED');
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const formato = request.query.get('format') === 'csv' ? 'csv' : 'json';
    const filas = itemsDeRevision.filtrar((i) => i.campaignId === c.id);
    const contenido =
      formato === 'json'
        ? JSON.stringify(filas.map(sinEvidencia))
        : [
            'persona,estado,vence',
            ...filas.map((i) => `${i.subjectName ?? ''},${i.state},${i.dueAt}`),
          ].join('\n');
    return {
      format: formato,
      kind: 'access-review-campaign',
      generatedAt: ahora(),
      generatedBy: actor.user.id,
      filters: { campaignId: c.id },
      rowCount: filas.length,
      sha256: uuid(contenido).replaceAll('-', '').padEnd(64, 'a'),
      content: contenido,
    };
  });

  /* ---- bandeja del revisor ------------------------------------------------------------------------------------------------ */

  const mios = (userId: string) =>
    itemsDeRevision.filtrar(
      (i) =>
        i.reviewerUserId === userId ||
        (i.reviewerKind === 'ADMIN' && userId === ADMIN_PRINCIPAL.userId),
    );

  router.get('/me/access-reviews/items', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const estado = request.query.get('status') ?? 'PENDING';
    return lista(
      mios(sesion.user.id)
        .filter((i) =>
          estado === 'ALL'
            ? true
            : estado === 'DECIDED'
              ? i.state !== 'PENDING'
              : i.state === 'PENDING',
        )
        .map(sinEvidencia),
    );
  });

  router.get('/me/access-reviews/items/:id', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const i = mios(sesion.user.id).find((x) => x.id === request.params['id']);
    return i === undefined ? noEncontrado('REVIEW_ITEM_NOT_FOUND') : EVIDENCIA_QUE_SE_VE(i);
  });

  router.post('/me/access-reviews/items/bulk-decision', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const d = cuerpo<{ itemIds?: string[]; decision?: string }>(request);
    if (!Array.isArray(d.itemIds) || d.itemIds.length === 0 || d.decision !== 'CERTIFY')
      return conMotivo(
        422,
        'Solo se pueden mantener en bloque los accesos de bajo riesgo con uso reciente.',
        'REVIEW_BULK_NOT_ALLOWED',
        { itemIds: d.itemIds ?? [] },
      );
    const filas = d.itemIds.map((id) => mios(sesion.user.id).find((i) => i.id === id));
    if (filas.some((i) => i === undefined)) return noEncontrado('REVIEW_ITEM_NOT_FOUND');
    const riesgosos = filas
      .filter(
        (i) =>
          i!.maxSensitivity === 'HIGH' ||
          i!.maxSensitivity === 'CRITICAL' ||
          i!.state !== 'PENDING',
      )
      .map((i) => i!.id);
    if (riesgosos.length > 0)
      return conMotivo(
        422,
        'Solo se pueden mantener en bloque los accesos de bajo riesgo con uso reciente.',
        'REVIEW_BULK_NOT_ALLOWED',
        { itemIds: riesgosos },
      );
    for (const i of filas)
      itemsDeRevision.actualizar(i!.id, { state: 'CERTIFIED', decidedAt: ahora() });
    return { ok: true, decided: filas.length };
  });

  router.post('/me/access-reviews/items/:id/decision', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const item = itemsDeRevision.get(request.params['id']!);
    if (item === undefined) return noEncontrado('REVIEW_ITEM_NOT_FOUND');
    // El revisor excluido (quien otorgó el permiso, o el propio sujeto) recibe 403; el ajeno, 404 uniforme.
    if (item.subjectUserId === sesion.user.id)
      return conMotivo(403, 'Usted no es quien debe revisar este acceso.', 'REVIEW_NOT_REVIEWER');
    if (!mios(sesion.user.id).some((i) => i.id === item.id))
      return noEncontrado('REVIEW_ITEM_NOT_FOUND');
    if (item.state !== 'PENDING')
      return conMotivo(409, 'Ese acceso ya fue revisado.', 'REVIEW_ALREADY_DECIDED');
    const campana = campanas.get(item.campaignId);
    if (campana !== undefined && campana.status !== 'OPEN')
      return conMotivo(409, 'La campaña no está abierta.', 'REVIEW_CAMPAIGN_NOT_OPEN');
    const d = cuerpo<{ decision?: string; comment?: string; adjustment?: { atoms?: string[] } }>(
      request,
    );
    if (!DECISIONES.includes(String(d.decision)))
      return validation('Elija mantener, quitar o ajustar.', [
        { field: 'decision', message: 'use CERTIFY, REVOKE o ADJUST' },
      ]);
    // Regla de la API (`support-access-review.decision.ts`): el comentario es de 10 caracteres o más, y obligatorio al quitar y al
    // ajustar siempre, y al mantener solo si algo es de riesgo ALTO o CRÍTICO o si algún permiso no se usó en 90 días.
    const altaOCritica = item.maxSensitivity === 'HIGH' || item.maxSensitivity === 'CRITICAL';
    const sinUso = (item.evidence?.atoms ?? []).some((a) => {
      const uso = item.evidence?.usage90d?.find((u) => u.atom === a.code);
      return uso === undefined || uso.permit + uso.deny === 0;
    });
    const comentarioObligatorio = d.decision !== 'CERTIFY' || altaOCritica || sinUso;
    if (comentarioObligatorio && (d.comment ?? '').trim().length < 10)
      return conMotivo(
        422,
        'Escriba un comentario de al menos 10 caracteres para esta decisión.',
        'REVIEW_COMMENT_REQUIRED',
      );
    if (d.decision === 'ADJUST') {
      const actuales = new Set(
        item.evidence?.atoms?.map((a) => a.code) ??
          (item.grantId === undefined ? [] : atomosDe(permisos.get(item.grantId)!)),
      );
      if ((d.adjustment?.atoms ?? []).some((a) => !actuales.has(a)))
        return conMotivo(
          422,
          'Un ajuste solo puede reducir permisos, no ampliarlos.',
          'REVIEW_ADJUST_CANNOT_BROADEN',
        );
    }
    const estado =
      d.decision === 'CERTIFY' ? 'CERTIFIED' : d.decision === 'REVOKE' ? 'REVOKED' : 'ADJUSTED';
    itemsDeRevision.actualizar(item.id, {
      state: estado,
      decidedAt: ahora(),
      ...(d.comment === undefined ? {} : { comment: d.comment.trim() }),
    });
    if (estado === 'REVOKED' && item.grantId !== undefined)
      permisos.actualizar(item.grantId, { status: 'REVOKED' });
    anotar(
      vinculos.get(item.engagementId)?.tenantId ?? '',
      nombreDe(sesion.user),
      `access_review.item_${estado.toLowerCase()}`,
      `Se revisó el acceso de ${item.subjectName ?? 'una persona'}.`,
    );
    return { ok: true, state: estado };
  });
}
