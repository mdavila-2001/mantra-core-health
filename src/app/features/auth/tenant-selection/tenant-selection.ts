import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import { AppButton } from '../../../shared/components/atoms/button/button';

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
  imports: [AppButton],
  templateUrl: './tenant-selection.html',
  styleUrl: './tenant-selection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantSelection {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  readonly tenants = this.auth.tenants;

  /** Nombre legible de la organización, o su identificador si no hay nombre. */
  nombre(tenantId: string): string {
    return this.session.tenantName(tenantId);
  }

  choose(tenantId: string): void {
    this.auth.selectTenant(tenantId);
    void this.router.navigateByUrl('/');
  }
}
