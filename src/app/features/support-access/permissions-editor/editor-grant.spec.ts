import type { SupportGrant } from '../../../core/data-access/support-access/support-access.types';
import {
  withGrantSummary,
  buildChangeSet,
  conditionOf,
  coveredAliases,
  expandAliases,
  hasChanges,
  normalizeActions,
  rowAtoms,
  rowConditionCount,
  setCondition,
  setEffect,
  setValidTo,
  toEditorGrant,
  toggleAtom,
  type EditorGrant,
} from './editor-grant';

const LEGACY: SupportGrant = {
  id: 'g-1',
  engagementId: 'e-1',
  targetKind: 'PRACTITIONER',
  practitionerRoleAssignmentId: 'd-1',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view', 'schedule.cancel'],
  status: 'ACTIVE',
  origin: 'LEGACY',
  atoms: [
    'agenda.appointment.view',
    'agenda.appointment.view.patient_name',
    'agenda.appointment.cancel',
  ],
};

const ATOMIC: SupportGrant = {
  ...LEGACY,
  id: 'g-2',
  actions: [],
  origin: 'ATOM',
  atoms: ['agenda.appointment.view', 'agenda.appointment.view.reason'],
  effect: 'ALLOW',
};

const nuevo = (over: Partial<EditorGrant> = {}): EditorGrant => ({
  key: 'nuevo-1',
  targetKind: 'SERVICE',
  healthcareServiceId: 's-1',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view'],
  ...over,
});

describe('toEditorGrant', () => {
  it('un permiso con alias se muestra como alias', () => {
    const fila = toEditorGrant(LEGACY);
    expect(fila.actions).toEqual(['schedule.view', 'schedule.cancel']);
    expect(rowAtoms(fila)).toEqual([
      'agenda.appointment.view',
      'agenda.appointment.view.patient_name',
      'agenda.appointment.cancel',
    ]);
    expect(fila.effect).toBe('ALLOW');
  });

  it('un permiso escrito con átomos se muestra con sus átomos', () => {
    expect(toEditorGrant(ATOMIC).actions).toEqual([
      'agenda.appointment.view',
      'agenda.appointment.view.reason',
    ]);
  });

  it('normalizeActions quita lo desconocido y repetido, y deja alias antes que átomos', () => {
    expect(
      normalizeActions([
        'agenda.appointment.view',
        'nada',
        'schedule.cancel',
        'schedule.view',
        'schedule.cancel',
      ]),
    ).toEqual(['schedule.view', 'schedule.cancel', 'agenda.appointment.view']);
  });

  it('coveredAliases también cuenta el alias que los átomos completan', () => {
    expect(
      coveredAliases({
        actions: ['agenda.appointment.view', 'agenda.appointment.view.patient_name'],
      }),
    ).toEqual(['schedule.view']);
  });
});

