import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState, readOpsError } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import { BLOCK_KIND_LABEL, BLOCK_REASON_LABEL, shortDateTime } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  AvailabilityAction,
  AvailabilityRequest,
  AvailabilityResult,
  BedBoardCell,
  BlockKind,
  BlockReason,
  FutureCommitment,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { OpsIssueAlert } from '../ops-issue-alert/ops-issue-alert';

export type BlockMode = 'clinical' | 'administrative' | 'maintenance' | 'closure';

const KIND_OF: Readonly<Record<BlockMode, BlockKind>> = {
  clinical: 'BLOCK_CLINICAL',
  administrative: 'BLOCK_ADMIN',
  maintenance: 'BLOCK_MAINTENANCE',
  closure: 'BLOCK_CLOSURE',
};

const ACTION_OF: Readonly<Record<BlockMode, AvailabilityAction>> = {
  clinical: 'block',
  administrative: 'block',
  maintenance: 'start-maintenance',
  closure: 'close',
};

const TITLE_OF: Readonly<Record<BlockMode, string>> = {
  clinical: 'Bloqueo clínico',
  administrative: 'Bloqueo administrativo',
  maintenance: 'Poner en mantenimiento',
  closure: 'Cerrar el espacio',
};

/** Los motivos si el catálogo de la API todavía no los trajo. */
const FALLBACK_REASONS: readonly BlockReason[] = Object.keys(BLOCK_REASON_LABEL).map((code) => ({
  code,
  kinds: ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE'],
}));

const COMMITMENT_KIND: Readonly<Record<FutureCommitment['kind'], string>> = {
  PROCEDURE_CASE: 'Cirugía',
  APPOINTMENT: 'Cita',
  BOOKING: 'Reserva',
};

/**
 * **Bloquear, poner en mantenimiento o cerrar** una cama o un local (F2.3
 * `POST /care-spaces/:id/availability`).
 *
 * Todo bloqueo lleva **motivo**; el mantenimiento además una **fecha estimada
 * de fin**; el motivo «Otro» una explicación. El diálogo marca lo obligatorio
 * pero no lo impide: la API es la autoridad y su rechazo (S4) se muestra bajo el
 * campo que corresponde, sin cerrar el diálogo ni perder lo escrito.
 *
 * Si la ventana pisa compromisos futuros —cirugías, citas, reservas— la API
 * responde 409 `FUTURE_COMMITMENTS_CONFLICT` con cada uno y su próxima acción;
 * el diálogo los lista y recién entonces ofrece «Bloquear de todos modos»
 * (`acknowledgeConflicts`). Nunca se aplica en silencio.
 */
@Component({
  selector: 'app-block-dialog',
  imports: [Alert, AppButton, ContentDialog, DatePicker, FormField, OpsIssueAlert, Select, Switch, Textarea],
  templateUrl: './block-dialog.html',
  styleUrl: './block-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockDialog {
  readonly cell = input.required<BedBoardCell>();
  readonly mode = input.required<BlockMode>();
  readonly reasons = input<readonly BlockReason[]>([]);

  readonly saved = output<AvailabilityResult>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureOpsClient);

  protected readonly reasonCode = signal('');
  protected readonly reasonText = signal('');
  protected readonly expectedEnd = signal<Date | null>(null);
  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);
  protected readonly conflicts = signal<readonly FutureCommitment[]>([]);
  protected readonly acknowledged = signal(false);

  protected readonly title = computed(() => TITLE_OF[this.mode()]);
  protected readonly minDate = new Date();
  protected readonly maxDate = new Date(Date.now() + 5 * 365 * 86_400_000);
  protected readonly commitmentKind = COMMITMENT_KIND;
  protected readonly shortDateTime = shortDateTime;

  protected readonly needsEnd = computed(() => this.mode() === 'maintenance');
  protected readonly reasonOptions = computed<readonly SelectOption<string>[]>(() => {
    const kind = KIND_OF[this.mode()];
    const source = this.reasons().length > 0 ? this.reasons() : FALLBACK_REASONS;
    return source
      .filter((r) => r.kinds.includes(kind))
      .map((r) => ({ value: r.code, label: r.display ?? BLOCK_REASON_LABEL[r.code] ?? r.code }));
  });
  protected readonly kindLabel = computed(() => BLOCK_KIND_LABEL[KIND_OF[this.mode()]]);

  /** El rechazo de la API anclado a un campo, por el `code` del problema. */
  protected fieldError(code: string): string {
    const s = this.serverState();
    return s !== null && s.status === 'validation' ? (s.issues.find((i) => i.code === code)?.message ?? '') : '';
  }

  /** Lo que no está anclado a un campo del formulario se muestra arriba. */
  protected readonly generalState = computed<ViewState<unknown> | null>(() => {
    const s = this.serverState();
    if (s === null) return null;
    if (s.status !== 'validation') return s;
    const rest = s.issues.filter((i) => !['reasonCode', 'reasonText', 'expectedEndAt'].includes(i.code ?? ''));
    return rest.length === 0 ? null : { ...s, issues: rest };
  });

  protected submit(): void {
    if (this.pending()) return;
    const cell = this.cell();
    const text = this.reasonText().trim();
    const end = this.expectedEnd();
    const body: AvailabilityRequest = {
      action: ACTION_OF[this.mode()],
      kindCode: KIND_OF[this.mode()],
      reasonCode: this.reasonCode(),
      ...(text === '' ? {} : { reasonText: text }),
      ...(end === null ? {} : { expectedEndAt: end.toISOString() }),
      ...(this.acknowledged() ? { acknowledgeConflicts: true } : {}),
    };
    this.pending.set(true);
    this.serverState.set(null);
    this.client.changeAvailability(cell.id, cell.opsVersion, body).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.saved.emit(result);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        const detail = readOpsError(error);
        if (detail?.reason === 'FUTURE_COMMITMENTS_CONFLICT') {
          this.conflicts.set(detail.conflicts);
          this.serverState.set(null);
          return;
        }
        this.serverState.set(opsErrorToViewState<unknown>(error));
      },
    });
  }
}
