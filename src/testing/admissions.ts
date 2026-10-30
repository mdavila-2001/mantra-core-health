import { HttpErrorResponse } from '@angular/common/http';
import type { Provider } from '@angular/core';
import { throwError } from 'rxjs';

import { AdmissionsClient } from '../app/core/data-access/admissions/admissions.client';
import type {
  WireAdmissionDetail,
  WireAdmissionPage,
  WireAdmissionSummary,
  WireDocument,
  WireMyAdmission,
  WireRequirement,
  WireReviewItem,
} from '../app/core/data-access/admissions/admissions.types';

/* Fábricas de respuestas de `/admissions` para las pruebas: el cuerpo tal como
   viaja (camelCase, fechas en ISO, códigos de estado en español). Cada prueba
   cambia solo lo que le importa. */

const HUELLA = 'a'.repeat(64);

export function wireItem(overrides: Partial<WireReviewItem> = {}): WireReviewItem {
  return {
    id: 'rev-1',
    itemId: 'item-1',
    itemType: 'LICENSE',
    label: 'Matrícula MP-2404',
    state: 'PENDING',
    fileId: 'f-1',
    verificationSourceUri: null,
    sourceType: null,
    sourceRef: null,
    sourceConsultedAt: null,
    reasonCode: null,
    reasonText: null,
    internalNote: null,
    reviewedBy: null,
    reviewedAt: null,
    evidenceChanged: false,
    evidenceSha256: HUELLA,
    rowVersion: 2,
    ...overrides,
  };
}

export function wireRequirement(overrides: Partial<WireRequirement> = {}): WireRequirement {
  const items = overrides.items ?? [wireItem()];
  const estado = items.length === 0 ? 'MISSING' : (items[0]?.state ?? 'PENDING');
  return {
    code: 'MATRICULA_MSALUD',
    label: 'Matrícula del Ministerio de Salud Nacional',
    description: null,
    required: true,
    evidenceKind: 'DOCUMENT',
    requiresSource: true,
    professionGroup: null,
    minItems: 1,
    maxItems: 1,
    state: estado,
    satisfied: estado === 'VERIFIED',
    blockedBy: estado === 'VERIFIED' ? null : estado === 'MISSING' ? 'MISSING' : estado,
    items,
    ...overrides,
  };
}

