import { describe, expect, it } from 'vitest';

import { CONDITION_SCHEMA_VERSION } from '../../../core/data-access/access-governance/conditions.types';
import type { PersonMatrix } from '../../../core/data-access/access-governance/governance-reports.types';
import type { GovernanceRule } from '../../../core/data-access/access-governance/governance-rules.types';
import {
  ceilingCell,
  conditionPhrases,
  describeRule,
  patternLabel,
  ruleImpact,
} from './rule-labels';

const regla = (parcial: Partial<GovernanceRule>): GovernanceRule => ({
  id: 'r',
  kind: 'DENY_PERMISSION',
  status: 'ACTIVE',
  permissionPattern: 'billing.*',
  createdAt: '',
  updatedAt: '',
  rowVersion: 1,
  ...parcial,
});

describe('rule-labels', () => {
  it('dice un patrón de categoría y un permiso como la persona los entiende', () => {
    expect(patternLabel('billing.*')).toBe('todo lo de «Facturación y caja»');
    expect(patternLabel('billing.payment.collect')).toBe('«Cobrar la atención»');
    expect(patternLabel('*')).toBe('todo');
  });

  it('cada tipo de regla es una oración, sin códigos', () => {
    expect(
      describeRule(
        regla({
          kind: 'DENY_PERMISSION',
          roleTemplateCode: 'FRONT_DESK',
          permissionPattern: 'billing.payment.collect',
        }),
      ),
    ).toBe('Nadie con el rol «Recepción» puede tener «Cobrar la atención».');
    expect(describeRule(regla({ kind: 'CEILING', roleTemplateCode: 'SECRETARY' }))).toBe(
      'El rol «Secretaria» nunca puede tener todo lo de «Facturación y caja».',
    );
    expect(
      describeRule(
        regla({
          kind: 'REQUIRE_CONDITION',
          condition: {
            schemaVersion: CONDITION_SCHEMA_VERSION,
            network: { require: 'ORG_RULES' },
            obligations: { requireReason: { minLength: 12 } },
          },
        }),
      ),
    ).toBe(
      'Todo lo de «Facturación y caja» solo se puede usar desde la red del hospital, con un motivo de al menos 12 caracteres.',
    );
    expect(
      describeRule(
        regla({
          kind: 'FIELD_FLOOR',
          permissionPattern: 'agenda.appointment.view.patient_document',
          maxVisibility: 'REDACT',
        }),
      ),
    ).toBe('El dato «Ver el documento del paciente en la cita» se ve como máximo tachado.');
  });

  it('las frases de una condición no inventan nada: lo que no conoce no lo dice', () => {
    expect(conditionPhrases(undefined)).toEqual([]);
    expect(
      conditionPhrases({
        schemaVersion: CONDITION_SCHEMA_VERSION,
        device: { knownOnly: true },
        obligations: { stepUp: { maxAgeMinutes: 5 }, approval: { by: 'DOCTOR' } },
      }),
    ).toEqual([
      'desde un equipo de confianza',
      'con verificación en dos pasos',
      'con la aprobación del doctor',
    ]);
  });

  describe('techos por plantilla', () => {
    it('sin reglas no hay límite propio; una categoría entera es «Bloqueada»; unos pocos permisos, «Limitada»', () => {
      expect(ceilingCell([], 'SECRETARY', 'SUPPORT_BILLING')).toEqual({
        kind: 'NONE',
        text: 'Sin límite propio',
      });
      const techo = regla({
        kind: 'CEILING',
        roleTemplateCode: 'SECRETARY',
        permissionPattern: 'billing.*',
      });
      expect(ceilingCell([techo], 'SECRETARY', 'SUPPORT_BILLING')).toEqual({
        kind: 'BLOCKED',
        text: 'Bloqueada',
      });
      expect(ceilingCell([techo], 'NURSING', 'SUPPORT_BILLING').kind).toBe('NONE');
      const parcial = regla({
        kind: 'CEILING',
        roleTemplateCode: 'SECRETARY',
        permissionPattern: 'billing.receipt.void',
      });
      expect(ceilingCell([parcial], 'SECRETARY', 'SUPPORT_BILLING').kind).toBe('LIMITED');
    });

    it('una regla retirada ya no limita', () => {
      expect(
        ceilingCell(
          [regla({ kind: 'CEILING', status: 'REVOKED', permissionPattern: 'billing.*' })],
          'SECRETARY',
          'SUPPORT_BILLING',
        ).kind,
      ).toBe('NONE');
    });
  });

  describe('impacto', () => {
    const matriz: PersonMatrix = {
      generatedAt: '',
      by: 'person',
      group: 'atom',
      columns: ['billing.payment.collect', 'agenda.appointment.view'],
      rows: [
        {
          userId: 'u1',
          name: 'Mario',
          engagementId: 'e1',
          templateCode: 'BILLING_CASHIER',
          state: 'ACTIVE',
          cells: {
            'billing.payment.collect': { status: 'FULL', grantIds: [], conditions: [] },
            'agenda.appointment.view': { status: 'NONE', grantIds: [], conditions: [] },
          },
        },
        {
          userId: 'u2',
          name: 'Lucía',
          engagementId: 'e2',
          templateCode: 'FRONT_DESK',
          state: 'ACTIVE',
          cells: {
            'billing.payment.collect': { status: 'CONDITIONAL', grantIds: [], conditions: [] },
            'agenda.appointment.view': { status: 'FULL', grantIds: [], conditions: [] },
          },
        },
        {
          userId: 'u3',
          name: 'Ana',
          engagementId: 'e3',
          templateCode: 'SECRETARY',
          state: 'ACTIVE',
          cells: {
            'billing.payment.collect': { status: 'NONE', grantIds: [], conditions: [] },
            'agenda.appointment.view': { status: 'FULL', grantIds: [], conditions: [] },
          },
        },
      ],
    };

    it('cuenta a quien hoy tiene algo que el patrón cubre, con o sin condición', () => {
      expect(ruleImpact(matriz, 'billing.*', undefined).people.map((p) => p.name)).toEqual([
        'Mario',
        'Lucía',
      ]);
      expect(ruleImpact(matriz, 'billing.payment.collect', 'FRONT_DESK').count).toBe(1);
      expect(ruleImpact(matriz, 'billing.receipt.void', undefined).count).toBe(0);
    });
  });
});
