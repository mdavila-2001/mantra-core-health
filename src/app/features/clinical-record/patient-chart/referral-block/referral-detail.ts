import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import {
  motivoDeDerivacion,
  type MotivoDeDerivacion,
} from '../../../../core/data-access/referrals/referrals.errors';
import {
  REFERRAL_LIMITS,
  REFERRAL_TYPES_WITH_CONSENT,
  type Referral,
} from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { encuentroParaConsentir } from '../informed-consent/encuentro-para-consentir';
import { InformedConsentPanel } from '../informed-consent/informed-consent-panel';
import { destinoDe, estadoDe, etiquetaDeTipo, vencida } from './referral-labels';

/**
 * **Una derivación, entera**: lo que se pidió, su estado, el consentimiento
 * dirigido a ella y lo que el destino puede hacer (responder, contrarreferir).
 *
 * Vive dentro de un `app-content-dialog`: es el detalle de una fila, y las
 * acciones que piden datos van en modal (composition-rules §6).
 *
 * ## Las acciones se ofrecen por estado, la API decide por rol
 *
 * «Aceptar» y «Rechazar» se ofrecen sobre una pendiente; «Registrar
 * contrarreferencia», sobre una aceptada (o pendiente, si el destino es
 * externo); «Cancelar derivación», sobre una pendiente o aceptada. Quién puede hacerlo —el destino o su
 * organización— lo decide el servidor: si no corresponde, su 403 se muestra
 * acá tal cual. Ocultar el botón no sería seguridad; ofrecerlo a quien no
 * puede escribir en la historia sí sería una puerta cerrada, y por eso
 * `puedeEscribir` lo baja.
 */
