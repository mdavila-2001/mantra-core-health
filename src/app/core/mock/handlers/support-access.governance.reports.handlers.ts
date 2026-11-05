import type { MatrixCell } from '../../data-access/access-governance/governance-reports.types';
import {
  GOVERNANCE_REPORT_KINDS,
  ANOMALY_KINDS,
} from '../../data-access/access-governance/governance-reports.types';
import {
  ATOM_CATEGORY_CODES,
  atomMeta,
  atomsOfCategory,
} from '../../data-access/support-access/support-atoms';
import {
  ajustesDeGobierno,
  anomalias,
  aprobaciones,
  excepcionesSod,
  GENTE,
  itemsDeRevision,
  metaDeVinculo,
} from '../fixtures/support-hospital-governance';
import type { FilaPermiso, FilaVinculo } from '../fixtures/support-hospital.types';
import { permisos, vinculos } from '../fixtures/support-hospital';
import { validation, type MockRouter, forbidden } from '../mock-router';
import { ahora, cuerpo, uuid } from '../mock-store';
import { anotar, doctorDe } from './support-access.core';
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
  textoObligatorio,
} from './support-access.governance.core';
import { atomosDe } from './support-access.governance.view';

/* ============================================================================
    Informes y tableros de gobierno (CONTRATO-GOBIERNO §8.3 G). Las formas son las de `governance-reports.service.ts`,
    `governance-matrix.service.ts` y `governance-panel.service.ts` de la API; los números salen de los fixtures del
    piloto, no de una política reimplementada.
   ========================================================================== */

const DIA_MS = 86_400_000;
const RANGO: Readonly<Record<string, number>> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const VER = 'audit.reports.governance.view';

const activos = (): FilaVinculo[] =>
  vinculos.filtrar((v) => v.tenantId === ajustesTenant() && v.status === 'ACTIVE');
const ajustesTenant = (): string => vinculos.todos()[0]?.tenantId ?? '';
const vivos = (engagementId: string): FilaPermiso[] =>
  permisos.filtrar(
    (p) => p.engagementId === engagementId && p.status === 'ACTIVE' && p.effect !== 'DENY',
  );
const topDe = (p: FilaPermiso): number =>
  Math.max(0, ...atomosDe(p).map((a) => RANGO[atomMeta(a)?.sensitivity ?? 'LOW'] ?? 1));
const ajustes = () => ajustesDeGobierno.get('settings');
/** Sin dueño solo si la persona tiene ficha de gobierno y esta no trae responsable (quien no tiene ficha se da por asignada). */
const sinDueno = (engagementId: string): boolean => {
  const m = metaDeVinculo.get(engagementId);
  return m !== undefined && m.supervisorUserId === undefined;
};

function celda(grants: readonly FilaPermiso[], atomos: readonly string[]): MatrixCell {
  const tiene = new Set(grants.flatMap((g) => atomosDe(g)));
  const n = atomos.filter((a) => tiene.has(a as never)).length;
  const con = grants.filter((g) => atomosDe(g).some((a) => atomos.includes(a)));
  const status =
    n === 0
      ? 'NONE'
      : con.some((g) => g.condition !== undefined || g.actionConditions !== undefined)
        ? 'CONDITIONAL'
        : n === atomos.length
          ? 'FULL'
          : 'PARTIAL';
  return {
    status,
    grantIds: con.map((g) => g.id),
    conditions: [
      ...new Set(
        con.flatMap((g) =>
          g.condition === undefined
            ? []
            : Object.keys(g.condition).filter((k) => k !== 'schemaVersion'),
        ),
      ),
    ],
  };
}

const cubre = (p: FilaPermiso, por: string, id: string): boolean =>
  por === 'doctor'
    ? p.practitionerRoleAssignmentId === id ||
      p.targetKind === 'ALL_PRACTITIONERS' ||
      p.targetKind === 'ALL'
    : por === 'service'
      ? p.healthcareServiceId === id || p.targetKind === 'ALL_SERVICES' || p.targetKind === 'ALL'
      : (p.careSpaceId ?? p.practiceSiteId) === id ||
        p.targetKind === 'ALL_LOCATIONS' ||
        p.targetKind === 'ALL';

