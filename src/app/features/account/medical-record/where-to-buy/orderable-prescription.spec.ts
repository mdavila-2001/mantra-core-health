import { HttpHeaders } from '@angular/common/http';

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { prescriptionList, type SimulatedPrescription } from '../../../../core/mock/fixtures/clinic';
import { record } from '../../../../core/mock/fixtures/concepts';
import { PACIENTE } from '../../../../core/mock/fixtures/people';
import { registrarClinica } from '../../../../core/mock/handlers/clinical.handlers';
import { MockRouter, type MockMethod, type MockReply } from '../../../../core/mock/mock-router';
import { buscarUsuario, type MockUser } from '../../../../core/mock/mock-session';
import { isOrderableRow, orderablePrescriptionOf } from './orderable-prescription';

/** Una fila del resumen clínico de la receta `enc-a`, con lo mínimo que se mira. */
function row(id: string): MedicationRequest {
  return {
    id,
    medicationConceptId: `concepto-${id}`,
    statusConceptId: 'st-emitida',
    encounterId: 'enc-a',
    createdAt: new Date('2026-03-01T10:30:00.000Z'),
  };
}

const NOW = new Date('2026-10-30T12:00:00.000Z');

/** Los estados de un ítem de receta, con los códigos del catálogo de la API. */
const STATUS_LABELS: ConceptLabels = new Map(
  (
    [
      ['st-emitida', 'MR_ISSUED'],
      ['st-borrador', 'MR_DRAFT'],
      ['st-anulada', 'MR_INVALIDATED'],
      ['st-reemplazada', 'MR_REPLACED'],
      ['st-completada', 'MR_COMPLETED'],
    ] as const
  ).map(([conceptId, code]) => [
    conceptId,
    { conceptId, code, display: code, codeSystemVersionId: 'v1' },
  ]),
);

/** Una fila en un estado, emitida salvo el borrador, y con el vencimiento que se pida. */
function rowIn(id: string, status: string, validTo?: Date): MedicationRequest {
  return {
    ...row(id),
    statusConceptId: status,
    ...(status === 'st-borrador' ? {} : { issuedAt: new Date('2026-03-01T11:00:00.000Z') }),
    ...(validTo === undefined ? {} : { validTo }),
  };
}

/** Lo mismo que aplica la API al crear el pedido (FAR-03): emitida y sin vencer. */
describe('isOrderableRow (FAR-03)', () => {
  it('emitida y sin vencer, o sin vencimiento: se puede pedir', () => {
    expect(isOrderableRow(rowIn('rx', 'st-emitida'), STATUS_LABELS, NOW)).toBe(true);
    expect(
      isOrderableRow(rowIn('rx', 'st-emitida', new Date('2026-11-30T00:00:00.000Z')), STATUS_LABELS, NOW),
    ).toBe(true);
  });

  it.each(['st-borrador', 'st-anulada', 'st-reemplazada', 'st-completada'])(
    '%s no se puede pedir, aunque conserve su `issuedAt`',
    (status) => {
      expect(isOrderableRow(rowIn('rx', status), STATUS_LABELS, NOW)).toBe(false);
    },
  );

  it('vencida no se puede pedir, y el instante exacto de `validTo` ya cuenta como vencida', () => {
    expect(
      isOrderableRow(rowIn('rx', 'st-emitida', new Date('2026-10-01T00:00:00.000Z')), STATUS_LABELS, NOW),
    ).toBe(false);
    expect(isOrderableRow(rowIn('rx', 'st-emitida', NOW), STATUS_LABELS, NOW)).toBe(false);
  });

  it('sin el código del estado en el catálogo, decide `issuedAt`', () => {
    const noLabels: ConceptLabels = new Map();
    expect(isOrderableRow(rowIn('rx', 'st-emitida'), noLabels, NOW)).toBe(true);
    expect(isOrderableRow(rowIn('rx', 'st-borrador'), noLabels, NOW)).toBe(false);
    // La API manda `issuedAt: null` en el borrador; el doble lo fuerza.
    const wireDraft = { ...rowIn('rx', 'st-borrador'), issuedAt: null } as unknown as MedicationRequest;
    expect(isOrderableRow(wireDraft, noLabels, NOW)).toBe(false);
  });
});

