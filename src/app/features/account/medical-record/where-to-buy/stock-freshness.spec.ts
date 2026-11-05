import {
  availabilityByMedication,
  DISPONIBILIDAD_FIXTURE,
  FIXTURE_IDS,
} from '../../../../core/data-access/pharmacy/pharmacy.fixtures';
import { evaluateBranches, pinStatusOf, type PrescriptionItem } from './pharmacy-branches';
import { STALE_STOCK_AFTER_HOURS, staleStockNoticeOf } from './stock-freshness';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const HOUR_MS = 3_600_000;

/** El instante de hace `hours` horas, en el ISO que manda la API. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR_MS).toISOString();
}

describe('staleStockNoticeOf (REQ-19-011)', () => {
  it('fresco: por debajo del umbral no avisa nada', () => {
    expect(staleStockNoticeOf(hoursAgo(2), NOW)).toBeNull();
    expect(staleStockNoticeOf(hoursAgo(STALE_STOCK_AFTER_HOURS - 0.01), NOW)).toBeNull();
  });

  it('desactualizado: desde el umbral lo dice en días y pide confirmar', () => {
    expect(staleStockNoticeOf(hoursAgo(STALE_STOCK_AFTER_HOURS), NOW)).toBe(
      'Existencias informadas hace 1 día; confirme con la farmacia antes de ir.',
    );
    expect(staleStockNoticeOf(hoursAgo(3 * 24 + 5), NOW)).toBe(
      'Existencias informadas hace 3 días; confirme con la farmacia antes de ir.',
    );
    expect(staleStockNoticeOf(hoursAgo(45 * 24), NOW)).toBe(
      'Existencias informadas hace más de un mes; confirme con la farmacia antes de ir.',
    );
  });

  it('sin fecha, con una ilegible o en el futuro: no inventa una antigüedad', () => {
    expect(staleStockNoticeOf(undefined, NOW)).toBeNull();
    expect(staleStockNoticeOf(null, NOW)).toBeNull();
    expect(staleStockNoticeOf('no es una fecha', NOW)).toBeNull();
    expect(staleStockNoticeOf(hoursAgo(-48), NOW)).toBeNull();
  });
});

describe('evaluateBranches y pinStatusOf con la antigüedad de las existencias', () => {
  const queryable: readonly PrescriptionItem[] = [
    FIXTURE_IDS.conceptoAmoxicilina,
    FIXTURE_IDS.conceptoIbuprofeno,
  ].map((conceptId, index) => ({
    conceptId,
    medication: `Medicamento ${index}`,
    instructions: '',
    issued: true,
  }));

  /** La sede completa del fixture, con la fecha dada; la parcial, sin fecha. */
  /** Con el seguro aprobándolo todo, para mirar también esa variante. */
  const allApproved = new Set(queryable.map((item) => item.conceptId));

  function evaluateWith(stockUpdatedAt: string | null | undefined) {
    const [complete, partial] = DISPONIBILIDAD_FIXTURE.items;
    const response = availabilityByMedication({
      ...DISPONIBILIDAD_FIXTURE,
      items: [{ ...complete!, stockUpdatedAt }, partial!],
    });
    return evaluateBranches(response, queryable, allApproved, NOW).branches;
  }

  it('desactualizado: la sede completa deja de afirmar «Tiene todo», con y sin seguro', () => {
    const [branch] = evaluateWith(hoursAgo(72));
    expect(branch!.complete).toBe(true);
    expect(branch!.staleStockNotice).toContain('hace 3 días');
    expect(pinStatusOf(branch!, false)).toEqual({ etiqueta: 'Tenía todo', tono: 'info' });
    expect(pinStatusOf(branch!, true)).toEqual({ etiqueta: 'Tenía todo lo aprobado', tono: 'info' });
  });

  it('fresco: la sede completa sigue diciendo «Tiene todo»', () => {
    const [branch] = evaluateWith(hoursAgo(2));
    expect(branch!.staleStockNotice).toBeNull();
    expect(pinStatusOf(branch!, false)).toEqual({ etiqueta: 'Tiene todo', tono: 'success' });
  });

  it('sin fecha: el comportamiento de siempre', () => {
    const [complete, partial] = evaluateWith(undefined);
    expect(complete!.staleStockNotice).toBeNull();
    expect(pinStatusOf(complete!, false)).toEqual({ etiqueta: 'Tiene todo', tono: 'success' });
    expect(pinStatusOf(partial!, false)).toEqual({ etiqueta: 'Le falta algo', tono: 'warning' });
  });
});
