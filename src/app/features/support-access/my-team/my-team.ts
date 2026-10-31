import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  DelegateReplyDisclosure,
  DoctorTeamMember,
  PendingClinicalAccessRequest,
  SupportActivityEntry,
} from '../../../core/data-access/support-access/support-access.types';
import { SUPPORT_ACTION_LABELS } from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime, templateLabel } from '../support-labels';
import { TeamAttention } from './team-attention/team-attention';
import { TeamExplain } from './team-explain/team-explain';

/**
 * **Mi equipo**: las personas que ayudan a un doctor con su agenda y sus
 * mensajes, y lo que el doctor decide sobre cada una.
 *
 * El doctor acepta a cada persona **una vez**; después decide si puede responder
 * en su nombre y si el paciente ve «respondido por su equipo». También aprueba o
 * niega los accesos clínicos temporales que pide el equipo (por paciente) y puede
 * retirar a alguien: deja de tener acceso de inmediato.
 *
 * Los interruptores piden el cambio a la API y vuelven a leer: lo que se ve es lo
 * que quedó guardado, no lo que se tocó.
 */
@Component({
  selector: 'app-my-team',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    PageHeader,
    RouterLink,
    Switch,
    TeamAttention,
    TeamExplain,
    ViewStateHost,
  ],
  templateUrl: './my-team.html',
  styleUrl: './my-team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTeam implements OnInit {
  private readonly support = inject(SupportAccessClient);
  private readonly delegated = inject(DelegatedAccessClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<readonly DoctorTeamMember[]>>(loading());
  protected readonly actividad = signal<readonly SupportActivityEntry[]>([]);
  protected readonly ocupado = signal<string | null>(null);
  /** La persona sobre la que el doctor pregunta «¿por qué pudo o no pudo…?». */
  protected readonly preguntandoPor = signal<DoctorTeamMember | null>(null);
  /** Lo que se está decidiendo al aceptar a alguien que todavía no se aceptó. */
  protected readonly responderAlAceptar = signal<Readonly<Record<string, boolean>>>({});

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.support.getMyTeam().subscribe({
      next: ({ items }) =>
        this.state.set(
          items.length === 0
            ? empty(
                { label: 'Cuando la organización le asigne a alguien, aparecerá acá' },
                'Todavía no tiene equipo de apoyo.',
              )
            : ready(items),
        ),
      error: (failure: unknown) =>
        this.state.set(errorToViewState<readonly DoctorTeamMember[]>(failure)),
    });
    this.support.getMyTeamActivity().subscribe({
      next: ({ items }) => this.actividad.set(items),
      error: () => this.actividad.set([]),
    });
  }

  protected miembros(): readonly DoctorTeamMember[] {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  }

  protected rol = (m: DoctorTeamMember): string => templateLabel(m.roleTemplate);
  protected fecha = formatDateTime;

  /**
   * El estado para el doctor: la API lo reduce a `PENDING_ACCEPTANCE | ACTIVE | REVOKED`
   * y deja en `delegateStatus` por qué una persona ya no está activa (retirada, suspendida
   * por su organización o vencida): acá se dice cuál.
   */
  protected estadoTexto(m: DoctorTeamMember): string {
    if (m.status === 'REVOKED')
      return {
        ACTIVE: 'Retirada',
        SUSPENDED: 'Suspendida',
        REVOKED: 'Retirada',
        EXPIRED: 'Vencida',
      }[m.delegateStatus];
    return { PENDING_ACCEPTANCE: 'Espera su aceptación', ACTIVE: 'Activa' }[m.status];
  }
  protected estadoTono(m: DoctorTeamMember): BadgeVariant {
    if (m.status === 'REVOKED') return m.delegateStatus === 'SUSPENDED' ? 'warning' : 'secondary';
    return ({ PENDING_ACCEPTANCE: 'warning', ACTIVE: 'success' } as const)[m.status];
  }

  /** Por qué ya no puede actuar, en palabras; `null` si está activa o esperando su aceptación. */
  protected motivoDeBaja(m: DoctorTeamMember): string | null {
    if (m.status !== 'REVOKED') return null;
    switch (m.delegateStatus) {
      case 'SUSPENDED':
        return 'Su organización suspendió el vínculo de esta persona por no renovarlo a tiempo. No puede actuar sobre su agenda hasta que la organización lo renueve; usted no tiene que hacer nada.';
      case 'EXPIRED':
        return 'El vínculo de esta persona venció. Ya no puede actuar sobre su agenda.';
      default:
        return 'Esta persona ya no forma parte de su equipo: no puede actuar sobre su agenda ni sus mensajes.';
    }
  }

  /** Lo que puede hacer sobre su agenda, en palabras. */
  protected acciones(m: DoctorTeamMember): string {
    return m.actions.map((a) => SUPPORT_ACTION_LABELS[a] ?? a).join(' · ');
  }

  protected respondeAlAceptar(m: DoctorTeamMember): boolean {
    return this.responderAlAceptar()[m.delegateId] ?? false;
  }
  protected alternarRespuestaAlAceptar(m: DoctorTeamMember, valor: boolean): void {
    this.responderAlAceptar.update((actual) => ({ ...actual, [m.delegateId]: valor }));
  }

  /* ---- acciones ------------------------------------------------------------ */

  protected aceptar(m: DoctorTeamMember): void {
    this.ejecutar(
      m.delegateId,
      this.support.acceptDelegate(m.delegateId, { mayReplyOnBehalf: this.respondeAlAceptar(m) }),
      `Aceptó a ${m.personName}.`,
    );
  }

  protected cambiarRespuesta(m: DoctorTeamMember, puede: boolean): void {
    if (puede === m.mayReplyOnBehalf) return;
    this.ejecutar(
      m.delegateId,
      this.support.setReplySettings(m.delegateId, { mayReplyOnBehalf: puede }),
      puede
        ? `${m.personName} puede responder en su nombre.`
        : `${m.personName} ya no responde en su nombre.`,
    );
  }

  protected cambiarAviso(m: DoctorTeamMember, mostrar: boolean): void {
    const valor: DelegateReplyDisclosure = mostrar ? 'SHOW' : 'HIDE';
    if (valor === m.replyDisclosure) return;
    this.ejecutar(
      m.delegateId,
      this.support.setReplySettings(m.delegateId, { replyDisclosure: valor }),
      mostrar
        ? 'El paciente verá «respondido por su equipo».'
        : 'El paciente ya no verá «respondido por su equipo».',
    );
  }

  protected decidirAcceso(pedido: PendingClinicalAccessRequest, aprobar: boolean): void {
    const hasta = new Date(Date.now() + pedido.requestedHours * 3_600_000).toISOString();
    this.ejecutar(
      pedido.requestId,
      this.delegated.resolveAccessRequest(
        pedido.requestId,
        aprobar ? { decision: 'APPROVED', validTo: hasta } : { decision: 'DENIED' },
      ),
      aprobar ? `Autorizó el acceso por ${pedido.requestedHours} horas.` : 'Negó el acceso.',
    );
  }

  protected async retirar(m: DoctorTeamMember): Promise<void> {
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: `Retirar a ${m.personName}`,
        message:
          'Deja de tener acceso a su agenda y a sus mensajes ahora mismo. Las citas que creó se mantienen.',
        confirmLabel: 'Retirar de mi equipo',
        destructive: true,
      },
      { label: 'Motivo', hint: 'Queda en la bitácora.', minLength: 3 },
    );
    if (motivo === null) return;
    this.ejecutar(
      m.delegateId,
      this.delegated.revokeDelegation(m.delegateId, { reason: motivo }),
      `${m.personName} ya no está en su equipo.`,
    );
  }

  private ejecutar(
    clave: string,
    peticion: { subscribe: (o: { next: () => void; error: (e: unknown) => void }) => unknown },
    hecho: string,
  ): void {
    if (this.ocupado() !== null) return;
    this.ocupado.set(clave);
    peticion.subscribe({
      next: () => {
        this.ocupado.set(null);
        this.toasts.success(hecho);
        this.cargar();
      },
      error: (failure: unknown) => {
        this.ocupado.set(null);
        const estado = errorToViewState<unknown>(failure);
        this.toasts.error(
          'message' in estado && typeof estado.message === 'string'
            ? estado.message
            : 'No pudimos completar la acción.',
        );
        this.cargar();
      },
    });
  }
}
