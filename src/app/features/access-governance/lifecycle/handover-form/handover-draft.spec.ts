import type { HandoverPreview } from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { countsOf, EMPTY_HANDOVER_DRAFT, handoverIssues, toHandover } from './handover-draft';

const PREVIEW: HandoverPreview = {
  engagementId: 'e-1',
  items: [
    { id: 'c1', kind: 'CONVERSATION' },
    { id: 'c2', kind: 'CONVERSATION' },
    { id: 't1', kind: 'TASK' },
    { id: 'a1', kind: 'PENDING_APPOINTMENT' },
    { id: 'o1', kind: 'SUPERVISED_ACCOUNT' },
  ],
  counts: {},
};

describe('handover-draft', () => {
  it('cuenta por tipo y unifica los nombres de la API (`HANDOVER_*`) con los cortos', () => {
    expect(
      countsOf({
        ...PREVIEW,
        items: [
          { id: 'x', kind: 'HANDOVER_WORKFLOW_TASK' },
          { id: 'y', kind: 'TASK' },
        ],
      }),
    ).toEqual([{ kind: 'TASK', count: 2 }]);
    expect(countsOf(PREVIEW).map((c) => `${c.kind}:${c.count}`)).toEqual([
      'CONVERSATION:2',
      'TASK:1',
      'PENDING_APPOINTMENT:1',
      'SUPERVISED_ACCOUNT:1',
    ]);
  });

  it('exige elegir el nuevo dueño de las cuentas que la persona supervisaba, y en singular o plural', () => {
    expect(handoverIssues(EMPTY_HANDOVER_DRAFT, PREVIEW)).toEqual([
      'Elija quién será responsable de la cuenta que esta persona supervisaba.',
    ]);
    const two = { ...PREVIEW, items: [...PREVIEW.items, { id: 'o2', kind: 'SUPERVISED_ACCOUNT' }] };
    expect(handoverIssues(EMPTY_HANDOVER_DRAFT, two)[0]).toContain('las 2 cuentas');
    expect(handoverIssues({ targets: {}, supervisedTo: 'u-9' }, PREVIEW)).toEqual([]);
    expect(handoverIssues(EMPTY_HANDOVER_DRAFT, { ...PREVIEW, items: [] })).toEqual([]);
  });

  it('si todo el trabajo va a la misma persona viaja como destino por omisión', () => {
    const draft = {
      targets: { CONVERSATION: 'u-2', TASK: 'u-2', PENDING_APPOINTMENT: 'u-2' },
      supervisedTo: 'u-3',
    };
    expect(toHandover(draft, PREVIEW)).toEqual({ defaultToUserId: 'u-2', supervisedTo: 'u-3' });
  });

  it('si los destinos difieren viaja ítem por ítem; lo que vuelve a la bandeja común no lleva destino', () => {
    const draft = { targets: { CONVERSATION: 'u-2', TASK: 'u-4' }, supervisedTo: 'u-3' };
    expect(toHandover(draft, PREVIEW)).toEqual({
      items: [
        { id: 'c1', toUserId: 'u-2' },
        { id: 'c2', toUserId: 'u-2' },
        { id: 't1', toUserId: 'u-4' },
      ],
      supervisedTo: 'u-3',
    });
  });

  it('sin destinos elegidos todo vuelve a la bandeja común: solo viaja el nuevo dueño', () => {
    expect(toHandover({ targets: {}, supervisedTo: 'u-3' }, PREVIEW)).toEqual({
      supervisedTo: 'u-3',
    });
    expect(toHandover(EMPTY_HANDOVER_DRAFT, { ...PREVIEW, items: [] })).toEqual({});
  });
});
