import { describe, expect, it } from 'vitest';

import type { SupportGrant } from '../../../core/data-access/support-access/support-access.types';
import { conditionNotes, obligationNotes } from './my-access-notes';

const permiso = (extra: Partial<SupportGrant>): SupportGrant => ({
  id: 'g',
  engagementId: 'e',
  targetKind: 'PRACTITIONER',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view'],
  status: 'ACTIVE',
  ...extra,
});

describe('my-access-notes', () => {
  it('las condiciones salen una vez cada una y las prohibiciones dicen «en ningún caso»', () => {
    const notas = conditionNotes([
      permiso({ conditionsSummary: 'Solo de lunes a viernes.' }),
      permiso({ id: 'h', conditionsSummary: 'Solo de lunes a viernes.' }),
      permiso({ id: 'i', effect: 'DENY', atoms: ['agenda.appointment.view.reason'] }),
      permiso({ id: 'j', status: 'REVOKED', conditionsSummary: 'Esta ya no rige.' }),
    ]);
    expect(notas).toEqual([
      'Solo de lunes a viernes.',
      'No puede, en ningún caso: Ver el motivo de consulta.',
    ]);
  });

  it('lo que se le pedirá se agrupa por tipo y no cuenta lo que una prohibición quita', () => {
    const notas = obligationNotes([
      permiso({
        atoms: ['agenda.appointment.cancel', 'billing.receipt.void', 'agenda.hours.edit'],
        origin: 'ATOM',
      }),
      permiso({ id: 'x', effect: 'DENY', atoms: ['billing.payment.refund'], origin: 'ATOM' }),
    ]);
    expect(notas).toContain(
      'Pide el motivo por escrito: Cancelar citas, Anular comprobantes y Cambiar los horarios de atención del doctor.',
    );
    expect(notas.some((n) => n.startsWith('Pide confirmar con el segundo paso'))).toBe(true);
    expect(notas).toContain(
      'Pide la aprobación del doctor: Cambiar los horarios de atención del doctor.',
    );
    expect(notas).toContain('Pide la aprobación de una segunda persona: Anular comprobantes.');
    expect(notas.join(' ')).not.toContain('Devolver pagos');
  });

  it('un permiso antiguo (alias) también dice lo que pedirá, porque sus átomos son los mismos', () => {
    expect(obligationNotes([permiso({ actions: ['schedule.cancel'] })])[0]).toContain(
      'Cancelar citas',
    );
  });

  it('sin requisitos no hay notas', () => {
    expect(
      obligationNotes([permiso({ atoms: ['agenda.appointment.view'], origin: 'ATOM' })]),
    ).toEqual([]);
    expect(conditionNotes([])).toEqual([]);
  });
});
