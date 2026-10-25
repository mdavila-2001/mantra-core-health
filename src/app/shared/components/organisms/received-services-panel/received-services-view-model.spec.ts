import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { ReceivedService, ReceivedServicesPage } from '../../../../core/data-access/received-services/received-services.types';
import { conceptsOf, historyServices, NO_CHARGE, NO_DATA, receivedServiceRows, UNNAMED_SERVICE } from './received-services-view-model';

function service(overrides: Partial<ReceivedService> = {}): ReceivedService {
  return {
    id: 'rs-1',
    type: 'INTERVENTION',
    typeConceptId: 'type-int',
    serviceConceptId: 'svc-1',
    statusConceptId: 'st-1',
    performedAt: new Date('2026-08-12T14:30:00.000Z'),
    cost: null,
    ...overrides,
  };
}

function page(items: ReceivedService[], costsVisible = true): ReceivedServicesPage {
  return { patientProfileId: 'p-1', items, limit: 50, truncated: false, costsVisible };
}

function labels(entries: Record<string, string>): ConceptLabels {
  return new Map(Object.entries(entries).map(([id, display]) => [id, { conceptId: id, code: id, display, codeSystemVersionId: 'v' }]));
}

describe('receivedServiceRows', () => {
  it('traduce cada concepto a su etiqueta y no deja pasar ningún identificador', () => {
    const [row] = receivedServiceRows(
      page([service({ performerName: 'Dra. Ana Rojas', practiceSiteName: 'Clínica Los Olivos', resultText: 'Sin complicaciones' })]),
      labels({ 'svc-1': 'Infiltración articular', 'st-1': 'Realizada' }),
    );
    expect(row).toMatchObject({
      typeLabel: 'Intervención médica',
      title: 'Infiltración articular',
      performer: 'Dra. Ana Rojas',
      site: 'Clínica Los Olivos',
      status: 'Realizada',
      result: 'Sin complicaciones',
    });
    expect(JSON.stringify({ ...row, id: undefined })).not.toMatch(/svc-1|st-1|type-int/);
  });

  it('rotula intervención y vacunación sin preguntarle a terminología', () => {
    const rows = receivedServiceRows(page([service(), service({ id: 'rs-2', type: 'VACCINATION' })]), labels({}));
    expect(rows.map((row) => row.typeLabel)).toEqual(['Intervención médica', 'Vacunación']);
    expect(rows.map((row) => row.typeTone)).toEqual(['primary', 'info']);
  });

  it('un tipo que el cliente no conoce se rotula con su concepto', () => {
    const [row] = receivedServiceRows(page([service({ type: 'OTHER', typeConceptId: 'type-new' })]), labels({ 'type-new': 'Hemodiálisis' }));
    expect(row.typeLabel).toBe('Hemodiálisis');
    expect(row.typeTone).toBe('secondary');
  });

  it('un tipo nuevo sin etiqueta no muestra su id', () => {
    const [row] = receivedServiceRows(page([service({ type: 'OTHER', typeConceptId: 'type-new' })]), labels({}));
    expect(row.typeLabel).toBe('Otro servicio');
  });

  it('sin etiqueta del servicio no se pinta el uuid', () => {
    const [row] = receivedServiceRows(page([service()]), labels({}));
    expect(row.title).toBe(UNNAMED_SERVICE);
    expect(row.status).toBe(NO_DATA);
  });

  it('sin profesional ni sede dice que no están registrados, no los inventa', () => {
    const [row] = receivedServiceRows(page([service()]), labels({}));
    expect(row.performer).toBe(NO_DATA);
    expect(row.site).toBe(NO_DATA);
  });

  it('junta el resultado clasificado y la nota libre', () => {
    const [row] = receivedServiceRows(page([service({ outcomeConceptId: 'out-1', resultText: 'Control en dos semanas' })]), labels({ 'out-1': 'Exitoso' }));
    expect(row.result).toBe('Exitoso · Control en dos semanas');
  });

  it('sin resultado ni nota deja el resultado vacío', () => {
    expect(receivedServiceRows(page([service()]), labels({}))[0].result).toBe('');
  });

  describe('costo', () => {
    it('lo formatea con la moneda visible y el importe exacto', () => {
      const [row] = receivedServiceRows(page([service({ cost: { amount: '350.10', currencyCode: 'BOB', source: 'INVOICE_LINE' } })]), labels({}));
      expect(row.cost).toBe('350.10 Bs');
    });

    it('sin cobro registrado lo dice: no es cero', () => {
      expect(receivedServiceRows(page([service({ cost: null })]), labels({}))[0].cost).toBe(NO_CHARGE);
    });

    it('si quien lee no ve importes, el costo queda vacío y no dice «sin cobro»', () => {
      const [row] = receivedServiceRows(page([service({ cost: null })], false), labels({}));
      expect(row.cost).toBe('');
    });
  });

  it('conserva el orden en que llegó la página', () => {
    const rows = receivedServiceRows(page([service({ id: 'a' }), service({ id: 'b' }), service({ id: 'c' })]), labels({}));
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('conceptsOf', () => {
  it('pide el servicio, el estado y el resultado, sin repetir', () => {
    const ids = conceptsOf([service({ outcomeConceptId: 'out-1' }), service({ id: 'rs-2', serviceConceptId: 'svc-1', outcomeConceptId: 'out-1' })]);
    expect(ids.sort()).toEqual(['out-1', 'st-1', 'svc-1']);
  });

  it('pide el concepto del tipo solo cuando el cliente no lo conoce', () => {
    expect(conceptsOf([service()])).not.toContain('type-int');
    expect(conceptsOf([service({ type: 'OTHER', typeConceptId: 'type-new' })])).toContain('type-new');
  });
});

describe('historyServices', () => {
  it('imprime en el papel lo mismo que dice la pantalla, con la fecha corta', () => {
    const rows = receivedServiceRows(
      page([service({ performerName: 'Dra. Ana Rojas', practiceSiteName: 'Clínica Los Olivos', cost: { amount: '350.00', currencyCode: 'BOB', source: 'INVOICE_LINE' } })]),
      labels({ 'svc-1': 'Infiltración articular', 'st-1': 'Realizada' }),
    );
    const [printed] = historyServices(rows);
    expect(printed).toEqual({
      date: expect.stringMatching(/^\d{2}\/\d{2}\/2026$/),
      title: 'Infiltración articular',
      type: 'Intervención médica',
      performer: 'Dra. Ana Rojas',
      site: 'Clínica Los Olivos',
      status: 'Realizada',
      result: '',
      cost: '350.00 Bs',
    });
  });

  it('conserva el orden y no inventa filas', () => {
    const rows = receivedServiceRows(page([service({ id: 'a' }), service({ id: 'b' })]), labels({}));
    expect(historyServices(rows)).toHaveLength(2);
    expect(historyServices([])).toEqual([]);
  });
});
