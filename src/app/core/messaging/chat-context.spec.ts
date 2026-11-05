import { describe, expect, it } from 'vitest';

import {
  contextoDelTexto,
  esRutaDeContexto,
  linea,
  normalizarContexto,
  resumenDeContexto,
  textoDeContexto,
  type ContextoDeChat,
} from './chat-context';

/** Ningún tipo de tarjeta acepta esa ruta. */
const deNingunTipo = (ruta: string): boolean =>
  (['pedido', 'producto', 'farmacia', 'servicio'] as const).every((tipo) => !esRutaDeContexto(tipo, ruta));

const PEDIDO: ContextoDeChat = {
  tipo: 'pedido',
  titulo: 'Farmacia Chávez · Sucursal Miraflores',
  detalle: '2 productos · Bs 69,00',
  ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
};

describe('contexto de chat', () => {
  it('ida y vuelta: el texto que se manda es la tarjeta que se lee', () => {
    const texto = textoDeContexto(PEDIDO);
    expect(texto).toBe(
      'Pedido: Farmacia Chávez · Sucursal Miraflores\n2 productos · Bs 69,00\n/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
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
    expect(esRutaDeContexto('pedido', '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6')).toBe(true);
    expect(esRutaDeContexto('farmacia', '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6')).toBe(false);
    expect(esRutaDeContexto('servicio', '/clinics-directory/clinica-sur')).toBe(true);
    // La tarjeta no puede llevar a abrir otro chat ni a nada con query.
    expect(deNingunTipo('/messaging?escribirA=x&sobre=producto&titulo=t&ruta=/x')).toBe(true);
    expect(deNingunTipo('/pharmacies-directory/chavez?x=1')).toBe(true);
    expect(contextoDelTexto('Producto: Algo\n/messaging?escribirA=otro')).toBeNull();
  });

  it('L-2 · la tarjeta de pedido exige un id de pedido, no las rutas reservadas del módulo', () => {
    expect(esRutaDeContexto('pedido', '/my-account/pharmacy-orders/new')).toBe(false);
    expect(esRutaDeContexto('pedido', '/my-account/pharmacy-orders/checkout')).toBe(false);
    expect(esRutaDeContexto('pedido', '/my-account/pharmacy-orders/7f3c')).toBe(false);
    expect(esRutaDeContexto('pedido', `/my-account/pharmacy-orders/${'7F3C1E2A-5B6D-4C7E-8F90-A1B2C3D4E5F6'}`)).toBe(true);
    expect(contextoDelTexto('Pedido: Comprar\n/my-account/pharmacy-orders/checkout')).toBeNull();
    expect(normalizarContexto({ tipo: 'pedido', titulo: 'Nuevo', ruta: '/my-account/pharmacy-orders/new' })).toBeNull();
  });

  it('las rutas internas no salen del sitio', () => {
    expect(deNingunTipo('/buscar/medicamentos?q=losartan')).toBe(true);
    expect(deNingunTipo('/a/../b')).toBe(true);
    expect(deNingunTipo('/javascript:alert(1)')).toBe(true);
    expect(deNingunTipo('relativa')).toBe(true);
  });

  it('resume la tarjeta para la bandeja', () => {
    expect(resumenDeContexto(PEDIDO)).toBe('Pedido · Farmacia Chávez · Sucursal Miraflores');
  });

  it('normalizarContexto deja el contexto como viaja en el texto, o null si no se puede mandar', () => {
    expect(normalizarContexto({ ...PEDIDO, titulo: '  Farmacia   Chávez\n' })?.titulo).toBe('Farmacia Chávez');
    expect(normalizarContexto({ ...PEDIDO, detalle: '   ' })).toEqual({
      tipo: 'pedido',
      titulo: PEDIDO.titulo,
      ruta: PEDIDO.ruta,
    });
    expect(normalizarContexto({ ...PEDIDO, ruta: 'https://malo.example' })).toBeNull();
    expect(normalizarContexto({ ...PEDIDO, tipo: 'receta' as never })).toBeNull();
    // Lo que se lee del texto ya está normalizado: normalizarlo no lo cambia.
    expect(normalizarContexto(contextoDelTexto(textoDeContexto(PEDIDO))!)).toEqual(PEDIDO);
  });

  it('linea recorta a 140 con elipsis', () => {
    expect(linea('x'.repeat(200))).toHaveLength(140);
    expect(linea('x'.repeat(200)).endsWith('…')).toBe(true);
  });
});
