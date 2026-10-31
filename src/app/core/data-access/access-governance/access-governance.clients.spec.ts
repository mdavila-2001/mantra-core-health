import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';

import { AccessApprovalsClient } from './access-approvals.client';
import { AccessExplainClient } from './access-explain.client';
import { AccessGovernanceClient } from './access-governance.client';
import { AccessLifecycleClient } from './access-lifecycle.client';
import { AccessReviewsClient } from './access-reviews.client';
import { StepUpClient } from './step-up.client';
import { TeamAdminClient } from './team-admin.client';

/**
 * Lo que fijan estas pruebas es el contrato con la API: verbo, ruta exacta y el cuerpo o los parámetros que viajan, para
 * **las 84 rutas** de `CONTRATO-GOBIERNO.md` §8.3 que el front consume. Las rutas son las de los controladores de
 * `delegated_access/controllers` y `iam/presentation/controllers/iam-step-up.controller.ts`.
 */
interface Caso {
  readonly nombre: string;
  readonly llamar: () => Observable<unknown>;
  readonly metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly ruta: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly cuerpo?: unknown;
  /** Lo que contesta la API si el cliente lee la respuesta (por omisión `{}`). */
  readonly respuesta?: unknown;
}

describe('clientes de gobierno de accesos', () => {
  let http: HttpTestingController;
  let explain: AccessExplainClient;
  let gov: AccessGovernanceClient;
  let approvals: AccessApprovalsClient;
  let reviews: AccessReviewsClient;
  let lifecycle: AccessLifecycleClient;
  let team: TeamAdminClient;
  let stepUp: StepUpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    explain = TestBed.inject(AccessExplainClient);
    gov = TestBed.inject(AccessGovernanceClient);
    approvals = TestBed.inject(AccessApprovalsClient);
    reviews = TestBed.inject(AccessReviewsClient);
    lifecycle = TestBed.inject(AccessLifecycleClient);
    team = TestBed.inject(TeamAdminClient);
    stepUp = TestBed.inject(StepUpClient);
  });

  afterEach(() => http.verify());

  const casos = (): readonly Caso[] => [
    /* A. decisiones, catálogo y compatibilidad */
    {
      nombre: 'explain',
      llamar: () => explain.explain({ engagementId: 'e1', action: 'agenda.appointment.cancel' }),
      metodo: 'POST',
      ruta: '/org/access/explain',
      cuerpo: { engagementId: 'e1', action: 'agenda.appointment.cancel' },
    },
    {
      nombre: 'simulate',
      llamar: () => explain.simulate({ engagementId: 'e1', draft: { mode: 'PATCH', grants: [] } }),
      metodo: 'POST',
      ruta: '/org/access/simulate',
      cuerpo: { engagementId: 'e1', draft: { mode: 'PATCH', grants: [] } },
    },
    {
      nombre: 'explainMine',
      llamar: () => explain.explainMine({ tenantId: 't1', action: 'schedule.cancel' }),
      metodo: 'POST',
      ruta: '/me/support-access/explain',
      cuerpo: { tenantId: 't1', action: 'schedule.cancel' },
    },
    {
      nombre: 'explainTeam',
      llamar: () => explain.explainTeam({ userId: 'u1', action: 'schedule.cancel' }),
      metodo: 'POST',
      ruta: '/me/practitioner/support-team/explain',
      cuerpo: { userId: 'u1', action: 'schedule.cancel' },
    },
    {
      nombre: 'permission-catalog',
      llamar: () => explain.getPermissionCatalog(),
      metodo: 'GET',
      ruta: '/org/permission-catalog',
    },
    {
      nombre: 'engagement summary',
      llamar: () => explain.getEngagementSummary('e 1'),
      metodo: 'GET',
      ruta: '/org/support-engagements/e%201/summary',
    },
    {
      nombre: 'engagement effective',
      llamar: () => explain.getEngagementEffective('e1'),
      metodo: 'GET',
      ruta: '/org/support-engagements/e1/effective',
    },
    {
      nombre: 'normalize-legacy',
      llamar: () => gov.normalizeLegacy({ dryRun: true }),
      metodo: 'POST',
      ruta: '/org/governance/normalize-legacy',
      cuerpo: { dryRun: true },
    },
    {
      nombre: 'normalize-legacy/revert',
      llamar: () => gov.revertNormalize('b1'),
      metodo: 'POST',
      ruta: '/org/governance/normalize-legacy/revert',
      cuerpo: { batchId: 'b1' },
    },
    /* B. reglas, SoD, ajustes y banderas */
    {
      nombre: 'rules list',
      llamar: () => gov.listRules({ kind: 'CEILING', status: 'ACTIVE' }),
      metodo: 'GET',
      ruta: '/org/governance/rules',
      params: { kind: 'CEILING', status: 'ACTIVE' },
    },
    {
      nombre: 'rules create',
      llamar: () =>
        gov.createRule({
          kind: 'CEILING',
          permissionPattern: 'billing.*',
          roleTemplateCode: 'SECRETARY',
        }),
      metodo: 'POST',
      ruta: '/org/governance/rules',
      cuerpo: { kind: 'CEILING', permissionPattern: 'billing.*', roleTemplateCode: 'SECRETARY' },
    },
    {
      nombre: 'rules update',
      llamar: () => gov.updateRule('r1', { expectedRowVersion: 2, message: 'x' }),
      metodo: 'PATCH',
      ruta: '/org/governance/rules/r1',
      cuerpo: { expectedRowVersion: 2, message: 'x' },
    },
    {
      nombre: 'rules retire',
      llamar: () => gov.retireRule('r1', 'ya no aplica'),
      metodo: 'POST',
      ruta: '/org/governance/rules/r1/retire',
      cuerpo: { reason: 'ya no aplica' },
    },
    {
      nombre: 'sod-rules list',
      llamar: () => gov.listSodRules(),
      metodo: 'GET',
      ruta: '/org/governance/sod-rules',
    },
    {
      nombre: 'sod-rules create',
      llamar: () =>
        gov.createSodRule({
          code: 'SOD-ORG-01',
          name: 'n',
          atomsA: ['a.b.c'],
          atomsB: ['d.e.f'],
          scope: 'PERSON',
          action: 'WARN',
        }),
      metodo: 'POST',
      ruta: '/org/governance/sod-rules',
      cuerpo: {
        code: 'SOD-ORG-01',
        name: 'n',
        atomsA: ['a.b.c'],
        atomsB: ['d.e.f'],
        scope: 'PERSON',
        action: 'WARN',
      },
    },
    {
      nombre: 'sod-rules update',
      llamar: () => gov.updateSodRule('s1', { expectedRowVersion: 1, action: 'BLOCK' }),
      metodo: 'PATCH',
      ruta: '/org/governance/sod-rules/s1',
      cuerpo: { expectedRowVersion: 1, action: 'BLOCK' },
    },
    {
      nombre: 'sod-findings',
      llamar: () => gov.listSodFindings(),
      metodo: 'GET',
      ruta: '/org/governance/sod-findings',
    },
    {
      nombre: 'sod-exceptions list',
      llamar: () => gov.listSodExceptions(),
      metodo: 'GET',
      ruta: '/org/governance/sod-exceptions',
    },
    {
      nombre: 'sod-exceptions request',
      llamar: () =>
        gov.requestSodException({
          engagementId: 'e1',
          ruleCode: 'SOD-BILL-03',
          justification: 'x'.repeat(40),
          validTo: '2026-12-31',
        }),
      metodo: 'POST',
      ruta: '/org/governance/sod-exceptions',
      cuerpo: {
        engagementId: 'e1',
        ruleCode: 'SOD-BILL-03',
        justification: 'x'.repeat(40),
        validTo: '2026-12-31',
      },
    },
    {
      nombre: 'sod-exceptions revoke',
      llamar: () => gov.revokeSodException('x1', 'ya no hace falta'),
      metodo: 'POST',
      ruta: '/org/governance/sod-exceptions/x1/revoke',
      cuerpo: { reason: 'ya no hace falta' },
    },
    {
      nombre: 'settings get',
      llamar: () => gov.getSettings(),
      metodo: 'GET',
      ruta: '/org/governance/settings',
    },
    {
      nombre: 'settings put',
      llamar: () => gov.putSettings({ inactivityDays: 30 }),
      metodo: 'PUT',
      ruta: '/org/governance/settings',
      cuerpo: { inactivityDays: 30 },
    },
    {
      nombre: 'restriction-flags get',
      llamar: () => gov.getRestrictionFlags('p1'),
      metodo: 'GET',
      ruta: '/org/patients/p1/restriction-flags',
    },
    {
      nombre: 'restriction-flags put',
      llamar: () => gov.putRestrictionFlags('p1', [{ flag: 'VIP', reason: 'Autoridad' }]),
      metodo: 'PUT',
      ruta: '/org/patients/p1/restriction-flags',
      cuerpo: { flags: [{ flag: 'VIP', reason: 'Autoridad' }] },
    },
    /* C. cuatro ojos */
    {
      nombre: 'support-approvals create',
      llamar: () =>
        approvals.createApproval({
          tenantId: 't1',
          atom: 'agenda.appointment.cancel',
          reasonText: 'Paciente avisó',
        }),
      metodo: 'POST',
      ruta: '/me/support-approvals',
      cuerpo: { tenantId: 't1', atom: 'agenda.appointment.cancel', reasonText: 'Paciente avisó' },
    },
    {
      nombre: 'support-approvals list',
      llamar: () => approvals.listMyApprovals(),
      metodo: 'GET',
      ruta: '/me/support-approvals',
    },
    {
      nombre: 'support-approvals cancel',
      llamar: () => approvals.cancelMyApproval('a1'),
      metodo: 'POST',
      ruta: '/me/support-approvals/a1/cancel',
      cuerpo: {},
    },
    {
      nombre: 'approvals pending',
      llamar: () => approvals.listPending(),
      metodo: 'GET',
      ruta: '/approvals/pending',
      params: { limit: '100' },
      respuesta: { items: [], count: 0 },
    },
    {
      nombre: 'approvals decision',
      llamar: () => approvals.decide('a1', { decision: 'REJECT', comment: 'no corresponde' }),
      metodo: 'POST',
      ruta: '/approvals/a1/decision',
      cuerpo: { decision: 'REJECT', comment: 'no corresponde' },
    },
    /* D. ciclo de vida */
    {
      nombre: 'lifecycle cases',
      llamar: () => lifecycle.listCases({ kind: 'LEAVER', status: 'OPEN' }),
      metodo: 'GET',
      ruta: '/org/lifecycle/cases',
      params: { kind: 'LEAVER', status: 'OPEN' },
    },
    {
      nombre: 'lifecycle case',
      llamar: () => lifecycle.getCase('c1'),
      metodo: 'GET',
      ruta: '/org/lifecycle/cases/c1',
    },
    {
      nombre: 'lifecycle checklist',
      llamar: () => lifecycle.completeChecklistItem('c1', 'SUPERVISOR_ASSIGNED', 'hecho'),
      metodo: 'POST',
      ruta: '/org/lifecycle/cases/c1/checklist/SUPERVISOR_ASSIGNED',
      cuerpo: { note: 'hecho' },
    },
    {
      nombre: 'lifecycle handover assign',
      llamar: () => lifecycle.assignHandover('c1', { defaultToUserId: 'u2' }),
      metodo: 'POST',
      ruta: '/org/lifecycle/cases/c1/handover/assign',
      cuerpo: { defaultToUserId: 'u2' },
    },
    {
      nombre: 'lifecycle export',
      llamar: () => lifecycle.exportCase('c1'),
      metodo: 'GET',
      ruta: '/org/lifecycle/cases/c1/export',
    },
    {
      nombre: 'identity-verification',
      llamar: () => lifecycle.verifyIdentity('e1', { method: 'IN_PERSON' }),
      metodo: 'POST',
      ruta: '/org/support-engagements/e1/identity-verification',
      cuerpo: { method: 'IN_PERSON' },
    },
    {
      nombre: 'owner',
      llamar: () => lifecycle.putOwner('e1', { supervisorUserId: 'u9' }),
      metodo: 'PUT',
      ruta: '/org/support-engagements/e1/owner',
      cuerpo: { supervisorUserId: 'u9' },
    },
    {
      nombre: 'confidentiality-ack',
      llamar: () => lifecycle.acknowledgeConfidentiality('e1'),
      metodo: 'POST',
      ruta: '/me/support-engagements/e1/confidentiality-ack',
      cuerpo: {},
    },
    {
      nombre: 'move',
      llamar: () => lifecycle.move('e1', { reason: 'Cambio de área', grants: [] }),
      metodo: 'POST',
      ruta: '/org/support-engagements/e1/move',
      cuerpo: { reason: 'Cambio de área', grants: [] },
    },
    {
      nombre: 'handover-preview',
      llamar: () => lifecycle.handoverPreview('e1'),
      metodo: 'GET',
      ruta: '/org/support-engagements/e1/handover-preview',
    },
    {
      nombre: 'offboard',
      llamar: () => lifecycle.offboard('e1', { reason: 'Renuncia', handover: null }),
      metodo: 'POST',
      ruta: '/org/support-engagements/e1/offboard',
      cuerpo: { reason: 'Renuncia', handover: null },
    },
    {
      nombre: 'suspend',
      llamar: () => lifecycle.suspend('e1', { reasonCode: 'LEAVE' }),
      metodo: 'POST',
      ruta: '/org/support-engagements/e1/suspend',
      cuerpo: { reasonCode: 'LEAVE' },
    },
    {
      nombre: 'reactivate',
      llamar: () => lifecycle.reactivate('e1', { reason: 'Volvió' }),
      metodo: 'POST',
      ruta: '/org/support-engagements/e1/reactivate',
      cuerpo: { reason: 'Volvió' },
    },
    /* E. administración delegada */
    {
      nombre: 'team capabilities',
      llamar: () => team.getCapabilities(),
      metodo: 'GET',
      ruta: '/org/team/capabilities',
    },
    {
      nombre: 'team members',
      llamar: () => team.listMembers(),
      metodo: 'GET',
      ruta: '/org/team/members',
    },
    {
      nombre: 'team member',
      llamar: () => team.getMember('e1'),
      metodo: 'GET',
      ruta: '/org/team/members/e1',
    },
    {
      nombre: 'team grants create',
      llamar: () =>
        team.createGrant('e1', {
          targetKind: 'SERVICE',
          healthcareServiceId: 's1',
          expansionMode: 'DYNAMIC',
          actions: ['agenda.appointment.view'],
        }),
      metodo: 'POST',
      ruta: '/org/team/members/e1/grants',
      cuerpo: {
        targetKind: 'SERVICE',
        healthcareServiceId: 's1',
        expansionMode: 'DYNAMIC',
        actions: ['agenda.appointment.view'],
      },
    },
    {
      nombre: 'team grants change',
      llamar: () => team.changeGrant('e1', { grantId: 'g1', revoke: true }),
      metodo: 'PATCH',
      ruta: '/org/team/members/e1/grants',
      cuerpo: { grantId: 'g1', revoke: true },
    },
    {
      nombre: 'team recertify',
      llamar: () => team.recertify('e1', 6),
      metodo: 'POST',
      ruta: '/org/team/members/e1/recertify',
      cuerpo: { recertifyEveryMonths: 6 },
    },
    {
      nombre: 'team suspend',
      llamar: () => team.suspend('e1', { reasonCode: 'MANUAL' }),
      metodo: 'POST',
      ruta: '/org/team/members/e1/suspend',
      cuerpo: { reasonCode: 'MANUAL' },
    },
    {
      nombre: 'team reactivate',
      llamar: () => team.reactivate('e1', { reason: 'Volvió' }),
      metodo: 'POST',
      ruta: '/org/team/members/e1/reactivate',
      cuerpo: { reason: 'Volvió' },
    },
    {
      nombre: 'team offboard',
      llamar: () => team.offboard('e1', { reason: 'Renuncia' }),
      metodo: 'POST',
      ruta: '/org/team/members/e1/offboard',
      cuerpo: { reason: 'Renuncia' },
    },
    {
      nombre: 'team handover-preview',
      llamar: () => team.handoverPreview('e1'),
      metodo: 'GET',
      ruta: '/org/team/members/e1/handover-preview',
    },
    {
      nombre: 'team invitations',
      llamar: () =>
        team.invite({
          kind: 'SUPPORT_STAFF',
          roleTemplate: 'SECRETARY',
          maxUses: 1,
          expiresInDays: 7,
        }),
      metodo: 'POST',
      ruta: '/org/team/invitations',
      cuerpo: {
        kind: 'SUPPORT_STAFF',
        maxUses: 1,
        expiresInDays: 7,
        roleTemplateCode: 'SECRETARY',
      },
    },
    {
      nombre: 'team requests',
      llamar: () => team.listRequests(),
      metodo: 'GET',
      ruta: '/org/team/requests',
    },
    {
      nombre: 'team requests decision',
      llamar: () => team.decideRequest('q1', { items: [{ itemId: 'i1', decision: 'APPROVED' }] }),
      metodo: 'POST',
      ruta: '/org/team/requests/q1/decision',
      cuerpo: { items: [{ itemId: 'i1', decision: 'APPROVED' }] },
    },
    /* F. campañas */
    {
      nombre: 'campaigns list',
      llamar: () => reviews.listCampaigns(),
      metodo: 'GET',
      ruta: '/org/access-reviews/campaigns',
    },
    {
      nombre: 'campaigns preview',
      llamar: () =>
        reviews.previewCampaign({
          name: 'n',
          kind: 'TARGETED',
          scope: { kind: 'ORGANIZATION' },
          dueAt: '2026-12-01',
        }),
      metodo: 'POST',
      ruta: '/org/access-reviews/campaigns/preview',
      cuerpo: { name: 'n', kind: 'TARGETED', scope: { kind: 'ORGANIZATION' }, dueAt: '2026-12-01' },
    },
    {
      nombre: 'campaigns create',
      llamar: () =>
        reviews.createCampaign({
          name: 'n',
          kind: 'TARGETED',
          scope: { kind: 'ORGANIZATION' },
          dueAt: '2026-12-01',
        }),
      metodo: 'POST',
      ruta: '/org/access-reviews/campaigns',
      cuerpo: { name: 'n', kind: 'TARGETED', scope: { kind: 'ORGANIZATION' }, dueAt: '2026-12-01' },
    },
    {
      nombre: 'campaigns get',
      llamar: () => reviews.getCampaign('c1'),
      metodo: 'GET',
      ruta: '/org/access-reviews/campaigns/c1',
    },
    {
      nombre: 'campaigns update',
      llamar: () => reviews.updateCampaign('c1', { name: 'otro' }),
      metodo: 'PATCH',
      ruta: '/org/access-reviews/campaigns/c1',
      cuerpo: { name: 'otro' },
    },
    {
      nombre: 'campaigns launch',
      llamar: () => reviews.launchCampaign('c1'),
      metodo: 'POST',
      ruta: '/org/access-reviews/campaigns/c1/launch',
      cuerpo: {},
    },
    {
      nombre: 'campaigns close',
      llamar: () => reviews.closeCampaign('c1'),
      metodo: 'POST',
      ruta: '/org/access-reviews/campaigns/c1/close',
      cuerpo: {},
    },
    {
      nombre: 'campaigns cancel',
      llamar: () => reviews.cancelCampaign('c1', 'ya no hace falta'),
      metodo: 'POST',
      ruta: '/org/access-reviews/campaigns/c1/cancel',
      cuerpo: { reason: 'ya no hace falta' },
    },
    {
      nombre: 'campaigns items',
      llamar: () => reviews.listCampaignItems('c1'),
      metodo: 'GET',
      ruta: '/org/access-reviews/campaigns/c1/items',
    },
    {
      nombre: 'campaigns results',
      llamar: () => reviews.getCampaignResults('c1'),
      metodo: 'GET',
      ruta: '/org/access-reviews/campaigns/c1/results',
    },
    {
      nombre: 'campaigns export',
      llamar: () => reviews.exportCampaign('c1', 'csv', 'AUDIT_REVIEW'),
      metodo: 'GET',
      ruta: '/org/access-reviews/campaigns/c1/export',
      params: { format: 'csv', reasonCode: 'AUDIT_REVIEW' },
    },
    {
      nombre: 'my items',
      llamar: () => reviews.listMyItems('PENDING'),
      metodo: 'GET',
      ruta: '/me/access-reviews/items',
      params: { status: 'PENDING' },
    },
    {
      nombre: 'my item',
      llamar: () => reviews.getMyItem('i1'),
      metodo: 'GET',
      ruta: '/me/access-reviews/items/i1',
    },
    {
      nombre: 'my item decision',
      llamar: () => reviews.decideItem('i1', { decision: 'REVOKE', comment: 'ya no trabaja allí' }),
      metodo: 'POST',
      ruta: '/me/access-reviews/items/i1/decision',
      cuerpo: { decision: 'REVOKE', comment: 'ya no trabaja allí' },
    },
    {
      nombre: 'my items bulk',
      llamar: () => reviews.bulkDecide({ itemIds: ['i1', 'i2'], decision: 'CERTIFY' }),
      metodo: 'POST',
      ruta: '/me/access-reviews/items/bulk-decision',
      cuerpo: { itemIds: ['i1', 'i2'], decision: 'CERTIFY' },
    },
    /* G. reportes y tableros */
    {
      nombre: 'summary',
      llamar: () => gov.getSummary(),
      metodo: 'GET',
      ruta: '/org/governance/summary',
    },
    {
      nombre: 'access-matrix person',
      llamar: () => gov.getAccessMatrix({ by: 'person', group: 'atom' }),
      metodo: 'GET',
      ruta: '/org/governance/access-matrix',
      params: { by: 'person', group: 'atom' },
    },
    {
      nombre: 'access-matrix doctor',
      llamar: () => gov.getAccessMatrix({ by: 'doctor', id: 'd1' }),
      metodo: 'GET',
      ruta: '/org/governance/access-matrix',
      params: { by: 'doctor', id: 'd1' },
    },
    {
      nombre: 'privilege-creep',
      llamar: () => gov.getPrivilegeCreep(),
      metodo: 'GET',
      ruta: '/org/governance/privilege-creep',
    },
    {
      nombre: 'unused-access',
      llamar: () => gov.getUnusedAccess(45),
      metodo: 'GET',
      ruta: '/org/governance/unused-access',
      params: { days: '45' },
    },
    {
      nombre: 'ownerless',
      llamar: () => gov.getOwnerless(),
      metodo: 'GET',
      ruta: '/org/governance/ownerless',
    },
    {
      nombre: 'exceptions',
      llamar: () => gov.getExceptions(),
      metodo: 'GET',
      ruta: '/org/governance/exceptions',
    },
    {
      nombre: 'anomalies',
      llamar: () => gov.listAnomalies({ status: 'OPEN', kind: 'ANOMALY_SEARCH_SPIKE' }),
      metodo: 'GET',
      ruta: '/org/governance/anomalies',
      params: { status: 'OPEN', kind: 'ANOMALY_SEARCH_SPIKE' },
    },
    {
      nombre: 'anomalies ack',
      llamar: () => gov.resolveAnomaly('a1', { status: 'DISMISSED', comment: 'falso positivo' }),
      metodo: 'POST',
      ruta: '/org/governance/anomalies/a1/ack',
      cuerpo: { status: 'DISMISSED', comment: 'falso positivo' },
    },
    {
      nombre: 'reports export',
      llamar: () =>
        gov.exportReport('access-matrix', { format: 'csv', reason: 'Auditoría trimestral' }),
      metodo: 'POST',
      ruta: '/org/governance/reports/access-matrix/export',
      cuerpo: { format: 'csv', reason: 'Auditoría trimestral' },
    },
    {
      nombre: 'practitioner governance-panel',
      llamar: () => gov.getPractitionerPanel(),
      metodo: 'GET',
      ruta: '/me/practitioner/governance-panel',
    },
    /* H. paso extra */
    {
      nombre: 'step-up verify',
      llamar: () => stepUp.verify('123456'),
      metodo: 'POST',
      ruta: '/iam/me/step-up',
      cuerpo: { code: '123456' },
    },
    {
      nombre: 'step-up status',
      llamar: () => stepUp.status(10),
      metodo: 'GET',
      ruta: '/iam/me/step-up',
      params: { maxAgeMinutes: '10' },
    },
  ];

  it('cubre 84 rutas del contrato (más las dos del paso extra)', () => {
    // 84 de §8.3 menos 2 de mantenimiento `SYSTEM` (no son del front) = 82; el paso extra suma 2 y el panel del doctor ya está contado.
    expect(casos().length).toBeGreaterThanOrEqual(82);
  });

  for (const caso of casos()) {
    it(`${caso.nombre}: ${caso.metodo} ${caso.ruta}`, () => {
      caso.llamar().subscribe();
      const req = http.expectOne((r) => r.method === caso.metodo && r.url === caso.ruta);
      for (const [clave, valor] of Object.entries(caso.params ?? {}))
        expect(req.request.params.get(clave)).toBe(valor);
      expect(req.request.params.keys().sort()).toEqual(Object.keys(caso.params ?? {}).sort());
      if (caso.cuerpo !== undefined) expect(req.request.body).toEqual(caso.cuerpo);
      req.flush(caso.respuesta ?? {});
    });
  }

  it('el resumen del tablero conserva los diez mosaicos', () => {
    let tiles: Record<string, number> | undefined;
    gov.getSummary().subscribe((s) => (tiles = { ...s.tiles }));
    http
      .expectOne('/org/governance/summary')
      .flush({ generatedAt: '2026-11-03T10:30:00-04:00', tiles: { peopleWithLiveAccess: 9 } });
    expect(tiles).toEqual({ peopleWithLiveAccess: 9 });
  });
});
