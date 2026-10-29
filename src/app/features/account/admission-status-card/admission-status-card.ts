import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdmissionsClient } from '@core/data-access/admissions/admissions.client';
import { ATTESTATION_VERSION, type MyAdmission } from '@core/data-access/admissions/admissions.types';
import { readAdmissionError } from '@shared/admissions/admission-error';
import {
  admissionStatusVariant,
  doctorStatusCopy,
  requirementStatusLabel,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
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
 * > [!note] La insignia azul de «verificado» y el estado «en proceso de
 * > verificación» de la guía y el chat los pinta un átomo compartido que
 * > mantiene otro equipo (`app-verification-badge`). Cuando exista se importa
 * > acá; mientras tanto el estado se dice con texto.
 */
@Component({
  selector: 'app-admission-status-card',
  imports: [Alert, AppButton, Badge, Card, Checkbox, DatePipe, RouterLink, Skeleton],
  templateUrl: './admission-status-card.html',
  styleUrl: './admission-status-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionStatusCard {
  private readonly client = inject(AdmissionsClient);
  private readonly toast = inject(ToastService);

  /** En el panel de inicio, una solicitud ya verificada no ocupa lugar. */
  readonly hideWhenVerified = input(false, { transform: booleanAttribute });

  protected readonly state = signal<CardState>('loading');
  protected readonly admission = signal<MyAdmission | null>(null);
  protected readonly attested = signal(false);
  protected readonly attestationTouched = signal(false);
  protected readonly submitting = signal(false);
  protected readonly resubmitError = signal<string | null>(null);

  protected readonly copy = computed(() => doctorStatusCopy(this.admission()?.status.code ?? ''));
  protected readonly variant = computed(() => admissionStatusVariant(this.admission()?.status.code ?? ''));
  protected readonly visible = computed(() => {
    if (this.state() === 'none') return false;
    return !(this.hideWhenVerified() && this.admission()?.status.code === 'VERIFIED');
  });
  protected readonly isOpen = computed(() => ['SUBMITTED', 'IN_REVIEW'].includes(this.admission()?.status.code ?? ''));
  protected readonly pendingItems = computed(() =>
    (this.admission()?.items ?? []).filter((i) => i.state !== 'VERIFIED'),
  );
  protected readonly canResubmit = computed(() => {
    const a = this.admission();
    return this.copy().canResubmit && (a?.resubmissionsRemaining ?? 1) > 0;
  });
  protected readonly limitReached = computed(
    () => this.copy().canResubmit && this.admission()?.resubmissionsRemaining === 0,
  );
  protected readonly attestationVersion = ATTESTATION_VERSION;
  protected readonly profileRoute = '/my-account';

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
  }

  protected resubmit(): void {
    if (this.submitting()) return;
    this.attestationTouched.set(true);
    if (!this.attested()) return;
    this.submitting.set(true);
    this.resubmitError.set(null);
    this.client.resubmitMyAdmission({ attested: true, attestationVersion: ATTESTATION_VERSION }).subscribe({
      next: (mia) => {
        this.admission.set(mia);
        this.attested.set(false);
        this.attestationTouched.set(false);
        this.submitting.set(false);
        this.toast.success('Reenviamos su solicitud. Le avisaremos cuando haya una decisión.');
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.resubmitError.set(readAdmissionError(error).message);
      },
    });
  }
}
