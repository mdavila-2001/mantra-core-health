import { HttpHeaders } from '@angular/common/http';

import type {
  ExplainAccessResponse,
  PermissionCatalog,
  SimulateAccessResponse,
} from '../../data-access/access-governance/access-explain.types';
import type {
  AccessMatrix,
  Anomaly,
  Campaign,
  ExceptionsReport,
  GovernanceSummary,
  SupportApproval,
  TeamMemberList,
} from '../../data-access/access-governance/access-governance.types';
import type { SupportGrant } from '../../data-access/support-access/support-access.types';
import { GENTE, itemsDeRevision, aprobaciones } from '../fixtures/support-hospital-governance';
import { permisos, vinculos } from '../fixtures/support-hospital';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import { CODIGO_DE_PRUEBA } from './iam-mfa.store';
import { reiniciarElGobiernoDeAccesos, reiniciarLaSesionDelSimulador } from './mock-reset';

/**
 * El backend simulado del gobierno de accesos con la **forma** de la API: paso extra, cuatro ojos, comentario obligatorio,
 * 404 uniforme, traspaso, alcance de quien administra y respuestas fijas de explicar y simular. Cada prueba parte del
 * piloto de fábrica (`isolate: false`: el estado de un archivo lo vería el siguiente).
 */
let router: MockRouter;
const org = buscarUsuario('hospital_piloto')!;
const sofia = buscarUsuario('sofia')!;
const marcos = buscarUsuario('marcos')!;
const ana = buscarUsuario('ana')!;
const perez = buscarUsuario('perez')!;
const suarez = buscarUsuario('suarez')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}
interface Error422 {
  reason?: string;
  code?: string;
  details?: Record<string, unknown>;
}

