import { specimenDraftFromInboxItem, type LabInboxItem } from './diagnostics-lab.types';

const ITEM = (extra: Partial<LabInboxItem> = {}): LabInboxItem => ({
  serviceRequestId: 'sr-1',
  patientProfileId: 'p-1',
  patientDisplayName: null,
  patientCode: null,
  codeConceptId: 'c',
  codeDisplay: null,
  categoryConceptId: null,
  priorityConceptId: null,
  statusConceptId: 's',
  requesterProfileId: null,
  requestingTenantId: 't-2',
  requestingTenantName: null,
  requestedAt: new Date('2026-11-06T10:00:00Z'),
  specimens: [],
  ...extra,
});

describe('specimenDraftFromInboxItem: precarga lo que el médico pidió, sin decidir por quien recibe', () => {
  it('correcto: el tipo de muestra pedido llega al espécimen', () => {
    expect(specimenDraftFromInboxItem(ITEM({ specimenTypeConceptId: 'sp-orina' }), 't-1')).toEqual({
      patientProfileId: 'p-1',
      custodianTenantId: 't-1',
      serviceRequestId: 'sr-1',
      specimenTypeConceptId: 'sp-orina',
    });
  });

  it('límite: una orden anterior, sin muestra, no inventa ninguna (queda a elección de quien recibe)', () => {
    const draft = specimenDraftFromInboxItem(ITEM(), 't-1');
    expect('specimenTypeConceptId' in draft).toBe(false);
    expect('bodySiteConceptId' in draft).toBe(false);
  });

  it('una orden de imagen aporta su región, no una muestra', () => {
    const draft = specimenDraftFromInboxItem(ITEM({ bodySiteConceptId: 'reg-mano' }), 't-1');
    expect(draft.bodySiteConceptId).toBe('reg-mano');
    expect('specimenTypeConceptId' in draft).toBe(false);
  });
});
