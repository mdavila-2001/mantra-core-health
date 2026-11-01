import type { PolicyType } from '../../data-access/admin-portal/governance-policies.types';

/* Políticas y cambios sintéticos del gobierno de datos (separados de governance-policies.handlers.ts por el techo de 600 líneas). */

const SIMULADO = ' (SIMULADO)';
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface Item {
  schemaName: string;
  tableName: string;
  columnName: string | null;
}

export interface PoliticaSintetica {
  readonly id: string;
  readonly policyType: PolicyType;
  readonly code: string;
  readonly name: string | null;
  readonly state: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
  readonly settings: Record<string, unknown>;
  readonly appliedTo: { total: number; items: Item[]; truncated: boolean };
}

export const tablas = (...nombres: string[]): Item[] =>
  nombres.map((n) => {
    const [schemaName, tableName] = n.split('.');
    return { schemaName: schemaName!, tableName: tableName!, columnName: null };
  });

export const POLITICAS: readonly PoliticaSintetica[] = [
  {
    id: id(1),
    policyType: 'WRITE',
    code: 'SIM-WRITE-APPEND',
    name: `Sólo agregar${SIMULADO}`,
    state: 'ACTIVE',
    version: 3,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-10-01T14:00:00.000Z',
    createdByUserId: id(800),
    updatedByUserId: id(800),
    settings: {
      insertMode: 'ALLOWED',
      updateMode: 'FORBIDDEN',
      deleteMode: 'FORBIDDEN',
      requiresReason: true,
      requiresApproval: false,
      dualControl: false,
      maxBatchSize: 500,
    },
    appliedTo: {
      total: 3,
      items: tablas('sim_ledger.entries', 'sim_ledger.movements', 'sim_audit.events'),
      truncated: false,
    },
  },
  {
    id: id(2),
    policyType: 'WRITE',
    code: 'SIM-WRITE-DUAL',
    name: `Doble control${SIMULADO}`,
    state: 'ACTIVE',
    version: 1,
    createdAt: '2026-10-03T09:30:00.000Z',
    updatedAt: '2026-10-03T09:30:00.000Z',
    createdByUserId: id(800),
    updatedByUserId: null,
    settings: {
      insertMode: 'WITH_APPROVAL',
      updateMode: 'WITH_APPROVAL',
      deleteMode: 'FORBIDDEN',
      requiresReason: true,
      requiresApproval: true,
      dualControl: true,
      maxBatchSize: null,
    },
    appliedTo: { total: 0, items: [], truncated: false },
  },
  {
    id: id(3),
    policyType: 'RETENTION',
    code: 'SIM-RET-10Y',
    name: `Diez años${SIMULADO}`,
    state: 'ACTIVE',
    version: 2,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z',
    createdByUserId: id(800),
    updatedByUserId: id(801),
    settings: {
      retentionPeriodDays: 3650,
      legalBasis: 'LEGAL_OBLIGATION',
      disposition: 'ARCHIVE',
      jurisdiction: 'BO',
    },
    appliedTo: {
      total: 2,
      items: tablas('sim_clinical.notes', 'sim_clinical.orders'),
      truncated: false,
    },
  },
  {
    id: id(4),
    policyType: 'RETENTION',
    code: 'SIM-RET-NODEADLINE',
    name: `Sin plazo declarado${SIMULADO}`,
    state: 'DRAFT',
    version: 1,
    createdAt: '2026-10-10T08:00:00.000Z',
    updatedAt: '2026-10-10T08:00:00.000Z',
    createdByUserId: null,
    updatedByUserId: null,
    settings: {
      retentionPeriodDays: null,
      legalBasis: null,
      disposition: null,
      jurisdiction: null,
    },
    appliedTo: { total: 0, items: [], truncated: false },
  },
  {
    id: id(5),
    policyType: 'ANONYMIZATION',
    code: 'SIM-ANON-HASH',
    name: null,
    state: null,
    version: 1,
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-09-20T08:00:00.000Z',
    createdByUserId: id(800),
    updatedByUserId: null,
    // Sólo los NOMBRES de los parámetros: jamás sus valores.
    settings: {
      technique: 'HASH',
      description: `Hash irreversible de identificadores${SIMULADO}`,
      parameterKeys: ['algorithm', 'keepLast', 'salt'],
    },
    appliedTo: {
      total: 52,
      items: Array.from({ length: 50 }, (_, i) => ({
        schemaName: 'sim_iam',
        tableName: 'people',
        columnName: `campo_${String(i + 1).padStart(2, '0')}`,
      })),
      truncated: true,
    },
  },
  {
    id: id(6),
    policyType: 'RESIDENCY',
    code: 'SIM-RES-BO',
    name: null,
    state: 'ACTIVE',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdByUserId: id(800),
    updatedByUserId: id(800),
    settings: {
      jurisdiction: 'BO',
      dataClassification: 'SIM-PERSONAL',
      crossBorderTransferBasis: null,
      transferImpactAssessmentRequired: true,
      encryptionKeyRegionLocked: true,
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: null,
    },
    // La API no lista a qué se aplica una residencia.
    appliedTo: { total: 0, items: [], truncated: false },
  },
];

export interface CambioSintetico {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  changedByUserId: string;
  reason: string | null;
  recordedAt: string;
}

export const TABLA_DE: Record<PolicyType, string> = {
  WRITE: 'write_policies',
  RETENTION: 'retention_policies',
  ANONYMIZATION: 'anonymization_rules',
  RESIDENCY: 'data_residency_policies',
};

export const cambio = (
  n: number,
  policy: number,
  action: string,
  recordedAt: string,
  reason: string | null,
): CambioSintetico => ({
  id: id(900 + n),
  targetType: TABLA_DE[POLITICAS.find((p) => p.id === id(policy))!.policyType],
  targetId: id(policy),
  action,
  changedByUserId: id(800),
  reason,
  recordedAt,
});

export const CAMBIOS: readonly CambioSintetico[] = [
  cambio(1, 1, 'CREATED', '2026-09-01T09:00:00.000Z', 'Carga inicial sintética'),
  cambio(2, 1, 'UPDATED', '2026-10-01T14:00:00.000Z', null),
  cambio(3, 3, 'UPDATED', '2026-09-28T10:00:00.000Z', 'Ajuste sintético'),
  cambio(4, 5, 'CREATED', '2026-09-20T08:00:00.000Z', null),
].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
