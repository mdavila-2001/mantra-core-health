import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import {
  etiquetaDeMedioDePago,
  pasosDeLaLineaDeTiempo,
  presentacionDePedido,
  toPedidoStatusPresentation,
} from './pedido-status';

/**
 * Lo que se fija acá: el estado siempre se dice **en palabras y con tono del
 * sistema** (cero códigos), y la línea de tiempo cuenta el recorrido real —
 * incluida la regla de que un final anticipado no dibuja progreso.
 */
describe('pedido-status', () => {
  const pedido = (estado: PedidoFarmacia['estado'], sustituciones = 0): PedidoFarmacia => ({
    id: 'p-1',
    estado,
    creadoEl: new Date('2026-08-21T10:00:00'),
    venceEl: null,
    farmacia: 'Farmacia del Sur',
    sede: 'Sucursal Equipetrol',
    direccion: null,
    modalidad: 'RETIRO',
    direccionDeEntrega: null,
    paciente: null,
    prescriptor: null,
    lineas: [],
    totalEstimado: null,
    moneda: null,
    codigoDeRetiro: null,
    motivoDeRechazo: null,
    envio: null,
    entregas: [],
    pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
    sustituciones: Array.from({ length: sustituciones }, (_, i) => ({
      id: `s-${i}`,
      original: { nombre: 'Marca', precio: '60.00' },
      propuesta: { nombre: 'Genérico', precio: '25.00' },
      moneda: 'BOB',
    })),
    requestId: 'rx-1',
    siteId: 'site-1',
    pharmacyId: 'pharmacy-1',
  });

  const pagoQr: PedidoFarmacia['pago'] = {
    estado: 'PAGADO',
    origen: 'QR_DEMO',
    pagadoEl: new Date('2026-08-21T10:03:00'),
    total: '60.00',
    moneda: 'BOB',
  };

  const pagado = (estado: PedidoFarmacia['estado']): PedidoFarmacia => ({
    ...pedido(estado),
    pago: pagoQr,
  });

  it('cada estado del contrato tiene palabra, tono y frase — ningún código suelto', () => {
    const enviado = toPedidoStatusPresentation('ENVIADO');
    expect(enviado.label).toBe('Enviado');
    expect(enviado.tone).toBe('info');

    const pendiente = toPedidoStatusPresentation('ACEPTACION_PENDIENTE');
    expect(pendiente.label).toBe('Esperando tu decisión');
    expect(pendiente.tone).toBe('warning');
    expect(pendiente.descripcion).not.toContain('_');
  });

  it('CONFIRMADO se dice «En preparación» (T-E4), en el badge y en la línea de tiempo', () => {
    expect(toPedidoStatusPresentation('CONFIRMADO').label).toBe('En preparación');
    expect(pasosDeLaLineaDeTiempo(pedido('CONFIRMADO')).map((p) => p.label)).not.toContain(
      'Confirmado',
    );
  });

  it('el recorrido feliz marca lo hecho, lo actual y lo que falta', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('CONFIRMADO'));

    expect(pasos.map((p) => p.label)).toEqual([
      'Enviado',
      'En revisión',
      'En preparación',
      'Listo para retirar',
      'Retirado',
    ]);
    expect(pasos.map((p) => p.status)).toEqual([
      'complete',
      'complete',
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('la decisión pendiente aparece como paso actual', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('ACEPTACION_PENDIENTE', 1));

    expect(pasos.map((p) => p.label)).toContain('Tu decisión');
    expect(pasos.find((p) => p.label === 'Tu decisión')?.status).toBe('current');
  });

  it('quien prefirió el original sigue derecho: la propuesta es historia, no etapa', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('CONFIRMADO', 1));

    expect(pasos.map((p) => p.label)).not.toContain('Tu decisión');
    expect(pasos.find((p) => p.label === 'En preparación')?.status).toBe('current');
  });

  it('retirado es un recorrido completo, sin paso pendiente', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('RETIRADO'));

    expect(pasos.every((p) => p.status === 'complete')).toBe(true);
  });

  it('un final anticipado no dibuja progreso: se cuenta con el aviso', () => {
    expect(pasosDeLaLineaDeTiempo(pedido('RECHAZADO'))).toEqual([]);
    expect(pasosDeLaLineaDeTiempo(pedido('VENCIDO'))).toEqual([]);
    expect(pasosDeLaLineaDeTiempo(pedido('CANCELADO'))).toEqual([]);
    expect(pasosDeLaLineaDeTiempo(pagado('CANCELADO'))).toEqual([]);
  });

  it('con envío el tramo final es otro: en camino y entregado, sin mostrador', () => {
    const enCamino: PedidoFarmacia = {
      ...pedido('CONFIRMADO'),
      modalidad: 'DOMICILIO',
      envio: 'EN_CAMINO',
    };
    const pasos = pasosDeLaLineaDeTiempo(enCamino);

    expect(pasos.map((p) => p.label)).toEqual([
      'Enviado',
      'En revisión',
      'En preparación',
      'En camino',
      'Entregado',
    ]);
    // El hito del envío manda: «En camino» es el paso actual aunque el
    // estado del contrato siga siendo CONFIRMADO.
    expect(pasos.find((p) => p.label === 'En camino')?.status).toBe('current');
    expect(pasos.find((p) => p.label === 'En preparación')?.status).toBe('complete');
  });

  it('el cierre de un envío se dice «Entregado», no «Retirado»', () => {
    const entregado: PedidoFarmacia = {
      ...pedido('RETIRADO'),
      modalidad: 'DOMICILIO',
      envio: 'ENTREGADO',
    };
    expect(presentacionDePedido(entregado).label).toBe('Entregado');
    // En un retiro, la palabra de siempre.
    expect(presentacionDePedido(pedido('RETIRADO')).label).toBe('Retirado');
    const pasos = pasosDeLaLineaDeTiempo(entregado);
    expect(pasos.every((p) => p.status === 'complete')).toBe(true);
  });

  it('listo y pagado ya no dice «pagás al retirar» (FAR-I5)', () => {
    const pagadoListo: PedidoFarmacia = {
      ...pedido('LISTO_PARA_RETIRO'),
      pago: {
        estado: 'PAGADO',
        origen: 'QR_DEMO',
        pagadoEl: new Date('2026-08-21T18:30:00'),
        total: '60.00',
        moneda: 'BOB',
      },
    };
    expect(presentacionDePedido(pagadoListo).descripcion).toContain('Ya está pagado');
    // Pendiente, la frase del mostrador de siempre.
    expect(presentacionDePedido(pedido('LISTO_PARA_RETIRO')).descripcion).toContain(
      'Pagás al retirar',
    );
  });

  describe('el paso «Pagado» (T-E4)', () => {
    it('sin pago registrado no existe: el pedido se paga al retirar, como siempre', () => {
      for (const estado of ['ENVIADO', 'EN_REVISION', 'CONFIRMADO', 'LISTO_PARA_RETIRO'] as const) {
        expect(pasosDeLaLineaDeTiempo(pedido(estado)).map((p) => p.label)).not.toContain('Pagado');
      }
      expect(pasosDeLaLineaDeTiempo({ ...pedido('CONFIRMADO'), pago: null }).map((p) => p.label)).not.toContain(
        'Pagado',
      );
    });

    it('con pago va después de «Enviado» y antes de «En preparación»', () => {
      const pasos = pasosDeLaLineaDeTiempo(pagado('CONFIRMADO'));

      expect(pasos.map((p) => p.label)).toEqual([
        'Enviado',
        'Pagado',
        'En revisión',
        'En preparación',
        'Listo para retirar',
        'Retirado',
      ]);
      expect(pasos.map((p) => p.status)).toEqual([
        'complete',
        'complete',
        'complete',
        'current',
        'upcoming',
        'upcoming',
      ]);
    });

    it('enviado y pagado: lo último que pasó es el pago, y nada posterior se da por hecho', () => {
      const pasos = pasosDeLaLineaDeTiempo(pagado('ENVIADO'));

      expect(pasos.find((p) => p.label === 'Enviado')?.status).toBe('complete');
      expect(pasos.find((p) => p.label === 'Pagado')?.status).toBe('current');
      expect(pasos.find((p) => p.label === 'En revisión')?.status).toBe('upcoming');
    });

    it('un pago pendiente no cuenta como pagado', () => {
      expect(pasosDeLaLineaDeTiempo(pedido('ENVIADO')).find((p) => p.label === 'Pagado')).toBeUndefined();
    });

    it('el flag explícito manda sobre el pedido: el detalle decide con su vista', () => {
      expect(pasosDeLaLineaDeTiempo(pedido('CONFIRMADO'), true).map((p) => p.label)).toContain('Pagado');
      expect(pasosDeLaLineaDeTiempo(pagado('CONFIRMADO'), false).map((p) => p.label)).not.toContain(
        'Pagado',
      );
      expect(presentacionDePedido(pedido('LISTO_PARA_RETIRO'), true).descripcion).toContain(
        'Ya está pagado',
      );
    });

    it('con envío conserva su tramo propio', () => {
      const enCamino: PedidoFarmacia = {
        ...pagado('CONFIRMADO'),
        modalidad: 'DOMICILIO',
        envio: 'EN_CAMINO',
      };
      expect(pasosDeLaLineaDeTiempo(enCamino).map((p) => p.label)).toEqual([
        'Enviado',
        'Pagado',
        'En revisión',
        'En preparación',
        'En camino',
        'Entregado',
      ]);
    });
  });

  describe('el medio de pago en palabras', () => {
    it('sólo con un pago registrado', () => {
      expect(etiquetaDeMedioDePago(null)).toBeNull();
      expect(etiquetaDeMedioDePago(pedido('CONFIRMADO').pago)).toBeNull();
    });

    it('con las mismas palabras que el resumen del pago', () => {
      expect(etiquetaDeMedioDePago(pagoQr)).toBe('Pagado por QR (demo)');
      expect(etiquetaDeMedioDePago({ ...pagoQr!, origen: 'MOSTRADOR' })).toBe('Pagado en mostrador');
      expect(etiquetaDeMedioDePago({ ...pagoQr!, origen: null })).toBe('Pagado');
    });
  });
});
