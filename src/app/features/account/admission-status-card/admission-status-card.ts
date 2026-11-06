import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ATTESTATION_VERSION, type MyAdmission } from '@core/data-access/admissions/admissions.types';
import { OwnAdmissionClient } from '@core/data-access/admissions/own-admission.client';
import { readAdmissionError, type AdmissionError } from '@shared/admissions/admission-error';
import {
  admissionStatusVariant,
  doctorStatusCopy,
  requirementStatusLabel,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { Badge } from '@shared/components/atoms/badge/badge';
import { Checkbox } from '@shared/components/atoms/checkbox/checkbox';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

type CardState = 'loading' | 'none' | 'ready' | 'error';

/**
 * «Estado de su verificación»: lo que el médico ve de su propia solicitud de
 * admisión —en qué paso está, cuándo se espera una respuesta, qué falta y por
 * qué se rechazó— y, cuando corresponde, «Corregir y reenviar».
 *
 * Solo muestra lo que la API le entrega al solicitante: los motivos que el
 * revisor escribió para él. Las notas internas del equipo no llegan.
 *
 * Quien no tiene una solicitud (404) no ve nada: ni tarjeta vacía ni aviso de
 * error, porque no hay nada que decirle. Un fallo de red sí se dice, en chico y
 * con reintento: callar haría creer que no hay solicitud.
 *
 * Except where the screen offers to send one (`allowSubmit`, «Mis
 * verificaciones»): there, no request means the card «Enviar a verificación»,
 * with the same declaration text and version as the resubmission.
 *
 * > [!note] La insignia azul de «verificado» y el estado «en proceso de
 * > verificación» de la guía y el chat los pinta un átomo compartido que
 * > mantiene otro equipo (`app-verification-badge`). Cuando exista se importa
 * > acá; mientras tanto el estado se dice con texto.
 */
@Component({
  selector: 'app-admission-status-card',
  imports: [Alert, AppButton, Badge, Card, Checkbox, DatePipe, NavIcon, RouterLink, Skeleton],
  templateUrl: './admission-status-card.html',
  styleUrl: './admission-status-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionStatusCard {
  private readonly client = inject(OwnAdmissionClient);
  private readonly toast = inject(ToastService);

  /** En el panel de inicio, una solicitud ya verificada no ocupa lugar. */
  readonly hideWhenVerified = input(false, { transform: booleanAttribute });
  /** Without a request (404), offer to send the first one instead of drawing nothing. */
  readonly allowSubmit = input(false, { transform: booleanAttribute });
  /** The API says the profile is no longer pending: the host rereads what it shows. */
  readonly profileChanged = output<void>();

  protected readonly state = signal<CardState>('loading');
  protected readonly admission = signal<MyAdmission | null>(null);
  protected readonly attested = signal(false);
  protected readonly submitting = signal(false);
  protected readonly resubmitError = signal<string | null>(null);

  protected readonly copy = computed(() => doctorStatusCopy(this.admission()?.status.code ?? ''));
  protected readonly variant = computed(() => admissionStatusVariant(this.admission()?.status.code ?? ''));
  protected readonly visible = computed(() => {
    if (this.state() === 'none') return this.allowSubmit();
    return !(this.hideWhenVerified() && this.admission()?.status.code === 'VERIFIED');
  });
  protected readonly isOpen = computed(() => ['SUBMITTED', 'IN_REVIEW'].includes(this.admission()?.status.code ?? ''));
  protected readonly pendingItems = computed(() =>
    (this.admission()?.items ?? []).filter((i) => i.state !== 'VERIFIED'),
  );
  /** La API decide si puede reenviar (estado y tope de reenvíos). */
  protected readonly canResubmit = computed(() => this.admission()?.canResubmit === true);
  /** El estado admitiría un reenvío pero la API lo niega: se llegó al tope. */
  protected readonly limitReached = computed(
    () => this.copy().canResubmit && this.admission()?.canResubmit === false,
  );
  protected readonly canWithdraw = computed(() => this.admission()?.canWithdraw === true);
  protected readonly confirmingWithdraw = signal(false);
  protected readonly attestationVersion = ATTESTATION_VERSION;
  /** The declaration the person marks, the same for the first request and the resubmission. */
  protected readonly attestationText = 'Declaro que los datos y documentos son verídicos.';
  protected readonly profileRoute = '/my-account';

  /** Why the first request did not go, in words; `null` when nothing failed. */
  protected readonly submitError = signal<string | null>(null);
  /** The API did not receive the declaration: the checkbox says so. */
  protected readonly attestationRefused = signal(false);
  /** The profile stopped being pending meanwhile: nothing left to send. */
  protected readonly notPending = signal(false);
  /** The card is «Enviar a verificación»: no request, and still something to send. */
  protected readonly offersSubmit = computed(() => this.state() === 'none' && !this.notPending());

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.client.myAdmission().subscribe({
      next: (mia) => {
        this.admission.set(mia);
        this.state.set('ready');
      },
      error: (error: unknown) => {
        // Sin solicitud no hay nada que decir: no es un error.
        this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'none' : 'error');
      },
    });
  }

  protected itemState(state: string): string {
    return requirementStatusLabel(state);
  }

  protected onAttest(valor: boolean): void {
    this.attested.set(valor);
    if (valor) this.attestationRefused.set(false);
  }

  /** The first request: same attestation and version as the resubmission, never by default. */
  protected submit(): void {
    if (this.submitting() || !this.attested()) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.client.submitMyAdmission({ attested: true, attestationVersion: ATTESTATION_VERSION }).subscribe({
      next: (mine) => {
        this.admission.set(mine);
        this.state.set('ready');
        this.attested.set(false);
        this.submitting.set(false);
        this.toast.success('Enviamos su solicitud. Le avisaremos cuando haya una decisión.');
      },
      error: (error: unknown) => this.submitRefused(readAdmissionError(error)),
    });
  }

  /**
   * Each refusal means something different, told by its `reason` and never by
   * the HTTP status. The ones that say the screen is out of date reread: a
   * request that already exists is shown; a profile no longer pending makes
   * the host reread its summary.
   */
  private submitRefused(error: AdmissionError): void {
    this.submitting.set(false);
    switch (error.reason) {
      case 'ADMISSION_ALREADY_EXISTS':
        // The attestation went with a request that was not created: it does
        // not carry over to whatever the existing one asks for next.
        this.attested.set(false);
        this.toast.info('Ya tenía una solicitud de verificación: le mostramos su estado.');
        this.load();
        return;
      case 'ADMISSION_NOT_PENDING':
        this.notPending.set(true);
        this.profileChanged.emit();
        return;
      case 'ADMISSION_ATTESTATION_REQUIRED':
        this.attested.set(false);
        this.attestationRefused.set(true);
        return;
      case 'ADMISSION_NOT_FOUND':
        this.submitError.set(
          'Su cuenta no tiene un perfil profesional que verificar. Complete su perfil y vuelva a intentarlo.',
        );
        return;
      default:
        this.submitError.set(error.message);
    }
  }

  protected resubmit(): void {
    if (this.submitting()) return;
    // Sin la casilla marcada no sale ninguna petición: la atestación es de la persona.
    if (!this.attested()) return;
    this.submitting.set(true);
    this.resubmitError.set(null);
    this.client.resubmitMyAdmission({ attested: true, attestationVersion: ATTESTATION_VERSION }).subscribe({
      next: (mia) => {
        this.admission.set(mia);
        this.attested.set(false);
        this.submitting.set(false);
        this.toast.success('Reenviamos su solicitud. Le avisaremos cuando haya una decisión.');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.resubmitError.set(readAdmissionError(error).message);
        // Si el tope o el estado cambiaron, se muestra lo vigente.
        this.reload();
      },
    });
  }

  /** Relee la solicitud sin pasar por «cargando»: se usa tras un rechazo de la API. */
  private reload(): void {
    this.client.myAdmission().subscribe({ next: (mia) => this.admission.set(mia), error: () => undefined });
  }

  protected askWithdraw(): void {
    this.confirmingWithdraw.set(true);
  }

  protected keepApplication(): void {
    this.confirmingWithdraw.set(false);
  }

  protected withdraw(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.resubmitError.set(null);
    this.client.withdrawMyAdmission().subscribe({
      next: (mia) => {
        this.admission.set(mia);
        this.confirmingWithdraw.set(false);
        this.submitting.set(false);
        this.toast.success('Retiramos su solicitud.');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.confirmingWithdraw.set(false);
        this.resubmitError.set(readAdmissionError(error).message);
        this.reload();
      },
    });
  }
}
