import { MODALIDADES_DE_ENTREGA } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { deliveryInScreen, toDeliveryPresentation } from './delivery-status';
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
      const presentacion = toDeliveryPresentation(modalidad);
      expect(presentacion, modalidad).not.toBeNull();
      expect(presentacion?.label, modalidad).not.toContain('_');
      expect(presentacion?.descripcion.length ?? 0, modalidad).toBeGreaterThan(10);
    }
  });

  it('distingue el mostrador del reparto y no inventa dos palabras para lo mismo', () => {
    expect(toDeliveryPresentation('RETIRO')?.label).toBe('Recojo en mostrador');
    expect(toDeliveryPresentation('DOMICILIO')?.label).toBe('Delivery');
    expect(toDeliveryPresentation('TRABAJO')?.label).toBe('Delivery');
  });

  it('el mostrador es una faceta neutra y el reparto informa; el ámbar queda afuera', () => {
    expect(toDeliveryPresentation('RETIRO')?.tone).toBe('neutral');
    expect(toDeliveryPresentation('DOMICILIO')?.tone).toBe('info');
    for (const modalidad of MODALIDADES_DE_ENTREGA) {
      expect(toDeliveryPresentation(modalidad)?.tone, modalidad).not.toBe('warning');
    }
  });

  it('sin modalidad no pinta nada: la ausencia no se rellena con un supuesto', () => {
    expect(toDeliveryPresentation(null)).toBeNull();
  });
});

/**
 * La resolución de un pedido concreto: la modalidad y la dirección salen del
 * contrato, también sobre la maqueta (las declara el backend simulado).
 */
describe('entregaEnPantalla', () => {
  it('un pedido común usa la modalidad que devolvió la API, sin dirección', () => {
    const entrega = deliveryInScreen(PEDIDO_NUEVO);

    expect(entrega?.modalidad).toBe('RETIRO');
    expect(entrega?.presentacion.label).toBe('Recojo en mostrador');
    expect(entrega?.direccion).toBeNull();
  });

  it('el pedido a domicilio trae su dirección del contrato', () => {
    const entrega = deliveryInScreen(PEDIDO_CON_DELIVERY);

    expect(PEDIDO_CON_DELIVERY.modalidad).toBe('DOMICILIO');
    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect(entrega?.presentacion.label).toBe('Delivery');
    expect(entrega?.direccion).toContain('Cristo Redentor');
  });

  it('un envío sin dirección guardada lo dice con null: no se inventa una', () => {
    const entrega = deliveryInScreen({ ...PEDIDO_CON_DELIVERY, direccionDeEntrega: null });

    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect(entrega?.direccion).toBeNull();
  });

  it('a un retiro no se le pinta un domicilio, aunque el pedido traiga uno', () => {
    const entrega = deliveryInScreen({ ...PEDIDO_CON_DELIVERY, modalidad: 'RETIRO' });

    expect(entrega?.direccion).toBeNull();
  });

  it('la modalidad efectiva y la etiqueta salen de la misma respuesta', () => {
    // Una sola fuente: lo que la pantalla muestra y lo que ofrece hacer no
    // pueden discrepar porque no hay dos lecturas de dónde discrepar.
    for (const pedido of [PEDIDO_NUEVO, PEDIDO_CON_DELIVERY]) {
      const entrega = deliveryInScreen(pedido);
      expect(entrega?.presentacion, pedido.id).toBe(
        toDeliveryPresentation(entrega?.modalidad ?? null),
      );
    }
  });

  it('sin modalidad no hay nada que mostrar', () => {
    expect(deliveryInScreen({ ...PEDIDO_NUEVO, modalidad: null })).toBeNull();
    expect(deliveryInScreen({ ...PEDIDO_CON_DELIVERY, modalidad: null })).toBeNull();
  });
});
