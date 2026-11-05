import {
  emptyCondition,
  type SupportCondition,
} from '../../../../core/data-access/access-governance/conditions.types';
import {
  describeDays,
  fieldExample,
  fieldMaskOf,
  getLimit,
  getPath,
  orNothing,
  presetOfDays,
  sectionCount,
  sectionOfKey,
  setFieldMask,
  setLimit,
  setPath,
} from './condition-form';

describe('setPath', () => {
  it('pone un valor anidado y conserva la versión', () => {
    expect(setPath(undefined, ['network', 'require'], 'ORG_RULES')).toEqual({
      schemaVersion: 1,
      network: { require: 'ORG_RULES' },
    });
  });

  it('quitar el único valor de una clave quita la clave: «null» o un objeto vacío lo rechaza el servidor', () => {
    const c = setPath(undefined, ['appointment', 'leadTime'], {
      minHours: 24,
      onViolation: 'DENY',
    });
    expect(setPath(c, ['appointment', 'leadTime'], undefined)).toEqual({ schemaVersion: 1 });
  });

  it('un arreglo vacío no restringe nada y se quita', () => {
    const c = setPath(undefined, ['time', 'windows'], [{ days: [1], from: '08:00', to: '12:00' }]);
    expect(setPath(c, ['time', 'windows'], [])).toEqual({ schemaVersion: 1 });
  });

  it('no cambia la condición que recibe', () => {
    const base: SupportCondition = { schemaVersion: 1, network: { require: 'ORG_RULES' } };
    setPath(base, ['device', 'knownOnly'], true);
    expect(base).toEqual({ schemaVersion: 1, network: { require: 'ORG_RULES' } });
  });

  it('getPath lee lo anidado y devuelve undefined si falta', () => {
    const c = setPath(undefined, ['obligations', 'requireReason', 'minLength'], 10);
    expect(getPath(c, ['obligations', 'requireReason', 'minLength'])).toBe(10);
    expect(getPath(c, ['obligations', 'stepUp'])).toBeUndefined();
  });

  it('orNothing: una condición sin restricciones se quita', () => {
    expect(orNothing(emptyCondition())).toBeUndefined();
    expect(orNothing(setPath(undefined, ['presence', 'doctor'], 'ONLINE'))).toBeDefined();
  });
});

describe('límites', () => {
  it('cada métrica tiene su límite y se pueden tener los dos', () => {
    let c = setLimit(undefined, 'ACTIONS', {
      metric: 'ACTIONS',
      per: 'DAY',
      max: 20,
      onExceed: 'DENY',
    });
    c = setLimit(c, 'DISTINCT_PATIENTS', { metric: 'DISTINCT_PATIENTS', per: 'HOUR', max: 15 });
    expect(c.limits).toHaveLength(2);
    expect(getLimit(c, 'ACTIONS')?.max).toBe(20);
    c = setLimit(c, 'ACTIONS', undefined);
    expect(c.limits).toEqual([{ metric: 'DISTINCT_PATIENTS', per: 'HOUR', max: 15 }]);
  });
});

describe('horarios', () => {
  it('reconoce los preajustes de días y dice los otros en palabras', () => {
    expect(presetOfDays([5, 1, 3, 2, 4])).toBe('weekdays');
    expect(presetOfDays([1, 3])).toBe('custom');
    expect(describeDays([1, 2, 3, 4, 5])).toBe('lunes a viernes');
    expect(describeDays([2, 4])).toBe('martes y jueves');
  });
});

describe('campos', () => {
  it('«completo» es no poner nada; parcial, tachado y oculto quedan en `fields`', () => {
    const atom = 'agenda.appointment.view.reason';
    let c = setFieldMask(undefined, atom, 'PARTIAL');
    expect(c.fields).toEqual({ [atom]: { mask: 'PARTIAL' } });
    expect(fieldMaskOf(c, atom)).toBe('PARTIAL');
    c = setFieldMask(c, atom, 'FULL');
    expect(c).toEqual({ schemaVersion: 1 });
    expect(fieldMaskOf(c, atom)).toBe('FULL');
  });

  it('el ejemplo ayuda a entender la opción: «Carmen O.» y «7******7»', () => {
    expect(fieldExample('agenda.appointment.view.patient_name', 'PARTIAL')).toBe('Carmen O.');
    expect(fieldExample('agenda.appointment.view.patient_phone', 'PARTIAL')).toBe('7******7');
    expect(fieldExample('agenda.appointment.view.patient_name', 'NULLIFY')).toBe('(no se muestra)');
  });
});

describe('secciones', () => {
  it('cuenta las condiciones de cada sección y ubica las claves', () => {
    const c: SupportCondition = {
      schemaVersion: 1,
      time: { windows: [{ days: [1], from: '08:00', to: '12:00' }] },
      network: { require: 'ORG_RULES' },
      device: { knownOnly: true },
      limits: [{ metric: 'ACTIONS', per: 'DAY', max: 5 }],
    };
    expect(sectionCount(c, 'when')).toBe(1);
    expect(sectionCount(c, 'where')).toBe(2);
    expect(sectionCount(c, 'limits')).toBe(1);
    expect(sectionCount(c, 'patients')).toBe(0);
    expect(sectionOfKey('session')).toBe('where');
    expect(sectionOfKey('patients', true)).toBe('deny');
    expect(sectionOfKey('patients')).toBe('patients');
    expect(sectionOfKey('inexistente')).toBeUndefined();
  });
});
