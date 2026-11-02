import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime, templateLabel } from '../support-labels';
import { MySupport } from '../my-support/my-support';
import { InviteSupport } from './invite-support/invite-support';
import { esInvitacionSinResponder } from './invite-support/invite-support.rules';
import { TeamAttention } from './team-attention/team-attention';
import { TeamExplain } from './team-explain/team-explain';
import { TeamQrTool } from './team-qr-tool/team-qr-tool';

/**
 * **Mi equipo y Mis accesos**: Gestión integral de equipo de apoyo y accesos delegados.
 */
@Component({
  selector: 'app-my-team',
  imports: [
    Alert, AppButton, AppButtonLink, Badge, Card, InviteSupport, MySupport, PageHeader,
    RouterLink, SearchField, SegmentedControl, Switch, TeamAttention, TeamExplain, TeamQrTool, ViewStateHost,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly state = signal<ViewState<readonly DoctorTeamMember[]>>(loading());
  protected readonly invitaciones = signal<readonly DoctorTeamMember[]>([]);
  protected readonly actividad = signal<readonly SupportActivityEntry[]>([]);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly preguntandoPor = signal<DoctorTeamMember | null>(null);
  protected readonly responderAlAceptar = signal<Readonly<Record<string, boolean>>>({});

  protected readonly pestana = signal<'equipo' | 'accesos'>(
    ['mis-accesos', 'accesos'].includes(this.route.snapshot.queryParamMap.get('tab') ?? '') ? 'accesos' : 'equipo',
  );
  protected readonly tabOpciones: readonly SegmentedOption<'equipo' | 'accesos'>[] = [
    { value: 'equipo', label: 'Mi equipo' },
    { value: 'accesos', label: 'Mis accesos' },
  ];
  protected readonly busqueda = signal('');
  protected readonly mostrarQr = signal(false);
  protected readonly qrInicial = signal<string | null>(null);

  protected readonly miembrosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const items = this.miembros();
    if (!q) return items;
    return items.filter((m) =>
      m.personName.toLowerCase().includes(q) ||
      m.organizationName.toLowerCase().includes(q) ||
      m.coverageSummary.toLowerCase().includes(q) ||
      this.rol(m).toLowerCase().includes(q),
    );
  });

  protected readonly invitacionesFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const items = this.invitaciones();
    if (!q) return items;
    return items.filter((m) =>
      m.personName.toLowerCase().includes(q) ||
      m.organizationName.toLowerCase().includes(q) ||
      m.coverageSummary.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('code=')) {
      const match = hash.match(/code=([^&]+)/);
      if (match) {
        this.qrInicial.set(decodeURIComponent(match[1]));
        this.mostrarQr.set(true);
      }
    }
    this.cargar();
  }

  protected cambiarPestana(p: 'equipo' | 'accesos'): void {
    this.pestana.set(p);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: p === 'accesos' ? 'mis-accesos' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected alternarQr(): void {
    this.mostrarQr.update((v) => !v);
  }

  protected alEscanearQr(codigo: string): void {
    this.toasts.info(`Código detectado: ${codigo}`);
    if (codigo.includes('REQ-')) this.cambiarPestana('accesos');
  }

  protected cargar(): void {
    this.state.set(loading());
    this.support.getMyTeam().subscribe({
      next: ({ items }) => {
        const equipo = items.filter((m) => !esInvitacionSinResponder(m));
        this.invitaciones.set(items.filter(esInvitacionSinResponder));
        this.state.set(
          equipo.length === 0
            ? empty({ label: 'Cuando la organización le asigne a alguien, aparecerá acá' }, 'Todavía no tiene equipo de apoyo.')
            : ready(equipo),
        );
      },
      error: (failure: unknown) => {
        this.invitaciones.set([]);
        const status = (failure as { status?: number })?.status;
        if (status === 404 || status === 0) {
          this.state.set(empty({ label: 'Cuando la organización le asigne a alguien, aparecerá acá' }, 'Todavía no tiene equipo de apoyo.'));
        } else {
          this.state.set(errorToViewState<readonly DoctorTeamMember[]>(failure));
        }
      },
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

  protected estadoTexto(m: DoctorTeamMember): string {
    if (m.status === 'REVOKED') {
      const mapa: Record<string, string> = { SUSPENDED: 'Suspendida', EXPIRED: 'Vencida' };
      return mapa[m.delegateStatus] ?? 'Retirada';
    }
    return m.status === 'PENDING_ACCEPTANCE' ? 'Espera su aceptación' : 'Activa';
  }

  protected estadoTono(m: DoctorTeamMember): BadgeVariant {
    if (m.status === 'REVOKED') return m.delegateStatus === 'SUSPENDED' ? 'warning' : 'secondary';
    return m.status === 'PENDING_ACCEPTANCE' ? 'warning' : 'success';
  }

  protected motivoDeBaja(m: DoctorTeamMember): string | null {
    if (m.status !== 'REVOKED') return null;
    if (m.delegateStatus === 'SUSPENDED') return 'Su organización suspendió el vínculo de esta persona por no renovarlo a tiempo.';
    if (m.delegateStatus === 'EXPIRED') return 'El vínculo de esta persona venció.';
    return 'Esta persona ya no forma parte de su equipo.';
  }

  protected acciones(m: DoctorTeamMember): string {
    return m.actions.map((a) => SUPPORT_ACTION_LABELS[a] ?? a).join(' · ');
  }

  protected respondeAlAceptar(m: DoctorTeamMember): boolean {
    return this.responderAlAceptar()[m.delegateId] ?? false;
  }
  protected alternarRespuestaAlAceptar(m: DoctorTeamMember, valor: boolean): void {
    this.responderAlAceptar.update((actual) => ({ ...actual, [m.delegateId]: valor }));
  }

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
      puede ? `${m.personName} puede responder en su nombre.` : `${m.personName} ya no responde en su nombre.`,
    );
  }

  protected cambiarAviso(m: DoctorTeamMember, mostrar: boolean): void {
    const valor: DelegateReplyDisclosure = mostrar ? 'SHOW' : 'HIDE';
    if (valor === m.replyDisclosure) return;
    this.ejecutar(
      m.delegateId,
      this.support.setReplySettings(m.delegateId, { replyDisclosure: valor }),
      mostrar ? 'El paciente verá «respondido por su equipo».' : 'El paciente ya no verá «respondido por su equipo».',
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
        message: 'Deja de tener acceso a su agenda y mensajes. Las citas creadas se mantienen.',
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
