import type {
  WireAdmissionDetail,
  WireAdmissionPage,
  WireAdmissionSummary,
  WireMyAdmission,
} from '../app/core/data-access/admissions/admissions.types';

/* Fábricas de respuestas de `/admissions` para las pruebas: el cuerpo tal como
   viaja (camelCase, fechas en ISO). Cada prueba cambia solo lo que le importa. */

type Req = NonNullable<WireAdmissionDetail['requirements']>[number];

export function wireRequirement(overrides: Partial<Req> = {}): Req {
  return {
    id: 'req-1',
    code: 'NATIONAL_ID',
    label: 'Cédula de identidad',
    description: null,
    mandatory: true,
    status: 'PENDING',
    documents: [{ fileId: 'f-1', name: 'cedula.png', mimeType: 'image/png', sizeBytes: 2048 }],
    data: [],
    itemRef: null,
    source: null,
    evidenceSha256: 'a'.repeat(64),
    reasonCode: null,
    reasonText: null,
    internalNote: null,
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

export function wireSummary(overrides: Partial<WireAdmissionSummary> = {}): WireAdmissionSummary {
  return {
    id: 'adm-1',
    type: { code: 'ALTA_DE_DOCTOR', label: 'Alta de doctor' },
    status: { code: 'SUBMITTED', label: 'Enviada' },
    practitioner: { id: 'p-1', fullName: 'Valeria Rojas Mendoza', profession: 'Cardióloga', maskedNationalId: '****890' },
    itemsSummary: { licenses: 1, credentials: 1, specialties: 1 },
    requirementsSummary: { total: 3, verified: 1, rejected: 0, pending: 2 },
    submittedAt: '2026-10-26T13:00:00.000Z',
    dueAt: '2026-10-29T13:00:00.000Z',
    overdue: false,
    assignedTo: null,
    rowVersion: 3,
    ...overrides,
  };
}

export function wirePage(items: readonly WireAdmissionSummary[] = [wireSummary()], overrides: Partial<WireAdmissionPage> = {}): WireAdmissionPage {
  return { items, nextCursor: null, counts: { SUBMITTED: items.length }, ...overrides };
}

export function wireDetail(overrides: Partial<WireAdmissionDetail> = {}): WireAdmissionDetail {
  const requirements = overrides.requirements ?? [
    wireRequirement({ id: 'req-1', code: 'NATIONAL_ID', label: 'Cédula de identidad' }),
    wireRequirement({
      id: 'req-2',
      code: 'PROFESSIONAL_LICENSE',
      label: 'Matrícula profesional',
      documents: [{ fileId: 'f-2', name: 'matricula.pdf', mimeType: 'application/pdf', sizeBytes: 18_000 }],
    }),
    wireRequirement({ id: 'req-3', code: 'SEDES_REGISTRATION', label: 'Registro del SEDES', mandatory: false, documents: [] }),
  ];
  return {
    ...wireSummary({ status: { code: 'IN_REVIEW', label: 'En revisión' }, assignedTo: { id: 'u-rev', name: 'Marcelo Dávila' } }),
    practitioner: {
      id: 'p-1',
      fullName: 'Valeria Rojas Mendoza',
      profession: 'Cardióloga',
      maskedNationalId: '****890',
      nationalId: '4567890',
      email: 'valeria@correo.mock',
      phone: '+591 70000000',
      city: 'Santa Cruz',
      registeredAt: '2026-10-26T12:00:00.000Z',
    },
    licenses: [],
    credentials: [],
    specialties: [],
    requirements,
    documents: requirements.flatMap((r) =>
      r.documents.map((d) => ({
        id: `${r.id}:${d.fileId}`,
        requirementCode: r.code,
        fileId: d.fileId,
        name: d.name,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        uploadedAt: '2026-10-26T13:00:00.000Z',
        pages: null,
        reviewState: r.status,
        evidenceSha256: 'b'.repeat(64),
      })),
    ),
    submittedForm: [
      {
        key: 'personal',
        title: 'Datos personales',
        fields: [
          { key: 'name', label: 'Nombres', value: 'Valeria', required: true, requirementCode: 'NATIONAL_ID', kind: 'TEXT' },
          { key: 'birthDate', label: 'Fecha de nacimiento', value: null, required: true, requirementCode: 'NATIONAL_ID', kind: 'TEXT' },
        ],
      },
    ],
    events: [
      {
        id: 'ev-1',
        type: 'SUBMITTED',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        itemType: null,
        itemId: null,
        sourceLabel: null,
        reasonCode: null,
        reasonText: null,
        internalNote: null,
        actor: { id: 'p-1', name: 'Valeria Rojas Mendoza' },
        occurredAt: '2026-10-26T13:00:00.000Z',
      },
    ],
    infoRequestedText: null,
    infoDueAt: null,
    decisionReasonText: null,
    allowedActions: [],
    assignableReviewers: [],
    ...overrides,
  };
}

export function wireMine(overrides: Partial<WireMyAdmission> = {}): WireMyAdmission {
  return {
    id: 'adm-1',
    status: { code: 'SUBMITTED', label: 'Enviada' },
    submittedAt: '2026-10-26T13:00:00.000Z',
    dueAt: '2026-10-29T13:00:00.000Z',
    infoDueAt: null,
    infoRequestedText: null,
    decisionReasonText: null,
    resubmissionsRemaining: 3,
    items: [],
    ...overrides,
  };
}
