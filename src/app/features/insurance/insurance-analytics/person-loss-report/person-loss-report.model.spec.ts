import { describe, expect, it } from 'vitest';

import type { ReceivedClaim } from '../../../../core/data-access/insurance/insurance.types';
import {
  buildPersonLossReport,
  formatScaled,
  monthsBetween,
  percentOf,
  toScaled,
  type PersonLossReportQuery,
} from './person-loss-report.model';

const BOB = { code: 'BOB', display: 'Boliviano' };
const USD = { code: 'USD', display: 'Dólar' };

interface ClaimSeed {
  readonly id: string;
  readonly patientId: string;
  readonly name?: string | null;
  readonly billed: string;
  readonly approved: string | null;
  readonly submittedAt: string;
  readonly plan?: string | null;
  readonly currency?: typeof BOB;
}

function claim(seed: ClaimSeed): ReceivedClaim {
  const currency = seed.currency ?? BOB;
  return {
    id: seed.id,
    claimIdentifier: `CL-${seed.id}`,
    patient: {
      id: seed.patientId,
      displayName: seed.name === undefined ? `Persona ${seed.patientId}` : seed.name,
      patientCode: null,
      memberIdentifier: `AF-${seed.patientId}`,
    },
    practitioner: null,
    providerName: 'Consultorio',
    service: null,
    additionalServiceCount: 0,
    billedTotal: { amount: seed.billed, currency },
    approvedTotal: seed.approved === null ? null : { amount: seed.approved, currency },
    submittedAt: new Date(`${seed.submittedAt}T15:00:00Z`),
    serviceDate: null,
    policyIdentifier: null,
    planName: seed.plan === undefined ? 'Aseguradora · Plan Oro' : seed.plan,
    status: null,
    lines: [],
    decision: null,
    invoice: null,
  };
}

const QUERY: PersonLossReportQuery = {
  startDate: '2026-01-01',
  endDate: '2026-03-31',
  planName: null,
  plans: [
    { name: 'Plan Oro', monthlyPremiumAmount: '100.00' },
    { name: 'Plan Sin Prima', monthlyPremiumAmount: null },
  ],
};

describe('aritmética de importes', () => {
  it('suma decimales sin el error de coma flotante', () => {
    expect(formatScaled(toScaled('0.1') + toScaled('0.2'))).toBe('0.30');
  });

  it('redondea half-up a dos decimales', () => {
    expect(formatScaled(toScaled('1.005'))).toBe('1.01');
    expect(formatScaled(toScaled('1.004'))).toBe('1.00');
  });

  it('el porcentaje no existe con denominador cero', () => {
    expect(percentOf(100n, 0n)).toBeNull();
    expect(percentOf(toScaled('75'), toScaled('100'))).toBe('75.0');
    expect(percentOf(toScaled('1'), toScaled('3'))).toBe('33.3');
  });

  it('un trimestre son unos tres meses', () => {
    expect(monthsBetween('2026-01-01', '2026-03-31')).toBeCloseTo(2.96, 1);
  });
});

