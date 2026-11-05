import { describe, expect, it } from 'vitest';

import {
  grantChangeChangeText,
  grantChangeReasonText,
  grantChangeReasonsText,
  grantChangeTargetText,
  grantChangeValidityText,
  pendingApprovalExplanation,
} from './grant-change-reasons';

/**
 * Los motivos por los que la API manda un cambio de permisos a la aprobación de otra persona (202 `GrantChangePendingDto.reasons`
 * y `GrantChangeDetailsDto.reasons`): se explican en lenguaje simple, nunca con el código.
 */
describe('grantChangeReasonText', () => {
  it('explica en lenguaje simple los tres motivos de la API', () => {
    expect(grantChangeReasonText('NEW_CRITICAL_ATOMS')).toContain('permisos críticos');
    expect(grantChangeReasonText('SCOPE_WIDENED')).toContain('Amplía');
    expect(grantChangeReasonText('VALIDITY_EXTENDED')).toContain('Alarga');
    for (const code of ['NEW_CRITICAL_ATOMS', 'SCOPE_WIDENED', 'VALIDITY_EXTENDED'])
      expect(grantChangeReasonText(code)).not.toMatch(/[A-Z]{2,}_[A-Z]/);
  });

  it('un motivo desconocido no se muestra como código: se dice que otra persona debe revisarlo', () => {
    expect(grantChangeReasonText('ALGO_NUEVO')).toBe('Es un cambio que otra persona debe revisar.');
  });

  it('acepta el nombre antiguo del simulador y no repite motivos', () => {
    expect(
      grantChangeReasonsText(['CRITICAL_ATOM_ADDED', 'NEW_CRITICAL_ATOMS', 'SCOPE_WIDENED']),
    ).toEqual([
      grantChangeReasonText('NEW_CRITICAL_ATOMS'),
      grantChangeReasonText('SCOPE_WIDENED'),
    ]);
  });
});

describe('pendingApprovalExplanation', () => {
  it('une los motivos de todos los cambios que quedaron pendientes', () => {
    const texto = pendingApprovalExplanation([
      { reasons: ['SCOPE_WIDENED'], criticalAtoms: [] },
      {
        reasons: ['VALIDITY_EXTENDED', 'NEW_CRITICAL_ATOMS'],
        criticalAtoms: ['billing.receipt.void'],
      },
    ]);
    expect(texto).toContain('Amplía');
    expect(texto).toContain('Alarga');
    expect(texto).toContain('permisos críticos');
    expect(texto).not.toContain('billing.receipt.void');
    expect(texto).toContain('no rige hasta que otra persona lo apruebe');
  });

  it('sin motivos igual dice que espera a otra persona', () => {
    expect(pendingApprovalExplanation([{ reasons: [], criticalAtoms: [] }])).toContain(
      'otra persona',
    );
  });
});

describe('detalle de un cambio de permisos', () => {
  it('el objetivo se dice por nombre, no por identificador', () => {
    expect(
      grantChangeTargetText({
        kind: 'PRACTITIONER',
        expansionMode: 'DYNAMIC',
        practitionerName: 'Dr. Andrés Pérez',
      }),
    ).toBe('Dr. Andrés Pérez, y lo que se sume después');
    expect(
      grantChangeTargetText({
        kind: 'PRACTITIONER_SERVICE',
        expansionMode: 'FIXED',
        practitionerName: 'Dr. Andrés Pérez',
        serviceName: 'Ecografía',
      }),
    ).toBe('Dr. Andrés Pérez, solo en Ecografía');
    expect(
      grantChangeTargetText({ kind: 'LOCATION', expansionMode: 'FIXED', locationName: 'Piso 2' }),
    ).toBe('Piso 2');
    expect(grantChangeTargetText({ kind: 'ALL', expansionMode: 'DYNAMIC' })).toBe(
      'Todo lo de la organización, y lo que se sume después',
    );
  });

  it('la vigencia dice desde y hasta, o que no termina', () => {
    expect(grantChangeValidityText({})).toBe('Sin fecha de fin.');
    expect(grantChangeValidityText({ validTo: '2026-12-31T23:59:00-04:00' })).toMatch(/^Hasta el /);
    expect(
      grantChangeValidityText({
        validFrom: '2026-11-02T00:00:00-04:00',
        validTo: '2026-12-31T23:59:00-04:00',
      }),
    ).toMatch(/^Desde el .* hasta el /);
  });

  it('lo que cambia un ajuste se dice en palabras', () => {
    expect(
      grantChangeChangeText([
        'actions',
        'validTo',
        'expansionMode',
        'condition',
        'actionConditions',
      ]),
    ).toEqual([
      'los permisos',
      'la vigencia',
      'si se actualiza solo con lo nuevo',
      'las condiciones',
      'las condiciones de cada permiso',
    ]);
    expect(grantChangeChangeText(['otraCosa'])).toEqual(['otros datos']);
  });
});
