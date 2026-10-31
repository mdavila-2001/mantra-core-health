import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { arrivalIssues, transferIssues, vitalsIssues } from './referral-transfer.types';
import { transferFromWire } from './referral-transfer.wire';
import { referralErrorDetail } from './referrals.errors';
import { ReferralsClient } from './referrals.client';
import type { Referral } from './referrals.types';

/**
 * El traslado (v4274): las reglas del front iguales a las de la API
 * (`assertTransferRules`), la frontera (fechas, `null`, códigos que no se
 * conocen) y los dos PATCH nuevos.
 */
describe('reglas del traslado (iguales a la API)', () => {
  const reasons = (issues: readonly { rule: string }[]): string[] => [...new Set(issues.map((i) => i.rule))];

  it('sin traslado físico no exige nada', () => {
    expect(transferIssues({ required: false })).toEqual([]);
  });

  it('TRANSFER_INCOMPLETE: con traslado faltan medio y estado al salir, cada uno en su campo', () => {
    const issues = transferIssues({ required: true });
    expect(issues.map((i) => [i.rule, i.field])).toEqual([
      ['TRANSFER_INCOMPLETE', 'transportMode'],
      ['TRANSFER_INCOMPLETE', 'departureCondition'],
    ]);
  });

  it('TRANSFER_UNSAFE_TRANSPORT: crítico en vehículo particular y sin personal de salud', () => {
    const issues = transferIssues({
      required: true,
      transportMode: 'PRIVATE_VEHICLE',
      departureCondition: 'CRITICAL',
      receiverContacted: true,
      receiverContactName: 'Guardia',
    });
    expect(issues.map((i) => [i.rule, i.field])).toEqual([
      ['TRANSFER_UNSAFE_TRANSPORT', 'transportMode'],
      ['TRANSFER_UNSAFE_TRANSPORT', 'escortProfessionalName'],
    ]);
    expect(issues[0]?.message).toContain('ambulancia');
  });

  it('TRANSFER_RECEIVER_NOT_CONTACTED: inestable sin aviso al receptor', () => {
    const issues = transferIssues({
      required: true,
      transportMode: 'AMBULANCE_BASIC',
      departureCondition: 'UNSTABLE',
      escortProfessionalName: 'Lic. Suárez',
    });
    expect(issues.map((i) => i.field)).toEqual(['receiverContacted', 'receiverContactName']);
    expect(reasons(issues)).toEqual(['TRANSFER_RECEIVER_NOT_CONTACTED']);
  });

  it('estable en vehículo particular, sin aviso: válido', () => {
    expect(
      transferIssues({ required: true, transportMode: 'PRIVATE_VEHICLE', departureCondition: 'STABLE' }),
    ).toEqual([]);
  });

  it('crítico completo: ambulancia, personal y aviso — válido', () => {
    expect(
      transferIssues({
        required: true,
        transportMode: 'AMBULANCE_ADVANCED',
        departureCondition: 'CRITICAL',
        escortProfessionalName: 'Dr. Vaca',
        receiverContacted: true,
        receiverContactName: 'Guardia de emergencias',
      }),
    ).toEqual([]);
  });

  it('TRANSFER_DETAIL_REQUIRED: «Otro» sin detalle', () => {
    const issues = transferIssues({ required: true, transportMode: 'OTHER', departureCondition: 'STABLE' });
    expect(issues.map((i) => [i.rule, i.field])).toEqual([['TRANSFER_DETAIL_REQUIRED', 'transportDetail']]);
  });

  it('TRANSFER_VITALS_OUT_OF_RANGE: los rangos de la base, diastólica < sistólica y enteros', () => {
    expect(vitalsIssues({ systolicBp: 40, diastolicBp: 20, temperatureC: 45, glasgow: 15, oxygenSaturation: 100 })).toEqual([]);
    expect(vitalsIssues({ glasgow: 2 }).map((i) => i.field)).toEqual(['glasgow']);
    expect(vitalsIssues({ temperatureC: 45.1 }).map((i) => i.field)).toEqual(['temperatureC']);
    expect(vitalsIssues({ heartRate: 88.5 })[0]?.message).toContain('sin decimales');
    expect(vitalsIssues({ heartRate: Number.NaN }).map((i) => i.field)).toEqual(['heartRate']);
    expect(vitalsIssues({ systolicBp: 120, diastolicBp: 120 })[0]?.message).toContain('menor que la sistólica');
  });

  it('la llegada: fecha y estado obligatorios, y no antes de la salida', () => {
    expect(arrivalIssues({}, undefined).map((i) => i.field)).toEqual(['arrivedAt', 'arrivalCondition']);
    const departed = new Date('2026-10-30T10:00:00Z');
    const early = arrivalIssues({ arrivedAt: new Date('2026-10-30T09:00:00Z'), arrivalCondition: 'STABLE' }, departed);
    expect(early.map((i) => i.rule)).toEqual(['TRANSFER_ARRIVAL_BEFORE_DEPARTURE']);
    expect(
      arrivalIssues({ arrivedAt: new Date('2026-10-30T11:00:00Z'), arrivalCondition: 'DECEASED' }, departed),
    ).toEqual([]);
  });
});

