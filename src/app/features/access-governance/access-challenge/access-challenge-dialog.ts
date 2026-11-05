import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { APPROVAL_HEADER, type AccessChallenge, type AccessChallengeOptions, type ChallengeAnswer } from '../../../core/access-challenge/access-challenge';
import { SessionStore } from '../../../core/auth/session.store';
import { accessFailureOf, accessErrorText } from '../../../core/data-access/access-governance/access-errors';
import { AccessApprovalsClient } from '../../../core/data-access/access-governance/access-approvals.client';
import type { SupportApproval } from '../../../core/data-access/access-governance/access-reviews.types';
import { StepUpClient } from '../../../core/data-access/access-governance/step-up.client';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/** Cada cuánto se pregunta si la aprobación ya se decidió. */
export const APPROVAL_POLL_MS = 8000;

/** Adónde se manda a quien aún no activó la verificación en dos pasos. */
export const MFA_ENROLLMENT_ROUTE = '/my-account/security/mfa';

const APPROVER_TEXT: Readonly<Record<string, string>> = {
  DOCTOR: 'el doctor',
  SECOND_APPROVER: 'un segundo administrador',
  SERVICE_HEAD: 'la jefatura del servicio',
};

const MIN_CODE = 6;
const MAX_CODE = 8;

/**
 * **Diálogo de desafío de acceso** (CONTRATO-GOBIERNO §9.5): un solo flujo para lo que la API pide antes de dejar hacer algo.
 *
 * - *Motivo*: campo con el mínimo de caracteres y ejemplos de motivos buenos.
 * - *Segundo paso*: código de 6 dígitos de su aplicación; si aún no activó el factor, lo lleva a activarlo.
 * - *Aprobación*: «Pedir aprobación a …»; muestra «Pendiente / Aprobada, vale N minutos / Rechazada: motivo» y, al aprobarse,
 *   devuelve el `approvalId` para reintentar la acción con `X-Approval-Id`.
 * - *Sin salida*: explica y cierra (paso extra no disponible, demasiados intentos, registro no disponible).
 *
 * Nunca revela el motivo técnico de una negación: usa el mensaje genérico y ofrece «¿Por qué no puedo?». Quien lo abre es
 * `AccessChallengeService`; las pantallas no lo declaran en su plantilla.
 */
