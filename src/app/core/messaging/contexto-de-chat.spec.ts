import { describe, expect, it } from 'vitest';

import {
  contextoDelTexto,
  esRutaDeContexto,
  esRutaInterna,
  resumenDeContexto,
  textoDeContexto,
  type ContextoDeChat,
} from './contexto-de-chat';

const PEDIDO: ContextoDeChat = {
  tipo: 'pedido',
  titulo: 'Farmacia Chávez · Sucursal Miraflores',
  detalle: '2 productos · Bs 69,00',
  ruta: '/my-account/pharmacy-orders/7f3c',
};

describe('contexto de chat', () => {
  it('ida y vuelta: el texto que se manda es la tarjeta que se lee', () => {
    const texto = textoDeContexto(PEDIDO);
    expect(texto).toBe(
      'Pedido: Farmacia Chávez · Sucursal Miraflores\n2 productos · Bs 69,00\n/my-account/pharmacy-orders/7f3c',
    );
    expect(contextoDelTexto(texto)).toEqual(PEDIDO);
  });

  it('el detalle es opcional', () => {
    const sinDetalle: ContextoDeChat = { tipo: 'farmacia', titulo: 'Farmacia Chávez', ruta: '/pharmacies-directory/chavez' };
    const texto = textoDeContexto(sinDetalle);
    expect(texto.split('\n')).toHaveLength(2);
    expect(contextoDelTexto(texto)).toEqual(sinDetalle);
  });

  it('aplana saltos y recorta líneas largas', () => {
    const texto = textoDeContexto({ ...PEDIDO, titulo: `Uno\ndos ${'x'.repeat(300)}` });
    const leido = contextoDelTexto(texto);
    expect(leido?.titulo.startsWith('Uno dos')).toBe(true);
    expect(leido?.titulo.endsWith('…')).toBe(true);
    expect(leido?.titulo.length).toBe(140);
  });

  it('rechaza armar una tarjeta hacia otro sitio o sin título', () => {
    expect(() => textoDeContexto({ ...PEDIDO, ruta: 'https://malo.example' })).toThrow();
    expect(() => textoDeContexto({ ...PEDIDO, ruta: '//malo.example/x' })).toThrow();
    expect(() => textoDeContexto({ ...PEDIDO, titulo: '   ' })).toThrow();
  });

  it('no confunde un mensaje común con una tarjeta', () => {
    expect(contextoDelTexto('Hola, ¿tienen losartán?')).toBeNull();
    expect(contextoDelTexto('Pedido: algo\nsin ruta al final')).toBeNull();
    expect(contextoDelTexto('Receta: algo\n/x')).toBeNull();
    expect(contextoDelTexto('Pedido: algo\n//malo.example')).toBeNull();
    expect(contextoDelTexto('Pedido: algo\nhttps://malo.example/x')).toBeNull();
    expect(contextoDelTexto('Pedido: a\nb\nc\n/x')).toBeNull();
    expect(contextoDelTexto(null)).toBeNull();
    expect(contextoDelTexto(undefined)).toBeNull();
  });

  it('cada tarjeta sólo lleva a la ficha de lo que dice ser', () => {
    expect(esRutaDeContexto('pedido', '/my-account/pharmacy-orders/7f3c')).toBe(true);
    expect(esRutaDeContexto('farmacia', '/my-account/pharmacy-orders/7f3c')).toBe(false);
    expect(esRutaDeContexto('servicio', '/clinics-directory/clinica-sur')).toBe(true);
    // La tarjeta no puede llevar a abrir otro chat ni a nada con query.
    expect(esRutaInterna('/messaging?escribirA=x&sobre=producto&titulo=t&ruta=/x')).toBe(false);
    expect(esRutaInterna('/pharmacies-directory/chavez?x=1')).toBe(false);
    expect(contextoDelTexto('Producto: Algo\n/messaging?escribirA=otro')).toBeNull();
  });

  it('las rutas internas no salen del sitio', () => {
    expect(esRutaInterna('/buscar/medicamentos?q=losartan')).toBe(false);
    expect(esRutaInterna('/a/../b')).toBe(false);
    expect(esRutaInterna('/javascript:alert(1)')).toBe(false);
    expect(esRutaInterna('relativa')).toBe(false);
  });

  it('resume la tarjeta para la bandeja', () => {
    expect(resumenDeContexto(PEDIDO)).toBe('Pedido · Farmacia Chávez · Sucursal Miraflores');
  });
});
