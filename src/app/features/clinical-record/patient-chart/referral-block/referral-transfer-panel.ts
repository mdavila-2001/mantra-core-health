import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ARRIVAL_CONDITIONS,
  arrivalIssues,
  TRANSFER_LIMITS,
  transferIssues,
  type ArrivalCondition,
  type TransferField,
} from '../../../../core/data-access/referrals/referral-transfer.types';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import { referralErrorDetail } from '../../../../core/data-access/referrals/referrals.errors';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { writeMessage } from '../../write-message';
import { ReferralTransferForm } from './referral-transfer-form';
import {
  ARRIVAL_CONDITION_LIST,
  CONDITION_LABELS,
  draftFromTransfer,
  joinParts,
  TRANSPORT_MODE_LABELS,
  transferFromDraft,
  vitalsLine,
  type TransferDraft,
} from './referral-transfer.model';

type Mode = 'view' | 'transfer' | 'arrival';

/**
 * **Traslado** en el detalle de una derivación: lo registrado (salida,
 * signos vitales, acompañante, aviso al receptor y llegada) y las dos
 * acciones que lo completan.
 *
 * - «Completar traslado» (`PATCH /referrals/:id/transfer`) se ofrece a quien
 *   emitió la derivación, pendiente o aceptada y sin llegada registrada.
 * - «Registrar llegada» (`PATCH /referrals/:id/arrival`) se ofrece al destino
 *   —o a quien escribe la historia si el destino es sólo externo— cuando el
 *   paciente se traslada y todavía no llegó.
 *
 * Se **ofrecen**; la API decide. Quien no es destino recibe 404
 * `REFERRAL_NOT_FOUND` y se dice en palabras. Los formularios van dentro del
 * mismo modal del detalle, no en uno encima de otro.
 */