describe('ediciones', () => {
  it('marcar un átomo convierte los alias de esa fila en átomos y no cambia lo que daban', () => {
    const [fila] = toggleAtom([toEditorGrant(LEGACY)], 'g-1', 'agenda.appointment.create', true);
    expect(fila!.actions).toEqual([
      'agenda.appointment.view',
      'agenda.appointment.view.patient_name',
      'agenda.appointment.create',
      'agenda.appointment.cancel',
    ]);
  });

  it('desmarcar un átomo que daba un alias lo quita solo a él', () => {
    const [fila] = toggleAtom([toEditorGrant(LEGACY)], 'g-1', 'agenda.appointment.cancel', false);
    expect(fila!.actions).toEqual([
      'agenda.appointment.view',
      'agenda.appointment.view.patient_name',
    ]);
  });

  it('quitar un átomo de campo quita su máscara y su condición propia (el servidor las rechazaría)', () => {
    const base = toEditorGrant(ATOMIC);
    const con = setCondition(
      setCondition([base], 'g-2', 'ALL', {
        schemaVersion: 1,
        fields: { 'agenda.appointment.view.reason': { mask: 'PARTIAL' } },
      }),
      'g-2',
      'agenda.appointment.view.reason',
      { schemaVersion: 1, time: { windows: [{ days: [1], from: '08:00', to: '12:00' }] } },
    );
    const [fila] = toggleAtom(con, 'g-2', 'agenda.appointment.view.reason', false);
    expect(fila!.condition).toEqual({ schemaVersion: 1 });
    expect(fila!.actionConditions).toBeUndefined();
  });

  it('expandAliases no toca una fila sin alias', () => {
    const filas = [toEditorGrant(ATOMIC)];
    expect(expandAliases(filas, 'g-2')).toBe(filas);
  });

  it('la condición de todo el permiso y la de un átomo se guardan por separado y se pueden quitar', () => {
    const c1 = { schemaVersion: 1 as const, network: { require: 'ORG_RULES' as const } };
    const c2 = {
      schemaVersion: 1 as const,
      limits: [{ metric: 'ACTIONS' as const, per: 'DAY' as const, max: 5 }],
    };
    let filas: readonly EditorGrant[] = [toEditorGrant(ATOMIC)];
    filas = setCondition(filas, 'g-2', 'ALL', c1);
    filas = setCondition(filas, 'g-2', 'agenda.appointment.view', c2);
    expect(conditionOf(filas[0]!, 'ALL')).toEqual(c1);
    expect(conditionOf(filas[0]!, 'agenda.appointment.view')).toEqual(c2);
    expect(rowConditionCount(filas[0]!)).toBe(2);
    filas = setCondition(
      setCondition(filas, 'g-2', 'ALL', undefined),
      'g-2',
      'agenda.appointment.view',
      undefined,
    );
    expect(rowConditionCount(filas[0]!)).toBe(0);
    expect(filas[0]!.actionConditions).toBeUndefined();
  });

  it('el vencimiento se pone y se quita', () => {
    const con = setValidTo([nuevo()], 'nuevo-1', '2026-12-01T23:59:00.000Z');
    expect(con[0]!.validTo).toBe('2026-12-01T23:59:00.000Z');
    expect(setValidTo(con, 'nuevo-1', undefined)[0]!.validTo).toBeUndefined();
  });
});

