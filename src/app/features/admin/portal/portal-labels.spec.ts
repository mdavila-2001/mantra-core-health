import { describe, expect, it } from 'vitest';

import {
  confianza,
  datosPersonales,
  ddlSource,
  decisionStep,
  metodoHttp,
  optionsOf,
  processKind,
  nombreDeOperacion,
  partirTabla,
  resumenDePagina,
  revisionInventario,
  riesgo,
  senal,
} from './portal-labels';

describe('portal-labels', () => {
  it('cada método HTTP tiene su tono y un método desconocido se muestra tal cual', () => {
    expect(metodoHttp('DELETE')).toEqual({ label: 'DELETE', tone: 'error' });
    expect(metodoHttp('GET').tone).toBe('info');
    expect(metodoHttp('TRACE')).toEqual({ label: 'TRACE', tone: 'secondary' });
  });

  it('el riesgo dice su nivel con texto, no sólo con color', () => {
    expect(riesgo('ALTO').label).toBe('Riesgo alto');
    expect(riesgo('BAJO').tone).toBe('success');
    expect(riesgo(null).label).toBe('Sin dato');
  });

  it('lo que el generador no pudo clasificar no se presenta como «sin datos personales»', () => {
    expect(datosPersonales('SIN_FUENTE').label).toBe('Sin clasificar');
    expect(datosPersonales('SIN_FUENTE').label).not.toBe(datosPersonales('NO').label);
  });

  it('«auto-detectada» no se confunde con «revisada»', () => {
    expect(revisionInventario('AUTO_DETECTADA').tone).toBe('secondary');
    expect(revisionInventario('REVISADA').tone).toBe('success');
  });

  it('una confianza o una señal nueva no inventa significado', () => {
    expect(confianza('POR_SQL').tone).toBe('warning');
    expect(confianza('NUEVA')).toEqual({ label: 'NUEVA', tone: 'secondary' });
    expect(senal('ESCRIBE_SIN_ROLES').tone).toBe('error');
    expect(senal('OTRA').label).toBe('OTRA');
  });

  it('nombreDeOperacion quita la clase del identificador', () => {
    expect(nombreDeOperacion('SchedulingController_placeHold')).toBe('placeHold');
    expect(nombreDeOperacion('sinGuion')).toBe('sinGuion');
  });

  it('partirTabla separa schema y tabla y rechaza lo que no tiene esa forma', () => {
    expect(partirTabla('scheduling.slot_holds')).toEqual({
      schema: 'scheduling',
      tabla: 'slot_holds',
    });
    expect(partirTabla('sin_punto')).toBeNull();
    expect(partirTabla('.x')).toBeNull();
    expect(partirTabla('x.')).toBeNull();
  });

  it('resumenDePagina cuenta páginas por el total, no por lo cargado', () => {
    expect(resumenDePagina(1, 50, 1254)).toMatch(/^Página 1 de 26 · 1.?254 registros$/);
    expect(resumenDePagina(3, 50, 1)).toBe('Página 1 de 1 · 1 registro');
    expect(resumenDePagina(1, 50, 0)).toBe('Página 1 de 1 · 0 registros');
  });

  it('las opciones de un filtro salen de los códigos que la tabla conoce, con su texto', () => {
    expect(optionsOf(riesgo)).toEqual([
      { value: 'ALTO', label: 'Riesgo alto' },
      { value: 'MEDIO', label: 'Riesgo medio' },
      { value: 'BAJO', label: 'Riesgo bajo' },
    ]);
  });

  it('un paso de árbol o un origen de DDL nuevos se muestran tal cual', () => {
    expect(decisionStep('SI').label).toBe('Condición');
    expect(decisionStep('OTRO')).toEqual({ label: 'OTRO', tone: 'secondary' });
    expect(ddlSource('NOSQL').label).toBe('Almacén no relacional');
    expect(processKind('CRITICO').label).toBe('Flujo crítico');
  });
});
