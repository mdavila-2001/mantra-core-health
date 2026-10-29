import type { AdmissionRequirement } from '@core/data-access/admissions/admissions.types';
import {
  ADMISSION_NOTE_MAX,
  ADMISSION_REASON_MAX,
  admissionStatusVariant,
  blockerText,
  doctorStatusCopy,
  formatBytes,
  missingMandatory,
  noteError,
  progressText,
  reasonCodeError,
  reasonError,
  requirementStatusLabel,
  sourceError,
  todayIso,
} from './admission-presentation';

function req(overrides: Partial<AdmissionRequirement>): AdmissionRequirement {
  return {
    code: 'C', label: 'Requisito', description: null, mandatory: true, evidenceKind: 'DOCUMENT', requiresSource: true,
    minItems: null, maxItems: null, state: 'PENDING', satisfied: false, blockedBy: 'PENDING', items: [], ...overrides,
  };
}

describe('presentación de admisiones', () => {
  it('dice el avance como «5 de 7 requisitos verificados, 1 rechazado»', () => {
    expect(progressText({ total: 7, verified: 5, rejected: 1, pending: 1 })).toBe('5 de 7 requisitos verificados, 1 rechazado');
    expect(progressText({ total: 1, verified: 1, rejected: 0, pending: 0 })).toBe('1 de 1 requisito verificado');
    expect(progressText({ total: 7, verified: 2, rejected: 3, pending: 2 })).toBe('2 de 7 requisitos verificados, 3 rechazados');
    expect(progressText({ total: 0, verified: 0, rejected: 0, pending: 0 })).toBe('Sin requisitos cargados');
  });

  it('lo que falta son los obligatorios que la API no da por cumplidos; los opcionales no cuentan', () => {
    const lista = [
      req({ code: 'a', state: 'VERIFIED', satisfied: true, blockedBy: null }),
      req({ code: 'b', mandatory: false, state: 'PENDING', satisfied: false }),
    ];
    expect(missingMandatory(lista)).toEqual([]);
    const falta = [...lista, req({ code: 'c', state: 'REJECTED', label: 'Matrícula' })];
    expect(missingMandatory(falta).map((r) => r.label)).toEqual(['Matrícula']);
  });

  it('dice por qué un requisito bloquea la verificación', () => {
    expect(blockerText({ label: 'Matrícula', reason: 'REJECTED' })).toBe('Matrícula: está rechazado');
    expect(blockerText({ label: 'Título', reason: 'BELOW_MINIMUM' })).toBe('Título: no llega al mínimo de documentos');
    expect(blockerText({ label: 'Cédula', reason: 'MISSING' })).toBe('Cédula: no se aportó');
    expect(blockerText({ label: 'X', reason: 'NUEVO' })).toBe('X: NUEVO');
  });

  it('nombra los estados de un requisito que no se aportó', () => {
    expect(requirementStatusLabel('NOT_PROVIDED')).toBe('No aportado');
    expect(requirementStatusLabel('MISSING')).toBe('Falta');
  });

  it('el motivo acepta de 5 a 500 caracteres, contados sin los espacios de los bordes', () => {
    expect(reasonError('')).toBe('Escriba el motivo.');
    expect(reasonError('     ')).toBe('Escriba el motivo.');
    expect(reasonError('abcd')).toContain('al menos 5');
    expect(reasonError('abcde')).toBeNull();
    expect(reasonError('a'.repeat(ADMISSION_REASON_MAX))).toBeNull();
    expect(reasonError(`  ${'a'.repeat(ADMISSION_REASON_MAX)}  `)).toBeNull();
    expect(reasonError('a'.repeat(ADMISSION_REASON_MAX + 1))).toContain('sobran 1');
  });

  it('un motivo con emoji y un nombre de 200 caracteres no rompen las cuentas', () => {
    expect(reasonError('Falta el sello 🩺'.repeat(3))).toBeNull();
    expect(progressText({ total: 200, verified: 200, rejected: 0, pending: 0 })).toBe('200 de 200 requisitos verificados');
  });

  it('la fuente pide el tipo; la referencia es opcional salvo en «Otra fuente»', () => {
    expect(sourceError('', '')).toContain('Elija');
    expect(sourceError('MINSALUD_REGISTRY', '')).toBeNull();
    expect(sourceError('MINSALUD_REGISTRY', 'Comprobante 4512')).toBeNull();
    expect(sourceError('OTHER', '  ')).toContain('Describa');
    expect(sourceError('OTHER', 'Llamada al colegio')).toBeNull();
    expect(sourceError('SEDES', 'x'.repeat(301))).toContain('300');
    // No se obliga a inventar una dirección web.
    expect(sourceError('PROVIDED_DOCUMENT', 'no es una url')).toBeNull();
  });

  it('el código de motivo y la nota interna se validan aparte', () => {
    expect(reasonCodeError('')).toContain('Elija');
    expect(reasonCodeError('ILLEGIBLE')).toBeNull();
    expect(noteError('a'.repeat(ADMISSION_NOTE_MAX))).toBeNull();
    expect(noteError('a'.repeat(ADMISSION_NOTE_MAX + 1))).toContain('500');
  });

  it('el estado siempre se dice con palabras', () => {
    expect(requirementStatusLabel('INFO_REQUIRED')).toBe('Información requerida');
    expect(requirementStatusLabel(null)).toBe('Sin revisar');
    expect(admissionStatusVariant('VERIFIED')).toBe('success');
    expect(admissionStatusVariant('REJECTED')).toBe('error');
    expect(admissionStatusVariant('ABANDONED')).toBe('secondary');
  });

  it('formatea tamaños, incluso uno desconocido o enorme', () => {
    expect(formatBytes(null)).toBe('Tamaño desconocido');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(6_000_000)).toContain('MB');
  });

  it('la fecha de hoy se arma en hora local', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('al médico solo se le ofrece reenviar donde la API lo admite: información pedida, rechazo, vencimiento y abandono', () => {
    const puede = ['INFO_REQUESTED', 'REJECTED', 'EXPIRED', 'ABANDONED'];
    for (const code of ['SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'ABANDONED', 'WITHDRAWN']) {
      expect(doctorStatusCopy(code).canResubmit).toBe(puede.includes(code));
      expect(doctorStatusCopy(code).title).not.toBe('');
    }
  });

  it('no promete lo que no sabe: ni «verificamos con el SEGIP» ni un plazo inventado', () => {
    const todo = ['SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'VERIFIED', 'REJECTED', 'SUSPENDED']
      .map((c) => doctorStatusCopy(c).detail)
      .join(' ');
    expect(todo).not.toMatch(/SEGIP|robot|\d+ días/i);
  });
});
