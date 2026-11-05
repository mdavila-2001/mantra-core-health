import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessApprovalsClient } from '../../../core/data-access/access-governance/access-approvals.client';
import type {
  GrantChangeDetails,
  SupportApproval,
} from '../../../core/data-access/access-governance/access-reviews.types';
import {
  grantChangeChangeText,
  grantChangeReasonsText,
  grantChangeTargetText,
  grantChangeValidityText,
} from '../../../core/data-access/support-access/grant-change-reasons';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';
import {
  approverText,
  consequenceText,
  expiryText,
  isExpired,
  isPending,
  kindText,
  needsStepUpToApprove,
  statusText,
  statusTone,
  validUntilText,
} from './approval-labels';

export interface ApprovalsData {
  /** Lo que yo puedo decidir. */
  readonly pending: readonly SupportApproval[];
  /** Lo que yo pedí. */
  readonly mine: readonly SupportApproval[];
}

const MINIMO_DEL_RECHAZO = 5;

/**
 * **Aprobaciones de cuatro ojos** (CONTRATO-GOBIERNO §6.5, §9.3 fila 8). Dos pestañas en una tarjeta:
 *
 * - *Pendientes de mi decisión*: cada tarjeta dice **qué se pide, quién lo pide, por qué y qué pasa si se aprueba**; aprobar
 *   o rechazar (el rechazo lleva motivo) y, si el permiso es crítico, la API pide además el segundo paso de quien aprueba.
 * - *Mis solicitudes*: lo que yo pedí, con su estado, hasta cuándo vale lo aprobado y «Cancelar» mientras esté pendiente.
 *
 * Es la misma pantalla para el administrador y para el doctor (`my-team/approvals`). Quien pidió nunca puede aprobar lo suyo:
 * la API lo impide y el listado de pendientes no se lo ofrece.
 */
