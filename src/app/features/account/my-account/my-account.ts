import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { OrganizationProfile } from '../../organization/organization-profile/organization-profile';
import { MyProfile } from '../my-profile/my-profile';

/**
 * Punto de entrada de «Mi perfil»: decide **antes** de montar nada si la cuenta
 * es una persona o una organización.
 *
 * Tiene que ser acá y no una rama dentro de `MyProfile`: ese componente pide el
 * resumen de paciente apenas se construye, y una organización no tiene perfil
 * de paciente.
 */
@Component({
  selector: 'app-my-account',
  imports: [MyProfile, OrganizationProfile],
  template: `
    @if (auth.isOrganizationAccount()) {
      <app-organization-profile />
    } @else {
      <app-my-profile />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAccount {
  protected readonly auth = inject(AuthService);
}