export function registrarGobiernoInformes(router: MockRouter): void {
  router.get('/org/governance/summary', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const hoy = Date.now();
    const meta = metaDeVinculo.todos();
    const dias = ajustes()?.inactivityDays ?? 45;
    const gente = activos().filter((v) => vivos(v.id).length > 0);
    return {
      generatedAt: ahora(),
      tiles: {
        peopleWithLiveAccess: gente.length,
        highRiskGrants: gente.reduce(
          (n, v) => n + vivos(v.id).filter((p) => topDe(p) >= 3).length,
          0,
        ),
        overdueCertifications: itemsDeRevision.filtrar(
          (i) => i.state === 'PENDING' && new Date(i.dueAt).getTime() < hoy,
        ).length,
        ownerlessAccounts: activos().filter((v) => sinDueno(v.id)).length,
        inactiveAccounts: activos().filter(
          (v) => (meta.find((m) => m.id === v.id)?.diasSinUso ?? 0) >= dias,
        ).length,
        activeSodExceptions: excepcionesSod.filtrar((e) => e.status === 'ACTIVE').length,
        pendingApprovalsOver24h: aprobaciones.filtrar(
          (a) => a.status === 'PENDING' && hoy - new Date(a.createdAt).getTime() > DIA_MS,
        ).length,
        openAnomalies: anomalias.filtrar((a) => a.status === 'OPEN').length,
        grantsAboveCeiling: meta.filter((m) => m.fueraDeTecho).length,
        breakGlassUnreviewed: 0,
      },
    };
  });

  router.get('/org/governance/access-matrix', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const por = request.query.get('by');
    const id = request.query.get('id');
    if (por !== 'person' && por !== 'doctor' && por !== 'service' && por !== 'location')
      return conMotivo(
        422,
        'Elija ver personas, o quién puede actuar sobre un doctor, servicio o espacio.',
        'MATRIX_DIMENSION_INVALID',
      );
    if (por === 'person') {
      const grupo = request.query.get('group') === 'atom' ? 'atom' : 'category';
      const columnas =
        grupo === 'atom'
          ? atomsOfCategory('SUPPORT_AGENDA').map((a) => a.code as string)
          : [...ATOM_CATEGORY_CODES];
      const grupos = (c: string): readonly string[] =>
        grupo === 'atom' ? [c] : atomsOfCategory(c as never).map((a) => a.code);
      return {
        generatedAt: ahora(),
        by: 'person',
        group: grupo,
        columns: columnas,
        rows: vinculos
          .filtrar((v) => v.status !== 'ENDED' && v.tenantId === actor.tenantId)
          .map((v) => ({
            userId: v.userId,
            name: v.personName,
            engagementId: v.id,
            templateCode: v.roleTemplate,
            state: v.status,
            cells: Object.fromEntries(columnas.map((c) => [c, celda(vivos(v.id), grupos(c))])),
          })),
      };
    }
    if (id === null)
      return conMotivo(
        422,
        'Elija ver personas, o quién puede actuar sobre un doctor, servicio o espacio.',
        'MATRIX_DIMENSION_INVALID',
      );
    const filas = vinculos
      .filtrar((v) => v.status !== 'ENDED' && v.tenantId === actor.tenantId)
      .flatMap((v) => {
        const cubren = vivos(v.id).filter((p) => cubre(p, por, id));
        if (cubren.length === 0) return [];
        const aceptado =
          por !== 'doctor' || v.userId !== GENTE.marcos.userId || id !== uuid('hp-doc-perez');
        return [
          {
            userId: v.userId,
            name: v.personName,
            engagementId: v.id,
            templateCode: v.roleTemplate,
            state: v.status,
            effective: aceptado,
            ...(aceptado ? {} : { reason: 'DOCTOR_NOT_ACCEPTED' }),
            atoms: [...new Set(cubren.flatMap((p) => atomosDe(p)))].sort(),
            grantIds: cubren.map((p) => p.id),
            conditions: [
              ...new Set(
                cubren.flatMap((p) =>
                  p.condition === undefined
                    ? []
                    : Object.keys(p.condition).filter((k) => k !== 'schemaVersion'),
                ),
              ),
            ],
          },
        ];
      });
    return { generatedAt: ahora(), by: por, id, rows: filas };
  });

  router.get('/org/governance/privilege-creep', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const umbral = ajustes()?.creepThreshold ?? 15;
    return {
      generatedAt: ahora(),
      threshold: umbral,
      items: activos().map((v) => {
        const m = metaDeVinculo.get(v.id);
        const score = m?.puntaje ?? 0;
        const baseline = m?.lineaBase ?? 0;
        return {
          userId: v.userId,
          name: v.personName,
          engagementId: v.id,
          templateCode: v.roleTemplate,
          score,
          baseline,
          drift: score - baseline,
          flagged: score - baseline >= umbral,
          reasons:
            score - baseline >= umbral ? ['Sumó permisos desde la última certificación.'] : [],
          grantsSinceCertification: Math.max(0, score - baseline > 0 ? 1 : 0),
        };
      }),
    };
  });

  router.get('/org/governance/unused-access', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const dias = Number(request.query.get('days') ?? ajustes()?.unusedDays ?? 60);
    return {
      generatedAt: ahora(),
      days: dias,
      items: activos().flatMap((v) => {
        const sin = metaDeVinculo.get(v.id)?.diasSinUso ?? 0;
        return sin >= dias
          ? vivos(v.id).map((p) => ({
              userId: v.userId,
              engagementId: v.id,
              grantId: p.id,
              atoms: atomosDe(p),
              daysSinceUse: sin,
            }))
          : [];
      }),
    };
  });

  router.get('/org/governance/ownerless', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    return {
      generatedAt: ahora(),
      items: activos()
        .filter((v) => sinDueno(v.id))
        .map((v) => ({
          userId: v.userId,
          engagementId: v.id,
          templateCode: v.roleTemplate,
          reasons: ['NO_OWNER'],
        })),
    };
  });

  router.get('/org/governance/exceptions', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const soon = Date.now() + 30 * DIA_MS;
    return {
      generatedAt: ahora(),
      sodExceptions: excepcionesSod
        .filtrar((e) => e.status === 'ACTIVE')
        .map((e) => ({
          exceptionId: e.id,
          ruleCode: e.ruleCode,
          userId: vinculos.get(e.engagementId)?.userId ?? '',
          validTo: e.validTo,
        })),
      approvalsNotExecuted: aprobaciones
        .filtrar((a) => a.status === 'APPROVED')
        .map((a) => ({
          id: a.id,
          ...(a.requesterUserId === undefined ? {} : { requesterUserId: a.requesterUserId }),
          ...(a.approvedUntil === undefined ? {} : { approvedUntil: a.approvedUntil }),
        })),
      temporaryClinicalAccess: [],
      expiringGrants: permisos
        .filtrar(
          (p) =>
            p.status === 'ACTIVE' &&
            p.validTo !== undefined &&
            new Date(p.validTo).getTime() <= soon,
        )
        .map((p) => ({
          grantId: p.id,
          userId: vinculos.get(p.engagementId)?.userId ?? '',
          ...(p.validTo === undefined ? {} : { validTo: p.validTo }),
        })),
    };
  });

  router.get('/org/governance/anomalies', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const estado = request.query.get('status');
    const tipo = request.query.get('kind');
    if (tipo !== null && !(ANOMALY_KINDS as readonly string[]).includes(tipo))
      return validation('Ese tipo de anomalía no existe.', [
        { field: 'kind', message: 'tipo no válido' },
      ]);
    return lista(
      anomalias.filtrar(
        (a) => (estado === null || a.status === estado) && (tipo === null || a.kind === tipo),
      ),
    );
  });

  router.post('/org/governance/anomalies/:id/ack', (request) => {
    const actor = administradorOConAtomo(request, VER);
    if (!esActor(actor)) return actor;
    const a = anomalias.get(request.params['id']!);
    if (a === undefined) return noEncontrado('ANOMALY_NOT_FOUND');
    const d = cuerpo<{ status?: string; comment?: string }>(request);
    if (d.status !== 'ACKNOWLEDGED' && d.status !== 'DISMISSED' && d.status !== 'ESCALATED')
      return validation('Elija reconocer, descartar o escalar.', [
        { field: 'status', message: 'estado no válido' },
      ]);
    // Como la API real: una alerta ya atendida es 409, y solo DESCARTAR pide comentario (10 caracteres o más).
    if (a.status !== 'OPEN')
      return conMotivo(409, 'Esta alerta ya se atendió.', 'ANOMALY_ALREADY_RESOLVED');
    if (d.status === 'DISMISSED') {
      const c = textoObligatorio(d.comment, 10, 'ANOMALY_COMMENT_REQUIRED');
      if (!c.ok) return c.respuesta;
    }
    anomalias.actualizar(a.id, {
      status: d.status,
      acknowledgedAt: ahora(),
      ...(d.comment === undefined ? {} : { resolutionComment: d.comment.trim() }),
    });
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      `anomaly.${d.status.toLowerCase()}`,
      'Se resolvió una anomalía.',
    );
    return { ok: true, status: d.status };
  });

  router.post('/org/governance/reports/:kind/export', (request) => {
    const actor = administradorOConAtomo(request, 'audit.activity.export');
    if (!esActor(actor)) return actor;
    const tipo = request.params['kind']!;
    if (!(GOVERNANCE_REPORT_KINDS as readonly string[]).includes(tipo))
      return conMotivo(422, 'Ese informe no se puede exportar.', 'EXPORT_KIND_INVALID');
    const d = cuerpo<{ format?: string; reason?: string; reasonCode?: string }>(request);
    if (d.format !== 'csv' && d.format !== 'json')
      return validation('Elija el formato del archivo.', [
        { field: 'format', message: 'use csv o json' },
      ]);
    if (
      d.reasonCode !== undefined &&
      !['AUDIT_REVIEW', 'REGULATORY', 'INTERNAL_CONTROL', 'INCIDENT', 'OTHER'].includes(
        d.reasonCode,
      )
    )
      return validation('Esa clase de motivo no existe.', [
        { field: 'reasonCode', message: 'clase no válida' },
      ]);
    const motivo = textoObligatorio(d.reason, 10, 'EXPORT_REASON_REQUIRED');
    if (!motivo.ok) return motivo.respuesta;
    const paso = exigirPasoExtra(actor.user.id);
    if (paso !== null) return paso;
    const formato = d.format === 'json' ? 'json' : 'csv';
    const contenido =
      formato === 'json'
        ? JSON.stringify({ kind: tipo, rows: vinculos.todos().length })
        : `informe,filas\n${tipo},${vinculos.todos().length}`;
    anotar(
      actor.tenantId,
      nombreDe(actor.user),
      'governance.report_exported',
      `Se exportó el informe ${tipo}.`,
    );
    return {
      format: formato,
      kind: tipo,
      generatedAt: ahora(),
      generatedBy: actor.user.id,
      filters: {},
      rowCount: vinculos.todos().length,
      sha256: uuid(contenido).replaceAll('-', '').padEnd(64, 'b'),
      content: contenido,
    };
  });

  router.get('/me/practitioner/governance-panel', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const doctor = doctorDe(sesion.user);
    if (doctor === undefined) return forbidden('Esta pantalla es para quien atiende.');
    const equipo = vinculos.filtrar(
      (v) =>
        v.status === 'ACTIVE' &&
        v.tenantId === doctor.tenantId &&
        vivos(v.id).some((p) => p.practitionerRoleAssignmentId === doctor.id),
    );
    const pendientes = itemsDeRevision.filtrar(
      (i) => i.reviewerUserId === sesion.user.id && i.state === 'PENDING',
    ).length;
    return {
      generatedAt: ahora(),
      team: equipo.map((v) => ({
        userId: v.userId,
        engagementId: v.id,
        templateCode: v.roleTemplate,
        liveGrants: vivos(v.id).length,
      })),
      pendingReviews: pendientes,
      openAnomalies: anomalias
        .filtrar((a) => a.status === 'OPEN' && equipo.some((v) => v.userId === a.userId))
        .map((a) => ({
          id: a.id,
          userId: a.userId,
          kindConceptId: a.kind,
          windowStart: a.windowStart,
          observed: a.observed,
          threshold: a.threshold,
        })),
    };
  });
}