describe('buildChangeSet', () => {
  it('sin cambios no hay nada que mandar', () => {
    expect(hasChanges([LEGACY], [toEditorGrant(LEGACY)])).toBe(false);
  });

  it('una fila nueva es un alta; el borrador simulado y el cuerpo que se manda salen de los mismos campos', () => {
    const { writes, revokeIds } = buildChangeSet(
      [],
      [nuevo({ effect: 'DENY', condition: { schemaVersion: 1, presence: { doctor: 'ONLINE' } } })],
    );
    expect(revokeIds).toEqual([]);
    const w = writes[0]!;
    expect(w.kind).toBe('create');
    expect(w.draftGrant).toEqual({
      effect: 'DENY',
      actions: ['schedule.view'],
      targetKind: 'SERVICE',
      healthcareServiceId: 's-1',
      expansionMode: 'DYNAMIC',
      condition: { schemaVersion: 1, presence: { doctor: 'ONLINE' } },
    });
    expect(w.create).toMatchObject({
      targetKind: 'SERVICE',
      healthcareServiceId: 's-1',
      actions: ['schedule.view'],
      effect: 'DENY',
      condition: { schemaVersion: 1, presence: { doctor: 'ONLINE' } },
    });
  });

  it('un cambio de acciones lleva `id` en la simulación y las acciones en el cuerpo, y pide huella', () => {
    const fila = { ...toEditorGrant(LEGACY), actions: normalizeActions(['schedule.view']) };
    const { writes } = buildChangeSet([LEGACY], [fila]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      kind: 'change',
      needsToken: true,
      change: { grantId: 'g-1', actions: ['schedule.view'] },
    });
    expect(writes[0]!.draftGrant).toMatchObject({
      id: 'g-1',
      effect: 'ALLOW',
      targetKind: 'PRACTITIONER',
      practitionerRoleAssignmentId: 'd-1',
      actions: ['schedule.view'],
    });
  });

  it('cambiar solo el modo de expansión no pide huella ni manda acciones', () => {
    const { writes } = buildChangeSet(
      [LEGACY],
      [{ ...toEditorGrant(LEGACY), expansionMode: 'FIXED' }],
    );
    expect(writes[0]).toMatchObject({
      kind: 'change',
      needsToken: false,
      change: { grantId: 'g-1', expansionMode: 'FIXED' },
    });
    expect(writes[0]!.change).not.toHaveProperty('actions');
  });

  it('quitar todas las condiciones de un permiso que las tenía se escribe como una condición vacía', () => {
    const conCondicion: SupportGrant = {
      ...LEGACY,
      condition: { schemaVersion: 1, network: { require: 'ORG_RULES' } },
    };
    const fila = toEditorGrant(conCondicion);
    const { condition: _c, ...sin } = fila;
    const { writes } = buildChangeSet([conCondicion], [sin]);
    expect(writes[0]!.change).toMatchObject({ condition: { schemaVersion: 1 } });
  });

  it('retirar un permiso es un revoke sin huella', () => {
    expect(buildChangeSet([LEGACY], [])).toEqual({ writes: [], revokeIds: ['g-1'] });
  });

  it('pasar de Permitir a Denegar retira el permiso y crea otro (el efecto no se edita con PATCH)', () => {
    const { writes, revokeIds } = buildChangeSet(
      [LEGACY],
      setEffect([toEditorGrant(LEGACY)], 'g-1', 'DENY') as EditorGrant[],
    );
    expect(revokeIds).toEqual(['g-1']);
    expect(writes).toHaveLength(1);
    expect(writes[0]!.kind).toBe('create');
    expect(writes[0]!.create).toMatchObject({
      effect: 'DENY',
      practitionerRoleAssignmentId: 'd-1',
    });
    expect(writes[0]!.create).not.toHaveProperty('id');
  });

  it('un permiso ya retirado o vencido no cuenta como guardado', () => {
    expect(buildChangeSet([{ ...LEGACY, status: 'REVOKED' }], [])).toEqual({
      writes: [],
      revokeIds: [],
    });
  });
});

describe('withGrantSummary (la lista de la API real no trae efecto ni átomos)', () => {
  const alias = {
    id: 'g1',
    engagementId: 'e',
    targetKind: 'PRACTITIONER',
    expansionMode: 'DYNAMIC',
    actions: ['schedule.view'],
    status: 'ACTIVE',
  } as unknown as SupportGrant;
  const soloAtomos = { ...alias, id: 'g2', actions: [] } as SupportGrant;

  it('un permiso solo de átomos y uno DENY dejan de llegar como «vacío / permitir»', () => {
    const [a, b] = withGrantSummary([alias, soloAtomos], {
      grants: [
        { grantId: 'g1', effect: 'ALLOW', atoms: ['agenda.appointment.view'] },
        { grantId: 'g2', effect: 'DENY', atoms: ['agenda.appointment.cancel'] },
      ],
    });
    expect(toEditorGrant(a!)).toMatchObject({
      effect: 'ALLOW',
      actions: ['agenda.appointment.view'],
    });
    expect(toEditorGrant(b!)).toMatchObject({
      effect: 'DENY',
      actions: ['agenda.appointment.cancel'],
    });
  });

  it('sin resumen, o con un permiso que el resumen no nombra, no cambia nada', () => {
    expect(withGrantSummary([alias], null)).toEqual([alias]);
    expect(withGrantSummary([alias], { grants: [] })).toEqual([alias]);
  });
});
