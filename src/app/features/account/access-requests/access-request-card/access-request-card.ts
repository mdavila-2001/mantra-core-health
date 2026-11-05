import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { AccessRequestItem, CareRelationshipDecision } from '../../../../core/data-access/authz/authz.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { CheckboxGroup } from '../../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { KIND_LABEL, STATUS_LABEL, specialtyName, type InboxRole } from '../access-requests.copy';

/** Nothing chosen yet is a legitimate state: the control starts with no option pressed. */
type Choice = CareRelationshipDecision | '';

const CHOICES: readonly SegmentedOption<Choice>[] = [
  { value: 'ACCEPT', label: 'Aceptar' },
  { value: 'REJECT', label: 'Rechazar' },
];

/** What the reader decided on a received request. */
export interface AccessRequestDecision {
  readonly decision: CareRelationshipDecision;
  readonly specialtyIds: readonly string[];
}

/**
 * One request of the inbox. Presentational: it shows who, what and when, and
 * emits the decision or the revocation; the container calls the API and
 * re-reads the inbox. A pending received request gets the Accept/Reject
 * toggle; a granular one also the specialties to authorize, preloaded with
 * the requested ones (accepting is not all or nothing).
 */
@Component({
  selector: 'app-access-request-card',
  imports: [AppButton, Badge, CheckboxGroup, Chip, DatePipe, FormField, SegmentedControl],
  templateUrl: './access-request-card.html',
  styleUrl: './access-request-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestCard {
  readonly item = input.required<AccessRequestItem>();
  readonly role = input.required<InboxRole>();
  /** Specialty concept id → name; empty while the catalog is not loaded. */
  readonly specialtyNames = input<ReadonlyMap<string, string>>(new Map());
  readonly busy = input(false);

  readonly decided = output<AccessRequestDecision>();
  readonly revoked = output<void>();

  protected readonly choices = CHOICES;
  protected readonly kindLabel = computed(() => KIND_LABEL[this.item().kind]);
  protected readonly status = computed(() => STATUS_LABEL[this.item().status]);
  protected readonly choice = signal<Choice>('');
  private readonly picked = signal<readonly string[] | null>(null);

  protected readonly canDecide = computed(
    () => this.item().status === 'PENDING' && this.item().direction === 'RECEIVED',
  );
  protected readonly canRevoke = computed(() => this.role() === 'patient' && this.item().status === 'ACTIVE');
  protected readonly picksSpecialties = computed(
    () => this.role() === 'patient' && this.item().kind === 'GRANULAR' && this.choice() === 'ACCEPT',
  );
  /** The checked specialties: the requested ones until the reader changes them. */
  protected readonly chosenSpecialties = computed(() => this.picked() ?? this.item().requestedSpecialtyConceptIds);
  protected readonly specialtyOptions = computed(() =>
    this.item().requestedSpecialtyConceptIds.map((id) => ({ value: id, label: this.name(id) })),
  );
  protected readonly noneChosen = computed(() => this.picksSpecialties() && this.chosenSpecialties().length === 0);
  /** Without the catalog the patient cannot read what he authorizes (the container says why). */
  private readonly namesMissing = computed(() => this.picksSpecialties() && this.specialtyNames().size === 0);
  protected readonly canConfirm = computed(
    () => this.choice() !== '' && !this.noneChosen() && !this.namesMissing() && !this.busy(),
  );

  protected names(ids: readonly string[]): string {
    return ids.map((id) => this.name(id)).join(', ');
  }

  protected pick(ids: readonly string[]): void {
    this.picked.set(ids);
  }

  protected confirm(): void {
    const decision = this.choice();
    if (decision === '' || !this.canConfirm()) return;
    this.decided.emit({ decision, specialtyIds: this.picksSpecialties() ? this.chosenSpecialties() : [] });
  }

  private name(id: string): string {
    return specialtyName(this.specialtyNames(), id);
  }
}
