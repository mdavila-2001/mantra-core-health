import { HttpHeaders } from '@angular/common/http';

import { conditionList, DX_CATEGORY, encounterList, orderList } from '../fixtures/clinic';
import { CONDITION_STATUS, DIAGNOSIS, ESTUDIO, ORDER_CATEGORY, SEVERITY, VERIFICATION_DX } from '../fixtures/concepts';
import { NETWORK_IDS } from '../fixtures/patient-network.data';
import { MEDICAL, PACIENTE, PATIENTS } from '../fixtures/people';
import { isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import { REFERRAL_STATUS, referralList, type SimulatedReferral } from './referrals.handlers';

/**
 * Los tres vínculos nuevos de la red clínica en el simulador (patch v4291):
 * `reasonConditionId` de la orden, `replacedByConditionId` del rechazo y
 * `targetEncounterId` de la derivación. Se aceptan, se guardan, se devuelven
 * en la lectura y se rechazan con 422 y su `reason` cuando lo vinculado no es
 * de la misma persona o la regla del contrato no se cumple.
 */
describe('vínculos de la red clínica en el mock (patch v4291)', () => {
  const router = crearRouterSimulado();
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const otherPatient = PATIENTS.find((p) => p.id !== PACIENTE.id)!;
  const foreignCondition = conditionList.todos().find((c) => c.patientProfileId === otherPatient.id)!;
  const foreignEncounter = encounterList.todos().find((e) => e.patientProfileId === otherPatient.id)!;

  function send(method: MockMethod, path: string, body: unknown = {}, user: MockUser = doctor) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': TENANT_CLINICA }),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }
  const reasonOf = (r: { body: unknown }): string => (r.body as { reason: string }).reason;

  let counter = 0;
  function provisional(code: keyof typeof DIAGNOSIS = 'G43'): string {
    counter += 1;
    const id = uuid(`spec-links-${counter}`);
    conditionList.agregar({
      id,
      patientProfileId: PACIENTE.id,
      codeConceptId: DIAGNOSIS[code]!,
      categoryConceptId: DX_CATEGORY,
      clinicalStatusConceptId: CONDITION_STATUS['COND_ACTIVE']!,
      verificationStatusConceptId: VERIFICATION_DX['COND_PROVISIONAL']!,
      severityConceptId: SEVERITY['SEV-MILD']!,
      onsetAt: '2026-10-01T10:00:00.000Z',
      noteText: 'Presuntivo de prueba',
      createdAt: '2026-10-01T10:00:00.000Z',
    });
    return id;
  }

  describe('POST /clinical/service-requests · reasonConditionId', () => {
    const order = (extra: object) =>
      send('POST', '/clinical/service-requests', {
        custodianTenantId: TENANT_CLINICA,
        patientProfileId: PACIENTE.id,
        // Un estudio que la paciente no tiene en la ventana de duplicados.
        codeConceptId: ESTUDIO['STUDY-VITAMINA-D']!,
        categoryConceptId: ORDER_CATEGORY['SRQ-LAB']!,
        ...extra,
      });

    it('lo guarda y la lectura del circuito lo devuelve', () => {
      const created = order({ reasonConditionId: NETWORK_IDS.anxiety });
      expect(created.status).toBe(201);
      const id = (created.body as { id: string }).id;
      expect(orderList.get(id)?.reasonConditionId).toBe(NETWORK_IDS.anxiety);
      const read = send('GET', `/diagnostics/patients/${PACIENTE.id}/orders`).body as {
        orders: { id: string; reasonConditionId?: string }[];
      };
      expect(read.orders.find((o) => o.id === id)?.reasonConditionId).toBe(NETWORK_IDS.anxiety);
    });

    it('sin el campo la orden sale sin vínculo', () => {
      const created = order({});
      expect(created.status).toBe(201);
      expect(orderList.get((created.body as { id: string }).id)?.reasonConditionId).toBeUndefined();
    });

    it('un diagnóstico de otra persona o inexistente es 422 SERVICE_REQUEST_REASON_CONDITION_INVALID', () => {
      for (const reasonConditionId of [foreignCondition.id, 'no-existe']) {
        const r = order({ reasonConditionId });
        expect(r.status).toBe(422);
        expect(reasonOf(r)).toBe('SERVICE_REQUEST_REASON_CONDITION_INVALID');
      }
    });

    it('un diagnóstico de la misma persona pero de otro custodio es el mismo 422 (API fbf18626)', () => {
      counter += 1;
      const id = uuid(`spec-links-custodian-${counter}`);
      conditionList.agregar({ ...conditionList.get(NETWORK_IDS.anxiety)!, id, custodianTenantId: 'otro-tenant' });
      const r = order({ reasonConditionId: id });
      expect(r.status).toBe(422);
      expect(reasonOf(r)).toBe('SERVICE_REQUEST_REASON_CONDITION_INVALID');
    });

    it('un valor que no es texto es 400', () => {
      expect(order({ reasonConditionId: 42 }).status).toBe(400);
    });
  });

  describe('POST /clinical/conditions/:id/verification · replacedByConditionId', () => {
    const verify = (id: string, body: object) => send('POST', `/clinical/conditions/${id}/verification`, body);

    it('al rechazar lo guarda y lo devuelve', () => {
      const id = provisional();
      const r = verify(id, { outcome: 'REFUTED', reasonText: 'TSH suprimida', replacedByConditionId: NETWORK_IDS.hypothyroidism });
      expect(r.status).toBe(200);
      expect((r.body as { replacedByConditionId?: string }).replacedByConditionId).toBe(NETWORK_IDS.hypothyroidism);
      expect(conditionList.get(id)?.verificationStatusConceptId).toBe(VERIFICATION_DX['COND_REFUTED']);
    });

    it('al confirmar es 422 CONDITION_REPLACEMENT_REQUIRES_REFUTED y no decide nada', () => {
      const id = provisional();
      const r = verify(id, {
        outcome: 'CONFIRMED',
        reasonText: 'x',
        expectedResolutionAt: '2027-01-01T00:00:00.000Z',
        replacedByConditionId: NETWORK_IDS.hypothyroidism,
      });
      expect(r.status).toBe(422);
      expect(reasonOf(r)).toBe('CONDITION_REPLACEMENT_REQUIRES_REFUTED');
      expect(conditionList.get(id)?.verificationStatusConceptId).toBe(VERIFICATION_DX['COND_PROVISIONAL']);
    });

    it('a sí mismo es 422 CONDITION_REPLACEMENT_SELF', () => {
      const id = provisional();
      expect(reasonOf(verify(id, { outcome: 'REFUTED', reasonText: 'x', replacedByConditionId: id }))).toBe(
        'CONDITION_REPLACEMENT_SELF',
      );
    });

    it('de otra persona es 422 CONDITION_REPLACEMENT_INVALID', () => {
      const r = verify(provisional(), { outcome: 'REFUTED', reasonText: 'x', replacedByConditionId: foreignCondition.id });
      expect(r.status).toBe(422);
      expect(reasonOf(r)).toBe('CONDITION_REPLACEMENT_INVALID');
    });
  });

  describe('derivaciones · targetEncounterId', () => {
    function incoming(): string {
      counter += 1;
      const id = uuid(`spec-links-referral-${counter}`);
      const row: SimulatedReferral = {
        id,
        patientProfileId: PACIENTE.id,
        sourceEncounterId: null,
        referringProfileId: PATIENTS[1]!.id,
        targetProfileId: MEDICAL.id,
        targetTenantId: null,
        targetServiceCatalogId: null,
        referralType: 'CONSULTATION',
        reasonText: null,
        priorityConceptId: null,
        statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
        validUntil: null,
        respondedAt: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        targetDisplayName: MEDICAL.displayName,
        targetServiceName: null,
      };
      referralList.agregar(row);
      return id;
    }
    const ownEncounter = NETWORK_IDS.palpitations;

    it('aceptar con la atención de llegada la guarda y la lectura la devuelve', () => {
      const id = incoming();
      const r = send('PATCH', `/referrals/${id}/respond`, { decision: 'ACCEPT', targetEncounterId: ownEncounter });
      expect(r.status).toBe(200);
      expect((send('GET', `/referrals/${id}`).body as { targetEncounterId?: string }).targetEncounterId).toBe(ownEncounter);
    });

    it('rechazar con atención de llegada es 422 REFERRAL_TARGET_ENCOUNTER_NOT_ALLOWED', () => {
      const r = send('PATCH', `/referrals/${incoming()}/respond`, {
        decision: 'REJECT',
        rejectReason: 'Sin cupo',
        targetEncounterId: ownEncounter,
      });
      expect(r.status).toBe(422);
      expect(reasonOf(r)).toBe('REFERRAL_TARGET_ENCOUNTER_NOT_ALLOWED');
    });

    it('una atención de otra persona es 422 REFERRAL_TARGET_ENCOUNTER_INVALID y la derivación sigue pendiente', () => {
      const id = incoming();
      const r = send('PATCH', `/referrals/${id}/respond`, { decision: 'ACCEPT', targetEncounterId: foreignEncounter.id });
      expect(r.status).toBe(422);
      expect(reasonOf(r)).toBe('REFERRAL_TARGET_ENCOUNTER_INVALID');
      expect(referralList.get(id)?.statusConceptId).toBe(REFERRAL_STATUS['REF_REQUESTED']);
    });

    it('la llegada (v4274) no escribe el vínculo: la API sólo lo acepta al responder', () => {
      const id = incoming();
      const r = send('PATCH', `/referrals/${id}/arrival`, {
        arrivedAt: '2026-11-02T10:00:00.000Z',
        arrivalCondition: 'STABLE',
      });
      expect(r.status).toBe(200);
      expect(referralList.get(id)?.targetEncounterId).toBeUndefined();
    });

    it('quien no es destino recibe 404 antes de mirar el vínculo', () => {
      const id = incoming();
      const other = buscarUsuario('paciente@alovida.mock') ?? doctor;
      const r = send('PATCH', `/referrals/${id}/respond`, { decision: 'ACCEPT', targetEncounterId: foreignEncounter.id }, {
        ...other,
        practitionerProfileId: uuid('hpid-otro'),
        roles: ['CLINICIAN'],
      } as MockUser);
      expect(r.status).toBe(404);
    });
  });
});
