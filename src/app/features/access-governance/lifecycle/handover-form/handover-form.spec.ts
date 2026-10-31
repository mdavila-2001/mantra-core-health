import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { HandoverPreview } from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { chooseSelectOption, selectOptionLabels } from '../../../../../testing/select';
import { EMPTY_HANDOVER_DRAFT, type HandoverDraft } from './handover-draft';
import { HandoverForm } from './handover-form';

const PEOPLE = [
  { value: 'u-lucia', label: 'Lucía Paz' },
  { value: 'u-mario', label: 'Mario Salvatierra' },
];

const PREVIEW: HandoverPreview = {
  engagementId: 'e-1',
  items: [
    { id: 'c1', kind: 'CONVERSATION' },
    { id: 'c2', kind: 'CONVERSATION' },
    { id: 'a1', kind: 'PENDING_APPOINTMENT' },
    { id: 'o1', kind: 'SUPERVISED_ACCOUNT' },
  ],
  counts: {},
};

describe('HandoverForm', () => {
  let fixture: ComponentFixture<HandoverForm>;
  let emitted: HandoverDraft[];
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);

  const abrir = async (
    preview: HandoverPreview,
    draft: HandoverDraft = EMPTY_HANDOVER_DRAFT,
    showIssues = false,
  ): Promise<void> => {
    fixture = TestBed.createComponent(HandoverForm);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('people', PEOPLE);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('showIssues', showIssues);
    emitted = [];
    fixture.componentInstance.draftChange.subscribe((d) => emitted.push(d));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('cuenta lo que tiene en las manos por tipo y explica qué pasa con cada uno', async () => {
    await abrir(PREVIEW);
    expect(byId('handover-count-CONVERSATION')!.textContent).toContain('2 conversaciones');
    expect(byId('handover-row-PENDING_APPOINTMENT')!.textContent).toContain(
      'Las citas se mantienen',
    );
    expect(byId('handover-row-SUPERVISED_ACCOUNT')!.textContent).toContain(
      'Es obligatorio elegir un nuevo dueño',
    );
  });

  it('el trabajo puede volver a la bandeja común o pasar a una persona; el dueño de las cuentas se elige entre las personas', async () => {
    await abrir(PREVIEW);
    expect(await selectOptionLabels(fixture, byId('handover-target-CONVERSATION')!)).toEqual([
      'Devolver a la bandeja común',
      'Lucía Paz',
      'Mario Salvatierra',
    ]);
    expect(await selectOptionLabels(fixture, byId('handover-owner')!)).toEqual([
      'Lucía Paz',
      'Mario Salvatierra',
    ]);
    await chooseSelectOption(fixture, byId('handover-target-CONVERSATION')!, 'Mario Salvatierra');
    expect(emitted.at(-1)).toEqual({ targets: { CONVERSATION: 'u-mario' }, supervisedTo: '' });
    await chooseSelectOption(fixture, byId('handover-owner')!, 'Lucía Paz');
    expect(emitted.at(-1)!.supervisedTo).toBe('u-lucia');
  });

  it('muestra el error del dueño solo después de intentar continuar', async () => {
    await abrir(PREVIEW);
    expect(el().textContent).not.toContain('Elija el nuevo dueño de la cuenta.');
    fixture.destroy();
    await abrir(PREVIEW, EMPTY_HANDOVER_DRAFT, true);
    expect(el().textContent).toContain('Elija el nuevo dueño de la cuenta.');
  });

  it('sin nada que traspasar lo dice y deja continuar', async () => {
    await abrir({ ...PREVIEW, items: [] });
    expect(byId('handover-empty')!.textContent).toContain('No tiene trabajo en las manos');
  });
});
