import { MODALIDADES_DE_ENTREGA } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { entregaEnPantalla, toEntregaPresentation } from './entrega-status';
import { PEDIDO_CON_DELIVERY, PEDIDO_NUEVO } from './pharmacy-inbox.fixtures';

/**
 * El medio de entrega del lado del mostrador (FAR-I3): las tres modalidades
 * del contrato tienen palabra, los dos envíos se leen igual —para la farmacia
 * son el mismo trabajo— y el ámbar no aparece: es el punto de acción único
 * del sistema y una logística no es una acción pendiente.
 */
describe('entrega-status', () => {
  it('cubre las tres modalidades del contrato, en palabras', () => {
    for (const modalidad of MODALIDADES_DE_ENTREGA) {
      const presentacion = toEntregaPresentation(modalidad);
      expect(presentacion, modalidad).not.toBeNull();
      expect(presentacion?.label, modalidad).not.toContain('_');
      expect(presentacion?.descripcion.length ?? 0, modalidad).toBeGreaterThan(10);
    }
  });

  it('distingue el mostrador del reparto y no inventa dos palabras para lo mismo', () => {
    expect(toEntregaPresentation('RETIRO')?.label).toBe('Recojo en mostrador');
    expect(toEntregaPresentation('DOMICILIO')?.label).toBe('Delivery');
    expect(toEntregaPresentation('TRABAJO')?.label).toBe('Delivery');
  });

  it('el mostrador es una faceta neutra y el reparto informa; el ámbar queda afuera', () => {
    expect(toEntregaPresentation('RETIRO')?.tone).toBe('neutral');
    expect(toEntregaPresentation('DOMICILIO')?.tone).toBe('info');
    for (const modalidad of MODALIDADES_DE_ENTREGA) {
      expect(toEntregaPresentation(modalidad)?.tone, modalidad).not.toBe('warning');
    }
  });

  it('sin modalidad no pinta nada: la ausencia no se rellena con un supuesto', () => {
    expect(toEntregaPresentation(null)).toBeNull();
  });
});

/**
 * La resolución de un pedido concreto: manda la `modalidad` del contrato, y
 * sólo el pedido de ejemplo de la maqueta trae el suyo — rotulado.
 */
describe('entregaEnPantalla', () => {
  it('un pedido común usa la modalidad que devolvió la API y no se rotula', () => {
    const entrega = entregaEnPantalla(PEDIDO_NUEVO);

    expect(entrega?.modalidad).toBe('RETIRO');
    expect(entrega?.presentacion.label).toBe('Recojo en mostrador');
    expect(entrega?.esEjemplo).toBe(false);
    expect(entrega?.direccion).toBeNull();
  });

  it('el pedido de ejemplo sale a domicilio, con dirección y declarado como maqueta', () => {
    const entrega = entregaEnPantalla(PEDIDO_CON_DELIVERY);

    // Lo que devuelve la API para ese pedido sigue siendo retiro …
    expect(PEDIDO_CON_DELIVERY.modalidad).toBe('RETIRO');
    // … y la pantalla dice que el medio lo puso ella.
    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect(entrega?.presentacion.label).toBe('Delivery');
    expect(entrega?.esEjemplo).toBe(true);
    expect(entrega?.direccion).toContain('Cristo Redentor');
  });

  it('la modalidad efectiva y la etiqueta salen de la misma respuesta', () => {
    // Una sola fuente: lo que la pantalla muestra y lo que ofrece hacer no
    // pueden discrepar porque no hay dos lecturas de dónde discrepar.
    for (const pedido of [PEDIDO_NUEVO, PEDIDO_CON_DELIVERY]) {
      const entrega = entregaEnPantalla(pedido);
      expect(entrega?.presentacion, pedido.id).toBe(
        toEntregaPresentation(entrega?.modalidad ?? null),
      );
    }
  });

  it('sin modalidad ni ejemplo no hay nada que mostrar', () => {
    expect(entregaEnPantalla({ ...PEDIDO_NUEVO, modalidad: null })).toBeNull();
  });
});