export function wireSummary(overrides: Partial<WireAdmissionSummary> = {}): WireAdmissionSummary {
  return {
    id: 'adm-1',
    type: { code: 'ALTA_DE_DOCTOR', label: 'Alta de doctor' },
    status: { code: 'ENVIADA', label: 'Enviada' },
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
  return { items, nextCursor: null, counts: { ENVIADA: items.length }, ...overrides };
}

export function wireDocument(overrides: Partial<WireDocument> = {}): WireDocument {
  return {
    id: 'rev-1',
    requirementCode: 'MATRICULA_MSALUD',
    fileId: 'f-1',
    name: 'matricula.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 18_000,
    uploadedAt: '2026-10-26T13:00:00.000Z',
    pages: 1,
    reviewState: 'PENDING',
    evidenceSha256: HUELLA,
    ...overrides,
  };
}

export function wireDetail(overrides: Partial<WireAdmissionDetail> = {}): WireAdmissionDetail {
  const requirements = overrides.requirements ?? [
    wireRequirement({
      code: 'CI',
      label: 'Cédula de identidad',
      evidenceKind: 'DATA',
      requiresSource: false,
      items: [wireItem({ id: 'rev-ci', itemId: 'item-ci', itemType: 'PROFILE', label: 'Cédula 4567890', fileId: null, evidenceSha256: 'c'.repeat(64) })],
    }),
    wireRequirement({
      items: [wireItem({ id: 'rev-1', itemId: 'item-1', fileId: 'f-1' })],
    }),
    wireRequirement({
      code: 'REGISTRO_SEDES',
      label: 'Registro del SEDES',
      required: false,
      items: [],
      state: 'NOT_PROVIDED',
      satisfied: true,
      blockedBy: null,
    }),
  ];
  return {
    ...wireSummary({ status: { code: 'EN_REVISION', label: 'En revisión' }, assignedTo: { id: 'u-rev', name: 'Marcelo Dávila' } }),
    practitioner: {
      id: 'p-1',
      fullName: 'Valeria Rojas Mendoza',
      profession: 'Cardióloga',
      maskedNationalId: '****890',
      nationalId: '4567890',
      nationalIdIssuer: 'SC',
      birthDate: '1985-04-12',
      age: 41,
      occupation: 'Médica',
      personalMobile: '+591 70000000',
      personalEmail: 'valeria@correo.mock',
      workMobile: null,
      workPhone: null,
      workEmail: null,
    },
    licenses: [],
    credentials: [],
    specialties: [],
    events: [
      {
        id: 'ev-1',
        type: 'CREATED',
        fromStatus: null,
        toStatus: { code: 'ENVIADA', label: 'Enviada' },
        itemType: null,
        itemId: null,
        requirementCode: null,
        verificationSourceUri: null,
        reasonCode: null,
        reasonText: null,
        actor: { id: 'p-1', name: 'Valeria Rojas Mendoza' },
        actorRole: 'PRACTITIONER',
        occurredAt: '2026-10-26T13:00:00.000Z',
      },
    ],
    infoRequestedText: null,
    infoDueAt: null,
    decisionReasonText: null,
    decisionReasonCode: null,
    internalNote: null,
    validUntil: null,
    resubmissionCount: 0,
    attestedAt: '2026-10-26T13:00:00.000Z',
    fourEyesRequired: true,
    requirements,
    blockers: [{ requirementCode: 'MATRICULA_MSALUD', label: 'Matrícula del Ministerio de Salud Nacional', reason: 'PENDING' }],
    canVerify: false,
    documents: [wireDocument()],
    submittedForm: {
      personal: {
        requirementCode: 'CI',
        firstName: 'Valeria',
        middleName: null,
        paternalLastName: 'Rojas',
        maternalLastName: 'Mendoza',
        nationalId: '4567890',
        nationalIdIssuer: 'SC',
        birthDate: null,
        age: null,
        occupation: 'Médica',
      },
      contact: { personalMobile: '+591 70000000', personalEmail: 'valeria@correo.mock', workMobile: null, workPhone: null, workEmail: null },
      addresses: { home: { lines: 'Av. Banzer 123', locality: 'Santa Cruz', department: 'Santa Cruz', gps: { lat: -17.78, lng: -63.18 } }, work: null },
      licenses: [{ id: 'item-1', requirementCode: 'MATRICULA_MSALUD', number: 'MP-2404', jurisdiction: 'Bolivia', authority: 'Ministerio de Salud y Deportes', validFrom: null, validTo: null, fileId: 'f-1' }],
      education: [],
      specialties: [],
      practices: [],
    },
    submittedFormSource: 'SNAPSHOT',
    ...overrides,
  };
}

export function wireMine(overrides: Partial<WireMyAdmission> = {}): WireMyAdmission {
  return {
    id: 'adm-1',
    status: { code: 'ENVIADA', label: 'Enviada' },
    submittedAt: '2026-10-26T13:00:00.000Z',
    dueAt: '2026-10-29T13:00:00.000Z',
    infoRequestedText: null,
    infoDueAt: null,
    decisionReasonText: null,
    validUntil: null,
    items: [],
    resubmissionCount: 0,
    canResubmit: false,
    canWithdraw: true,
    ...overrides,
  };
}

/**
 * Para las pruebas de una pantalla que monta la tarjeta «Estado de su
 * verificación» sin ser la pantalla de la tarjeta: la persona no tiene solicitud
 * (404), así que la tarjeta no se dibuja y la prueba no ve ninguna petición de
 * más. La tarjeta tiene su propia spec.
 */
export function sinSolicitudDeAdmision(): Provider {
  return {
    provide: AdmissionsClient,
    useValue: {
      myAdmission: () => throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    },
  };
}
