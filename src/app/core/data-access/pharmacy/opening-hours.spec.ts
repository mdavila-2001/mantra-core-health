import { aperturaDe, deHoraLocalDeBolivia, horaDeBolivia, momentoDeBolivia } from './opening-hours';

describe('opening-hours (P34)', () => {
  /** 2026-10-26 03:00 en La Paz. */
  const AHORA = new Date('2026-10-26T07:00:00Z');

  it('escribe la hora de Bolivia sin importar el huso del navegador', () => {
    expect(horaDeBolivia('2026-10-26T12:00:00Z')).toBe('08:00');
    expect(momentoDeBolivia('2026-10-27T12:00:00Z')).toContain('08:00');
  });

  it('24 h declarada gana sobre el turno', () => {
    expect(aperturaDe({ open24h: true, onCallUntil: '2026-10-26T12:00:00Z' }, AHORA)).toEqual({
      texto: 'Abierta 24 h',
      tono: 'success',
    });
  });

  it('de turno el mismo día: «hasta las 08:00»; otro día, con la fecha', () => {
    expect(aperturaDe({ onCallUntil: '2026-10-26T12:00:00Z' }, AHORA)?.texto).toBe(
      'De turno hasta las 08:00',
    );
    const otroDia = aperturaDe({ onCallUntil: '2026-10-27T12:00:00Z' }, AHORA)?.texto ?? '';
    expect(otroDia.startsWith('De turno hasta el ')).toBe(true);
    expect(otroDia).toContain('08:00');
  });

  it('false y sin declarar no muestran nada', () => {
    expect(aperturaDe({ open24h: false, onCallUntil: null }, AHORA)).toBeNull();
    expect(aperturaDe({}, AHORA)).toBeNull();
  });

  it('lo tipeado se manda con el desplazamiento de Bolivia', () => {
    expect(deHoraLocalDeBolivia('2026-10-26', '20:00')).toBe('2026-10-26T20:00:00-04:00');
    expect(deHoraLocalDeBolivia('2026-10-26', '')).toBeNull();
    expect(deHoraLocalDeBolivia('26/10/2026', '20:00')).toBeNull();
    expect(deHoraLocalDeBolivia('2026-02-31', '20:00')).toBeNull();
  });
});