describe('orderablePrescriptionOf (FAR-03)', () => {
  const rows = [
    rowIn('rx-renovacion', 'st-borrador'),
    rowIn('rx-anulada', 'st-anulada'),
    rowIn('rx-emitida', 'st-emitida'),
    rowIn('rx-otra-emitida', 'st-emitida'),
  ];

  it('la elegida se puede pedir: viaja ella, con sus hermanas vigentes', () => {
    expect(orderablePrescriptionOf(rows, 'rx-otra-emitida', STATUS_LABELS, NOW)).toEqual({
      rows: [rows[2], rows[3]],
      requestId: 'rx-otra-emitida',
    });
  });

  it('la elegida es el borrador o la anulada: viaja la primera fila vigente de la receta', () => {
    expect(orderablePrescriptionOf(rows, 'rx-renovacion', STATUS_LABELS, NOW).requestId).toBe('rx-emitida');
    expect(orderablePrescriptionOf(rows, 'rx-anulada', STATUS_LABELS, NOW).requestId).toBe('rx-emitida');
  });

  it('ninguna fila vigente: nada que pedir', () => {
    expect(orderablePrescriptionOf(rows.slice(0, 2), 'rx-renovacion', STATUS_LABELS, NOW)).toEqual({
      rows: [],
      requestId: null,
    });
  });
});

/**
 * El backend simulado (`environment.mockBackend`) tiene que hablar los mismos
 * códigos de estado que la API: si inventara los suyos, en modo demo ninguna
 * receta sería pedible y «Dónde comprar» quedaría vacía.
 */
describe('el simulador usa los códigos de estado de la API (FAR-03)', () => {
  /** Las etiquetas por id, desde el mismo catálogo que sirve la terminología simulada. */
  const mockLabels: ConceptLabels = new Map(
    [...record.values()].map((concept) => [
      concept.id,
      { conceptId: concept.id, code: concept.code, display: concept.display, codeSystemVersionId: 'v1' },
    ]),
  );

  /** La fila sembrada, como la deja el cliente clínico (fechas a `Date`, `null` omitido). */
  function asRequest(rx: SimulatedPrescription): MedicationRequest {
    return {
      id: rx.id,
      medicationConceptId: rx.medicationConceptId,
      statusConceptId: rx.statusConceptId,
      createdAt: new Date(rx.createdAt),
      ...(rx.validTo === null ? {} : { validTo: new Date(rx.validTo) }),
      ...(rx.issuedAt === null ? {} : { issuedAt: new Date(rx.issuedAt) }),
      ...(rx.encounterId === undefined ? {} : { encounterId: rx.encounterId }),
    };
  }

  const seededWithStatus = (display: string) =>
    prescriptionList.todos().filter((rx) => mockLabels.get(rx.statusConceptId)?.display === display);

  it('una receta «Vigente» sembrada pasa la regla; una «Completada» no', () => {
    const now = new Date();
    const current = seededWithStatus('Vigente');
    const completed = seededWithStatus('Completada');
    expect(current.length).toBeGreaterThan(0);
    expect(completed.length).toBeGreaterThan(0);

    for (const rx of current) {
      expect(isOrderableRow(asRequest(rx), mockLabels, now)).toBe(true);
    }
    for (const rx of completed) {
      expect(isOrderableRow(asRequest(rx), mockLabels, now)).toBe(false);
    }
  });

  it('una receta continua creada y emitida en el simulador (sin validTo) se puede pedir', () => {
    const router = new MockRouter();
    registrarClinica(router);
    const medica = buscarUsuario('medica')!;
    const call = (method: MockMethod, path: string, body: unknown): MockReply => {
      const match = router.match(method, path);
      if (match === null) throw new Error(`No existe ${method} ${path}`);
      return match.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(),
        body,
        headers: new HttpHeaders(),
        user: medica as MockUser,
      }) as MockReply;
    };

    const created = call('POST', '/clinical/medication-requests', {
      patientProfileId: PACIENTE.id,
      medicationConceptId: 'med-continua',
      indicationText: 'Tratamiento crónico',
    });
    const id = (created.body as { id: string }).id;
    call('POST', `/clinical/medication-requests/${id}/sign`, {});
    call('POST', `/clinical/medication-requests/${id}/issue`, {});

    const issued = prescriptionList.get(id)!;
    const asRead = asRequest(issued);
    expect(asRead.validTo).toBeUndefined();
    expect(isOrderableRow(asRead, mockLabels, new Date())).toBe(true);
  });

  it('el catálogo simulado ya no tiene los códigos propios del simulador', () => {
    for (const code of ['RX-ACTIVE', 'RX-DRAFT', 'RX-COMPLETED', 'RX-CANCELLED']) {
      expect(record.has(code)).toBe(false);
    }
    expect(record.get('MR_ISSUED')?.display).toBe('Vigente');
  });
});
