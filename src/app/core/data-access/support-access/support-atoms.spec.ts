import { SUPPORT_ACTION_CODES } from './support-access.types';
import {
  ATOM_CATEGORY_CODES,
  LEGACY_ALIAS_ATOMS,
  LEGACY_ALIAS_PRIMARY,
  SUPPORT_ATOMS,
  SUPPORT_ATOM_CODES,
  atomMeta,
  atomsOfCategory,
  expandSupportAction,
  isSupportAtom,
  primaryAtomOfAction,
  privilegeWeightOf,
} from './support-atoms';

/** Fija el catálogo del front a los números de CONTRATO-GOBIERNO §2.2 (el mock y el editor dependen de ellos). */
describe('support-atoms (catálogo de 73 permisos atómicos)', () => {
  it('tiene 73 átomos únicos con el formato módulo.recurso.acción[.campo]', () => {
    expect(SUPPORT_ATOMS).toHaveLength(73);
    expect(new Set(SUPPORT_ATOM_CODES).size).toBe(73);
    for (const code of SUPPORT_ATOM_CODES) expect(code).toMatch(/^[a-z_]+(\.[a-z_]+){2,3}$/);
  });

  it('reparte las categorías como el contrato: 20 · 11 · 9 · 7 · 4 · 17 · 5', () => {
    expect(ATOM_CATEGORY_CODES.map((c) => atomsOfCategory(c).length)).toEqual([20, 11, 9, 7, 4, 17, 5]);
  });

  it('reparte la sensibilidad (11 baja, 27 media, 29 alta, 6 crítica) y las obligaciones', () => {
    const cuenta = (f: (a: (typeof SUPPORT_ATOMS)[number]) => boolean): number => SUPPORT_ATOMS.filter(f).length;
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => cuenta((a) => a.sensitivity === s))).toEqual([11, 27, 29, 6]);
    expect(cuenta((a) => a.requiresReason)).toBe(31);
    expect(cuenta((a) => a.requiresStepUp)).toBe(14);
    expect(cuenta((a) => a.approvalMode === 'DOCTOR')).toBe(3);
    expect(cuenta((a) => a.approvalMode === 'SECOND_APPROVER')).toBe(7);
    expect(cuenta((a) => a.isFieldLevel)).toBe(8);
    expect(cuenta((a) => a.touchesClinicalData)).toBe(2);
    expect(cuenta((a) => !a.supportAssignable)).toBe(4);
    expect(cuenta((a) => a.isDangerous)).toBe(35);
  });

  it('los 15 códigos antiguos son alias que se expanden a átomos reales y suman 24 átomos distintos', () => {
    expect(Object.keys(LEGACY_ALIAS_ATOMS).sort()).toEqual([...SUPPORT_ACTION_CODES].sort());
    const todos = new Set(Object.values(LEGACY_ALIAS_ATOMS).flat());
    expect(todos.size).toBe(24);
    for (const atom of todos) expect(isSupportAtom(atom)).toBe(true);
    expect(LEGACY_ALIAS_PRIMARY['messages.reply_on_behalf']).toBe('messages.conversation.reply_on_behalf');
    expect(expandSupportAction('schedule.view')).toEqual(['agenda.appointment.view', 'agenda.appointment.view.patient_name']);
  });

  it('un átomo se expande a sí mismo y lo desconocido a nada', () => {
    expect(expandSupportAction('agenda.appointment.cancel')).toEqual(['agenda.appointment.cancel']);
    expect(expandSupportAction('no.existe.esto')).toEqual([]);
    expect(primaryAtomOfAction('schedule.cancel')).toBe('agenda.appointment.cancel');
    expect(primaryAtomOfAction('nada')).toBeUndefined();
  });

  it('el puntaje de privilegios suma 1, 2, 5 y 10 sin repetir átomos', () => {
    expect(privilegeWeightOf(['agenda.appointment.view', 'agenda.appointment.view'])).toBe(1);
    expect(privilegeWeightOf(['billing.payment.collect', 'billing.receipt.void', 'x.y.z'])).toBe(15);
    expect(atomMeta('billing.receipt.void')).toMatchObject({ sensitivity: 'CRITICAL', approvalMode: 'SECOND_APPROVER', requiresStepUp: true });
  });
});
