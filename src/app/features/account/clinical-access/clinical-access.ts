import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

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

/** El rótulo de cada estado, en castellano. */
const ROTULO_DE_ESTADO: Readonly<Record<AccessState, string>> = {
  ACTIVE: 'Con acceso',
  REVOKED: 'Revocado',
  EXPIRED: 'Vencido',
  OTHER: 'Sin estado',
};

/**
 * **Quién ve mi historia** (BR-20 · CV-19): los profesionales vinculados y los
 * accesos concedidos sobre la historia clínica del titular, los de emergencia
 * incluidos, con nombre, desde cuándo y hasta cuándo.
 *
 * - **Revocar** pide confirmación, llama a la ruta del titular
 *   (`POST /authz/me/care-relationships/:id/revoke` o
 *   `.../clinical-access-grants/:grantId/revoke`) y **relee** la lista: quien
 *   quedó sin acceso recibe 403 al abrir la historia sin un turno de hoy.
 * - Un acceso de emergencia se marca como tal: es lo que el titular más necesita
 *   poder ver, porque no lo concedió él.
 *
 * Una sola tarjeta con pestañas (regla del cliente §5). La autoridad es la API:
 * ocultar un botón no es seguridad.
 */
@Component({
  selector: 'app-account-clinical-access',
  imports: [AppButton, Alert, Badge, Card, DatePipe, EmptyState, PageHeader, Tab, Tabs],
  templateUrl: './clinical-access.html',
  styleUrl: './clinical-access.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountClinicalAccess {
  private readonly authz = inject(AuthzClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly cargando = signal(true);
  protected readonly sinPermiso = signal(false);
  protected readonly error = signal<{ mensaje: string; requestId: string | null } | null>(null);
  protected readonly relaciones = signal<readonly MyCareRelationship[]>([]);
  protected readonly accesos = signal<readonly MyClinicalGrant[]>([]);
  protected readonly revocando = signal<string | null>(null);

  /** Cuántos accesos de emergencia hay, para destacarlos en la pestaña. */
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
              ? 'No pudimos conectarnos. Revisá tu conexión y reintentá.'
              : 'No pudimos traer quién ve tu historia.',
          requestId: vista.status === 'error' ? vista.requestId : null,
        });
      },
    });
  }

  protected rotulo(estado: AccessState): string {
    return ROTULO_DE_ESTADO[estado];
  }

  /** Revoca el vínculo con un profesional, con confirmación. */
  protected async revocarRelacion(relacion: MyCareRelationship): Promise<void> {
    if (relacion.state !== 'ACTIVE' || this.revocando() !== null) {
      return;
    }
    const quien = relacion.practitionerName ?? 'este profesional';
    const confirmado = await this.dialogs.confirm({
      title: 'Revocar el vínculo',
      message: `${quien} deja de ver tu historia clínica salvo que tenga un turno tuyo el mismo día.`,
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.revocando.set(relacion.id);
    this.authz.revokeMyCareRelationship(relacion.id).subscribe({
      next: () => this.terminarRevocacion(`Revocaste el vínculo con ${quien}.`),
      error: () => this.fallarRevocacion(),
    });
  }

  /** Revoca un acceso clínico concedido, con confirmación. */
  protected async revocarAcceso(acceso: MyClinicalGrant): Promise<void> {
    if (acceso.state !== 'ACTIVE' || this.revocando() !== null) {
      return;
    }
    const quien = acceso.grantedName ?? 'esta persona';
    const confirmado = await this.dialogs.confirm({
      title: acceso.isEmergency ? 'Revocar el acceso de emergencia' : 'Revocar el acceso',
      message: `${quien} deja de tener acceso a tu historia clínica.`,
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.revocando.set(acceso.id);
    this.authz.revokeMyClinicalGrant(acceso.id).subscribe({
      next: () => this.terminarRevocacion(`Revocaste el acceso de ${quien}.`),
      error: () => this.fallarRevocacion(),
    });
  }

  private terminarRevocacion(mensaje: string): void {
    this.revocando.set(null);
    this.toasts.success(mensaje);
    // Se relee: lo que prueba la revocación es la fila releída, no el aviso.
    this.cargar();
  }

  private fallarRevocacion(): void {
    this.revocando.set(null);
    this.toasts.warning('No pudimos revocar el acceso. Probá de nuevo.');
  }
}
