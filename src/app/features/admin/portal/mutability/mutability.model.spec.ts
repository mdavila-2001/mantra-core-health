import {
  EVIDENCE_HELP,
  evidenceLevel,
  findingCode,
  mutabilityQuery,
  parseTableParam,
  ratioText,
  retentionText,
  writeMode,
  type MutabilityUrlValues,
} from './mutability.model';
import { EVIDENCE_LEVELS } from '../../../../core/data-access/admin-portal/mutability.types';

const vacio: MutabilityUrlValues = {
  q: '',
  schema: '',
  writeMode: '',
  evidence: '',
  finding: '',
  disposition: '',
  legalHold: '',
};

describe('mutability.model', () => {
  it('«sin evidencia» nunca se rotula «No» y un código nuevo se muestra tal cual', () => {
    expect(writeMode('UNKNOWN').label).toContain('Sin evidencia');
    expect(writeMode('UNKNOWN').label).not.toBe('No');
    expect(writeMode('CODIGO_NUEVO')).toEqual({ label: 'CODIGO_NUEVO', tone: 'secondary' });
    expect(evidenceLevel(null).tone).toBe('secondary');
  });

  it('cada nivel de evidencia tiene rótulo y explicación', () => {
    for (const level of EVIDENCE_LEVELS) {
      expect(evidenceLevel(level).label).not.toBe(level);
      expect(EVIDENCE_HELP[level].length).toBeGreaterThan(10);
    }
  });

  it('la consulta sólo lleva filtros con valor y dentro de lo que la API acepta', () => {
    expect(mutabilityQuery(vacio)).toEqual({});
    expect(
      mutabilityQuery({
        ...vacio,
        q: 'audit',
        schema: 'audit',
        writeMode: 'APPEND_ONLY',
        evidence: 'ENFORCED_DB',
        finding: 'GAP',
      }),
    ).toEqual({
      q: 'audit',
      schema: 'audit',
      writeMode: 'APPEND_ONLY',
      evidence: 'ENFORCED_DB',
      finding: 'GAP',
    });
    // lo que la API rechazaría con 400 no viaja
    expect(
      mutabilityQuery({
        ...vacio,
        schema: 'a;b',
        writeMode: 'BORRABLE',
        evidence: 'x',
        finding: 'y',
      }),
    ).toEqual({});
  });

  it('un filtro fijo manda sobre la URL', () => {
    expect(
      mutabilityQuery({ ...vacio, finding: 'GAP' }, { finding: 'CONTRADICTION' }).finding,
    ).toBe('CONTRADICTION');
  });

  it('la tabla de la URL se valida', () => {
    expect(parseTableParam('audit.audit_log')).toEqual({ schema: 'audit', table: 'audit_log' });
    expect(parseTableParam('pay_ledger.ledger_legs')).toEqual({
      schema: 'pay_ledger',
      table: 'ledger_legs',
    });
    expect(parseTableParam('audit')).toBeNull();
    expect(parseTableParam('a.b.c')).toBeNull();
    expect(parseTableParam('x; drop.table')).toBeNull();
  });

  it('las cuentas llevan denominador y el plazo no se inventa', () => {
    expect(ratioText({ numerator: 3, denominator: 10 })).toContain('de');
    expect(retentionText(null)).toBeNull();
    expect(retentionText({ days: null, status: 'PENDIENTE_DE_CUMPLIMIENTO' })).toContain(
      'Sin plazo declarado',
    );
    expect(retentionText({ days: 14, status: 'PENDIENTE_DE_CUMPLIMIENTO' })).toContain(
      'pendiente de cumplimiento',
    );
  });

  it('los hallazgos tienen texto en español y uno desconocido se muestra tal cual', () => {
    expect(findingCode('DECLARED_NOT_ENFORCED')).toContain('sin barrera');
    expect(findingCode('OTRO')).toBe('OTRO');
  });
});
