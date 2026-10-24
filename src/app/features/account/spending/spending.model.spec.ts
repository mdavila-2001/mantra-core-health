import type {
  PatientSpendingResponseDto,
  SpendingMovementDto,
} from '@core/data-access/patient-spending/patient-spending.dto';

import {
  buildDashboard,
  describeDelta,
  formatMoney,
  movementFromContract,
  requestedRange,
} from './spending.model';

const TODAY = new Date(2026, 8, 15, 12); // 15 de septiembre de 2026

let seq = 0;
function mov(
  when: Date,
  paid: string,
  code = 'SPEND_PHARMACY',
  extra: Partial<SpendingMovementDto> = {},
): SpendingMovementDto {
  seq += 1;
  return {
    id: `m-${seq}`,
    occurredAt: when.toISOString(),
    description: 'Movimiento',
    category: { code, display: code },
    providerName: 'Farmacia Vida',
    grossAmount: paid,
    coveredAmount: '0.00',
    discountAmount: '0.00',
    paidAmount: paid,
    ...extra,
  };
}

function response(items: SpendingMovementDto[]): PatientSpendingResponseDto {
  return {
    currency: 'BOB',
    from: '2025-01-01',
    to: '2026-09-15',
    items: [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  };
}

describe('spending.model', () => {
  it('pide del 1 de enero del año pasado a hoy', () => {
    expect(requestedRange(TODAY)).toEqual({ from: '2025-01-01', to: '2026-09-15' });
  });

  it('suma en centavos: 0,10 + 0,20 da 0,30 exacto', () => {
    const d = buildDashboard(
      response([mov(new Date(2026, 8, 1), '0.10'), mov(new Date(2026, 8, 2), '0.20')]),
      TODAY,
    );
    expect(d.thisMonth.cents).toBe(30);
  });

  it('compara el mes contra el MISMO tramo del mes anterior, no contra el mes entero', () => {
    const d = buildDashboard(
      response([
        mov(new Date(2026, 8, 10), '200.00'), // este mes
        mov(new Date(2026, 7, 10), '100.00'), // agosto, dentro del tramo 1–15
        mov(new Date(2026, 7, 25), '900.00'), // agosto, fuera del tramo
      ]),
      TODAY,
    );
    expect(d.thisMonth).toEqual({ cents: 20000, previousCents: 10000, ratio: 1 });
    // El mes anterior completo sí incluye el 25.
    expect(d.previousMonth.cents).toBe(100000);
    expect(d.previousMonthLabel).toBe('agosto 2026');
  });

  it('compara el año contra el mismo tramo del año pasado y aparte da el total del año pasado', () => {
    const d = buildDashboard(
      response([
        mov(new Date(2026, 2, 1), '300.00'),
        mov(new Date(2025, 2, 1), '200.00'), // dentro del tramo
        mov(new Date(2025, 10, 1), '500.00'), // noviembre del año pasado: fuera del tramo
      ]),
      TODAY,
    );
    expect(d.yearToDate).toEqual({ cents: 30000, previousCents: 20000, ratio: 0.5 });
    expect(d.previousYearTotalCents).toBe(70000);
  });

  it('los meses que no llegaron quedan en null, no en cero', () => {
    const d = buildDashboard(response([mov(new Date(2026, 0, 5), '10.00')]), TODAY);
    expect(d.months).toHaveLength(12);
    expect(d.months[8]!.currentCents).toBe(0);
    expect(d.months[9]!.currentCents).toBeNull();
    expect(d.months[0]!.currentCents).toBe(1000);
  });

  it('reparte por categoría, de mayor a menor, con su parte del total', () => {
    const d = buildDashboard(
      response([
        mov(new Date(2026, 8, 2), '300.00', 'SPEND_CONSULTATION'),
        mov(new Date(2026, 8, 3), '100.00', 'SPEND_PHARMACY'),
      ]),
      TODAY,
    );
    expect(d.categoriesThisMonth.map((c) => [c.label, c.share])).toEqual([
      ['Consultas', 0.75],
      ['Farmacia', 0.25],
    ]);
    expect(d.categoriesThisMonth[0]!.icon).toBe('stethoscope');
  });

  it('una categoría que el front no conoce se muestra con el rótulo del contrato', () => {
    const m = movementFromContract(mov(new Date(2026, 8, 2), '1.00', 'SPEND_DENTAL'));
    expect(m.categoryLabel).toBe('SPEND_DENTAL');
    expect(m.categoryIcon).toBe('folder');
  });

  it('suma lo que cubrió el seguro y lo descontado en el año', () => {
    const d = buildDashboard(
      response([
        mov(new Date(2026, 4, 2), '100.00', 'SPEND_CONSULTATION', {
          grossAmount: '250.00',
          coveredAmount: '125.00',
          discountAmount: '25.00',
        }),
      ]),
      TODAY,
    );
    expect(d.yearGrossCents).toBe(25000);
    expect(d.yearCoveredCents).toBe(12500);
    expect(d.yearDiscountCents).toBe(2500);
  });

  it('elige el gasto más grande del año y ordena los proveedores por lo pagado', () => {
    const d = buildDashboard(
      response([
        mov(new Date(2026, 1, 1), '50.00', 'SPEND_PHARMACY', { providerName: 'Farmacia Vida' }),
        mov(new Date(2026, 1, 2), '700.00', 'SPEND_IMAGING', { providerName: 'Hospital San Lucas' }),
        mov(new Date(2026, 1, 3), '60.00', 'SPEND_PHARMACY', { providerName: 'Farmacia Vida' }),
      ]),
      TODAY,
    );
    expect(d.biggestThisYear?.paidCents).toBe(70000);
    expect(d.topProviders).toEqual([
      { name: 'Hospital San Lucas', cents: 70000, count: 1 },
      { name: 'Farmacia Vida', cents: 11000, count: 2 },
    ]);
  });

  it('dice la variación en palabras, sin depender del color', () => {
    expect(describeDelta({ cents: 120, previousCents: 100, ratio: 0.2 }, 'agosto')).toBe(
      '20 % más que agosto',
    );
    expect(describeDelta({ cents: 80, previousCents: 100, ratio: -0.2 }, 'agosto')).toBe(
      '20 % menos que agosto',
    );
    expect(describeDelta({ cents: 50, previousCents: 0, ratio: null }, 'agosto')).toBe(
      'Sin gasto en agosto',
    );
  });

  it('formatea en bolivianos, como se escribe en Bolivia', () => {
    expect(formatMoney(123450, 'Bs')).toMatch(/^Bs 1\.234,50$/);
  });
});
