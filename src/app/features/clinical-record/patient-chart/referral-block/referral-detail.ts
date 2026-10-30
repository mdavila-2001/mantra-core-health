import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import {
  referralErrorDetail,
  type ReferralErrorDetail,
} from '../../../../core/data-access/referrals/referrals.errors';
import { REFERRAL_LIMITS, type Referral } from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { writeMessage } from '../../write-message';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { consentEncounter } from '../informed-consent/consent-encounter';
import { InformedConsentPanel } from '../informed-consent/informed-consent-panel';
import {
  destinationOf,
  isExpired,
  offersConsent,
  referralStatusOf,
  referralTypeLabel,
} from './referral-block.model';

/**
 * **Una derivación, entera**: lo que se pidió, su estado, el consentimiento
 * dirigido a ella y lo que el destino puede hacer (responder, contrarreferir)
 * o quien escribe la historia (anular).
 *
 * Vive dentro de un `app-content-dialog`: es el detalle de una fila, y las
 * acciones que piden datos van en modal (composition-rules §6).
 *
 * ## Las acciones se ofrecen por estado, la API decide por rol
 *
 * «Aceptar» y «Rechazar» se ofrecen sobre una pendiente; «Registrar
 * contrarreferencia», sobre una aceptada (o pendiente, si el destino es
 * externo); «Anular», sobre una pendiente o aceptada. Quién puede hacerlo lo
 * decide el servidor: quien no es destino recibe 404 `REFERRAL_NOT_FOUND` y
 * se muestra acá en palabras. Ocultar el botón no sería seguridad; ofrecerlo
 * a quien no puede escribir en la historia sí sería una puerta cerrada, y por
 * eso `canWrite` lo baja.
 */
