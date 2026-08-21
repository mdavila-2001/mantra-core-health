import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import {
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
    sustituciones: Array.from({ length: sustituciones }, (_, i) => ({
      id: `s-${i}`,
      original: { nombre: 'Marca', precio: '60.00' },
      propuesta: { nombre: 'Genérico', precio: '25.00' },
      moneda: 'BOB',
    })),
    requestId: 'rx-1',
    siteId: 'site-1',
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

  it('el recorrido feliz marca lo hecho, lo actual y lo que falta', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('CONFIRMADO'));

    expect(pasos.map((p) => p.label)).toEqual([
      'Enviado',
      'En revisión',
      'Confirmado',
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
    expect(pasos.find((p) => p.label === 'Confirmado')?.status).toBe('current');
  });

  it('retirado es un recorrido completo, sin paso pendiente', () => {
    const pasos = pasosDeLaLineaDeTiempo(pedido('RETIRADO'));

    expect(pasos.every((p) => p.status === 'complete')).toBe(true);
  });

  it('un final anticipado no dibuja progreso: se cuenta con el aviso', () => {
    expect(pasosDeLaLineaDeTiempo(pedido('RECHAZADO'))).toEqual([]);
    expect(pasosDeLaLineaDeTiempo(pedido('VENCIDO'))).toEqual([]);
    expect(pasosDeLaLineaDeTiempo(pedido('CANCELADO'))).toEqual([]);
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
      'Confirmado',
      'En camino',
      'Entregado',
    ]);
    // El hito del envío manda: «En camino» es el paso actual aunque el
    // estado del contrato siga siendo CONFIRMADO.
    expect(pasos.find((p) => p.label === 'En camino')?.status).toBe('current');
    expect(pasos.find((p) => p.label === 'Confirmado')?.status).toBe('complete');
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
});
