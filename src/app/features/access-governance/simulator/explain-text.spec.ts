import { describe, expect, it } from 'vitest';

import type { PolicyTraceStep } from '../../../core/data-access/access-governance/access-explain.types';
import {
  actionOptions,
  assumeOf,
  assumeSummary,
  changeInfo,
  decisionWords,
  NO_ASSUMPTIONS,
  obligationLines,
  reasonText,
  stepViews,
  verdictOf,
} from './explain-text';

describe('explain-text', () => {
  it('el veredicto dice lo mismo con palabras y con símbolo, nunca solo con color', () => {
    expect(verdictOf({ effect: 'PERMIT' })).toEqual({
      icon: '✔',
      label: 'Sí puede',
      tone: 'success',
    });
    expect(verdictOf({ effect: 'DENY' })).toEqual({ icon: '✖', label: 'No puede', tone: 'error' });
    expect(verdictOf({ effect: 'CHALLENGE' }).label).toContain('falta un requisito');
  });

  it('las obligaciones se dicen en frases de usted, una por requisito', () => {
    expect(
      obligationLines({
        reason: { minLength: 10 },
        stepUp: null,
        approval: { by: 'DOCTOR', ttlMinutes: 60 },
      }),
    ).toEqual([
      'Escribir el motivo (al menos 10 caracteres).',
      'Pedir la aprobación del doctor (queda vigente 60 minutos).',
    ]);
    expect(
      obligationLines({ reason: null, stepUp: { maxAgeMinutes: 10 }, approval: null })[0],
    ).toContain('vale 10 minutos');
    expect(obligationLines({ reason: null, stepUp: null, approval: null })).toEqual([]);
  });

  it('la traza sale en orden, marca el paso que decidió y deja los números reales detrás del detalle', () => {
    const pasos: PolicyTraceStep[] = [
      {
        order: 2,
        layer: 'CONDITION',
        passed: false,
        code: 'LEAD_TIME',
        message: 'Faltan 6 horas.',
        atom: 'agenda.appointment.cancel',
        conditionPath: 'actionConditions.x',
        details: { minHours: 24, hoursLeft: 6 },
      },
      {
        order: 1,
        layer: 'ENGAGEMENT',
        passed: true,
        code: 'ENGAGEMENT_ACTIVE',
        message: 'Vigente.',
      },
    ];
    const vistas = stepViews(pasos, 2);
    expect(vistas.map((v) => v.order)).toEqual([1, 2]);
    expect(vistas[0]).toMatchObject({
      outcome: 'Pasó',
      icon: '✔',
      decisive: false,
      layerLabel: 'Vínculo',
    });
    expect(vistas[1]).toMatchObject({
      outcome: 'No pasó',
      icon: '✖',
      decisive: true,
      layerLabel: 'Condición del permiso',
    });
    expect(vistas[1]!.technical).toContainEqual({ label: 'minHours', value: '24' });
    expect(vistas[1]!.technical).toContainEqual({ label: 'Código', value: 'LEAD_TIME' });
  });

  it('«¿y si…?» solo manda lo que se pisó', () => {
    expect(assumeOf(NO_ASSUMPTIONS)).toBeUndefined();
    expect(assumeOf({ ...NO_ASSUMPTIONS, approvalGranted: 'YES', doctorOnline: 'NO' })).toEqual({
      approvalGranted: true,
      doctorOnline: false,
    });
    expect(assumeOf(NO_ASSUMPTIONS, true)).toEqual({ forceFull: true });
    expect(assumeSummary({ approvalGranted: true })).toBe('si tuviera la aprobación');
  });

  it('la comparación acepta NEWLY_PERMITTED como sinónimo de NEWLY_ALLOWED y filtra lo que no cambia', () => {
    expect(changeInfo('NEWLY_PERMITTED')).toEqual(changeInfo('NEWLY_ALLOWED'));
    expect(changeInfo('SAME').changes).toBe(false);
    expect(changeInfo('NEWLY_DENIED')).toMatchObject({
      label: 'Ya no puede',
      tone: 'error',
      changes: true,
    });
    expect(changeInfo('ALGO_NUEVO').label).toBe('Cambia el motivo');
  });

  it('un «no puede» dice el motivo en palabras y no con el código', () => {
    expect(decisionWords({ effect: 'DENY', allowed: false, reason: 'TIME_WINDOW' })).toBe(
      'No puede · Está fuera del horario permitido.',
    );
    expect(decisionWords({ effect: 'PERMIT', allowed: true, reason: 'ALLOWED' })).toBe('Sí puede');
  });

  it('cada motivo del Anexo C tiene su frase en lenguaje simple y de usted, sin códigos', () => {
    for (const reason of [
      'NO_ENGAGEMENT',
      'ORG_RULE_DENY',
      'PATIENT_EXCLUDED',
      'NETWORK_NOT_ALLOWED',
      'DOCTOR_OFFLINE',
      'AMOUNT_LIMIT',
      'HORIZON',
      'SESSION_TOO_LONG',
    ]) {
      expect(reasonText(reason)).not.toBe(reason);
      expect(reasonText(reason)).not.toMatch(/[A-Z_]{6,}/);
    }
    // Los desafíos usan la tabla de errores del gobierno de accesos.
    expect(reasonText('APPROVAL_REQUIRED')).toBe(
      'Esta acción necesita la aprobación de otra persona.',
    );
    // Un código que no se conoce se dice tal cual: no se inventa una frase.
    expect(reasonText('ALGO_NUEVO')).toBe('ALGO_NUEVO');
  });

  it('las acciones se ofrecen con su categoría y, para el personal de apoyo, sin lo que no se puede delegar', () => {
    const todas = actionOptions(null);
    expect(todas.length).toBe(73);
    expect(todas.find((o) => o.value === 'agenda.appointment.cancel')?.label).toBe(
      'Agenda · Cancelar citas',
    );
    expect(actionOptions(null, true).length).toBeLessThanOrEqual(todas.length);
  });
});

describe('obligationLines con lo que manda la API real (B7c)', () => {
  it('la API manda `{}` cuando la acción no exige nada: no hay frases y no se rompe', () => {
    expect(obligationLines({})).toEqual([]);
  });

  it('con solo algunas claves, dice solo esas', () => {
    expect(obligationLines({ reason: { minLength: 10 } })).toEqual([
      'Escribir el motivo (al menos 10 caracteres).',
    ]);
  });
});