@Component({
  selector: 'app-access-challenge-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, RouterLink, Textarea],
  templateUrl: './access-challenge-dialog.html',
  styleUrl: './access-challenge-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessChallengeDialog implements OnInit {
  private readonly stepUp = inject(StepUpClient);
  private readonly approvals = inject(AccessApprovalsClient);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly challenge = input.required<AccessChallenge>();
  readonly options = input<AccessChallengeOptions>({});
  readonly answered = output<ChallengeAnswer>();
  readonly cancelled = output<void>();

  protected readonly mfaRoute = MFA_ENROLLMENT_ROUTE;
  protected readonly approvalHeader = APPROVAL_HEADER;
  protected readonly texto = signal('');
  protected readonly codigo = signal('');
  protected readonly intento = signal(false);
  protected readonly trabajando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Terminal: la persona no puede reintentar desde acá. */
  protected readonly sinSalida = signal<string | null>(null);
  protected readonly aprobacion = signal<SupportApproval | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;
  private resuelto = false;

  protected readonly titulo = computed(() => {
    const c = this.challenge();
    switch (c.kind) {
      case 'REASON':
        return 'Indique el motivo';
      case 'STEP_UP':
        return 'Confirme su identidad';
      case 'APPROVAL':
        return c.stale ? 'Pida una aprobación nueva' : 'Esta acción necesita una aprobación';
      case 'BLOCKED':
        return 'No pudimos continuar';
    }
  });

  protected readonly bajada = computed(() => this.options().actionLabel ?? 'Para continuar, la organización le pide un paso más.');

  protected readonly minimo = computed(() => {
    const c = this.challenge();
    return c.kind === 'REASON' ? c.minLength : 5;
  });

  /** El desafío visto como cada tipo, para la plantilla (que no estrecha tipos dentro de `@switch`). */
  protected readonly challengeAsReason = computed(() => {
    const c = this.challenge();
    return c.kind === 'REASON' ? c : null;
  });
  protected readonly challengeAsApproval = computed(() => {
    const c = this.challenge();
    return c.kind === 'APPROVAL' ? c : null;
  });

  protected readonly motivoCorto = computed(() => this.texto().trim().length < this.minimo());
  protected readonly codigoValido = computed(() => /^\d+$/.test(this.codigo()) && this.codigo().length >= MIN_CODE && this.codigo().length <= MAX_CODE);

  protected readonly aprobador = computed(() => {
    const c = this.challenge();
    return c.kind === 'APPROVAL' && c.approverKind !== null ? (APPROVER_TEXT[c.approverKind] ?? 'otra persona autorizada') : 'otra persona autorizada';
  });

  protected readonly vigencia = computed(() => {
    const c = this.challenge();
    return c.kind === 'APPROVAL' && c.ttlMinutes !== null ? c.ttlMinutes : 60;
  });

  protected readonly estadoAprobacion = computed(() => {
    const a = this.aprobacion();
    if (a === null) return null;
    switch (a.status) {
      case 'PENDING':
        return { tone: 'info' as const, titulo: 'Pendiente', texto: `Esperando la decisión de ${this.aprobador()}. Puede cerrar esta ventana: la aprobación queda registrada.` };
      case 'APPROVED':
        return { tone: 'success' as const, titulo: 'Aprobada', texto: `Aprobada: vale ${this.vigencia()} minutos. Reintentando la acción.` };
      case 'REJECTED':
        return { tone: 'error' as const, titulo: 'Rechazada', texto: a.decisionComment === undefined ? 'Rechazada.' : `Rechazada: ${a.decisionComment}` };
      default:
        return { tone: 'warning' as const, titulo: 'Ya no está vigente', texto: 'La solicitud caducó o se canceló. Pida una nueva.' };
    }
  });

  ngOnInit(): void {
    const c = this.challenge();
    if (c.kind === 'BLOCKED') this.sinSalida.set(accessErrorText(c.reason) ?? 'No se puede continuar ahora.');
    if (c.kind === 'STEP_UP' && !c.enrolled) this.sinSalida.set('Para esta acción necesita la verificación en dos pasos y aún no la activó.');
    this.destroyRef.onDestroy(() => this.detenerSondeo());
  }

  protected cambiarTexto(valor: string): void {
    this.texto.set(valor);
  }

  protected cambiarCodigo(valor: string | number | null): void {
    this.codigo.set(String(valor ?? '').replace(/\s+/g, ''));
  }

  /** Motivo: lo devuelve tal cual (recortado). */
  protected confirmarMotivo(): void {
    this.intento.set(true);
    if (this.motivoCorto()) return;
    this.responder({ reasonText: this.texto().trim() });
  }

  /** Segundo paso: verifica el código y sella la sesión; el reintento no lleva nada nuevo. */
  protected verificarCodigo(): void {
    this.intento.set(true);
    if (!this.codigoValido() || this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set(null);
    this.stepUp.verify(this.codigo()).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.responder({ stepUpVerified: true });
      },
      error: (e: unknown) => {
        this.trabajando.set(false);
        const fallo = accessFailureOf(e);
        const terminal = fallo?.reason === 'STEP_UP_ATTEMPTS_EXCEEDED' || fallo?.reason === 'STEP_UP_UNAVAILABLE' || fallo?.reason === 'MFA_NOT_ENROLLED' || fallo?.status === 429 || fallo?.status === 503;
        if (terminal) this.sinSalida.set(fallo?.message ?? 'No pudimos verificar el código.');
        else this.error.set(fallo?.message ?? 'No pudimos verificar el código. Intente de nuevo.');
      },
    });
  }

  /** Aprobación: crea la solicitud de **esta** acción y empieza a mirar su estado. */
  protected pedirAprobacion(): void {
    this.intento.set(true);
    if (this.motivoCorto() || this.trabajando()) return;
    const c = this.challenge();
    const target = this.options().approval ?? {};
    const atom = target.atom ?? (c.kind === 'APPROVAL' ? (c.atom ?? undefined) : undefined);
    const tenantId = target.tenantId ?? this.session.activeTenantId() ?? undefined;
    if (atom === undefined || tenantId === undefined) {
      this.error.set('No sabemos de qué acción pedir la aprobación. Vuelva a intentar desde la pantalla.');
      return;
    }
    this.trabajando.set(true);
    this.error.set(null);
    this.approvals
      .createApproval({
        tenantId,
        atom,
        reasonText: this.texto().trim(),
        ...(target.practitionerRoleAssignmentId === undefined ? {} : { practitionerRoleAssignmentId: target.practitionerRoleAssignmentId }),
        ...(target.healthcareServiceId === undefined ? {} : { healthcareServiceId: target.healthcareServiceId }),
        ...(target.careSpaceId === undefined ? {} : { careSpaceId: target.careSpaceId }),
        ...(target.patientProfileId === undefined ? {} : { patientProfileId: target.patientProfileId }),
        ...(target.appointmentStartAt === undefined ? {} : { appointmentStartAt: target.appointmentStartAt }),
      })
      .subscribe({
        next: (approval) => {
          this.trabajando.set(false);
          this.recibirAprobacion(approval);
          if (approval.status === 'PENDING') this.iniciarSondeo();
        },
        error: (e: unknown) => {
          this.trabajando.set(false);
          this.error.set(accessFailureOf(e)?.message ?? 'No pudimos pedir la aprobación. Intente de nuevo.');
        },
      });
  }

  /** «Comprobar ahora»: pregunta si ya se decidió. */
  protected refrescarAprobacion(): void {
    const actual = this.aprobacion();
    if (actual === null) return;
    this.approvals.listMyApprovals().subscribe({
      next: (lista) => {
        const fila = lista.items.find((a) => a.id === actual.id);
        if (fila !== undefined) this.recibirAprobacion(fila);
      },
      error: () => undefined,
    });
  }

  protected cancelar(): void {
    this.cancelled.emit();
  }

  protected cerrado(): void {
    if (!this.resuelto) this.cancelled.emit();
  }

  private recibirAprobacion(approval: SupportApproval): void {
    this.aprobacion.set(approval);
    if (approval.status === 'APPROVED') {
      this.detenerSondeo();
      this.responder({ approvalId: approval.id });
    } else if (approval.status !== 'PENDING') {
      this.detenerSondeo();
    }
  }

  private iniciarSondeo(): void {
    this.detenerSondeo();
    this.timer = setInterval(() => this.refrescarAprobacion(), APPROVAL_POLL_MS);
  }

  private detenerSondeo(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private responder(answer: ChallengeAnswer): void {
    this.resuelto = true;
    this.answered.emit(answer);
  }
}
