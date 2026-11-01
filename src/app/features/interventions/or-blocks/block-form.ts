import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import type { OperatingRoomSummary, OrBlockOwnerKind } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import type { OrganizationStaffMember } from '../../../core/data-access/medical-organization/medical-organization.types';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { CheckboxGroup } from '../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { localDay, shiftDay, toIso } from '../interventions.presentation';

const OWNER_KINDS: readonly SegmentedOption<OrBlockOwnerKind>[] = [
  { value: 'SERVICE', label: 'Servicio' },
  { value: 'SURGEON', label: 'Cirujano' },
];

const REPEAT: readonly SegmentedOption<'once' | 'weekly'>[] = [
  { value: 'once', label: 'Una vez' },
  { value: 'weekly', label: 'Cada semana' },
];

const WEEKDAYS = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '7', label: 'Domingo' },
];

/**
 * **Asignar un bloque** (o una serie semanal) — `POST /sites/:siteId/or-blocks`.
 *
 * Los campos caben en una página de la tarjeta: dueño (servicio o cirujano),
 * sala, horario, plazo de liberación (72 h por defecto, el de
 * `infra.or_block_release_hours`) y recurrencia. La API valida el solape con
 * otros bloques (409 `OR_BLOCK_OVERLAP`), el pasado y el dueño (422). La
 * especialidad viaja como concepto (`specialtyConceptId`, `CreateOrBlocksDto`).
 */
@Component({
  selector: 'app-block-form',
  imports: [AppButton, CheckboxGroup, FormField, Input, SegmentedControl, Select, ViewStateHost],
  templateUrl: './block-form.html',
  styleUrl: './or-blocks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockForm {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly specialtiesCatalog = inject(MedicalSpecialtiesCatalog);

  readonly siteId = input.required<string>();
  readonly rooms = input.required<readonly OperatingRoomSummary[]>();
  readonly staff = input.required<readonly OrganizationStaffMember[]>();
  readonly created = output<void>();

  protected readonly ownerKinds = OWNER_KINDS;
  protected readonly repeatOptions = REPEAT;
  protected readonly weekdayOptions = WEEKDAYS;

  protected readonly roomId = signal<string | null>(null);
  protected readonly ownerKind = signal<OrBlockOwnerKind>('SERVICE');
  protected readonly specialtyConceptId = signal<string | null>(null);
  protected readonly surgeonId = signal<string | null>(null);
  protected readonly day = signal(shiftDay(localDay(new Date()), 7));
  protected readonly from = signal('08:00');
  protected readonly to = signal('14:00');
  protected readonly releaseHours = signal(72);
  protected readonly repeat = signal<'once' | 'weekly'>('once');
  protected readonly weekdays = signal<readonly string[]>([]);
  protected readonly until = signal(shiftDay(localDay(new Date()), 35));
  protected readonly specialties = signal<readonly SelectOption<string>[]>([]);

  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly roomOptions = computed<readonly SelectOption<string>[]>(() => this.rooms().map((r) => ({ value: r.careSpace.id, label: `${r.careSpace.code} · ${r.careSpace.name}` })));
  protected readonly surgeonOptions = computed<readonly SelectOption<string>[]>(() =>
    this.staff().map((s) => ({ value: s.practitionerProfileId, label: s.practitionerName ?? 'Profesional sin nombre' })),
  );

  protected readonly valid = computed(
    () =>
      this.roomId() !== null &&
      (this.ownerKind() === 'SERVICE' ? this.specialtyConceptId() !== null : this.surgeonId() !== null) &&
      this.from() < this.to() &&
      Number(this.releaseHours()) >= 0 &&
      (this.repeat() === 'once' || (this.weekdays().length > 0 && this.until() >= this.day())),
  );

  constructor() {
    this.specialtiesCatalog.listar().subscribe({
      next: (list) => this.specialties.set(list.filter((s) => s.selectable !== false).map((s) => ({ value: s.conceptId, label: s.display }))),
      error: () => this.specialties.set([]),
    });
  }

  protected submit(): void {
    const room = this.roomId();
    if (!this.valid() || room === null || this.sending()) return;
    this.sending.set(true);
    this.failure.set(null);
    const service = this.ownerKind() === 'SERVICE';
    this.operatingRooms
      .createBlock(this.siteId(), {
        operatingRoomId: room,
        ownerKind: this.ownerKind(),
        ...(service ? { specialtyConceptId: this.specialtyConceptId()! } : { surgeonProfileId: this.surgeonId()! }),
        startsAt: toIso(this.day(), this.from()),
        endsAt: toIso(this.day(), this.to()),
        releaseHours: Number(this.releaseHours()),
        ...(this.repeat() === 'weekly' ? { recurrence: { weekdays: this.weekdays().map(Number), until: this.until() } } : {}),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.created.emit();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.failure.set(errorToViewState<never>(error));
        },
      });
  }
}
