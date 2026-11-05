import { draftsOf, endDayOf, endIsoOf, rulesOf, sameRules, startDayOf, startIsoOf } from './ip-rules-draft';

describe('el borrador de las reglas de red', () => {
  it('lo leído se vuelve borrador y vuelve igual a la API', () => {
    const leidas = [
      { type: 'ALLOW', cidr: '190.129.0.0/16', description: 'Sede central' },
      { type: 'DENY', cidr: '203.0.113.7/32', validFrom: '2026-11-01T04:00:00.000Z', validTo: '2026-12-01T04:00:00.000Z' },
    ] as const;
    expect(rulesOf(draftsOf(leidas))).toEqual(leidas);
  });

  it('no manda campos vacíos: el DTO rechaza una fecha vacía y una descripción en blanco no dice nada', () => {
    const borrador = draftsOf([{ type: 'ALLOW', cidr: '  10.0.0.0/8  ', description: '   ' }]);
    const [regla] = rulesOf(borrador);
    expect(regla).toEqual({ type: 'ALLOW', cidr: '10.0.0.0/8' });
    expect(Object.keys(regla!)).not.toContain('validFrom');
    expect(Object.keys(regla!)).not.toContain('description');
  });

  it('cada renglón tiene un uid propio, también los que se leen iguales', () => {
    const [a, b] = draftsOf([
      { type: 'ALLOW', cidr: '10.0.0.0/8' },
      { type: 'ALLOW', cidr: '10.0.0.0/8' },
    ]);
    expect(a!.uid).not.toBe(b!.uid);
  });

  it('reconoce el mismo conjunto ignorando espacios, y distingue el orden y cada campo', () => {
    const base = [{ type: 'ALLOW', cidr: '10.0.0.0/8' }, { type: 'DENY', cidr: '10.1.0.0/16' }] as const;
    expect(sameRules(base, [{ type: 'ALLOW', cidr: ' 10.0.0.0/8 ' }, { type: 'DENY', cidr: '10.1.0.0/16', description: '' }])).toBe(true);
    expect(sameRules(base, [base[1], base[0]])).toBe(false);
    expect(sameRules(base, [{ type: 'DENY', cidr: '10.0.0.0/8' }, base[1]])).toBe(false);
    expect(sameRules(base, [base[0]])).toBe(false);
  });

  describe('los días', () => {
    it('«desde» es la medianoche local de ese día y «hasta» es la medianoche siguiente: el día elegido rige completo', () => {
      const desde = new Date(startIsoOf('2026-11-30')!);
      const hasta = new Date(endIsoOf('2026-11-30')!);
      expect([desde.getFullYear(), desde.getMonth(), desde.getDate(), desde.getHours()]).toEqual([2026, 10, 30, 0]);
      expect([hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), hasta.getHours()]).toEqual([2026, 11, 1, 0]);
    });

    it('lo que se escribe y lo que se muestra son el mismo día', () => {
      expect(startDayOf(startIsoOf('2026-11-30'))).toBe('2026-11-30');
      expect(endDayOf(endIsoOf('2026-11-30'))).toBe('2026-11-30');
      expect(endDayOf(endIsoOf('2026-12-31'))).toBe('2026-12-31');
    });

    it('un campo vacío o un día mal escrito no inventa un instante', () => {
      expect(startIsoOf('')).toBeUndefined();
      expect(endIsoOf('30/11/2026')).toBeUndefined();
      expect(startDayOf(undefined)).toBe('');
      expect(endDayOf('no es una fecha')).toBe('');
    });
  });
});
