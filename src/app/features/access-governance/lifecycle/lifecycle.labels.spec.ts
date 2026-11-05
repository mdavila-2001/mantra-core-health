import {
  caseKindLabel,
  checklistHelp,
  checklistLabel,
  dueText,
  handoverKindOf,
  handoverKindText,
  handoverStatusLabel,
  isHandoverPending,
  ownerlessReasonText,
} from './lifecycle.labels';

describe('lifecycle.labels', () => {
  it('nombra los pasos de ingreso en lenguaje simple y cae al texto de la API si no conoce el código', () => {
    expect(checklistLabel('SUPERVISOR_ASSIGNED', 'x')).toBe('Dueño de la cuenta asignado');
    expect(checklistLabel('CONFIDENTIALITY_ACKNOWLEDGED', 'x')).toContain(
      'aceptado por la persona',
    );
    expect(checklistLabel('NUEVO_PASO', 'Un paso nuevo')).toBe('Un paso nuevo');
    expect(checklistHelp('CONFIDENTIALITY_ACK')).toContain('la propia persona');
  });

  it('el plazo se dice con palabras: vence, vence hoy, venció hace…', () => {
    const now = new Date(2026, 10, 3, 12, 0, 0);
    expect(dueText(undefined, now)).toEqual({ text: 'Sin plazo', overdue: false });
    expect(dueText(new Date(2026, 10, 9, 12).toISOString(), now)).toEqual({
      text: 'Vence en 6 días',
      overdue: false,
    });
    expect(dueText(new Date(2026, 10, 3, 20).toISOString(), now).text).toBe('Vence hoy');
    expect(dueText(new Date(2026, 9, 31, 12).toISOString(), now)).toEqual({
      text: 'Venció hace 3 días',
      overdue: true,
    });
  });

  it('unifica los tipos y los estados del traspaso, vengan de la API o del simulador', () => {
    expect(handoverKindOf('HANDOVER_PENDING_BOOKING')).toBe('PENDING_APPOINTMENT');
    expect(handoverKindText('SUPERVISED_ACCOUNT', 2)).toBe('cuentas que supervisaba');
    expect(handoverStatusLabel('HANDOVER_RETURNED_TO_POOL')).toBe('Devuelto a la bandeja común');
    expect(isHandoverPending('HANDOVER_PENDING')).toBe(true);
    expect(isHandoverPending('REASSIGNED')).toBe(false);
  });

  it('explica una cuenta sin dueño y nombra el tipo de caso', () => {
    expect(ownerlessReasonText(['NO_OWNER'])).toBe('Nadie es responsable de esta cuenta.');
    expect(ownerlessReasonText(['OTRA'])).toBe('Falta asignar un responsable de la cuenta.');
    expect(caseKindLabel('LEAVER')).toBe('Baja');
  });
});