describe('el traslado en la frontera', () => {
  it('null o sin datos no es traslado; los códigos desconocidos no se inventan', () => {
    expect(transferFromWire(null)).toBeUndefined();
    expect(transferFromWire({ required: null, vitals: null })).toBeUndefined();
    const t = transferFromWire({
      required: true,
      transportMode: 'TELEPORT',
      departureCondition: 'CRITICAL',
      vitals: { systolicBp: 90, temperatureC: '37.5', glasgow: null, recordedAt: '2026-10-30T10:00:00.000Z' },
      departedAt: '2026-10-30T10:15:00.000Z',
      arrivedAt: null,
    });
    expect(t?.transportMode).toBeUndefined();
    expect(t?.departureCondition).toBe('CRITICAL');
    expect(t?.vitals).toEqual({ recordedAt: new Date('2026-10-30T10:00:00.000Z'), systolicBp: 90, temperatureC: 37.5 });
    expect(t?.departedAt).toEqual(new Date('2026-10-30T10:15:00.000Z'));
    expect(t?.arrivedAt).toBeUndefined();
  });
});

describe('ReferralsClient — traslado', () => {
  let client: ReferralsClient;
  let http: HttpTestingController;
  const row = {
    id: 'r-1',
    patientProfileId: 'p-1',
    statusConceptId: 'st',
    status: 'PENDING',
    createdAt: '2026-10-30T12:00:00.000Z',
    transfer: { required: true, transportMode: 'AMBULANCE_BASIC', departureCondition: 'STABLE', arrivedAt: null },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ReferralsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el alta manda transfer con fechas ISO y sin los opcionales vacíos', () => {
    client
      .create({
        patientProfileId: 'p-1',
        targetExternalName: 'Hospital Japonés',
        transfer: {
          required: true,
          transportMode: 'AMBULANCE_ADVANCED',
          departureCondition: 'CRITICAL',
          escortProfessionalName: '  Dr. Vaca ',
          companionName: '',
          vitals: { systolicBp: 90, diastolicBp: 50 },
          receiverContacted: true,
          receiverContactName: 'Guardia',
          departedAt: new Date('2026-10-30T10:00:00.000Z'),
        },
      })
      .subscribe();
    const req = http.expectOne('/referrals');
    expect(req.request.body.transfer).toEqual({
      required: true,
      transportMode: 'AMBULANCE_ADVANCED',
      departureCondition: 'CRITICAL',
      escortProfessionalName: 'Dr. Vaca',
      vitals: { systolicBp: 90, diastolicBp: 50 },
      receiverContacted: true,
      receiverContactName: 'Guardia',
      departedAt: '2026-10-30T10:00:00.000Z',
    });
    req.flush({ id: 'r-1', patientProfileId: 'p-1', statusConceptId: 'st', createdAt: row.createdAt });
  });

  it('updateTransfer → PATCH /referrals/:id/transfer; lo vaciado viaja en null para que la API lo borre', () => {
    let updated: Referral | undefined;
    client
      .updateTransfer('r 1', { required: true, transportMode: 'AMBULANCE_BASIC', departureCondition: 'STABLE' })
      .subscribe((r) => (updated = r));
    const req = http.expectOne('/referrals/r%201/transfer');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({
      required: true,
      transportMode: 'AMBULANCE_BASIC',
      departureCondition: 'STABLE',
      companionName: null,
      escortProfessionalName: null,
      vitals: null,
      departedAt: null,
    });
    req.flush(row);
    expect(updated?.transfer?.transportMode).toBe('AMBULANCE_BASIC');
    expect(updated?.transfer?.arrivedAt).toBeUndefined();
  });

  it('recordArrival → PATCH /referrals/:id/arrival con fecha ISO y notas recortadas', () => {
    client
      .recordArrival('r-1', {
        arrivedAt: new Date('2026-10-30T11:00:00.000Z'),
        arrivalCondition: 'UNSTABLE',
        arrivalNotes: '  Llegó con SatO2 90 % ',
      })
      .subscribe();
    const req = http.expectOne('/referrals/r-1/arrival');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      arrivedAt: '2026-10-30T11:00:00.000Z',
      arrivalCondition: 'UNSTABLE',
      arrivalNotes: 'Llegó con SatO2 90 %',
    });
    req.flush({ ...row, transfer: { ...row.transfer, arrivedAt: '2026-10-30T11:00:00.000Z', arrivalCondition: 'UNSTABLE' } });
  });

  it('los reason del traslado se dicen en palabras', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { code: 'VALIDATION_FAILED', reason: 'TRANSFER_UNSAFE_TRANSPORT', details: { fields: ['transfer.transportMode'] } },
    });
    const detail = referralErrorDetail(error);
    expect(detail?.reason).toBe('TRANSFER_UNSAFE_TRANSPORT');
    expect(detail?.message).toContain('ambulancia');
    expect(detail?.fields).toEqual(['transfer.transportMode']);
    const already = new HttpErrorResponse({ status: 422, error: { reason: 'REFERRAL_ARRIVAL_ALREADY_RECORDED' } });
    expect(referralErrorDetail(already)?.message).toContain('llegada ya está registrada');
  });
});