@Component({
  selector: 'app-approvals',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    FormField,
    PageHeader,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './approvals.html',
  styleUrl: './approvals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Approvals implements OnInit {
  private readonly client = inject(AccessApprovalsClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** El doctor llega por `my-team/approvals`: cambia el rótulo y a dónde vuelve, no lo que puede. */
  protected readonly esDelDoctor = this.router.url.startsWith('/my-team');
  protected readonly state = signal<ViewState<ApprovalsData>>(loading());
  protected readonly pestana = signal(0);
  protected readonly ahora = signal(new Date());
  protected readonly anuncio = signal('');

  /** Qué tarjeta está rechazando y el motivo que lleva escrito. */
  protected readonly rechazando = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly intentoDeRechazo = signal(false);
  protected readonly trabajando = signal<string | null>(null);
  /** El fallo de una decisión, por tarjeta, en palabras. */
  protected readonly fallos = signal<Readonly<Record<string, string>>>({});

  protected readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly motivoCorto = computed(() => this.motivo().trim().length < MINIMO_DEL_RECHAZO);
  protected readonly tablero = this.esDelDoctor ? '/my-team' : '/administration/access-governance';

  protected readonly tipo = kindText;
  protected readonly quienDecide = approverText;
  protected readonly estado = (a: SupportApproval): string => statusText(a, this.ahora());
  protected readonly tono = statusTone;
  protected readonly pendiente = isPending;
  protected readonly vence = (a: SupportApproval): string => expiryText(a.expiresAt, this.ahora());
  protected readonly vencida = (a: SupportApproval): boolean => isExpired(a, this.ahora());
  protected readonly vigencia = (a: SupportApproval): string | null =>
    validUntilText(a.approvedUntil, this.ahora());
  protected readonly consecuencia = (a: SupportApproval): string => consequenceText(a);
  protected readonly pideSegundoPaso = needsStepUpToApprove;

  /* El detalle de un cambio de permisos (`details`), en palabras: nunca los códigos de la API. */
  protected readonly motivosDelCambio = (d: GrantChangeDetails): readonly string[] =>
    grantChangeReasonsText(d.reasons);
  protected readonly objetivoDelCambio = (d: GrantChangeDetails): string =>
    grantChangeTargetText(d.target);
  protected readonly vigenciaDelCambio = (d: GrantChangeDetails): string =>
    grantChangeValidityText(d);
  protected readonly queCambia = (d: GrantChangeDetails): string =>
    grantChangeChangeText(d.changes ?? []).join(', ');

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const previo = this.datos();
    if (previo === null) this.state.set(loading());
    forkJoin({ pending: this.client.listPending(), mine: this.client.listMyApprovals() }).subscribe(
      {
        next: ({ pending, mine }) => {
          this.ahora.set(new Date());
          this.state.set(
            pending.items.length === 0 && mine.items.length === 0
              ? empty(
                  {
                    label: this.esDelDoctor
                      ? 'Volver a Mi equipo'
                      : 'Volver al tablero de gobierno',
                    route: this.tablero,
                  },
                  'No hay nada esperando su decisión y no tiene solicitudes propias.',
                )
              : ready<ApprovalsData>({ pending: pending.items, mine: mine.items }),
          );
        },
        error: (failure: unknown) =>
          this.state.set(
            previo === null
              ? errorToViewState<ApprovalsData>(failure)
              : stale(previo, this.ahora()),
          ),
      },
    );
  }

  private ponerFallo(id: string, texto: string | null): void {
    this.fallos.update((actual) => {
      const { [id]: _quitado, ...resto } = actual;
      return texto === null ? resto : { ...resto, [id]: texto };
    });
  }

  protected falloDe(id: string): string | undefined {
    return this.fallos()[id];
  }

  /* ---- decidir ---- */

  protected aprobar(a: SupportApproval): void {
    if (this.trabajando() !== null) return;
    this.decidir(
      a,
      { decision: 'APPROVE' },
      `Aprobada. ${consequenceText({ kind: a.kind }, 60).replace('Si la aprueba, ', 'Ahora ')}`,
    );
  }

  protected empezarRechazo(a: SupportApproval): void {
    this.rechazando.set(a.id);
    this.motivo.set('');
    this.intentoDeRechazo.set(false);
    this.ponerFallo(a.id, null);
  }

  protected cancelarRechazo(): void {
    this.rechazando.set(null);
  }

  protected rechazar(a: SupportApproval): void {
    this.intentoDeRechazo.set(true);
    if (this.trabajando() !== null || this.motivoCorto()) return;
    this.decidir(
      a,
      { decision: 'REJECT', comment: this.motivo().trim() },
      'Rechazada. Quien la pidió verá su motivo.',
    );
  }

  private decidir(
    a: SupportApproval,
    decision: { decision: 'APPROVE' | 'REJECT'; comment?: string },
    hecho: string,
  ): void {
    this.trabajando.set(a.id);
    this.ponerFallo(a.id, null);
    this.challenges
      .run(() => this.client.decide(a.id, decision), {
        actionLabel: `${decision.decision === 'APPROVE' ? 'Aprobar' : 'Rechazar'}: ${a.summary}`,
      })
      .subscribe({
        next: () => {
          this.trabajando.set(null);
          this.rechazando.set(null);
          this.toasts.success(hecho);
          this.anuncio.set(hecho);
          this.cargar();
        },
        error: (failure: unknown) => {
          this.trabajando.set(null);
          if (failure instanceof AccessChallengeCancelledError) return;
          const f = accessFailureOf(failure);
          this.ponerFallo(
            a.id,
            f?.message ?? 'No pudimos registrar su decisión. Intente de nuevo.',
          );
          // Ya decidida por otra persona o caducada: lo que se ve dejó de ser verdad. Se dice arriba (la tarjeta va a salir de la lista) y se relee.
          if (f?.reason === 'FOUR_EYES_NOT_PENDING' || f?.reason === 'FOUR_EYES_EXPIRED') {
            this.anuncio.set(f.message);
            this.cargar();
          }
        },
      });
  }

  /* ---- cancelar una propia ---- */

  protected cancelar(a: SupportApproval): void {
    if (this.trabajando() !== null) return;
    this.trabajando.set(a.id);
    this.ponerFallo(a.id, null);
    this.client.cancelMyApproval(a.id).subscribe({
      next: () => {
        this.trabajando.set(null);
        this.toasts.success('Solicitud cancelada.');
        this.anuncio.set('Solicitud cancelada.');
        this.cargar();
      },
      error: (failure: unknown) => {
        this.trabajando.set(null);
        const f = accessFailureOf(failure);
        this.ponerFallo(a.id, f?.message ?? 'No pudimos cancelar la solicitud.');
        if (f?.reason === 'FOUR_EYES_NOT_PENDING') {
          this.anuncio.set(f.message);
          this.cargar();
        }
      },
    });
  }
}