function llamar<T = unknown>(
  user: MockUser | null,
  method: MockMethod,
  path: string,
  body?: unknown,
  query: Record<string, string> = {},
): Respuesta<T> {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(query),
    body: body ?? null,
    headers: new HttpHeaders({ 'X-Tenant-Id': TENANT_HOSPITAL_PILOTO }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}
const comoOrg = <T = unknown>(
  method: MockMethod,
  path: string,
  body?: unknown,
  query?: Record<string, string>,
) => llamar<T>(org, method, path, body, query);
const conPasoExtra = (user: MockUser = org): void => {
  expect(llamar(user, 'POST', '/iam/me/step-up', { code: CODIGO_DE_PRUEBA }).status).toBe(200);
};

describe('gobierno de accesos en el simulador', () => {
  beforeEach(() => {
    reiniciarLaSesionDelSimulador();
    reiniciarElGobiernoDeAccesos();
    router = crearRouterSimulado();
  });

  describe('catálogo y permisos con átomos', () => {
    it('sirve los 73 átomos, las 7 categorías y los 15 alias', () => {
      const c = comoOrg<PermissionCatalog>('GET', '/org/permission-catalog').body;
      expect([c.atoms.length, c.categories.length, c.aliases.length]).toEqual([73, 7, 15]);
    });

    it('los permisos de Ana traen átomos, efecto y el resumen de sus condiciones; la prohibición expresa va como DENY', () => {
      const grants = comoOrg<readonly SupportGrant[]>(
        'GET',
        `/org/support-engagements/${GENTE.ana.engagementId}/grants`,
      ).body;
      const rojas = grants.find((g) => g.id === uuid('hp-grant-ana-rojas'))!;
      expect(rojas).toMatchObject({ origin: 'ATOM', effect: 'ALLOW' });
      expect(rojas.atoms).toContain('agenda.appointment.cancel');
      expect(rojas.conditionsSummary).toContain('lunes a viernes de 07:30 a 18:30');
      expect(grants.find((g) => g.id === uuid('hp-grant-ana-perez'))).toMatchObject({
        origin: 'LEGACY',
      });
      expect(grants.find((g) => g.id === uuid('hp-grant-ana-rojas-deny'))).toMatchObject({
        effect: 'DENY',
        atoms: ['agenda.appointment.view.reason'],
      });
    });

    it('el resumen y los átomos efectivos del vínculo salen del servidor; uno ajeno es 404 uniforme', () => {
      const efectivo = comoOrg<{ atoms: { atom: string; origin: string }[]; denied: unknown[] }>(
        'GET',
        `/org/support-engagements/${GENTE.ana.engagementId}/effective`,
      ).body;
      expect(efectivo.atoms.some((a) => a.atom === 'agenda.appointment.cancel')).toBe(true);
      expect(efectivo.denied).toHaveLength(1);
      expect(comoOrg('GET', `/org/support-engagements/${uuid('no-existe')}/summary`).status).toBe(
        404,
      );
    });
  });

  describe('paso extra', () => {
    it('una regla nueva sin paso extra es 403 STEP_UP_REQUIRED con lo que hace falta; con el código de prueba pasa', () => {
      const sin = comoOrg<Error422>('POST', '/org/governance/rules', {
        kind: 'DENY_PERMISSION',
        permissionPattern: 'patients.profile.register',
        roleTemplateCode: 'FRONT_DESK',
      });
      expect(sin.status).toBe(403);
      expect(sin.body).toMatchObject({
        reason: 'STEP_UP_REQUIRED',
        details: { maxAgeMinutes: 10, enrolled: true },
      });
      expect(comoOrg<Error422>('POST', '/iam/me/step-up', { code: '000000' }).body.reason).toBe(
        'MFA_CODE_INVALID',
      );
      conPasoExtra();
      expect(comoOrg('GET', '/iam/me/step-up').body).toMatchObject({ fresh: true });
      expect(
        comoOrg('POST', '/org/governance/rules', {
          kind: 'DENY_PERMISSION',
          permissionPattern: 'patients.profile.register',
          roleTemplateCode: 'FRONT_DESK',
        }).status,
      ).toBe(201);
    });
  });

  describe('reglas de la organización, ajustes y SoD', () => {
    it('crea, edita con la versión que vio, rechaza una edición desfasada y retira sin borrar', () => {
      conPasoExtra();
      const creada = comoOrg<{ id: string; rowVersion: number }>('POST', '/org/governance/rules', {
        kind: 'CEILING',
        permissionPattern: 'reports.*',
        roleTemplateCode: 'FRONT_DESK',
      }).body;
      expect(
        comoOrg<Error422>('POST', '/org/governance/rules', {
          kind: 'CEILING',
          permissionPattern: 'reports.*',
          roleTemplateCode: 'FRONT_DESK',
        }).body.reason,
      ).toBe('GOVERNANCE_RULE_DUPLICATE');
      expect(
        comoOrg('PATCH', `/org/governance/rules/${creada.id}`, {
          expectedRowVersion: 1,
          message: 'Sin reportes',
        }).status,
      ).toBe(200);
      expect(
        comoOrg<Error422>('PATCH', `/org/governance/rules/${creada.id}`, {
          expectedRowVersion: 1,
          message: 'otra',
        }).body,
      ).toMatchObject({ reason: 'ROW_VERSION_CONFLICT' });
      comoOrg('POST', `/org/governance/rules/${creada.id}/retire`);
      expect(
        comoOrg<{ items: { status: string }[] }>('GET', '/org/governance/rules', undefined, {
          status: 'REVOKED',
        }).body.items,
      ).toHaveLength(1);
    });

    it('un ajuste inválido es 422; uno válido se guarda', () => {
      conPasoExtra();
      expect(
        comoOrg<Error422>('PUT', '/org/governance/settings', { inactivityDays: 0 }).body.reason,
      ).toBe('GOVERNANCE_SETTINGS_INVALID');
      expect(
        comoOrg<{ settings: { inactivityDays: number }; isDefault: boolean }>(
          'PUT',
          '/org/governance/settings',
          { inactivityDays: 30 },
        ).body,
      ).toMatchObject({ settings: { inactivityDays: 30 }, isDefault: false });
    });

    it('lista las 11 reglas de plataforma de solo lectura y no admite excepción a una regla dura', () => {
      conPasoExtra();
      const reglas = comoOrg<{ items: { code: string; platform: boolean }[] }>(
        'GET',
        '/org/governance/sod-rules',
      ).body.items;
      expect(reglas.filter((r) => r.platform)).toHaveLength(11);
      expect(
        comoOrg<Error422>('POST', '/org/governance/sod-exceptions', {
          engagementId: GENTE.ana.engagementId,
          ruleCode: 'SOD-BILL-01',
          justification: 'x'.repeat(40),
          validTo: '2026-12-31',
        }).body.reason,
      ).toBe('SOD_RULE_HARD');
      expect(
        comoOrg<Error422>('PATCH', '/org/governance/sod-rules/SOD-BILL-01', {
          expectedRowVersion: 1,
        }).body.reason,
      ).toBe('SOD_RULE_PLATFORM_READ_ONLY');
    });

    it('la excepción exige justificación de 40 caracteres y crea un cuatro ojos que quien la pidió no puede aprobar', () => {
      expect(
        comoOrg<Error422>('POST', '/org/governance/sod-exceptions', {
          engagementId: GENTE.lucia.engagementId,
          ruleCode: 'SOD-BILL-03',
          justification: 'corta',
          validTo: '2026-12-31',
        }).status,
      ).toBe(422);
      const creada = comoOrg<{ approvalId: string }>('POST', '/org/governance/sod-exceptions', {
        engagementId: GENTE.lucia.engagementId,
        ruleCode: 'SOD-BILL-03',
        justification: 'Atiende sola el mostrador de la mañana y no hay otra persona.',
        validTo: '2026-12-31',
      });
      expect(creada.status).toBe(202);
      expect(
        comoOrg<Error422>('POST', `/approvals/${creada.body.approvalId}/decision`, {
          decision: 'APPROVE',
        }).body.reason,
      ).toBe('FOUR_EYES_SELF_APPROVAL');
    });

    it('el hallazgo de Ricardo trae su excepción vigente y las banderas de pacientes se reemplazan enteras', () => {
      const f = comoOrg<{ items: { ruleCode: string; exceptionId?: string }[] }>(
        'GET',
        '/org/governance/sod-findings',
      ).body.items;
      expect(f[0]).toMatchObject({ ruleCode: 'SOD-GOV-03' });
      expect(f[0]!.exceptionId).toBeDefined();
      const p = uuid('demo-gov-patient-carmen-ortuno');
      expect(
        comoOrg<{ flags: unknown[] }>('PUT', `/org/patients/${p}/restriction-flags`, {
          flags: [{ flag: 'VIP', reason: 'Autoridad pública' }],
        }).body.flags,
      ).toHaveLength(1);
      expect(
        comoOrg<{ flags: unknown[] }>('PUT', `/org/patients/${p}/restriction-flags`, { flags: [] })
          .body.flags,
      ).toHaveLength(0);
    });
  });

  describe('cuatro ojos', () => {
    it('el doctor titular ve y decide lo suyo; otro doctor no es elegible; al aprobar queda vigente', () => {
      const pendienteId = aprobaciones.todos()[0]!.id;
      expect(
        llamar<{ items: SupportApproval[] }>(suarez, 'GET', '/approvals/pending').body.items,
      ).toHaveLength(1);
      expect(
        llamar<{ items: SupportApproval[] }>(perez, 'GET', '/approvals/pending').body.items,
      ).toHaveLength(0);
      expect(
        llamar<Error422>(perez, 'POST', `/approvals/${pendienteId}/decision`, {
          decision: 'APPROVE',
        }).body.reason,
      ).toBe('FOUR_EYES_NOT_ELIGIBLE');
      expect(
        llamar<Error422>(suarez, 'POST', `/approvals/${pendienteId}/decision`, {
          decision: 'REJECT',
        }).status,
      ).toBe(422);
      const r = llamar<{ approval: SupportApproval }>(
        suarez,
        'POST',
        `/approvals/${pendienteId}/decision`,
        { decision: 'APPROVE' },
      );
      expect(r.body.approval).toMatchObject({ status: 'APPROVED' });
      expect(
        llamar<Error422>(suarez, 'POST', `/approvals/${pendienteId}/decision`, {
          decision: 'APPROVE',
        }).body.reason,
      ).toBe('FOUR_EYES_NOT_PENDING');
    });

    it('la persona de apoyo pide aprobación de una acción, ve la suya y puede cancelarla', () => {
      const nueva = llamar<SupportApproval>(ana, 'POST', '/me/support-approvals', {
        tenantId: TENANT_HOSPITAL_PILOTO,
        atom: 'agenda.appointment.cancel',
        reasonText: 'Cita con menos de 24 horas',
      });
      expect(nueva.status).toBe(201);
      expect(
        llamar<Error422>(ana, 'POST', '/me/support-approvals', {
          tenantId: TENANT_HOSPITAL_PILOTO,
          atom: 'agenda.appointment.cancel',
          reasonText: 'Cita con menos de 24 horas',
        }).body.reason,
      ).toBe('FOUR_EYES_DUPLICATE_PENDING');
      expect(llamar<{ count: number }>(ana, 'GET', '/me/support-approvals').body.count).toBe(1);
      expect(
        llamar<SupportApproval>(ana, 'POST', `/me/support-approvals/${nueva.body.id}/cancel`).body
          .status,
      ).toBe('CANCELLED');
    });
  });

  describe('campañas de certificación', () => {
    it('la campaña del piloto está vencida con tres ítems pendientes ya escalados', () => {
      const c = comoOrg<{ items: Campaign[] }>('GET', '/org/access-reviews/campaigns').body
        .items[0]!;
      expect(c).toMatchObject({
        name: 'Certificación Q4-2026',
        status: 'OPEN',
        uncertifiedAction: 'UNCERTIFIED_REVOKE',
      });
      const r = comoOrg<{ pending: number; byDecision: Record<string, number> }>(
        'GET',
        `/org/access-reviews/campaigns/${c.id}/results`,
      ).body;
      expect(r.pending).toBe(4);
      expect(r.byDecision).toMatchObject({ CERTIFIED: 1, REVOKED: 1 });
    });

    it('el revisor decide con evidencia: comentario obligatorio en ALTA, ajuste que solo reduce, masivo todo o nada y 404 uniforme', () => {
      const mios = comoOrg<{
        items: { id: string; maxSensitivity: string; subjectName: string }[];
      }>('GET', '/me/access-reviews/items').body.items;
      const alta = mios.find((i) => i.subjectName === 'Sofía Camacho')!;
      expect(
        comoOrg<Error422>('POST', `/me/access-reviews/items/${alta.id}/decision`, {
          decision: 'CERTIFY',
        }).body.reason,
      ).toBe('REVIEW_COMMENT_REQUIRED');
      expect(
        comoOrg<Error422>('POST', `/me/access-reviews/items/${alta.id}/decision`, {
          decision: 'ADJUST',
          comment: 'Reducir sus permisos',
          adjustment: { atoms: ['billing.payment.refund'] },
        }).body.reason,
      ).toBe('REVIEW_ADJUST_CANNOT_BROADEN');
      expect(
        comoOrg<{ evidence: { summary: string } }>('GET', `/me/access-reviews/items/${alta.id}`)
          .body.evidence.summary,
      ).toContain('Sofía');
      expect(
        comoOrg<Error422>('POST', '/me/access-reviews/items/bulk-decision', {
          itemIds: [alta.id],
          decision: 'CERTIFY',
        }).body,
      ).toMatchObject({ reason: 'REVIEW_BULK_NOT_ALLOWED', details: { itemIds: [alta.id] } });
      expect(
        comoOrg('POST', `/me/access-reviews/items/${alta.id}/decision`, {
          decision: 'CERTIFY',
          comment: 'Su función lo exige y la usa a diario.',
        }).status,
      ).toBe(200);
      expect(
        comoOrg<Error422>('POST', `/me/access-reviews/items/${alta.id}/decision`, {
          decision: 'CERTIFY',
          comment: 'otra vez',
        }).body.reason,
      ).toBe('REVIEW_ALREADY_DECIDED');
      const ajeno = itemsDeRevision.todos().find((i) => i.reviewerUserId !== org.id)!;
      expect(comoOrg<Error422>('GET', `/me/access-reviews/items/${ajeno.id}`).status).toBe(404);
    });

    it('cerrar la campaña revoca lo no certificado y deja los vínculos intactos', () => {
      const c = comoOrg<{ items: Campaign[] }>('GET', '/org/access-reviews/campaigns').body
        .items[0]!;
      const cierre = comoOrg<{ autoRevoked: number }>(
        'POST',
        `/org/access-reviews/campaigns/${c.id}/close`,
      ).body;
      expect(cierre.autoRevoked).toBe(4);
      expect(vinculos.get(GENTE.sofia.engagementId)!.status).toBe('ACTIVE');
      expect(
        comoOrg<Error422>('POST', `/org/access-reviews/campaigns/${c.id}/close`).body.reason,
      ).toBe('REVIEW_CAMPAIGN_NOT_OPEN');
    });

    it('arma, previsualiza y lanza una campaña nueva; un alcance sin nada es 422', () => {
      const borrador = {
        name: 'Dirigida de prueba',
        kind: 'TARGETED',
        scope: { kind: 'ORGANIZATION' },
        dueAt: '2026-12-01',
        filters: { minSensitivity: 'HIGH' },
      };
      expect(
        comoOrg<{ total: number }>('POST', '/org/access-reviews/campaigns/preview', borrador).body
          .total,
      ).toBeGreaterThan(0);
      expect(
        comoOrg<Error422>('POST', '/org/access-reviews/campaigns', {
          ...borrador,
          filters: { minSensitivity: 'CRITICAL' },
        }).body.reason,
      ).toBe('REVIEW_SCOPE_EMPTY');
      // La API real contesta solo `{ id }` (`ResourceCreatedDto`); el detalle se pide con GET (B7c, #53).
      const creada = comoOrg<{ id: string }>('POST', '/org/access-reviews/campaigns', borrador);
      expect(creada.status).toBe(201);
      expect(Object.keys(creada.body)).toEqual(['id']);
      const c = comoOrg<Campaign>('GET', `/org/access-reviews/campaigns/${creada.body.id}`).body;
      expect(c.status).toBe('DRAFT');
      expect(
        comoOrg<{ items: number }>('POST', `/org/access-reviews/campaigns/${c.id}/launch`).body
          .items,
      ).toBeGreaterThan(0);
      expect(
        comoOrg<Error422>('PATCH', `/org/access-reviews/campaigns/${c.id}`, { name: 'otro' }).body
          .reason,
      ).toBe('REVIEW_CAMPAIGN_NOT_DRAFT');
    });
  });

  describe('informes y anomalías', () => {
    it('el tablero trae los diez mosaicos con los números del piloto', () => {
      const t = comoOrg<GovernanceSummary>('GET', '/org/governance/summary').body.tiles;
      expect(t).toMatchObject({
        ownerlessAccounts: 1,
        inactiveAccounts: 1,
        activeSodExceptions: 1,
        openAnomalies: 2,
        overdueCertifications: 4,
        breakGlassUnreviewed: 0,
      });
      expect(Object.keys(t)).toHaveLength(10);
    });

    it('la matriz por persona trae siete categorías; por doctor pide el id; Marcos figura sin efecto sobre el Dr. Pérez', () => {
      const m = comoOrg<Extract<AccessMatrix, { by: 'person' }>>(
        'GET',
        '/org/governance/access-matrix',
        undefined,
        { by: 'person' },
      ).body;
      expect(m.columns).toHaveLength(7);
      expect(
        m.rows.find((r) => r.userId === GENTE.ana.userId)!.cells['SUPPORT_AGENDA']!.status,
      ).toBe('CONDITIONAL');
      expect(
        comoOrg<Error422>('GET', '/org/governance/access-matrix', undefined, { by: 'doctor' }).body
          .reason,
      ).toBe('MATRIX_DIMENSION_INVALID');
      expect(
        comoOrg<Error422>('GET', '/org/governance/access-matrix', undefined, { by: 'espacio' }).body
          .reason,
      ).toBe('MATRIX_DIMENSION_INVALID');
    });

    it('la deriva de privilegios, lo sin uso, lo sin dueño y las excepciones salen de los fixtures', () => {
      expect(
        comoOrg<{ items: { name: string; flagged: boolean }[] }>(
          'GET',
          '/org/governance/privilege-creep',
        ).body.items.some((i) => i.flagged),
      ).toBe(false);
      expect(
        comoOrg<{ items: { userId: string }[] }>(
          'GET',
          '/org/governance/unused-access',
          undefined,
          { days: '60' },
        ).body.items.every((i) => i.userId === GENTE.pablo.userId),
      ).toBe(true);
      expect(
        comoOrg<{ items: { userId: string }[] }>('GET', '/org/governance/ownerless').body.items.map(
          (i) => i.userId,
        ),
      ).toEqual([GENTE.nora.userId]);
      expect(
        comoOrg<ExceptionsReport>('GET', '/org/governance/exceptions').body.sodExceptions,
      ).toHaveLength(1);
    });

    it('reconocer, descartar y escalar: descartar pide comentario', () => {
      const a = comoOrg<{ items: Anomaly[] }>('GET', '/org/governance/anomalies', undefined, {
        status: 'OPEN',
        kind: 'ANOMALY_SEARCH_SPIKE',
      }).body.items[0]!;
      expect(a).toMatchObject({ observed: 18, baseline: 4 });
      expect(
        comoOrg('POST', `/org/governance/anomalies/${a.id}/ack`, { status: 'DISMISSED' }).status,
      ).toBe(422);
      expect(
        comoOrg('POST', `/org/governance/anomalies/${a.id}/ack`, {
          status: 'DISMISSED',
          comment: 'Era una campaña de recordatorios',
        }).status,
      ).toBe(200);
      expect(
        comoOrg<{ count: number }>('GET', '/org/governance/anomalies', undefined, {
          status: 'OPEN',
        }).body.count,
      ).toBe(1);
    });

    it('exportar pide motivo, luego paso extra, y devuelve el archivo con su sha256', () => {
      expect(
        comoOrg<Error422>('POST', '/org/governance/reports/access-matrix/export', {
          format: 'csv',
          reason: 'corto',
        }).body.reason,
      ).toBe('EXPORT_REASON_REQUIRED');
      expect(
        comoOrg<Error422>('POST', '/org/governance/reports/access-matrix/export', {
          format: 'csv',
          reason: 'Auditoría trimestral',
        }).body.reason,
      ).toBe('STEP_UP_REQUIRED');
      conPasoExtra();
      expect(
        comoOrg<Error422>('POST', '/org/governance/reports/inventado/export', {
          format: 'csv',
          reason: 'Auditoría trimestral',
        }).body.reason,
      ).toBe('EXPORT_KIND_INVALID');
      expect(
        comoOrg<{ sha256: string }>('POST', '/org/governance/reports/access-matrix/export', {
          format: 'csv',
          reason: 'Auditoría trimestral',
        }).body.sha256,
      ).toMatch(/^[0-9a-f]{64}$/);
    });

    it('el doctor ve su panel «Mi equipo»; quien no atiende, no', () => {
      expect(
        llamar<{ team: unknown[] }>(perez, 'GET', '/me/practitioner/governance-panel').body.team
          .length,
      ).toBeGreaterThan(0);
      expect(llamar(ana, 'GET', '/me/practitioner/governance-panel').status).toBe(403);
    });
  });

  describe('ciclo de vida', () => {
    it('dar de baja a Ricardo (dueño de Lucía) sin nuevo responsable es 422 y no cambia nada', () => {
      const r = comoOrg<Error422>(
        'POST',
        `/org/support-engagements/${GENTE.ricardo.engagementId}/offboard`,
        { reason: 'Renuncia al hospital' },
      );
      expect(r.body.reason).toBe('HANDOVER_SUPERVISOR_REQUIRED');
      expect(vinculos.get(GENTE.ricardo.engagementId)!.status).toBe('ACTIVE');
    });

    it('la baja de Pablo revoca primero y reasigna después: 5 reasignados y 1 devuelto a la bandeja común', () => {
      const prev = comoOrg<{ counts: Record<string, number> }>(
        'GET',
        `/org/support-engagements/${GENTE.pablo.engagementId}/handover-preview`,
      ).body;
      expect(prev.counts).toMatchObject({ CONVERSATION: 3, WORKFLOW_TASK: 2, PENDING_BOOKING: 1 });
      const r = comoOrg<{ caseId: string; handover: { status: string } }>(
        'POST',
        `/org/support-engagements/${GENTE.pablo.engagementId}/offboard`,
        { reason: 'Se va del hospital', handover: { defaultToUserId: GENTE.ana.userId } },
      ).body;
      expect(r.handover).toMatchObject({ status: 'COMPLETED', pending: 0 });
      expect(vinculos.get(GENTE.pablo.engagementId)!.status).toBe('ENDED');
      expect(
        permisos.filtrar(
          (p) => p.engagementId === GENTE.pablo.engagementId && p.status === 'ACTIVE',
        ),
      ).toHaveLength(0);
      const caso = comoOrg<{ handover: { status: string }[]; status: string }>(
        'GET',
        `/org/lifecycle/cases/${r.caseId}`,
      ).body;
      expect(caso.status).toBe('COMPLETED');
      expect(caso.handover.filter((h) => h.status === 'REASSIGNED')).toHaveLength(5);
      expect(caso.handover.filter((h) => h.status === 'RETURNED_TO_POOL')).toHaveLength(1);
    });

    it('suspender es inmediato y reactivar crea un cuatro ojos (202)', () => {
      expect(
        comoOrg('POST', `/org/support-engagements/${GENTE.marcos.engagementId}/suspend`, {
          reasonCode: 'INVESTIGATION',
        }).status,
      ).toBe(200);
      expect(vinculos.get(GENTE.marcos.engagementId)!.status).toBe('SUSPENDED');
      expect(
        comoOrg<Error422>('POST', `/org/support-engagements/${GENTE.marcos.engagementId}/suspend`, {
          reasonCode: 'MANUAL',
        }).body.reason,
      ).toBe('ENGAGEMENT_ALREADY_SUSPENDED');
      const r = comoOrg<{ approvalId: string }>(
        'POST',
        `/org/support-engagements/${GENTE.marcos.engagementId}/reactivate`,
        { reason: 'Investigación cerrada' },
      );
      expect(r.status).toBe(202);
      expect(
        comoOrg<Error422>('POST', `/approvals/${r.body.approvalId}/decision`, {
          decision: 'APPROVE',
        }).body.reason,
      ).toBe('FOUR_EYES_SELF_APPROVAL');
    });

    it('un cambio que sube mucho el puntaje pide cuatro ojos (202); uno chico se ejecuta', () => {
      const sinPaso = comoOrg<Error422>(
        'POST',
        `/org/support-engagements/${GENTE.nora.engagementId}/move`,
        { reason: 'Pasa a Internación', grants: [] },
      );
      expect(sinPaso.body.reason).toBe('STEP_UP_REQUIRED');
      conPasoExtra();
      const grande = comoOrg<{ status: string; delta: number }>(
        'POST',
        `/org/support-engagements/${GENTE.nora.engagementId}/move`,
        {
          reason: 'Pasa a cobrar y corregir datos',
          grants: [
            {
              targetKind: 'ALL',
              actions: [
                'billing.receipt.void',
                'patients.profile.edit_verified',
                'billing.payment.refund',
              ],
            },
          ],
        },
      );
      expect(grande.status).toBe(202);
      expect(grande.body.delta).toBeGreaterThan(10);
      expect(
        comoOrg<{ status: string }>(
          'POST',
          `/org/support-engagements/${GENTE.nora.engagementId}/move`,
          {
            reason: 'Solo ver la agenda ahora',
            grants: [{ targetKind: 'ALL', actions: ['agenda.appointment.view'] }],
          },
        ).status,
      ).toBe(200);
    });

    it('el ingreso de Nora queda abierto hasta asignar dueño; asignarlo completa el paso', () => {
      const abierto = comoOrg<{ items: { id: string; subjectUserId: string; status: string }[] }>(
        'GET',
        '/org/lifecycle/cases',
        undefined,
        { kind: 'JOINER', status: 'OPEN' },
      ).body.items;
      expect(abierto.map((c) => c.subjectUserId)).toEqual([GENTE.nora.userId]);
      expect(
        comoOrg('PUT', `/org/support-engagements/${GENTE.nora.engagementId}/owner`, {
          supervisorUserId: GENTE.nora.userId,
        }).status,
      ).toBe(422);
      expect(
        comoOrg('PUT', `/org/support-engagements/${GENTE.nora.engagementId}/owner`, {
          supervisorUserId: GENTE.sofia.userId,
        }).status,
      ).toBe(200);
      const caso = comoOrg<{ checklist: { code: string; status: string }[] }>(
        'GET',
        `/org/lifecycle/cases/${abierto[0]!.id}`,
      ).body;
      expect(caso.checklist.find((c) => c.code === 'SUPERVISOR_ASSIGNED')!.status).toBe('DONE');
      expect(
        comoOrg<Error422>(
          'POST',
          `/org/lifecycle/cases/${abierto[0]!.id}/checklist/CONFIDENTIALITY_ACK`,
        ).body.reason,
      ).toBe('LIFECYCLE_ITEM_AUTOMATIC');
    });
  });

  describe('administración delegada', () => {
    it('Sofía administra solo su servicio: sus capacidades son DELEGATED y su lista excluye a quien no es de Ecografía', () => {
      expect(
        llamar<{ mode: string; atoms: string[] }>(sofia, 'GET', '/org/team/capabilities').body,
      ).toMatchObject({ mode: 'DELEGATED' });
      const lista = llamar<TeamMemberList>(sofia, 'GET', '/org/team/members').body.items;
      const nombres = lista.map((m) => m.personName);
      expect(nombres).toContain('Marcos Ribera');
      expect(nombres).not.toContain('Ana Gutiérrez');
      expect(nombres).not.toContain('Lucía Paz');
      const m = lista.find((x) => x.personName === 'Marcos Ribera')!;
      expect(m.otherFunctions).toBe(1);
      expect(m.grants).toHaveLength(1);
    });

    it('un ítem fuera de su alcance es 404 uniforme; el administrador de seguridad ve todo (FULL)', () => {
      expect(llamar(sofia, 'GET', `/org/team/members/${GENTE.ana.engagementId}`).status).toBe(404);
      expect(comoOrg<{ mode: string }>('GET', '/org/team/capabilities').body.mode).toBe('FULL');
    });

    it('otorgar: dentro del techo y alcance pasa; cobrar excede el techo; otro servicio excede el alcance; a sí misma no', () => {
      conPasoExtra(sofia);
      const nuevo = {
        targetKind: 'SERVICE',
        healthcareServiceId: uuid('hp-svc-ecografia'),
        expansionMode: 'DYNAMIC',
      };
      expect(
        llamar(sofia, 'POST', `/org/team/members/${GENTE.marcos.engagementId}/grants`, {
          ...nuevo,
          actions: ['agenda.appointment.view', 'agenda.appointment.create'],
        }).status,
      ).toBe(201);
      expect(
        llamar<Error422>(sofia, 'POST', `/org/team/members/${GENTE.marcos.engagementId}/grants`, {
          ...nuevo,
          actions: ['billing.payment.collect'],
        }).body.reason,
      ).toBe('ADMIN_CEILING_EXCEEDED');
      expect(
        llamar<Error422>(sofia, 'POST', `/org/team/members/${GENTE.marcos.engagementId}/grants`, {
          ...nuevo,
          healthcareServiceId: uuid('hp-svc-consulta-cardiologia'),
          actions: ['agenda.appointment.view'],
        }).body.reason,
      ).toBe('ADMIN_SCOPE_EXCEEDED');
      expect(
        llamar<Error422>(sofia, 'POST', `/org/team/members/${GENTE.marcos.engagementId}/grants`, {
          ...nuevo,
          actions: ['agenda.appointment.view'],
          validTo: '2030-01-01',
        }).body.reason,
      ).toBe('ADMIN_CEILING_EXCEEDED');
    });

    it('sin el paso extra, otorgar es 403 STEP_UP_REQUIRED', () => {
      expect(
        llamar<Error422>(sofia, 'POST', `/org/team/members/${GENTE.marcos.engagementId}/grants`, {
          targetKind: 'SERVICE',
          healthcareServiceId: uuid('hp-svc-ecografia'),
          actions: ['agenda.appointment.view'],
        }).body.reason,
      ).toBe('STEP_UP_REQUIRED');
    });

    it('una persona sin átomos de equipo no pasa: el mismo 403 genérico', () => {
      expect(llamar(marcos, 'GET', '/org/team/members').status).toBe(403);
    });
  });

  describe('explicar y simular', () => {
    it('Marcos cancela con 6 horas: CHALLENGE de aprobación del doctor, con lo que puede hacer y lo que puede cambiar el administrador', () => {
      const e = comoOrg<ExplainAccessResponse>('POST', '/org/access/explain', {
        engagementId: GENTE.marcos.engagementId,
        action: 'agenda.appointment.cancel',
        at: '2026-11-03T10:30:00-04:00',
        practitionerRoleAssignmentId: uuid('hp-doc-suarez'),
      }).body;
      expect(e.decision).toMatchObject({
        effect: 'CHALLENGE',
        allowed: false,
        reason: 'APPROVAL_REQUIRED',
      });
      expect(e.missing[0]).toMatchObject({ kind: 'APPROVAL', by: 'DOCTOR' });
      expect(e.adminFixes?.[0]).toMatchObject({ type: 'RELAX_CONDITION' });
      expect(e.reasons.filter((r) => r.passed)).toHaveLength(7);
      const con = comoOrg<ExplainAccessResponse>('POST', '/org/access/explain', {
        engagementId: GENTE.marcos.engagementId,
        action: 'agenda.appointment.cancel',
        at: '2026-11-03T10:30:00-04:00',
        assume: { approvalGranted: true, reasonProvided: true },
      }).body;
      expect(con.decision.effect).toBe('PERMIT');
    });

    it('Ana fuera de su horario: DENY TIME_WINDOW', () => {
      const e = comoOrg<ExplainAccessResponse>('POST', '/org/access/explain', {
        engagementId: GENTE.ana.engagementId,
        action: 'agenda.appointment.cancel',
        at: '2026-11-03T19:10:00-04:00',
        assume: { reasonProvided: true },
      }).body;
      expect(e.decision).toMatchObject({ effect: 'DENY', reason: 'TIME_WINDOW', unmet: ['time'] });
    });

    it('sobre un paciente confidencial, la prohibición expresa gana aunque otro permiso incluya el motivo', () => {
      const e = comoOrg<ExplainAccessResponse>('POST', '/org/access/explain', {
        engagementId: GENTE.ana.engagementId,
        action: 'agenda.appointment.view.reason',
        patientProfileId: uuid('demo-gov-patient-reservado-02'),
        at: '2026-11-03T10:30:00-04:00',
      }).body;
      expect(e.decision).toMatchObject({ effect: 'DENY', reason: 'EXPLICIT_DENY' });
    });

    it('el autoservicio no trae adminFixes sino askAdmin; el doctor solo pregunta por su agenda', () => {
      const mio = llamar<ExplainAccessResponse>(marcos, 'POST', '/me/support-access/explain', {
        tenantId: TENANT_HOSPITAL_PILOTO,
        action: 'schedule.view',
      }).body;
      expect(mio.adminFixes).toBeUndefined();
      expect(mio.askAdmin).toContain('Pida a su administrador');
      expect(
        llamar(perez, 'POST', '/me/practitioner/support-team/explain', {
          engagementId: GENTE.ana.engagementId,
          action: 'schedule.view',
          practitionerRoleAssignmentId: uuid('hp-doc-rojas'),
        }).status,
      ).toBe(404);
      const delDoctor = llamar<ExplainAccessResponse>(perez, 'POST', '/me/practitioner/support-team/explain', {
        engagementId: GENTE.ana.engagementId,
        action: 'schedule.view',
        practitionerRoleAssignmentId: uuid('hp-doc-perez'),
      });
      expect(delDoctor.status).toBe(200);
      // Pendiente 79: la API real tampoco manda `adminFixes` al doctor (eso es de la administración): manda `askAdmin`.
      expect(delDoctor.body.adminFixes).toBeUndefined();
      expect(delDoctor.body.askAdmin).toContain('Pida a su administrador');
    });

    it('simular: un borrador con cobro para una secretaria no es válido; una condición desconocida y una franja vacía tampoco', () => {
      const s = comoOrg<SimulateAccessResponse>('POST', '/org/access/simulate', {
        engagementId: GENTE.ana.engagementId,
        draft: {
          mode: 'PATCH',
          grants: [
            {
              effect: 'ALLOW',
              actions: ['billing.payment.collect'],
              practitionerRoleAssignmentId: uuid('hp-doc-perez'),
            },
          ],
        },
      }).body;
      expect(s.valid).toBe(false);
      expect(s.validation.errors.map((e) => e.code)).toContain('GUARDRAIL_CEILING_EXCEEDED');
      expect(s.simulationToken).toBeUndefined();
      const c = comoOrg<SimulateAccessResponse>('POST', '/org/access/simulate', {
        engagementId: GENTE.ana.engagementId,
        draft: {
          mode: 'PATCH',
          grants: [
            {
              effect: 'ALLOW',
              actions: ['agenda.appointment.view'],
              condition: {
                schemaVersion: 1,
                tiempo: {},
                time: { windows: [{ days: [1], from: '08:00', to: '08:00' }] },
              },
            },
          ],
        },
      }).body;
      expect(c.validation.errors.map((e) => e.code)).toEqual(
        expect.arrayContaining(['CONDITION_UNKNOWN_KEY', 'CONDITION_TIME_EMPTY_WINDOW']),
      );
    });

    it('un borrador válido devuelve su resumen, el impacto y un token; guardar otra cosa es 409 SIMULATION_STALE', () => {
      const grant = {
        effect: 'ALLOW',
        actions: ['reports.agenda.view', 'audit.activity.view_team'],
        condition: {
          schemaVersion: 1,
          time: { windows: [{ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' }] },
        },
        practitionerRoleAssignmentId: uuid('hp-doc-vaca'),
        targetKind: 'PRACTITIONER',
      };
      const s = comoOrg<SimulateAccessResponse>('POST', '/org/access/simulate', {
        engagementId: GENTE.ana.engagementId,
        draft: { mode: 'PATCH', grants: [grant] },
      }).body;
      expect(s.valid).toBe(true);
      expect(s.summary.changes.length).toBeGreaterThan(0);
      expect(s.simulationToken).toMatch(/^sim_/);
      expect(
        comoOrg<Error422>('POST', `/org/support-engagements/${GENTE.ana.engagementId}/grants`, {
          ...grant,
          actions: ['reports.agenda.view'],
          simulationToken: s.simulationToken,
        }).body.reason,
      ).toBe('SIMULATION_STALE');
      const guardado = comoOrg<{ id: string; atoms: string[]; warnings: unknown[] }>(
        'POST',
        `/org/support-engagements/${GENTE.ana.engagementId}/grants`,
        { ...grant, simulationToken: s.simulationToken },
      );
      expect(guardado.status).toBe(201);
      expect(guardado.body.atoms).toContain('audit.activity.view_team');
    });

    it('los permisos de antes (15 códigos) siguen entrando por el manejador original', () => {
      const r = comoOrg<{ id: string }>(
        'POST',
        `/org/support-engagements/${GENTE.ana.engagementId}/grants`,
        {
          targetKind: 'PRACTITIONER',
          practitionerRoleAssignmentId: uuid('hp-doc-vaca'),
          expansionMode: 'DYNAMIC',
          actions: ['schedule.view'],
        },
      );
      expect(r.status).toBe(201);
    });
  });

  describe('normalizar permisos antiguos', () => {
    it('el ensayo informa qué obligaciones nuevas aparecen sin cambiar nada; aplicar exige reconocer el endurecimiento y se puede revertir', () => {
      conPasoExtra();
      const ensayo = comoOrg<{
        dryRun: boolean;
        requiresAcknowledgement: boolean;
        engagements: unknown[];
      }>('POST', '/org/governance/normalize-legacy', {}).body;
      expect(ensayo.dryRun).toBe(true);
      expect(ensayo.engagements.length).toBeGreaterThan(0);
      if (ensayo.requiresAcknowledgement) {
        expect(
          comoOrg<Error422>('POST', '/org/governance/normalize-legacy', { dryRun: false }).body
            .reason,
        ).toBe('NORMALIZE_TIGHTENING_NOT_ACKNOWLEDGED');
      }
      const lote = comoOrg<{ batchId: string }>('POST', '/org/governance/normalize-legacy', {
        dryRun: false,
        acknowledgeTightening: true,
      }).body;
      expect(
        permisos.filtrar((p) => p.engagementId === GENTE.pablo.engagementId)[0]!.atoms,
      ).toBeDefined();
      expect(
        comoOrg<{ restoredAliasRows: number }>('POST', '/org/governance/normalize-legacy/revert', {
          batchId: lote.batchId,
        }).body.restoredAliasRows,
      ).toBeGreaterThan(0);
      expect(
        permisos.filtrar((p) => p.engagementId === GENTE.pablo.engagementId)[0]!.atoms,
      ).toBeUndefined();
    });
  });
});