@Component({
  selector: 'app-referral-detail',
  imports: [Alert, AppButton, DatePipe, InformedConsentPanel, StatusSeal],
  templateUrl: './referral-detail.html',
  styleUrl: './referral-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralDetail {
  private readonly referrals = inject(ReferralsClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly referral = input.required<Referral>();
  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  /** Las citas de la persona: el consentimiento se ata a una atención. */
  readonly appointments = input<readonly CitaDelPaciente[]>([]);
  readonly canWrite = input(true);
  /** Recién emitida: el detalle se abre para ofrecer el consentimiento. */
  readonly justIssued = input(false);

  /** Hubo una respuesta, una contrarreferencia o una anulación: hay que releer. */
  readonly changed = output<Referral>();
  readonly consentChanged = output<InformedConsent | null>();

  /**
   * La atención del consentimiento: la de origen de la derivación, si no la
   * abierta del contexto, si no la cita en curso. Sin ninguna, el panel
   * muestra el S3 «Falta la atención» y no deja registrar.
   */
  protected readonly consentEncounterId = computed(() =>
    consentEncounter(this.referral().sourceEncounterId, this.encounterId(), this.appointments()),
  );

  protected readonly type = computed(() => referralTypeLabel(this.referral().referralType));
  protected readonly destination = computed(() => destinationOf(this.referral()));
  protected readonly status = computed(() => referralStatusOf(this.referral()));
  protected readonly expired = computed(() => isExpired(this.referral()));
  protected readonly offersConsent = computed(() => offersConsent(this.referral()));

  protected readonly consentLabel = computed(() => {
    const r = this.referral();
    const service = r.targetServiceName ?? r.requestedServiceText ?? 'servicio sin detallar';
    return `Derivación · ${this.type()}: ${service} → ${this.destination()}`;
  });

  /** Lo que el panel prellena: lo que la derivación ya dice. */
  protected readonly consentDefaults = computed(() => {
    const r = this.referral();
    const service = r.targetServiceName ?? r.requestedServiceText ?? '';
    return {
      ...(r.diagnosisText === undefined ? {} : { diagnosisText: r.diagnosisText }),
      purposeText: `Derivación (${this.type().toLowerCase()}) a ${this.destination()} para: ${service}`.trim(),
    };
  });

  /**
   * Quien emitió la derivación no la responde ni la contrarrefiere: eso es
   * del destino. Es sólo no ofrecer una puerta de más; la API vuelve a decidir.
   */
  private readonly issuedByMe = computed(() => {
    const own = this.auth.practitionerProfileId();
    return own !== null && this.referral().referringProfileId === own;
  });

  /** Destino sólo externo: nadie en la plataforma la responde. */
  private readonly externalOnly = computed(() => {
    const r = this.referral();
    return (
      r.targetExternalName !== undefined &&
      r.targetProfileId === undefined &&
      r.targetTenantId === undefined &&
      r.targetBranchId === undefined
    );
  });

  protected readonly canRespond = computed(
    () => this.canWrite() && !this.externalOnly() && !this.issuedByMe() && this.referral().status === 'PENDING',
  );

  /**
   * La contrarreferencia la registra el destino sobre una aceptada. Si el
   * destino es externo, la transcribe quien escribe la historia —también sobre
   * una pendiente—: es la regla de la API.
   */
  protected readonly canCounterRefer = computed(() => {
    const status = this.referral().status;
    if (!this.canWrite()) return false;
    return this.externalOnly()
      ? status === 'PENDING' || status === 'ACCEPTED'
      : !this.issuedByMe() && status === 'ACCEPTED';
  });

  /** Se anula una pendiente o aceptada; la API exige escritura sobre la historia. */
  protected readonly canCancel = computed(() => {
    const status = this.referral().status;
    return this.canWrite() && (status === 'PENDING' || status === 'ACCEPTED');
  });

  protected readonly working = signal(false);
  protected readonly write = signal<ViewState<null>>(ready(null));
  private readonly reason = signal<ReferralErrorDetail | null>(null);
  protected readonly actionError = computed(
    () =>
      this.reason()?.message ??
      writeMessage(this.write(), {
        accion: 'actualizar la derivación',
        sinPermiso: 'Sólo el destino de la derivación o su organización puede responderla o contrarreferirla.',
      }),
  );

  protected async accept(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'Aceptar derivación',
      message: `Quedará registrado que ${this.destination()} recibe a la persona para: ${this.referral().requestedServiceText ?? this.referral().targetServiceName ?? 'el servicio pedido'}.`,
      confirmLabel: 'Aceptar derivación',
      cancelLabel: 'Volver',
    });
    if (confirmed) {
      this.run(
        this.referrals.respond(this.referral().id, { decision: 'ACCEPT' }),
        'Derivación aceptada',
        'Cuando termine la atención, registre la contrarreferencia.',
      );
    }
  }

  protected async reject(): Promise<void> {
    const reason = await this.dialogs.confirmWithReason(
      {
        title: 'Rechazar derivación',
        message: 'Quien derivó va a ver el motivo para buscar otro destino.',
        confirmLabel: 'Registrar rechazo',
        cancelLabel: 'Volver',
        destructive: true,
      },
      {
        label: 'Motivo del rechazo',
        placeholder: 'Ej.: Sin cupo de fisioterapia hasta diciembre',
        hint: 'Obligatorio. Concreto: qué impide recibirla.',
        minLength: 3,
        maxLength: REFERRAL_LIMITS.rejectReason,
      },
    );
    if (reason !== null) {
      this.run(
        this.referrals.respond(this.referral().id, { decision: 'REJECT', rejectReason: reason }),
        'Derivación rechazada',
        'Quien derivó ya puede ver el motivo.',
      );
    }
  }

  protected async counterRefer(): Promise<void> {
    const text = await this.dialogs.confirmWithReason(
      {
        title: 'Registrar contrarreferencia',
        message: 'Lo que se hizo y lo que se indica al volver con quien derivó.',
        confirmLabel: 'Registrar contrarreferencia',
        cancelLabel: 'Volver',
      },
      {
        label: 'Contrarreferencia',
        placeholder: 'Ej.: 10 sesiones completas. Alta con ejercicios domiciliarios. Control en 3 meses.',
        hint: 'Obligatoria por la norma de referencia: diagnóstico final, tratamiento y recomendaciones.',
        minLength: 10,
        maxLength: REFERRAL_LIMITS.counterReferralText,
      },
    );
    if (text !== null) {
      this.run(
        this.referrals.counterReferral(this.referral().id, text),
        'Contrarreferencia registrada',
        'Quien derivó la ve en esta misma lista.',
      );
    }
  }

  protected async cancel(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'Anular derivación',
      message: `La derivación a ${this.destination()} queda anulada y el destino ya no debería recibirla. No se puede deshacer.`,
      confirmLabel: 'Anular derivación',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (confirmed) {
      this.run(
        this.referrals.cancel(this.referral().id),
        'Derivación anulada',
        'Si la persona todavía necesita el servicio, emita una nueva.',
      );
    }
  }

  private run(request: Observable<Referral>, title: string, nextStep: string): void {
    this.working.set(true);
    this.reason.set(null);
    this.write.set(ready(null));
    request.subscribe({
      next: (updated) => {
        this.working.set(false);
        this.toasts.success(nextStep, title);
        this.changed.emit(updated);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.reason.set(referralErrorDetail(error));
        this.write.set(errorToViewState<null>(error));
      },
    });
  }
}
