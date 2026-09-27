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
 * La resolución de un pedido concreto: manda siempre la `modalidad` del
 * contrato, y la maqueta sólo completa la dirección que el contrato no trae —
 * rotulada, y nunca contra la API real.
 */
describe('entregaEnPantalla', () => {
  it('un pedido común usa la modalidad que devolvió la API y no se rotula', () => {
    const entrega = entregaEnPantalla(PEDIDO_NUEVO, true);

    expect(entrega?.modalidad).toBe('RETIRO');
    expect(entrega?.presentacion.label).toBe('Recojo en mostrador');
    expect(entrega?.esEjemplo).toBe(false);
    expect(entrega?.direccion).toBeNull();
  });

  it('sobre la maqueta, el pedido a domicilio suma la dirección de ejemplo, rotulada', () => {
    const entrega = entregaEnPantalla(PEDIDO_CON_DELIVERY, true);

    // La modalidad la declara el contrato (el backend simulado la devuelve) …
    expect(PEDIDO_CON_DELIVERY.modalidad).toBe('DOMICILIO');
    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect(entrega?.presentacion.label).toBe('Delivery');
    // … y lo único de ejemplo es la dirección, que se dice como tal.
    expect(entrega?.esEjemplo).toBe(true);
    expect(entrega?.direccion).toContain('Cristo Redentor');
  });

  it('contra la API real no hay dirección de ejemplo: queda la modalidad del contrato', () => {
    const entrega = entregaEnPantalla(PEDIDO_CON_DELIVERY, false);

    expect(entrega?.modalidad).toBe('DOMICILIO');
    expect(entrega?.presentacion.label).toBe('Delivery');
    expect(entrega?.esEjemplo).toBe(false);
    expect(entrega?.direccion).toBeNull();
  });

  it('la dirección del contrato gana sobre la de ejemplo', () => {
    const entrega = entregaEnPantalla(
      { ...PEDIDO_CON_DELIVERY, direccionDeEntrega: 'Calle Sucre 12' },
      true,
    );

    expect(entrega?.direccion).toBe('Calle Sucre 12');
    expect(entrega?.esEjemplo).toBe(false);
  });

  it('a un retiro no se le pone un domicilio, aunque sea el pedido de ejemplo', () => {
    const entrega = entregaEnPantalla({ ...PEDIDO_CON_DELIVERY, modalidad: 'RETIRO' }, true);

    expect(entrega?.direccion).toBeNull();
    expect(entrega?.esEjemplo).toBe(false);
  });

  it('la modalidad efectiva y la etiqueta salen de la misma respuesta', () => {
    // Una sola fuente: lo que la pantalla muestra y lo que ofrece hacer no
    // pueden discrepar porque no hay dos lecturas de dónde discrepar.
    for (const pedido of [PEDIDO_NUEVO, PEDIDO_CON_DELIVERY]) {
      const entrega = entregaEnPantalla(pedido, true);
      expect(entrega?.presentacion, pedido.id).toBe(
        toEntregaPresentation(entrega?.modalidad ?? null),
      );
    }
  });

  it('sin modalidad no hay nada que mostrar', () => {
    expect(entregaEnPantalla({ ...PEDIDO_NUEVO, modalidad: null }, true)).toBeNull();
    expect(entregaEnPantalla({ ...PEDIDO_CON_DELIVERY, modalidad: null }, true)).toBeNull();
  });
});
