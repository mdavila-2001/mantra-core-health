import type { ActivityEventProperty } from '../../data-access/telemetry/telemetry.types';
import {
  campoEnfocado,
  clic,
  DetectorDeClicRepetido,
  paginaAbandonada,
  paginaVista,
  tamanoDePantalla,
  type Lienzo,
  type MedidasDeClic,
} from './ux-events';

const LIENZO: Lienzo = { anchoVentana: 400, altoVentana: 800, anchoDocumento: 400, altoDocumento: 2400 };

const MEDIDAS: MedidasDeClic = {
  xDocumento: 100,
  yDocumento: 1200,
  xVentana: 100,
  yVentana: 400,
  rectangulo: { left: 50, top: 380, width: 100, height: 40 },
  porTeclado: false,
};

function valor(propiedades: readonly ActivityEventProperty[], nombre: string): unknown {
  const propiedad = propiedades.find((p) => p.propertyName === nombre);
  return propiedad?.valueString ?? propiedad?.valueNumber ?? propiedad?.valueBoolean;
}

describe('eventos de interacción', () => {
  it('el clic lleva la posición normalizada en el documento, la ventana y el control', () => {
    const evento = clic(LIENZO, { selector: 'button', interactivo: true }, MEDIDAS, false);

    expect(evento.nombre).toBe('clic');
    expect(valor(evento.propiedades, 'x_doc')).toBe(0.25);
    expect(valor(evento.propiedades, 'y_doc_px')).toBe(1200);
    expect(valor(evento.propiedades, 'x_vp')).toBe(0.25);
    expect(valor(evento.propiedades, 'y_vp')).toBe(0.5);
    expect(valor(evento.propiedades, 'objetivo_x')).toBe(0.5);
    expect(valor(evento.propiedades, 'objetivo_y')).toBe(0.5);
    expect(valor(evento.propiedades, 'tamano_pantalla')).toBe('movil');
    expect(valor(evento.propiedades, 'objetivo')).toBe('button');
  });

  it('un clic de teclado no inventa una posición en la esquina', () => {
    const evento = clic(LIENZO, { selector: 'button', interactivo: true }, { ...MEDIDAS, porTeclado: true }, false);

    expect(valor(evento.propiedades, 'es_teclado')).toBe(true);
    for (const coordenada of ['x_doc', 'y_doc_px', 'x_vp', 'y_vp', 'objetivo_x', 'objetivo_y']) {
      expect(valor(evento.propiedades, coordenada)).toBeUndefined();
    }
  });

  it('acota las fracciones a 0..1 y sobrevive a un control de tamaño cero', () => {
    const evento = clic(
      { anchoVentana: 0, altoVentana: 0, anchoDocumento: 0, altoDocumento: 0 },
      { selector: 'button', interactivo: false },
      { ...MEDIDAS, xVentana: -20, rectangulo: { left: 0, top: 0, width: 0, height: 0 } },
      false,
    );

    for (const propiedad of evento.propiedades.filter((p) => p.valueType === 'NUMBER')) {
      expect(Number.isFinite(propiedad.valueNumber)).toBe(true);
    }
    expect(valor(evento.propiedades, 'x_vp')).toBe(0);
    expect(valor(evento.propiedades, 'objetivo_y')).toBe(1);
  });

  it('cada propiedad trae exactamente el valor de su tipo', () => {
    const todos = [
      paginaVista(LIENZO, '/inicio'),
      paginaAbandonada(LIENZO, { profundidadMaxima: 0.5, msEnPagina: 1500.4, clics: 2 }),
      clic(LIENZO, { selector: 'a', interactivo: true }, MEDIDAS, true),
      campoEnfocado(LIENZO, { selector: 'input' }, 'text'),
    ];

    for (const { propiedades } of todos) {
      for (const p of propiedades) {
        const presentes = [p.valueString, p.valueNumber, p.valueBoolean].filter((v) => v !== undefined);
        expect(presentes).toHaveLength(1);
        const esperado = { STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean' }[p.valueType];
        expect(typeof presentes[0]).toBe(esperado);
      }
    }
  });

  it('la página vista lleva la ruta anterior solo si la hubo', () => {
    expect(valor(paginaVista(LIENZO, null).propiedades, 'ruta_anterior')).toBeUndefined();
    expect(valor(paginaVista(LIENZO, '/agenda').propiedades, 'ruta_anterior')).toBe('/agenda');
  });

  it('el abandono lleva profundidad acotada, tiempo entero y clics', () => {
    const { propiedades } = paginaAbandonada(LIENZO, { profundidadMaxima: 1.7, msEnPagina: 1500.6, clics: 3 });

    expect(valor(propiedades, 'profundidad_max')).toBe(1);
    expect(valor(propiedades, 'ms_en_pagina')).toBe(1501);
    expect(valor(propiedades, 'clics')).toBe(3);
  });

  it('el foco de un campo lleva el control y su tipo, nunca un valor', () => {
    const { nombre, propiedades } = campoEnfocado(LIENZO, { selector: 'input[name="dosis"]' }, 'number');

    expect(nombre).toBe('campo_enfocado');
    expect(propiedades.map((p) => p.propertyName).sort()).toEqual(
      ['alto_doc_px', 'alto_vp', 'ancho_vp', 'objetivo', 'tamano_pantalla', 'tipo_campo'].sort(),
    );
  });

  it('corta los tamaños de pantalla en 600 y 1024', () => {
    expect([599, 600, 1023, 1024].map(tamanoDePantalla)).toEqual(['movil', 'tableta', 'tableta', 'escritorio']);
  });
});

describe('DetectorDeClicRepetido', () => {
  it('marca el tercer clic en 700 ms y 30 px', () => {
    const detector = new DetectorDeClicRepetido();

    expect(detector.registrar(0, 10, 10)).toBe(false);
    expect(detector.registrar(200, 15, 12)).toBe(false);
    expect(detector.registrar(400, 12, 18)).toBe(true);
  });

  it('no marca clics lentos ni lejanos', () => {
    const lentos = new DetectorDeClicRepetido();
    lentos.registrar(0, 10, 10);
    lentos.registrar(500, 10, 10);
    expect(lentos.registrar(1300, 10, 10)).toBe(false);

    const lejanos = new DetectorDeClicRepetido();
    lejanos.registrar(0, 10, 10);
    lejanos.registrar(100, 200, 10);
    expect(lejanos.registrar(200, 400, 10)).toBe(false);
  });
});
