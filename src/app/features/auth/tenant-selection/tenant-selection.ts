import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { RouterLink } from '@angular/router';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { MembershipInvitationsClient } from '../../../core/data-access/directory/membership-invitations.client';
import { tenantDenialHint, tenantDenialText } from '../../../core/data-access/iam/tenant-denial';

import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Link } from '../../../shared/components/atoms/link/link';
import { entryDestination } from '../../reporting/reporting-access';

/**
 * Selector de organización.
 *
 * Aparece entre el login y la aplicación cuando el token trae más de un tenant.
 * Es una pantalla propia y no un desplegable dentro del login porque la
 * elección **cambia qué datos se ven**: mezclarla con las credenciales invita a
 * pasarla por alto.
 *
 * Los nombres salen del claim `tenantNames` del propio token, así que no hace
 * falta consultar el directorio. Si el token no lo trae, se cae al
 * identificador: feo, pero preferible a una fila vacía.
 */
@Component({
  selector: 'app-tenant-selection',
  imports: [Link, RouterLink, AnnounceOnAppear],
  templateUrl: './tenant-selection.html',
  styleUrl: './tenant-selection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantSelection implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly invitations = inject(MembershipInvitationsClient);
  private readonly directory = inject(DirectoryClient);

  readonly tenants = this.auth.tenants;

  /**
   * Las organizaciones que **no dejan entrar ahora** (`deniedTenants` del token). Se ven en la lista, marcadas y
   * deshabilitadas, con su motivo: la persona sabe que existen y por qué no puede elegirlas, y entra a las demás.
   */
  readonly denied = this.session.deniedTenants;

  /** Cuántas invitaciones de organizaciones tiene pendientes de aceptar; `0` mientras no se sepa. */
  protected readonly pendingInvitations = signal(0);
  /** Los nombres de las organizaciones que niegan: el token solo trae el de las que dejan entrar. */
  private readonly deniedNames = signal<Readonly<Record<string, string>>>({});

  ngOnInit(): void {
    // Un aviso, no una condición: si no se puede leer, el selector sigue igual.
    if (this.denied().length > 0) {
      this.directory.listMyOrganizations().subscribe({
        next: (lista) => this.deniedNames.set(Object.fromEntries(lista.map((o) => [o.id, o.tradeName ?? o.legalName]))),
        error: () => undefined,
      });
    }
    this.invitations.list().subscribe({ next: (lista) => this.pendingInvitations.set(lista.length), error: () => this.pendingInvitations.set(0) });
  }

  protected motivo(reason: string): string {
    return `${tenantDenialText(reason).replace(/^./, (c) => c.toLocaleUpperCase('es'))}. ${tenantDenialHint(reason)}`;
  }

  /** El nombre de una organización que niega, o un rótulo genérico si no se pudo leer. */
  protected deniedName(tenantId: string): string {
    return this.deniedNames()[tenantId] ?? 'Otra organización de su cuenta';
  }

  /** Nombre legible de la organización, o su identificador si no hay nombre. */
  nombre(tenantId: string): string {
    return this.session.tenantName(tenantId);
  }

  choose(tenantId: string): void {
    this.auth.selectTenant(tenantId);
    // Tras elegir organización, el mismo destino que el login (`login.ts`).
    void this.router.navigateByUrl(entryDestination(this.auth.roles()));
  }
}
