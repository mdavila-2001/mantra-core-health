import type { PedidoFarmacia } from '../data-access/pharmacy-orders/pharmacy-orders.types';
import { contextoDelTexto, textoDeContexto } from './contexto-de-chat';
import { contextoDePedido, numeroCortoDePedido, numeroDelTitulo } from './contexto-de-pedido';

/**
 * Lo que se fija acá: la tarjeta dice **qué pedido es** —número corto,
 * farmacia y sede, cuántos productos y el total— y **no** el estado, que es
 * una foto del momento y la tarjeta no se actualiza.
 */
describe('contextoDePedido', () => {
  const pedido = (extra: Partial<PedidoFarmacia> = {}): PedidoFarmacia => ({
    id: '7f3c0a2e-9d41-4b7e-8c55-1a2b3c4d22be',
    estado: 'ACEPTACION_PENDIENTE',
    creadoEl: new Date('2026-08-21T10:00:00'),
    venceEl: null,
    farmacia: 'Farmacia Vida',
    sede: 'Sucursal Central',
    direccion: null,
    modalidad: 'RETIRO',
    direccionDeEntrega: null,
    paciente: null,
    prescriptor: null,
    lineas: [{}, {}] as unknown as PedidoFarmacia['lineas'],
    totalEstimado: '96.50',
    moneda: 'BOB',
    codigoDeRetiro: null,
    motivoDeRechazo: null,
    envio: null,
    entregas: [],
    pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
    sustituciones: [],
    requestId: 'rx-1',
    siteId: 'site-1',
    pharmacyId: 'pharmacy-1',
    ...extra,
  });

  it('el número corto son los últimos cuatro caracteres del id, en mayúsculas', () => {
    expect(numeroCortoDePedido('7f3c0a2e-9d41-4b7e-8c55-1a2b3c4d22be')).toBe('#22BE');
    expect(numeroCortoDePedido('p-1')).toBe('#P1');
  });

  it('la tarjeta dice número, farmacia, sede, productos y total', () => {
    const contexto = contextoDePedido(pedido());
    expect(contexto.titulo).toBe('#22BE · Farmacia Vida · Sucursal Central');
    expect(contexto.detalle).toMatch(/^2 productos · 96,50 /u);
    expect(contexto.ruta).toBe('/my-account/pharmacy-orders/7f3c0a2e-9d41-4b7e-8c55-1a2b3c4d22be');
  });

  it('no lleva el estado: la tarjeta no se actualiza y el estado cambia', () => {
    const contexto = contextoDePedido(pedido());
    const texto = `${contexto.titulo} ${contexto.detalle ?? ''}`;
    expect(texto).not.toMatch(/decisión|revisión|preparación|listo/iu);
    // El mismo pedido en otro estado arma la misma tarjeta: el store no la repite.
    expect(contextoDePedido(pedido({ estado: 'LISTO_PARA_RETIRO' }))).toEqual(contexto);
  });

  it('sin total, sólo los productos', () => {
    expect(contextoDePedido(pedido({ totalEstimado: null })).detalle).toBe('2 productos');
  });

  it('viaja y se vuelve a leer igual, recortada al tope de 140', () => {
    const larga = contextoDePedido(pedido({ sede: 'Sucursal '.repeat(30) }));
    const leida = contextoDelTexto(textoDeContexto(larga));
    expect(leida?.titulo.length).toBeLessThanOrEqual(140);
    expect(leida?.titulo.startsWith('#22BE · Farmacia Vida')).toBe(true);
  });

  it('el número se lee del título; una tarjeta vieja no lo tiene', () => {
    expect(numeroDelTitulo('#22BE · Farmacia Vida · Sucursal Central')).toBe('#22BE');
    expect(numeroDelTitulo('Farmacia Vida · Sucursal Central')).toBeNull();
  });
});
