import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { AppButton } from '../../../shared/components/atoms/button/button';

/**
 * Selector de organización.
 *
 * Aparece entre el login y la aplicación cuando el token trae más de un tenant.
 * Es una pantalla propia y no un desplegable dentro del login porque la
 * elección **cambia qué datos se ven**: mezclarla con las credenciales invita a
 * pasarla por alto.
 *
 * El token sólo trae los identificadores, no los nombres — la API no expone un
 * `/me`. Mostrarlos con nombre exige leer el directorio, que es trabajo de otra
 * tarjeta; por ahora se listan por identificador.
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
  private readonly router = inject(Router);

  readonly tenants = this.auth.tenants;

  choose(tenantId: string): void {
    this.auth.selectTenant(tenantId);
    void this.router.navigateByUrl('/');
  }
}
