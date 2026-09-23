import {
  addPeriods,
  buildSchedule,
  rebalance,
  remainingCents,
  splitCents,
  type PlanRow,
} from './flexible-payment-plan';

function fila(amount: number, pinned = false, n = 1): PlanRow {
  return { installmentNumber: n, dueDate: '2026-10-01', amount, pinned };
}

describe('flexible-payment-plan', () => {
  it('reparte centavos sin perder ninguno', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(splitCents(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(splitCents(500, 0)).toEqual([]);
  });

  it('suma meses respetando el fin de mes', () => {
    expect(addPeriods('2026-01-31', 'MONTHLY', 1)).toBe('2026-02-28');
    expect(addPeriods('2026-01-31', 'MONTHLY', 2)).toBe('2026-03-31');
    expect(addPeriods('2026-12-15', 'MONTHLY', 1)).toBe('2027-01-15');
  });

  it('suma semanas y quincenas', () => {
    expect(addPeriods('2026-09-10', 'WEEKLY', 1)).toBe('2026-09-17');
    expect(addPeriods('2026-09-10', 'BIWEEKLY', 2)).toBe('2026-10-08');
  });

  it('arma el cronograma con el saldo después del anticipo, sin interés', () => {
    const plan = buildSchedule({
      total: 890,
      downPayment: 190,
      installmentCount: 3,
      frequency: 'MONTHLY',
      firstDueDate: '2026-10-10',
    });
    expect(plan.map((f) => f.amount)).toEqual([233.34, 233.33, 233.33]);
    expect(remainingCents(plan, 890, 190)).toBe(0);
  });

  it('pagado todo de anticipo, no quedan cuotas', () => {
    const plan = buildSchedule({
      total: 100,
      downPayment: 100,
      installmentCount: 3,
      frequency: 'MONTHLY',
      firstDueDate: '2026-10-10',
    });
    expect(plan.every((f) => f.amount === 0)).toBe(true);
  });

  it('rebalancea sólo las cuotas libres', () => {
    const filas = rebalance([fila(70, true, 1), fila(0, false, 2), fila(0, false, 3)], 100, 0);
    expect(filas.map((f) => f.amount)).toEqual([70, 15, 15]);
  });

  it('nunca deja un monto negativo si lo fijado pasa el precio', () => {
    const filas = rebalance([fila(120, true, 1), fila(0, false, 2)], 100, 0);
    expect(filas.map((f) => f.amount)).toEqual([120, 0]);
    expect(remainingCents(filas, 100, 0)).toBe(-2000);
  });

  it('con todo fijado no toca nada y la diferencia queda a la vista', () => {
    const filas = rebalance([fila(40, true, 1), fila(40, true, 2)], 100, 0);
    expect(filas.map((f) => f.amount)).toEqual([40, 40]);
    expect(remainingCents(filas, 100, 0)).toBe(2000);
  });
});
