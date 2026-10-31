import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import type {
  HandoverPreview,
  OffboardResult,
  SuspensionReasonCode,
  SuspensionResult,
} from '../../../../../core/data-access/access-governance/access-lifecycle.types';
import { TeamAdminClient } from '../../../../../core/data-access/access-governance/team-admin.client';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { formatDateTime } from '../../../../support-access/support-labels';
import { AccessChallengeService } from '../../../access-challenge/access-challenge.service';
import {
  EMPTY_HANDOVER_DRAFT,
  handoverIssues,
  toHandover,
  type HandoverDraft,
} from '../../../lifecycle/handover-form/handover-draft';
import { HandoverForm } from '../../../lifecycle/handover-form/handover-form';
import { SUSPENSION_REASON_OPTIONS } from '../../../lifecycle/lifecycle.labels';
import {
  recipientOptions,
  type Person,
  type PersonOption,
} from '../../../lifecycle/lifecycle.people';
import { canDo, type TeamAbilities } from '../../team-ceiling';
import { explainTeamFailure, type TeamFailure } from '../../team-failure';

const MIN_REASON = 5;

/**
 * **Vínculo y baja de una persona de mi equipo** (CONTRATO-GOBIERNO §6.4): recertificar, suspender (inmediato), pedir la
 * reactivación (cuatro ojos) y dar de baja con traspaso. Suspender y dar de baja afectan a **toda** la persona: si tiene
 * funciones fuera de lo que usted administra, la API responde `ADMIN_SCOPE_EXCEEDED` y se explica qué sí puede hacer.
 *
 * Cada botón es la mutación; el padre recarga a la persona al terminar (`changed`) y la pantalla muestra lo guardado.
 */
@Component({
  selector: 'app-member-account',
  imports: [Alert, AppButton, FormField, HandoverForm, RouterLink, Select, Textarea],
  templateUrl: './member-account.html',
  styleUrl: './member-account.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberAccount implements OnInit {
  private readonly team = inject(TeamAdminClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly session = inject(SessionStore);

  readonly engagementId = input.required<string>();
  readonly memberName = input.required<string>();
  readonly status = input.required<string>();
  readonly otherFunctions = input(0);
  readonly abilities = input.required<TeamAbilities>();
  readonly people = input<readonly Person[]>([]);
  readonly userId = input('');

  /** `offboarded`: la persona salió del equipo, así que ya no se puede volver a leer desde acá. */
  readonly changed = output<'updated' | 'offboarded'>();

  protected readonly busy = signal<string | null>(null);
  protected readonly failure = signal<TeamFailure | null>(null);
  protected readonly notice = signal('');

  protected readonly suspendCode = signal<string | null>('MANUAL');
  protected readonly suspendNote = signal('');
  protected readonly reactivateReason = signal('');
  protected readonly reactivateAttempted = signal(false);
  protected readonly reactivated = signal<SuspensionResult | null>(null);

  protected readonly preview = signal<HandoverPreview | null>(null);
  protected readonly previewFailed = signal(false);
  protected readonly draft = signal<HandoverDraft>(EMPTY_HANDOVER_DRAFT);
  protected readonly offboardReason = signal('');
  protected readonly offboardAttempted = signal(false);
  protected readonly offboarded = signal<OffboardResult | null>(null);

  protected readonly suspensionOptions: readonly SelectOption<string>[] =
    SUSPENSION_REASON_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      description: o.description,
    }));

  private readonly me = computed<Person | null>(() => {
    const id = this.session.userId();
    return id === null ? null : { userId: id, name: this.session.displayName() ?? 'usted' };
  });

  protected readonly options = computed<readonly PersonOption[]>(() =>
    recipientOptions(this.people(), this.userId() === '' ? undefined : this.userId(), this.me()),
  );
  protected readonly can = (atom: string): boolean => canDo(this.abilities(), atom);
  protected readonly isActive = computed(() => this.status() === 'ACTIVE');
  protected readonly isSuspended = computed(() => this.status() === 'SUSPENDED');
  protected readonly isEnded = computed(() => this.status() === 'ENDED');
  protected readonly issues = computed(() => {
    const p = this.preview();
    return p === null ? [] : handoverIssues(this.draft(), p);
  });
  protected readonly reactivateError = computed(() =>
    this.reactivateAttempted() && this.reactivateReason().trim().length < MIN_REASON
      ? `Escriba al menos ${MIN_REASON} caracteres.`
      : '',
  );
  protected readonly offboardError = computed(() =>
    this.offboardAttempted() && this.offboardReason().trim().length < MIN_REASON
      ? `Escriba al menos ${MIN_REASON} caracteres: queda en el registro.`
      : '',
  );
  protected readonly dateTime = formatDateTime;

  ngOnInit(): void {
    if (this.can('team.handover.execute') && !this.isEnded()) this.loadPreview();
  }

  private loadPreview(): void {
    this.team
      .handoverPreview(this.engagementId())
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        this.preview.set(p);
        this.previewFailed.set(p === null);
      });
  }

  private run<T>(
    key: string,
    label: string,
    call: () => import('rxjs').Observable<T>,
    done: (value: T) => void,
    outcome: 'updated' | 'offboarded' = 'updated',
  ): void {
    if (this.busy() !== null) return;
    this.busy.set(key);
    this.failure.set(null);
    this.notice.set('');
    this.challenges.run(call, { actionLabel: label }).subscribe({
      next: (value) => {
        this.busy.set(null);
        done(value);
        this.changed.emit(outcome);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.failure.set(explainTeamFailure(error));
      },
    });
  }

  protected recertify(): void {
    this.run(
      'recertify',
      `Confirmar el vínculo de ${this.memberName()}`,
      () => this.team.recertify(this.engagementId()),
      () =>
        this.notice.set(
          `Listo: confirmó que ${this.memberName()} sigue trabajando aquí. Su próxima revisión quedó programada.`,
        ),
    );
  }

  protected suspend(): void {
    const code = this.suspendCode();
    if (code === null) return;
    const request = {
      reasonCode: code as SuspensionReasonCode,
      ...(this.suspendNote().trim() === '' ? {} : { note: this.suspendNote().trim() }),
    };
    this.run(
      'suspend',
      `Suspender a ${this.memberName()}`,
      () => this.team.suspend(this.engagementId(), request),
      () => {
        this.notice.set(
          `${this.memberName()} quedó suspendida o suspendido: su acceso se cortó ahora. Sus permisos quedan guardados.`,
        );
        this.suspendNote.set('');
      },
    );
  }

  protected reactivate(): void {
    this.reactivateAttempted.set(true);
    if (this.reactivateReason().trim().length < MIN_REASON) return;
    const request = { reason: this.reactivateReason().trim() };
    this.run(
      'reactivate',
      `Reactivar a ${this.memberName()}`,
      () => this.team.reactivate(this.engagementId(), request),
      (result) => {
        this.reactivated.set(result);
        this.reactivateReason.set('');
        this.reactivateAttempted.set(false);
      },
    );
  }

  protected offboard(withHandover: boolean): void {
    this.offboardAttempted.set(true);
    const p = this.preview();
    if (this.offboardReason().trim().length < MIN_REASON) return;
    if (withHandover && this.issues().length > 0) return;
    const request = {
      reason: this.offboardReason().trim(),
      handover: withHandover && p !== null ? toHandover(this.draft(), p) : null,
    };
    this.run(
      'offboard',
      `Dar de baja a ${this.memberName()}`,
      () => this.team.offboard(this.engagementId(), request),
      (result) => this.offboarded.set(result),
      'offboarded',
    );
  }
}
