import { detalleDeOrdenPropia } from './patient-order-detail.mock';
import { detallesDeOrden } from './service-request-detail.mock';

describe('detalleDeOrdenPropia', () => {
  it('una orden sin detalle guardado es «estudio completo, sin detalle»', () => {
    const d = detalleDeOrdenPropia({ id: 'orden-sin-detalle', codeConceptId: 'no-existe' });

    expect(d.componentsSpecified).toBe(false);
    expect(d.components).toEqual([]);
    expect(d.imaging).toBeNull();
    expect(d.requisitionId).toBeNull();
    expect(typeof d.summary).toBe('string');
  });

  it('una orden con detalle guardado devuelve muestra y componentes', () => {
    detallesDeOrden.agregar({
      id: 'orden-con-detalle',
      requisitionId: 'req-1',
      family: null,
      specimenTypeConceptId: null,
      components: [{ conceptId: 'c1', ordinal: 1 }],
      componentsSpecified: true,
      imaging: null,
    } as never);

    const d = detalleDeOrdenPropia({ id: 'orden-con-detalle', codeConceptId: 'x' });

    expect(d.requisitionId).toBe('req-1');
    expect(d.componentsSpecified).toBe(true);
    expect(d.components).toHaveLength(1);
    expect(d.summary).toContain('1 componente');
  });
});
