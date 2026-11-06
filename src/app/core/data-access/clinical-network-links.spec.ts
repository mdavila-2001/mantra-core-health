import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClinicalClient } from './clinical/clinical.client';
import type { ClinicalSummary, Condition } from './clinical/clinical.types';
import { DiagnosticsClient } from './diagnostics/diagnostics.client';
import type { DiagnosticOrderCreated, PatientDiagnostics } from './diagnostics/diagnostics.types';
import { ReferralsClient } from './referrals/referrals.client';
import type { Referral } from './referrals/referrals.types';

/**
 * Los tres vínculos de la red clínica (patch v4291, API 13d2c494) en los
 * clientes: viajan en la escritura sólo cuando se eligieron, y en la lectura
 * llegan a la vista —ausentes si la API los manda en `null`—.
 */
describe('vínculos de la red clínica en los clientes (v4291)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('reasonConditionId · orden de estudio', () => {
    const ORDER = {
      id: 'sr-1',
      patientProfileId: 'p-1',
      codeConceptId: 'code-1',
      statusConceptId: 'st',
      createdAt: '2026-08-14T10:00:00.000Z',
    };

    it('el alta lo manda y la respuesta lo devuelve', () => {
      let created: DiagnosticOrderCreated | undefined;
      TestBed.inject(DiagnosticsClient)
        .requestStudy({ custodianTenantId: 't-1', patientProfileId: 'p-1', codeConceptId: 'code-1', reasonConditionId: 'c-9' })
        .subscribe((r) => (created = r));
      const req = http.expectOne('/clinical/service-requests');
      expect(req.request.body.reasonConditionId).toBe('c-9');
      req.flush({ id: 'sr-1', patientProfileId: 'p-1', status: 'st', intent: 'i', reasonConditionId: 'c-9', createdAt: ORDER.createdAt });
      expect(created?.reasonConditionId).toBe('c-9');
    });

    it('sin elegir no viaja la clave', () => {
      TestBed.inject(DiagnosticsClient)
        .requestStudy({ custodianTenantId: 't-1', patientProfileId: 'p-1', codeConceptId: 'code-1', reasonConditionId: undefined })
        .subscribe();
      const req = http.expectOne('/clinical/service-requests');
      expect('reasonConditionId' in req.request.body).toBe(false);
      req.flush({ id: 'sr-1', patientProfileId: 'p-1', status: 'st', intent: 'i', createdAt: ORDER.createdAt });
    });

    it('la lectura lo propaga, y un `null` queda ausente', () => {
      let circuit: PatientDiagnostics | undefined;
      TestBed.inject(DiagnosticsClient).getPatientDiagnostics('p-1').subscribe((c) => (circuit = c));
      http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders').flush({
        patientProfileId: 'p-1',
        orders: [{ ...ORDER, reasonConditionId: 'c-9' }, { ...ORDER, id: 'sr-2', reasonConditionId: null }],
        reports: [],
        limit: 50,
        truncated: [],
      });
      expect(circuit?.orders[0]?.reasonConditionId).toBe('c-9');
      expect(circuit?.orders[1] !== undefined && 'reasonConditionId' in circuit.orders[1]).toBe(false);
    });
  });

  describe('replacedByConditionId · rechazo de un presuntivo', () => {
    it('verifyCondition lo manda con REFUTED y lo devuelve', () => {
      let condition: Condition | undefined;
      TestBed.inject(ClinicalClient)
        .verifyCondition('c-1', { outcome: 'REFUTED', reasonText: 'TSH suprimida', replacedByConditionId: 'c-2' })
        .subscribe((c) => (condition = c));
      const req = http.expectOne('/clinical/conditions/c-1/verification');
      expect(req.request.body).toEqual({ outcome: 'REFUTED', reasonText: 'TSH suprimida', replacedByConditionId: 'c-2' });
      req.flush({ id: 'c-1', codeConceptId: 'cod', replacedByConditionId: 'c-2', createdAt: '2026-09-01T10:00:00.000Z' });
      expect(condition?.replacedByConditionId).toBe('c-2');
    });

    it('el resumen lo propaga, y un `null` queda ausente', () => {
      let summary: ClinicalSummary | undefined;
      TestBed.inject(ClinicalClient).getSummary('p-1').subscribe((s) => (summary = s));
      http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush({
        patientProfileId: 'p-1',
        conditions: [
          { id: 'c-1', codeConceptId: 'cod', replacedByConditionId: 'c-2', createdAt: '2026-09-01T10:00:00.000Z' },
          { id: 'c-3', codeConceptId: 'cod', replacedByConditionId: null, createdAt: '2026-09-01T10:00:00.000Z' },
        ],
        allergies: [],
        medicationRequests: [],
        observations: [],
        encounters: [],
        limit: 50,
        truncated: [],
      });
      expect(summary?.conditions[0]?.replacedByConditionId).toBe('c-2');
      expect(summary?.conditions[1] !== undefined && 'replacedByConditionId' in summary.conditions[1]).toBe(false);
    });
  });

  describe('targetEncounterId · derivación', () => {
    const ROW = {
      id: 'r-1',
      patientProfileId: 'p-1',
      statusConceptId: 'st',
      createdAt: '2026-10-28T12:00:00.000Z',
      targetEncounterId: 'e-9',
    };

    it('aceptar lo manda y la respuesta lo devuelve', () => {
      let referral: Referral | undefined;
      TestBed.inject(ReferralsClient)
        .respond('r-1', { decision: 'ACCEPT', targetEncounterId: 'e-9' })
        .subscribe((r) => (referral = r));
      const req = http.expectOne('/referrals/r-1/respond');
      expect(req.request.body).toEqual({ decision: 'ACCEPT', targetEncounterId: 'e-9' });
      req.flush({ ok: true, ...ROW });
      expect(referral?.targetEncounterId).toBe('e-9');
    });

    it('rechazar nunca lo manda, aunque venga: la API responde 422', () => {
      TestBed.inject(ReferralsClient)
        .respond('r-1', { decision: 'REJECT', rejectReason: 'Sin cupo', targetEncounterId: 'e-9' })
        .subscribe();
      const req = http.expectOne('/referrals/r-1/respond');
      expect(req.request.body).toEqual({ decision: 'REJECT', rejectReason: 'Sin cupo' });
      req.flush({ ok: true, ...ROW, targetEncounterId: null });
    });

    it('la lectura en `null` queda ausente', () => {
      let referral: Referral | undefined;
      TestBed.inject(ReferralsClient).get('r-1').subscribe((r) => (referral = r));
      http.expectOne('/referrals/r-1').flush({ ...ROW, targetEncounterId: null });
      expect(referral !== undefined && 'targetEncounterId' in referral).toBe(false);
    });
  });
});
