import { HttpHeaders } from '@angular/common/http';

import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import {
  prescriptionList,
  type SimulatedPrescription,
} from '../../../../core/mock/fixtures/clinic';
import { record } from '../../../../core/mock/fixtures/concepts';
import { PACIENTE } from '../../../../core/mock/fixtures/people';
import { registrarClinica } from '../../../../core/mock/handlers/clinical.handlers';
import { MockRouter, type MockMethod, type MockReply } from '../../../../core/mock/mock-router';
import { buscarUsuario, type MockUser } from '../../../../core/mock/mock-session';
import {
  isOrderableRow,
  orderablePrescriptionOf,
  prescriptionStandingOf,
  prescriptionStateOf,
  standingWithOrders,
} from './orderable-prescription';

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

/** Los estados de un ítem de receta, con los códigos del catálogo persistido de la API. */
const STATUS_LABELS: ConceptLabels = new Map(
  (
    [
      ['st-emitida', 'clinical:MEDICATION_REQUEST_ISSUED'],
      ['st-borrador', 'clinical:MEDICATION_REQUEST_DRAFT'],
      ['st-anulada', 'clinical:MEDICATION_REQUEST_INVALIDATED'],
      ['st-reemplazada', 'clinical:MEDICATION_REQUEST_REPLACED'],
      ['st-completada', 'clinical:MEDICATION_REQUEST_COMPLETED'],
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

/**
 * El cuerpo literal de `GET /terminology/concepts?ids=…&lang=ES` que sirvió la
 * API real para los estados de un ítem de receta. No se arma desde las
 * constantes del front: fue suponer el código lo que escondió que ninguna
 * receta se podía pedir.
 */
const REAL_CATALOG_RESPONSE = JSON.parse(`{"items": [
  {"conceptId": "e21a9c9a-ffd2-5bb4-8e60-beb7a10a8d8c", "code": "clinical:MEDICATION_REQUEST_DRAFT",
   "display": "Medication request draft", "definition": null, "selectable": true,
   "codeSystemVersionId": "ffda3cef-e77a-5002-8709-e79f32e62fb4", "translated": false},
  {"conceptId": "cce628c0-3334-50cb-9176-652c14f6f10c", "code": "clinical:MEDICATION_REQUEST_ISSUED",
   "display": "Medication request issued", "definition": null, "selectable": true,
   "codeSystemVersionId": "ffda3cef-e77a-5002-8709-e79f32e62fb4", "translated": false}
], "count": 2, "limit": 50}`) as {
  items: { conceptId: string; code: string; display: string; codeSystemVersionId: string }[];
};

describe('los estados con el catálogo que sirve la API', () => {
  const labels: ConceptLabels = new Map(
    REAL_CATALOG_RESPONSE.items.map((item) => [item.conceptId, item]),
  );
  const ISSUED_ID = 'cce628c0-3334-50cb-9176-652c14f6f10c';
  const DRAFT_ID = 'e21a9c9a-ffd2-5bb4-8e60-beb7a10a8d8c';

  it('una receta emitida y vigente se puede pedir', () => {
    const issued = { ...rowIn('rx', ISSUED_ID), statusConceptId: ISSUED_ID };
    expect(isOrderableRow(issued, labels, NOW)).toBe(true);
    expect(prescriptionStandingOf([issued], labels, NOW)).toBe('orderable');
  });

  it('un borrador no, aunque traiga fecha de emisión', () => {
    const draft = {
      ...row('rx'),
      statusConceptId: DRAFT_ID,
      issuedAt: new Date('2026-03-01T11:00:00.000Z'),
    };
    expect(isOrderableRow(draft, labels, NOW)).toBe(false);
    expect(prescriptionStandingOf([draft], labels, NOW)).toBe('draft');
  });
});

describe('prescriptionStateOf', () => {
  it.each([
    ['clinical:MEDICATION_REQUEST_DRAFT', 'draft'],
    ['clinical:MEDICATION_REQUEST_ISSUED', 'issued'],
    ['clinical:MEDICATION_REQUEST_INVALIDATED', 'invalidated'],
    ['clinical:MEDICATION_REQUEST_REPLACED', 'replaced'],
    ['clinical:MEDICATION_REQUEST_RENEWED', 'renewed'],
    ['clinical:MEDICATION_REQUEST_ACTIVE', 'active'],
    ['clinical:MEDICATION_REQUEST_COMPLETED', 'completed'],
  ] as const)('%s es %s', (code, state) => {
    expect(prescriptionStateOf(code)).toBe(state);
  });

  it('el código corto del archivo de conceptos no es lo que sirve la API', () => {
    expect(prescriptionStateOf('MR_ISSUED')).toBeUndefined();
    expect(prescriptionStateOf('clinical:MEDICATION_REQUEST_OTRO')).toBeUndefined();
    expect(prescriptionStateOf('clinical:MEDICATION_INTENT_ORDER')).toBeUndefined();
  });
});

describe('prescriptionStandingOf (Mis recetas)', () => {
  const PAST = new Date('2026-10-01T00:00:00.000Z');

  it('basta una fila pedible para que la receta se pueda pedir', () => {
    expect(
      prescriptionStandingOf(
        [rowIn('a', 'st-anulada'), rowIn('b', 'st-emitida')],
        STATUS_LABELS,
        NOW,
      ),
    ).toBe('orderable');
  });

  it.each([
    ['st-borrador', 'draft'],
    ['st-anulada', 'invalidated'],
    ['st-reemplazada', 'replaced'],
    ['st-completada', 'completed'],
  ] as const)('sin filas pedibles, %s se nombra %s', (status, standing) => {
    expect(prescriptionStandingOf([rowIn('a', status)], STATUS_LABELS, NOW)).toBe(standing);
  });

  it('una emitida que venció es «vencida», aunque la acompañe un borrador', () => {
    expect(
      prescriptionStandingOf(
        [rowIn('a', 'st-emitida', PAST), rowIn('b', 'st-borrador')],
        STATUS_LABELS,
        NOW,
      ),
    ).toBe('expired');
  });

  it('sin catálogo, una fila sin emitir es un borrador', () => {
    expect(prescriptionStandingOf([rowIn('a', 'st-borrador')], new Map(), NOW)).toBe('draft');
  });
});

/** Lo mismo que aplica la API al crear el pedido (FAR-03): emitida y sin vencer. */
describe('isOrderableRow (FAR-03)', () => {
  it('emitida y sin vencer, o sin vencimiento: se puede pedir', () => {
    expect(isOrderableRow(rowIn('rx', 'st-emitida'), STATUS_LABELS, NOW)).toBe(true);
    expect(
      isOrderableRow(
        rowIn('rx', 'st-emitida', new Date('2026-11-30T00:00:00.000Z')),
        STATUS_LABELS,
        NOW,
      ),
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
      isOrderableRow(
        rowIn('rx', 'st-emitida', new Date('2026-10-01T00:00:00.000Z')),
        STATUS_LABELS,
        NOW,
      ),
    ).toBe(false);
    expect(isOrderableRow(rowIn('rx', 'st-emitida', NOW), STATUS_LABELS, NOW)).toBe(false);
  });

  it('sin el código del estado en el catálogo, decide `issuedAt`', () => {
    const noLabels: ConceptLabels = new Map();
    expect(isOrderableRow(rowIn('rx', 'st-emitida'), noLabels, NOW)).toBe(true);
    expect(isOrderableRow(rowIn('rx', 'st-borrador'), noLabels, NOW)).toBe(false);
    // La API manda `issuedAt: null` en el borrador; el doble lo fuerza.
    const wireDraft = {
      ...rowIn('rx', 'st-borrador'),
      issuedAt: null,
    } as unknown as MedicationRequest;
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
    expect(orderablePrescriptionOf(rows, 'rx-renovacion', STATUS_LABELS, NOW).requestId).toBe(
      'rx-emitida',
    );
    expect(orderablePrescriptionOf(rows, 'rx-anulada', STATUS_LABELS, NOW).requestId).toBe(
      'rx-emitida',
    );
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
      {
        conceptId: concept.id,
        code: concept.code,
        display: concept.display,
        codeSystemVersionId: 'v1',
      },
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
    prescriptionList
      .todos()
      .filter((rx) => mockLabels.get(rx.statusConceptId)?.display === display);

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
    expect(record.get('clinical:MEDICATION_REQUEST_ISSUED')?.display).toBe('Vigente');
  });
});

describe('standingWithOrders (una receta no se repite)', () => {
  const rows = [rowIn('a', 'st-emitida'), rowIn('b', 'st-emitida')];

  it('un pedido vivo de cualquier ítem de la receta la deja «con pedido»', () => {
    expect(standingWithOrders('orderable', rows, [{ requestId: 'b', estado: 'ACEPTADO' }])).toBe(
      'ordered',
    );
  });

  it('retirada, sin pedido vivo', () => {
    expect(standingWithOrders('orderable', rows, [{ requestId: 'a', estado: 'RETIRADO' }])).toBe(
      'collected',
    );
  });

  it('cancelar, rechazar o vencer el pedido la libera; otro ítem u otra receta no cuentan', () => {
    expect(
      standingWithOrders('orderable', rows, [
        { requestId: 'a', estado: 'CANCELADO' },
        { requestId: 'b', estado: 'RECHAZADO' },
        { requestId: 'otra', estado: 'ENVIADO' },
        { requestId: null, estado: 'ENVIADO' },
      ]),
    ).toBe('orderable');
  });

  it('una receta que ya no está vigente conserva su estado', () => {
    expect(standingWithOrders('expired', rows, [{ requestId: 'a', estado: 'ENVIADO' }])).toBe(
      'expired',
    );
  });
});