@Component({
  selector: 'app-referral-transfer-panel',
  imports: [Alert, AppButton, DatePicker, DatePipe, FormField, Radio, RadioGroup, ReferralTransferForm, Textarea],
  templateUrl: './referral-transfer-panel.html',
  styleUrl: './referral-transfer-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralTransferPanel {
  private readonly referrals = inject(ReferralsClient);
  private readonly toasts = inject(ToastService);

  readonly referral = input.required<Referral>();
  readonly canWrite = input(true);
  /** Quien mira la emitió: puede completar la salida. */
  readonly issuedByMe = input(false);
  /** Destino sólo externo: la llegada la registra quien escribe la historia. */
  readonly externalOnly = input(false);

  /** La API devolvió la derivación actualizada: hay que releer. */
  readonly changed = output<Referral>();

  protected readonly modeLabels = TRANSPORT_MODE_LABELS;
  protected readonly conditionLabels = CONDITION_LABELS;
  protected readonly arrivalConditions = ARRIVAL_CONDITION_LIST;
  protected readonly notesMax = TRANSFER_LIMITS.arrivalNotes;

  protected readonly transfer = computed(() => this.referral().transfer);
  protected readonly vitals = computed(() => vitalsLine(this.transfer()?.vitals));
  protected readonly escort = computed(() =>
    joinParts(this.transfer()?.escortProfessionalName, this.transfer()?.escortProfessionalRole),
  );
  protected readonly companion = computed(() =>
    joinParts(this.transfer()?.companionName, this.transfer()?.companionRelationship, this.transfer()?.companionPhone),
  );

  private readonly open = computed(() => {
    const status = this.referral().status;
    return (status === 'PENDING' || status === 'ACCEPTED') && this.transfer()?.arrivedAt === undefined;
  });

  protected readonly canCompleteTransfer = computed(() => this.canWrite() && this.issuedByMe() && this.open());

  /** La API admite la llegada también en una completada: la contrarreferencia puede anotarse antes. */
  protected readonly canRecordArrival = computed(() => {
    const status = this.referral().status;
    return (
      this.canWrite() &&
      (this.externalOnly() || !this.issuedByMe()) &&
      (status === 'PENDING' || status === 'ACCEPTED' || status === 'COMPLETED') &&
      this.transfer()?.arrivedAt === undefined &&
      this.transfer()?.required === true
    );
  });

  protected readonly mode = signal<Mode>('view');
  protected readonly attempted = signal(false);
  protected readonly working = signal(false);

  /* -- Completar traslado --------------------------------------------------- */

  protected readonly draft = signal<TransferDraft>(draftFromTransfer(undefined));
  protected readonly transferProblems = computed(() =>
    transferIssues(transferFromDraft(this.draft())),
  );

  /* -- Registrar llegada ---------------------------------------------------- */

  protected readonly arrivedAt = signal<Date | null>(null);
  protected readonly arrivalCondition = signal<ArrivalCondition | null>(null);
  protected readonly arrivalNotes = signal('');
  protected readonly arrivalProblems = computed(() => {
    const arrivedAt = this.arrivedAt();
    const arrivalCondition = this.arrivalCondition();
    return arrivalIssues(
      {
        ...(arrivedAt === null ? {} : { arrivedAt }),
        ...(arrivalCondition === null ? {} : { arrivalCondition }),
        arrivalNotes: this.arrivalNotes(),
      },
      this.transfer()?.departedAt,
    );
  });

  protected arrivalError(field: TransferField): string {
    if (!this.attempted()) return '';
    return this.arrivalProblems().find((p) => p.field === field)?.message ?? '';
  }

  /* -- Errores del servidor ------------------------------------------------- */

  private readonly write = signal<ViewState<null>>(ready(null));
  private readonly reason = signal<string | null>(null);
  protected readonly serverError = computed(
    () =>
      this.reason() ??
      writeMessage(this.write(), {
        accion: this.mode() === 'arrival' ? 'registrar la llegada' : 'guardar el traslado',
        sinPermiso: 'Sólo el destino de la derivación registra la llegada; la salida, quien la emitió.',
      }),
  );

  protected startTransfer(): void {
    this.draft.set(draftFromTransfer(this.transfer()));
    this.begin('transfer');
  }

  protected startArrival(): void {
    this.arrivedAt.set(new Date());
    this.arrivalCondition.set(null);
    this.arrivalNotes.set('');
    this.begin('arrival');
  }

  protected chooseArrivalCondition(value: unknown): void {
    if ((ARRIVAL_CONDITIONS as readonly unknown[]).includes(value)) {
      this.arrivalCondition.set(value as ArrivalCondition);
    }
  }

  protected back(): void {
    this.mode.set('view');
    this.clearErrors();
  }

  protected saveTransfer(): void {
    this.attempted.set(true);
    if (this.transferProblems().length > 0) return;
    this.run(
      this.referrals.updateTransfer(this.referral().id, transferFromDraft(this.draft())),
      'Traslado guardado',
      'Cuando el paciente llegue, el destino registra la llegada.',
    );
  }

  protected saveArrival(): void {
    this.attempted.set(true);
    const arrivedAt = this.arrivedAt();
    const condition = this.arrivalCondition();
    if (this.arrivalProblems().length > 0 || arrivedAt === null || condition === null) return;
    this.run(
      this.referrals.recordArrival(this.referral().id, {
        arrivedAt,
        arrivalCondition: condition,
        arrivalNotes: this.arrivalNotes(),
      }),
      'Llegada registrada',
      'Cuando termine la atención, registre la contrarreferencia.',
    );
  }

  private begin(mode: Mode): void {
    this.clearErrors();
    this.attempted.set(false);
    this.mode.set(mode);
  }

  private clearErrors(): void {
    this.reason.set(null);
    this.write.set(ready(null));
  }

  private run(request: Observable<Referral>, title: string, nextStep: string): void {
    this.working.set(true);
    this.clearErrors();
    request.subscribe({
      next: (updated) => {
        this.working.set(false);
        this.mode.set('view');
        this.toasts.success(nextStep, title);
        this.changed.emit(updated);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.reason.set(referralErrorDetail(error)?.message ?? null);
        this.write.set(errorToViewState<null>(error));
      },
    });
  }
}
