import { HttpErrorResponse } from '@angular/common/http';

import { answerFormat, importFailure, removeFailure, sourcesLine, sortForService, serviceKindOf } from './service-surveys.logic';

describe('service-surveys.logic', () => {
  it('deduce el tipo del nombre, y el informado manda', () => {
    expect(serviceKindOf('Teleconsulta cardiológica')).toBe('TELEMEDICINE');
    expect(serviceKindOf('Ecocardiograma Doppler')).toBe('IMAGING');
    expect(serviceKindOf('Holter de 24 horas')).toBe('PROCEDURE');
    expect(serviceKindOf('Análisis de sangre')).toBe('LAB');
    expect(serviceKindOf('Sesión de kinesiología')).toBe('THERAPY');
    expect(serviceKindOf('Algo raro')).toBe('OTHER');
    expect(serviceKindOf('Algo raro', 'PHARMACY')).toBe('PHARMACY');
  });

  it('ordena recomendadas primero sin perder el orden del servidor dentro de cada grupo', () => {
    const e = (code: string, kinds: string[]) =>
      ({ code, serviceKinds: kinds }) as unknown as Parameters<typeof sortForService>[0][number];
    const orden = sortForService([e('A', ['LAB']), e('B', ['IMAGING']), e('C', ['IMAGING'])], 'IMAGING');
    expect(orden.map((o) => `${o.entry.code}:${o.recommended}`)).toEqual(['B:true', 'C:true', 'A:false']);
  });

  it('la escala 0–10 de recomendación se llama «Recomendación», nunca con la marca', () => {
    const texto = answerFormat({ text: '¿Lo recomendaría?', answerType: 'SCALE', required: false, scaleMin: 0, scaleMax: 10, dimension: 'recomendacion' });
    expect(texto).toBe('Recomendación del 0 al 10 · opcional');
    expect(texto).not.toMatch(/NPS|Net Promoter/);
    expect(answerFormat({ text: 'x', answerType: 'BOOLEAN', required: true })).toBe('Sí / No');
    // The text already spells out the scale: no redundant «Escala del 1 al 5».
    expect(answerFormat({ text: '¿Lo trató con respeto? (1 = Nunca, 5 = Siempre)', answerType: 'SCALE', required: false, scaleMin: 1, scaleMax: 5 })).toBe('Opcional');
  });

  it('explica cada fallo del PUT por su nombre y dice qué refrescar', () => {
    const err = (status: number, body: object = {}) => new HttpErrorResponse({ status, error: body });
    expect(importFailure(err(404))).toMatchObject({ message: expect.stringContaining('ya no está en el catálogo'), followUp: 'reload-catalog' });
    expect(importFailure(err(409, { code: 'CONFLICT', reason: 'ASSIGNMENT_ALREADY_ACTIVE', message: 'x' }))).toMatchObject({
      message: expect.stringContaining('otra sesión'),
      followUp: 'reload-list',
    });
    expect(importFailure(err(403)).message).toContain('no figura entre los suyos');
    expect(importFailure(err(412)).message).toContain('perfil profesional');
    expect(importFailure(err(0)).message).toContain('No hay conexión');
    expect(importFailure(err(500))).toMatchObject({ title: 'No se pudo importar la encuesta', message: expect.stringContaining('sigue como estaba') });
    // Never the server's own text.
    expect(importFailure(err(500, { code: 'INTERNAL', message: 'RAW' })).message).not.toContain('RAW');
  });

  it('el DELETE tiene sus propios mensajes, sin hablar de importar', () => {
    const err = (status: number) => new HttpErrorResponse({ status });
    expect(removeFailure(err(500))).toMatchObject({ title: 'No se pudo quitar la encuesta', followUp: null });
    expect(removeFailure(err(404)).followUp).toBe('reload-list');
    expect(removeFailure(err(409)).followUp).toBe('reload-list');
    expect(removeFailure(err(412)).message).toContain('perfil profesional');
    expect(removeFailure(err(403)).message).toContain('no figura entre los suyos');
    expect(removeFailure(err(500)).message).not.toMatch(/importar/i);
  });

  it('cita las fuentes como ítems adaptados', () => {
    const linea = sourcesLine({
      source: { instrument: 'PSQ-18', license: 'Uso libre (RAND)' },
    } as unknown as Parameters<typeof sourcesLine>[0]);
    expect(linea).toBe('Ítems adaptados de PSQ-18 — Uso libre (RAND)');
  });
});
