import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';
import { loading, ready } from '../../../core/view-state/view-state';
import { ordersBlockState, pendingResultsState, todayRange, wordingFor } from './laboratory-home.logic';

const order = (orderId: string, status: LabOrder['status']): LabOrder => ({
  orderId,
  studyName: 'Hemograma',
  patientName: 'Ana',
  requesterName: 'Dra. Rojas',
  requestedAt: `2026-11-0${orderId}T09:00:00Z`,
  status,
  reason: null,
  files: [],
});

describe('reglas de la portada del centro de diagnóstico', () => {
  it('sin saber el tipo de centro, el texto sirve para laboratorio e imagen', () => {
    expect(wordingFor(null).items).toBe('muestras o estudios');
    expect(wordingFor('LABORATORY').items).toBe('muestras');
    expect(wordingFor('IMAGING').items).toBe('estudios');
  });

  it('sin órdenes es S3 con próxima acción, no tres ceros', () => {
    const state = ordersBlockState(ready([]), wordingFor(null));
    expect(state.status).toBe('empty');
  });

  it('la carga pasa intacta: no se inventa un vacío', () => {
    expect(ordersBlockState(loading(), wordingFor(null)).status).toBe('loading');
    expect(pendingResultsState(loading()).status).toBe('loading');
  });

  it('pendientes son sólo las procesadas, la más nueva primero', () => {
    const state = pendingResultsState(ready([order('1', 'PROCESSED'), order('2', 'UPLOADED'), order('3', 'PROCESSED')]));
    expect(state.status === 'ready' && state.data.items.map((o) => o.orderId)).toEqual(['3', '1']);
  });

  it('el día va de medianoche a medianoche', () => {
    const { from, to } = todayRange(new Date(2026, 10, 4, 15, 30));
    expect(from).toEqual(new Date(2026, 10, 4));
    expect(to).toEqual(new Date(2026, 10, 5));
  });
});