@Component({
  selector: 'app-referral-detail',
  imports: [Alert, AppButton, Badge, DatePipe, InformedConsentPanel],
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
  readonly citas = input<readonly CitaDelPaciente[]>([]);
  readonly puedeEscribir = input(false);
  /** Recién emitida: el detalle se abre para ofrecer el consentimiento. */
  readonly recienEmitida = input(false);

  /** Hubo una respuesta o una contrarreferencia: hay que releer. */
  readonly cambio = output<void>();
  readonly consentChanged = output<InformedConsent | null>();

  /**
   * La atención del consentimiento: la de origen de la derivación, la del
   * contexto, o la que elige `encuentroParaConsentir` entre las citas (igual
   * que los demás bloques). Sin ninguna, el panel lo dice y no deja registrar.
   */
  protected readonly encuentroDelConsentimiento = computed(() =>
    encuentroParaConsentir(this.referral().sourceEncounterId, this.encounterId(), this.citas()),
  );

  protected readonly tipo = computed(() => etiquetaDeTipo(this.referral().referralType));
  protected readonly destino = computed(() => destinoDe(this.referral()));
  protected readonly estado = computed(() => estadoDe(this.referral()));
  protected readonly vencida = computed(() => vencida(this.referral()));

  /** Si el tipo admite el consentimiento dirigido y la derivación sigue viva. */
  protected readonly ofreceConsentimiento = computed(() => {
    const r = this.referral();
    return (
      r.referralType !== undefined &&
      REFERRAL_TYPES_WITH_CONSENT.has(r.referralType) &&
      r.status !== 'REJECTED' &&
      r.status !== 'CANCELLED'
    );
  });

  protected readonly etiquetaParaConsentir = computed(() => {
    const r = this.referral();
    return `Derivación · ${this.tipo()}: ${r.requestedServiceText ?? 'servicio sin detallar'} → ${this.destino()}`;
  });

  /** Lo que el panel prellena: lo que la derivación ya dice. */
  protected readonly defaultsDelConsentimiento = computed(() => {
    const r = this.referral();
    return {
      ...(r.diagnosisText === undefined ? {} : { diagnosisText: r.diagnosisText }),
      purposeText: `Derivación (${this.tipo().toLowerCase()}) a ${this.destino()} para: ${r.requestedServiceText ?? ''}`.trim(),
    };
  });

  /**
   * Quien emitió la derivación no la responde ni la contrarrefiere: eso es
   * del destino. Es sólo no ofrecer una puerta de más; la API vuelve a decidir.
   */
  private readonly laEmitiYo = computed(() => {
    const propio = this.auth.practitionerProfileId();
    return propio !== null && this.referral().referringProfileId === propio;
  });

  /** Destino sólo externo: nadie en la plataforma la responde. */
  private readonly soloExterno = computed(() => {
    const r = this.referral();
    return (
      r.targetExternalName !== undefined &&
      r.targetProfileId === undefined &&
      r.targetTenantId === undefined &&
      r.targetBranchId === undefined
    );
  });

  protected readonly puedeResponder = computed(
    () =>
      this.puedeEscribir() &&
      !this.soloExterno() &&
      !this.laEmitiYo() &&
      this.referral().status === 'PENDING',
  );

  /**
   * La contrarreferencia la registra el destino sobre una aceptada. Si el
   * destino es externo, la transcribe quien escribe la historia —también sobre
   * una pendiente—: es la regla de la API.
   */
  protected readonly puedeContrarreferir = computed(() => {
    const estado = this.referral().status;
    if (!this.puedeEscribir()) return false;
    return this.soloExterno()
      ? estado === 'PENDING' || estado === 'ACCEPTED'
      : !this.laEmitiYo() && estado === 'ACCEPTED';
  });

  /** Se anula una pendiente o aceptada; la API exige escritura sobre la historia. */
  protected readonly puedeAnular = computed(() => {
    const estado = this.referral().status;
    return this.puedeEscribir() && (estado === 'PENDING' || estado === 'ACCEPTED');
  });

  protected readonly trabajando = signal(false);
  protected readonly escritura = signal<ViewState<null>>(ready(null));
  private readonly motivo = signal<MotivoDeDerivacion | null>(null);
  protected readonly errorDeLaAccion = computed(() =>
    this.motivo()?.mensaje ??
    mensajeDeEscritura(this.escritura(), {
      accion: 'actualizar la derivación',
      sinPermiso: 'Sólo el destino de la derivación o su organización puede responderla o contrarreferirla.',
    }),
  );

  protected async aceptar(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Aceptar derivación',
      message: `Quedará registrado que ${this.destino()} recibe a la persona para: ${this.referral().requestedServiceText ?? 'el servicio pedido'}.`,
      confirmLabel: 'Aceptar derivación',
      cancelLabel: 'Volver',
    });
    if (confirmado) {
      this.escribir(
        this.referrals.respond(this.referral().id, { decision: 'ACCEPT' }),
        'Derivación aceptada',
        'Cuando termine la atención, registrá la contrarreferencia.',
      );
    }
  }

  protected async rechazar(): Promise<void> {
    const motivo = await this.dialogs.confirmWithReason(
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
    if (motivo !== null) {
      this.escribir(
        this.referrals.respond(this.referral().id, { decision: 'REJECT', rejectReason: motivo }),
        'Derivación rechazada',
        'Quien derivó ya puede ver el motivo.',
      );
    }
  }

  protected async contrarreferir(): Promise<void> {
    const texto = await this.dialogs.confirmWithReason(
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
    if (texto !== null) {
      this.escribir(
        this.referrals.counterReferral(this.referral().id, texto),
        'Contrarreferencia registrada',
        'Quien derivó la ve en esta misma pestaña.',
      );
    }
  }

  protected async anular(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Cancelar derivación',
      message: `La derivación a ${this.destino()} queda anulada y el destino ya no debería recibirla. No se puede deshacer.`,
      confirmLabel: 'Cancelar derivación',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (confirmado) {
      this.escribir(
        this.referrals.cancel(this.referral().id),
        'Derivación cancelada',
        'Si la persona todavía necesita el servicio, emití una nueva.',
      );
    }
  }

  private escribir(
    peticion: ReturnType<ReferralsClient['respond']>,
    titulo: string,
    proximoPaso: string,
  ): void {
    this.trabajando.set(true);
    this.motivo.set(null);
    this.escritura.set(ready(null));
    peticion.subscribe({
      next: () => {
        this.trabajando.set(false);
        this.toasts.success(proximoPaso, titulo);
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.trabajando.set(false);
        this.motivo.set(motivoDeDerivacion(error));
        this.escritura.set(errorToViewState<null>(error));
      },
    });
  }
}
