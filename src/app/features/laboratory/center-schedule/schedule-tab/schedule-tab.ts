import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import { nombreDelHorarioGeneral, validarHorario } from '../../../../core/data-access/diagnostic-units/center-schedule.rules';
import type { CenterSchedule, CenterScheduleView, ScheduleBlock } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { MODALIDADES, type ModalityCode } from '../../../../core/data-access/diagnostic-units/modalidades';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { modalitiesOf, serverMessage, summaryOf, type CenterModality } from '../center-schedule.logic';
import { ScheduleBlockEditor } from '../schedule-block-editor';

/**
 * «Horarios»: the center's general schedule, which every device without its
 * own hours inherits; a default for modalities that have no devices yet; and
 * exceptions for single studies. The draft survives a device change made in
 * the other tab: it only resets from the server while it is untouched.
 */
@Component({
  selector: 'app-schedule-tab',
  imports: [AppButton, Alert, SegmentedControl, ScheduleBlockEditor],
  templateUrl: './schedule-tab.html',
  styleUrl: './schedule-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTab {
  private readonly client = inject(CenterScheduleClient);

  readonly center = input.required<CenterScheduleView>();
  readonly viewChange = output<CenterScheduleView>();

  protected readonly draft = linkedSignal<CenterSchedule, CenterSchedule>({
    source: () => this.center().schedule,
    computation: (schedule, previous) =>
      previous !== undefined && JSON.stringify(previous.value) !== JSON.stringify(previous.source) ? previous.value : schedule,
  });
  protected readonly saving = signal(false);
  protected readonly published = signal(false);
  protected readonly problems = signal<readonly string[]>([]);

  protected readonly yesNo: readonly SegmentedOption<'si' | 'no'>[] = [
    { value: 'si', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  protected readonly modalities = computed(() => modalitiesOf(this.center()));
  /** Modalities without devices: the only ones a modality schedule still applies to. */
  protected readonly withoutDevices = computed(() => this.modalities().filter((m) => m.devices.length === 0));
  protected readonly generalName = computed(() => nombreDelHorarioGeneral(this.draft()));
  protected readonly summary = computed(() => summaryOf(this.modalities(), this.draft()));
  protected readonly dirty = computed(() => JSON.stringify(this.center().schedule) !== JSON.stringify(this.draft()));

  protected modalityBlock(code: ModalityCode): ScheduleBlock | null {
    return this.draft().modalities.find((m) => m.modalityCode === code)?.schedule ?? null;
  }

  protected exceptionOf(studyCode: string): ScheduleBlock | null {
    return this.draft().studies.find((s) => s.studyCode === studyCode)?.schedule ?? null;
  }

  protected hasException(m: CenterModality): boolean {
    return m.studies.some((s) => this.exceptionOf(s.code) !== null);
  }

  protected setGeneral(block: ScheduleBlock): void {
    this.edit((d) => ({ ...d, general: block }));
  }

  protected toggleModality(code: ModalityCode, value: 'si' | 'no'): void {
    this.edit((d) => {
      const rest = d.modalities.filter((m) => m.modalityCode !== code);
      return { ...d, modalities: value === 'si' ? [...rest, { modalityCode: code, schedule: d.general }] : rest };
    });
  }

  protected setModality(code: ModalityCode, block: ScheduleBlock): void {
    this.edit((d) => ({ ...d, modalities: d.modalities.map((m) => (m.modalityCode === code ? { ...m, schedule: block } : m)) }));
  }

  protected addException(m: CenterModality, studyCode: string): void {
    this.edit((d) => ({ ...d, studies: [...d.studies, { studyCode, schedule: this.modalityBlock(m.code) ?? d.general }] }));
  }

  protected setException(studyCode: string, block: ScheduleBlock): void {
    this.edit((d) => ({ ...d, studies: d.studies.map((s) => (s.studyCode === studyCode ? { ...s, schedule: block } : s)) }));
  }

  protected removeException(studyCode: string): void {
    this.edit((d) => ({ ...d, studies: d.studies.filter((s) => s.studyCode !== studyCode) }));
  }

  protected discard(): void {
    this.draft.set(this.center().schedule);
    this.problems.set([]);
  }

  protected publish(): void {
    const center = this.center();
    const draft = this.draft();
    if (this.saving()) return;
    const local = validarHorario(draft, (where) => this.nameOf(where, center)).map((p) => p.mensaje);
    if (local.length > 0) {
      this.problems.set(local);
      return;
    }
    this.saving.set(true);
    this.client.saveSchedule(center.unitId, draft).subscribe({
      next: (view) => {
        this.saving.set(false);
        this.draft.set(view.schedule);
        this.viewChange.emit(view);
        this.published.set(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.problems.set([serverMessage(error, 'No pudimos guardar los cambios. Pruebe de nuevo en un momento.')]);
      },
    });
  }

  private nameOf(where: string, center: CenterScheduleView): string {
    if (where === 'general') return this.generalName();
    const m = MODALIDADES.find((x) => x.code === where);
    if (m !== undefined) return m.label;
    return center.studies.find((s) => s.code === where)?.name ?? where;
  }

  private edit(change: (d: CenterSchedule) => CenterSchedule): void {
    this.draft.set(change(this.draft()));
    this.published.set(false);
    this.problems.set([]);
  }
}