describe('buildPersonLossReport', () => {
  it('agrupa por persona y separa lo dictaminado de lo pendiente', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '100.00',
          approved: '80.00',
          submittedAt: '2026-01-10',
        }),
        claim({
          id: '2',
          patientId: 'a',
          billed: '50.00',
          approved: '0.00',
          submittedAt: '2026-02-10',
        }),
        claim({
          id: '3',
          patientId: 'a',
          billed: '30.00',
          approved: null,
          submittedAt: '2026-03-01',
        }),
        claim({
          id: '4',
          patientId: 'b',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2026-02-01',
        }),
      ],
      QUERY,
    );

    const a = report.rows.find((row) => row.personId === 'a')!;
    expect(a.claimsCount).toBe(3);
    expect(a.pendingCount).toBe(1);
    expect(a.billedAmount).toBe('180.00');
    expect(a.approvedAmount).toBe('80.00');
    // La pendiente no se cuenta como denegada: 150 dictaminados − 80 aprobados.
    expect(a.deniedAmount).toBe('70.00');
    expect(a.approvalRatePercent).toBe('53.3');
    expect(report.rows).toHaveLength(2);
    expect(report.currencyCode).toBe('BOB');
  });

  it('la siniestralidad es aprobado ÷ prima del periodo', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '400.00',
          approved: '300.00',
          submittedAt: '2026-01-10',
        }),
      ],
      QUERY,
    );
    const row = report.rows[0]!;
    // Prima: 100 × ~2,96 meses ≈ 296 → 300 / 296 ≈ 101 %.
    expect(row.premiumAmount).toBe('296.00');
    expect(row.lossRatioPercent).toBe('101.4');
  });

  it('sin límite de inicio («Todo») la prima corre desde la primera solicitud', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '400.00',
          approved: '300.00',
          submittedAt: '2026-01-10',
        }),
      ],
      { ...QUERY, startDate: null },
    );
    // 10/01 → 31/03 = 81 días ≈ 2,66 meses.
    expect(report.startDate).toBe('2026-01-10');
    expect(report.rows[0]!.premiumAmount).toBe('266.00');
  });

  it('sin prima registrada la siniestralidad es null, no 0 %', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '40.00',
          approved: '40.00',
          submittedAt: '2026-01-10',
          plan: 'Aseguradora · Plan Sin Prima',
        }),
      ],
      QUERY,
    );
    expect(report.rows[0]!.premiumAmount).toBeNull();
    expect(report.rows[0]!.lossRatioPercent).toBeNull();
  });

  it('respeta el periodo: lo de afuera no entra', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2025-12-31',
        }),
        claim({
          id: '2',
          patientId: 'a',
          billed: '20.00',
          approved: '20.00',
          submittedAt: '2026-04-01',
        }),
      ],
      QUERY,
    );
    expect(report.rows).toEqual([]);
    expect(report.claimsConsidered).toBe(0);
  });

  it('filtra por plan', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2026-01-10',
        }),
        claim({
          id: '2',
          patientId: 'b',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2026-01-10',
          plan: 'Aseguradora · Plan Plata',
        }),
      ],
      { ...QUERY, planName: 'Plan Plata' },
    );
    expect(report.rows.map((row) => row.personId)).toEqual(['b']);
  });

  it('informa en una sola moneda y cuenta las demás en vez de sumarlas', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2026-01-10',
        }),
        claim({
          id: '2',
          patientId: 'a',
          billed: '20.00',
          approved: '20.00',
          submittedAt: '2026-01-11',
        }),
        claim({
          id: '3',
          patientId: 'a',
          billed: '999.00',
          approved: '999.00',
          submittedAt: '2026-01-12',
          currency: USD as typeof BOB,
        }),
      ],
      QUERY,
    );
    expect(report.currencyCode).toBe('BOB');
    expect(report.excludedOtherCurrencyCount).toBe(1);
    expect(report.rows[0]!.billedAmount).toBe('30.00');
  });

  it('ordena de mayor a menor siniestralidad y deja al final lo no computable', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'bajo',
          billed: '10.00',
          approved: '10.00',
          submittedAt: '2026-01-10',
        }),
        claim({
          id: '2',
          patientId: 'alto',
          billed: '500.00',
          approved: '500.00',
          submittedAt: '2026-01-10',
        }),
        claim({
          id: '3',
          patientId: 'sinprima',
          billed: '900.00',
          approved: '900.00',
          submittedAt: '2026-01-10',
          plan: 'Aseguradora · Plan Sin Prima',
        }),
      ],
      QUERY,
    );
    expect(report.rows.map((row) => row.personId)).toEqual(['alto', 'bajo', 'sinprima']);
  });

  it('nombra a quien no tiene nombre sin inventarle uno', () => {
    const report = buildPersonLossReport(
      [
        claim({
          id: '1',
          patientId: 'a',
          name: null,
          billed: '1.00',
          approved: null,
          submittedAt: '2026-01-10',
        }),
      ],
      QUERY,
    );
    expect(report.rows[0]!.name).toBe('Sin nombre registrado');
    expect(report.rows[0]!.memberCode).toBe('AF-a');
  });
});
