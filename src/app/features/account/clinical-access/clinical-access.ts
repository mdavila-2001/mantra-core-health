import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import type {
  AccessState,
  MyCareRelationship,
  MyClinicalGrant,
} from '../../../core/data-access/authz/authz.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { LoadingState } from '../../../shared/components/molecules/loading-state/loading-state';

/** Status display labels in Spanish. */
const ROTULO_DE_ESTADO: Readonly<Record<AccessState, string>> = {
  ACTIVE: 'Con acceso',
  REVOKED: 'Revocado',
  EXPIRED: 'Vencido',
  OTHER: 'Sin estado',
};

/**
 * Patient clinical access management view (BR-20 · CV-19).
 * Displays care relationships and active clinical access grants with revocation support.
 */
@Component({
  selector: 'app-account-clinical-access',
  imports: [AppButton, Alert, Badge, Card, DatePipe, EmptyState, PageHeader, RouterLink, Tab, Tabs, LoadingState],
  templateUrl: './clinical-access.html',
  styleUrl: './clinical-access.css',
  host: { '[class.is-incrustada]': 'incrustada()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountClinicalAccess {
  private readonly authz = inject(AuthzClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  /** Embedded within privacy settings tab without duplicate page header. */
  readonly incrustada = input(false);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly cargando = signal(true);
  protected readonly sinPermiso = signal(false);
  protected readonly error = signal<{ mensaje: string; requestId: string | null } | null>(null);
  protected readonly relaciones = signal<readonly MyCareRelationship[]>([]);
  protected readonly accesos = signal<readonly MyClinicalGrant[]>([]);
  protected readonly revocando = signal<string | null>(null);

  /** Active emergency clinical access grants count. */
  protected readonly cuantosDeEmergencia = computed(
    () => this.accesos().filter((acceso) => acceso.isEmergency).length,
  );

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.sinPermiso.set(false);
    this.authz.getMyClinicalAccess().subscribe({
      next: (datos) => {
        this.relaciones.set(datos.careRelationships);
        this.accesos.set(datos.grants);
        this.cargando.set(false);
      },
      error: (falla: unknown) => {
        const vista = errorToViewState<null>(falla);
        this.cargando.set(false);
        if (vista.status === 'forbidden') {
          this.sinPermiso.set(true);
          return;
        }
        this.error.set({
          mensaje:
            vista.status === 'offline'
              ? 'No pudimos conectarnos. Revise su conexión y reintente.'
              : 'No pudimos traer quién ve su historia.',
          requestId: vista.status === 'error' ? vista.requestId : null,
        });
      },
    });
  }

  protected rotulo(estado: AccessState): string {
    return ROTULO_DE_ESTADO[estado];
  }

  /** Revokes practitioner care relationship with user confirmation. */
  protected async revocarRelacion(relacion: MyCareRelationship): Promise<void> {
    if (relacion.state !== 'ACTIVE' || this.revocando() !== null) {
      return;
    }
    const quien = relacion.practitionerName ?? 'este profesional';
    const confirmado = await this.dialogs.confirm({
      title: 'Revocar el vínculo',
      message: `${quien} deja de ver su historia clínica salvo que tenga un turno suyo el mismo día.`,
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.revocando.set(relacion.id);
    this.authz.revokeMyCareRelationship(relacion.id).subscribe({
      next: () => this.terminarRevocacion(`Revocó el vínculo con ${quien}.`),
      error: () => this.fallarRevocacion(),
    });
  }

  /** Revokes granted clinical access with user confirmation. */
  protected async revocarAcceso(acceso: MyClinicalGrant): Promise<void> {
    if (acceso.state !== 'ACTIVE' || this.revocando() !== null) {
      return;
    }
    const quien = acceso.grantedName ?? 'esta persona';
    const confirmado = await this.dialogs.confirm({
      title: acceso.isEmergency ? 'Revocar el acceso de emergencia' : 'Revocar el acceso',
      message: `${quien} deja de tener acceso a su historia clínica.`,
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.revocando.set(acceso.id);
    this.authz.revokeMyClinicalGrant(acceso.id).subscribe({
      next: () => this.terminarRevocacion(`Revocó el acceso de ${quien}.`),
      error: () => this.fallarRevocacion(),
    });
  }

  private terminarRevocacion(mensaje: string): void {
    this.revocando.set(null);
    this.toasts.success(mensaje);
    // Reload state after revocation to verify backend persistence.
    this.cargar();
  }

  private fallarRevocacion(): void {
    this.revocando.set(null);
    this.toasts.warning('No pudimos revocar el acceso. Pruebe de nuevo.');
  }
}
