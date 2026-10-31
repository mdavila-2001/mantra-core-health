import {
  campaignStatusText,
  campaignStatusTone,
  dueCounter,
  itemStateText,
  itemStateTone,
  reviewerKindText,
  scopeKindText,
  sensitivityRisk,
  sensitivityTone,
  uncertifiedActionText,
} from './review-labels';

const AHORA = new Date('2026-11-03T12:00:00-04:00');
const enDias = (n: number): string => new Date(AHORA.getTime() + n * 86_400_000).toISOString();

describe('review-labels', () => {
  it('dice el riesgo con palabras y le da un tono, sin depender del color', () => {
    expect(sensitivityRisk('LOW')).toBe('Riesgo bajo');
    expect(sensitivityRisk('MEDIUM')).toBe('Riesgo medio');
    expect(sensitivityRisk('HIGH')).toBe('Riesgo alto');
    expect(sensitivityRisk('CRITICAL')).toBe('Riesgo crítico');
    expect(sensitivityRisk(undefined)).toBe('Riesgo sin clasificar');
    expect(sensitivityTone('LOW')).toBe('success');
    expect(sensitivityTone('CRITICAL')).toBe('error');
  });

  it('traduce el estado de la campaña, su tono, el alcance y qué pasa con lo no certificado', () => {
    expect(campaignStatusText('DRAFT')).toBe('Borrador');
    expect(campaignStatusText('OPEN')).toBe('Abierta');
    expect(campaignStatusText('CLOSED')).toBe('Cerrada');
    expect(campaignStatusText('CANCELLED')).toBe('Cancelada');
    expect(campaignStatusTone('OPEN')).toBe('info');
    expect(scopeKindText('ORGANIZATION')).toBe('Toda la organización');
    expect(scopeKindText('PRACTITIONER')).toBe('Doctores elegidos');
    expect(uncertifiedActionText('UNCERTIFIED_REVOKE')).toContain('se quita');
    expect(uncertifiedActionText('UNCERTIFIED_ESCALATE')).toContain('no cambia');
  });

  it('traduce quién revisa y el estado de cada acceso, aunque llegue un código que no conoce', () => {
    expect(reviewerKindText('ADMIN')).toBe('Administración de seguridad');
    expect(reviewerKindText('DOCTOR_OWNER')).toBe('Doctor responsable');
    expect(reviewerKindText('SERVICE_HEAD')).toBe('Jefatura del servicio');
    expect(reviewerKindText('SUPERVISOR')).toBe('Responsable de la cuenta');
    expect(reviewerKindText('ACCOUNT_OWNER')).toBe('Otro revisor');
    expect(reviewerKindText('OTRO')).toBe('Otro revisor');
    expect(itemStateText('PENDING')).toBe('Pendiente');
    expect(itemStateText('CERTIFIED')).toBe('Mantenido');
    expect(itemStateText('REVOKED')).toBe('Quitado');
    expect(itemStateText('ADJUSTED')).toBe('Ajustado');
    expect(itemStateText('AUTO_REVOKED')).toBe('Quitado por no revisarse');
    expect(itemStateText('SKIPPED')).toBe('Omitido');
    expect(itemStateText('RARO')).toBe('En revisión');
    expect(itemStateTone('PENDING')).toBe('warning');
    expect(itemStateTone('CERTIFIED')).toBe('success');
    expect(itemStateTone('REVOKED')).toBe('error');
  });

  it('cuenta los días hasta el vencimiento y marca lo vencido', () => {
    expect(dueCounter(enDias(5), AHORA)).toEqual({ text: 'Vence en 5 días', overdue: false });
    expect(dueCounter(enDias(1), AHORA)).toEqual({ text: 'Vence mañana', overdue: false });
    expect(dueCounter(enDias(0), AHORA)).toEqual({ text: 'Vence hoy', overdue: false });
    expect(dueCounter(enDias(-1), AHORA)).toEqual({ text: 'Venció ayer', overdue: true });
    expect(dueCounter(enDias(-4), AHORA)).toEqual({ text: 'Venció hace 4 días', overdue: true });
  });
});
