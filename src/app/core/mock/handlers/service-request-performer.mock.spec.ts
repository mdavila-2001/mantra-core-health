import { PERFORMER_MODE } from '../fixtures/performer-concepts';
import { seededProcedureOrdersOf, type ProcedureOrder } from '../fixtures/procedure-orders';
import { PACIENTE } from '../fixtures/people';
import { uuid } from '../mock-store';
import { performerFieldsOfOrder, pickPerformerFields } from './service-request-performer.mock';

const BASE: ProcedureOrder = {
  id: 'o-1',
  patientProfileId: 'p-1',
  codeConceptId: 'c-1',
  categoryConceptId: 'cat-1',
  priorityConceptId: 'pri-1',
  statusConceptId: 'st-1',
  requesterProfileId: 'pr-1',
  reasonText: '',
  createdAt: '2026-10-25T10:00:00.000Z',
};

describe('pickPerformerFields', () => {
  it('se queda con los tres campos del ejecutor', () => {
    expect(
      pickPerformerFields({
        performerSelectionConceptId: 'perf-self',
        performerPractitionerProfileId: 'pr-1',
        suggestedPracticeSiteId: 'site-1',
        codeConceptId: 'c-1',
      }),
    ).toEqual({
      performerSelectionConceptId: 'perf-self',
      performerPractitionerProfileId: 'pr-1',
      suggestedPracticeSiteId: 'site-1',
    });
  });

  it('ignora performerTenantId: sugerir un centro no le da acceso a la orden', () => {
    const resultado = pickPerformerFields({
      performerSelectionConceptId: 'perf-org',
      suggestedPracticeSiteId: 'site-1',
      performerTenantId: 'tenant-1',
    } as Parameters<typeof pickPerformerFields>[0]);

    expect('performerTenantId' in resultado).toBe(false);
  });

  it('sin campos devuelve vacío, sin claves en undefined', () => {
    expect(pickPerformerFields({})).toEqual({});
    expect(Object.keys(pickPerformerFields({ performerSelectionConceptId: undefined }))).toEqual([]);
  });
});

describe('performerFieldsOfOrder', () => {
  it('una orden sin modo no devuelve nada, ni un null inventado', () => {
    expect(performerFieldsOfOrder(BASE)).toEqual({});
  });

  it('con sede sugerida suma su nombre', () => {
    expect(
      performerFieldsOfOrder({
        ...BASE,
        performerSelectionConceptId: PERFORMER_MODE['SR_PERF_ORGANIZATION'],
        suggestedPracticeSiteId: uuid('site-cm-sur-1'),
      }),
    ).toEqual({
      performerSelectionConceptId: PERFORMER_MODE['SR_PERF_ORGANIZATION'],
      suggestedPracticeSiteId: uuid('site-cm-sur-1'),
      suggestedPracticeSiteName: 'Centro Médico Sur — Sede Central',
    });
  });

  it('con el modo del paciente no hay sede ni nombre', () => {
    const campos = performerFieldsOfOrder({
      ...BASE,
      performerSelectionConceptId: PERFORMER_MODE['SR_PERF_PATIENT_CHOICE'],
    });

    expect(campos).toEqual({ performerSelectionConceptId: PERFORMER_MODE['SR_PERF_PATIENT_CHOICE'] });
  });

  it('una sede desconocida da nombre null, nunca el uuid', () => {
    const campos = performerFieldsOfOrder({
      ...BASE,
      performerSelectionConceptId: PERFORMER_MODE['SR_PERF_SELF'],
      performerPractitionerProfileId: 'pr-1',
      suggestedPracticeSiteId: 'site-desconocida',
    });

    expect(campos.suggestedPracticeSiteName).toBeNull();
  });
});

describe('órdenes de procedimiento sembradas', () => {
  it('son dos, de la paciente de ejemplo, con los ids de procedimiento del contrato', () => {
    const sembradas = seededProcedureOrdersOf(PACIENTE.id);

    expect(sembradas.map((o) => o.codeConceptId).sort()).toEqual(
      [uuid('proc-endoscopia-alta'), uuid('proc-colonoscopia')].sort(),
    );
  });

  it('una persona sin órdenes sembradas no recibe ninguna', () => {
    expect(seededProcedureOrdersOf('otra-persona')).toEqual([]);
  });
});
