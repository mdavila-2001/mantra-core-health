import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MembershipInvitationsClient } from '../../../core/data-access/directory/membership-invitations.client';
import type { InvitedRoleCode, MembershipInvitation } from '../../../core/data-access/directory/membership-invitations.types';
import { TokenRefreshService } from '../../../core/http/token-refresh.service';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

const ROL_EN_PALABRAS: Readonly<Record<InvitedRoleCode, string>> = {
  OWNER: 'dueño',
  ADMIN: 'administración',
  STAFF: 'equipo',
  OTHER: 'otro rol',
};

type Estado = 'cargando' | 'listo' | 'error';

/**
 * **Invitaciones de organizaciones**: las organizaciones que quieren sumar a la persona y a las que todavía no dijo que sí.
 *
 * Desde esta ronda de la API, que una organización «incorpore» a alguien (`POST /tenants/:id/memberships`) **no la
 * incorpora**: deja la membresía pendiente de aceptación. Hasta que acepte no cuenta para su token, sus políticas ni la
 * lectura de la organización; así una organización no puede cerrarle el acceso a las demás con solo agregarla. Acá se
 * decide: **aceptar** activa la membresía; **rechazar** la descarta.
 *
 * Aceptar o rechazar una invitación que no es suya, o que ya no está pendiente, responde 404 igual que si no existiera:
 * la pantalla lo dice sin dar más datos y vuelve a leer la lista.
 *
 * Es presentación: la decisión la toma la persona y la valida la API.
 */
@Component({
  selector: 'app-organization-invitations',
  imports: [Alert, AppButton, Card, DatePipe, EmptyState, LoadingState, PageHeader],
  templateUrl: './organization-invitations.html',
  styleUrl: './organization-invitations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationInvitations implements OnInit {
  private readonly client = inject(MembershipInvitationsClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly refresher = inject(TokenRefreshService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly estado = signal<Estado>('cargando');
  protected readonly invitaciones = signal<readonly MembershipInvitation[]>([]);
  /** La que se está aceptando o rechazando, para frenar el doble clic. */
  protected readonly enCurso = signal<string | null>(null);
  protected readonly fallo = signal<string | null>(null);
  /** Lo último que se hizo, a la vista hasta que la persona lo lea. */
  protected readonly resultado = signal<string | null>(null);

  protected readonly rol = (codigo: InvitedRoleCode): string => ROL_EN_PALABRAS[codigo];

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set('cargando');
    this.client.list().subscribe({
      next: (lista) => {
        this.invitaciones.set(lista);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }

  /** `POST …/accept`: la membresía queda activa. Se renueva la sesión para que el token ya lleve la organización. */
  protected aceptar(invitacion: MembershipInvitation): void {
    if (this.enCurso() !== null) return;
    this.enCurso.set(invitacion.id);
    this.fallo.set(null);
    this.client.accept(invitacion.id).subscribe({
      next: () => {
        this.enCurso.set(null);
        this.resultado.set(`Aceptó la invitación de ${invitacion.tenantName}. Ya forma parte de la organización.`);
        this.toasts.success(`Ya forma parte de ${invitacion.tenantName}.`, 'Invitación aceptada');
        // El token se arma con las membresías activas: se renueva para que la organización nueva aparezca sin volver a entrar.
        this.refresher.refresh().subscribe({ error: () => undefined });
        this.cargar();
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /** `POST …/decline`, después de confirmar: la invitación se descarta y la organización no puede darla por aceptada. */
  protected async rechazar(invitacion: MembershipInvitation): Promise<void> {
    if (this.enCurso() !== null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Rechazar la invitación',
      message: `Si rechaza la invitación de ${invitacion.tenantName}, la organización no podrá sumarlo sin invitarlo de nuevo. ¿Quiere rechazarla?`,
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!confirmado) return;
    this.enCurso.set(invitacion.id);
    this.fallo.set(null);
    this.client.decline(invitacion.id).subscribe({
      next: () => {
        this.enCurso.set(null);
        this.resultado.set(`Rechazó la invitación de ${invitacion.tenantName}.`);
        this.cargar();
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  private fallar(error: unknown): void {
    this.enCurso.set(null);
    // 404 uniforme: ajena, ya decidida o inexistente se dicen igual. Se vuelve a leer lo que de verdad hay.
    const ausente = error instanceof HttpErrorResponse && error.status === 404;
    this.fallo.set(ausente ? 'Esa invitación ya no está disponible: puede que la organización la haya retirado o que ya la haya decidido.' : 'No pudimos guardar su respuesta. Vuelva a intentarlo.');
    if (ausente) this.cargar();
  }
}
