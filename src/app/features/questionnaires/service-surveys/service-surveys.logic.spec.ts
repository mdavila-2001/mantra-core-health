import { HttpErrorResponse } from '@angular/common/http';

import { answerFormat, failureState, importFailure, removeFailure, sourcesLine, sortForService, serviceKindOf } from './service-surveys.logic';

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
    expect(answerFormat({ text: 'x', answerType: 'BOOLEAN', required: true })).toBe('Sí / No · obligatoria');
    // The text already spells out the scale: no redundant «Escala del 1 al 5».
    expect(answerFormat({ text: '¿Lo trató con respeto? (1 = Nunca, 5 = Siempre)', answerType: 'SCALE', required: false, scaleMin: 1, scaleMax: 5 })).toBe('Escala · opcional');
  });

  it('explica cada fallo del PUT nombrando el servicio y dice qué refrescar', () => {
    const err = (status: number, body: object = {}) => new HttpErrorResponse({ status, error: body });
    expect(importFailure(err(404), 'ECG')).toMatchObject({ message: expect.stringContaining('ya no está en el catálogo'), followUp: 'reload-catalog' });
    expect(importFailure(err(409, { code: 'CONFLICT', reason: 'ASSIGNMENT_ALREADY_ACTIVE', message: 'x' }), 'ECG')).toMatchObject({
      message: expect.stringContaining('«ECG» cambió al mismo tiempo en otra sesión'),
      followUp: 'reload-list',
    });
    expect(importFailure(err(403), 'ECG').message).toContain('«ECG» no figura entre sus servicios');
    expect(importFailure(err(412), 'ECG').message).toContain('perfil profesional');
    expect(importFailure(err(0), 'ECG').message).toContain('No hay conexión');
    expect(importFailure(err(500), 'ECG')).toMatchObject({ title: 'No se pudo importar la encuesta de «ECG»', message: expect.stringContaining('«ECG» sigue con la encuesta que tenía') });
    // Never the server's own text.
    expect(importFailure(err(500, { code: 'INTERNAL', message: 'RAW' }), 'ECG').message).not.toContain('RAW');
  });

  it('el DELETE tiene sus propios mensajes y nunca pide releer (la API es idempotente)', () => {
    const err = (status: number) => new HttpErrorResponse({ status });
    for (const status of [403, 404, 409, 412, 500]) expect(removeFailure(err(status), 'ECG').followUp).toBeNull();
    expect(removeFailure(err(500), 'ECG')).toMatchObject({ title: 'No se pudo quitar la encuesta de «ECG»' });
    expect(removeFailure(err(412), 'ECG').message).toContain('perfil profesional');
    expect(removeFailure(err(500), 'ECG').message).not.toMatch(/importar/i);
  });

  it('un rechazo (403/412) es S5, sin «Reintentar»; un fallo del servidor es S9 con código', () => {
    const refused = failureState(new HttpErrorResponse({ status: 412, error: { code: 'PRECONDITION_FAILED', message: 'RAW', correlationId: 'c-1' } }), 'T', 'M');
    expect(refused).toMatchObject({
      title: 'T',
      state: { status: 'forbidden', message: 'M', requestId: 'c-1', nextAction: { label: 'Completar mi perfil profesional', route: '/my-account' } },
    });
    const failed = failureState(new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL', message: 'RAW', correlationId: 'c-2' } }), 'T', 'M');
    expect(failed).toMatchObject({ title: 'T', state: { status: 'error', title: 'T', message: 'M', requestId: 'c-2' } });
  });

  it('cita las fuentes como ítems adaptados', () => {
    const linea = sourcesLine({
      source: { instrument: 'PSQ-18', license: 'Uso libre (RAND)' },
    } as unknown as Parameters<typeof sourcesLine>[0]);
    expect(linea).toBe('Ítems adaptados de PSQ-18 — Uso libre (RAND)');
  });
});
