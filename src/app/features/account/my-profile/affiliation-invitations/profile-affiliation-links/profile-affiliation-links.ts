import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import type { ButtonSize } from '../../../../../shared/components/atoms/button/button.types';

/**
 * Los dos accesos del perfil del médico a sus afiliaciones con centros médicos (CM-07): «Invitaciones y
 * solicitudes» y «Procedimientos que hago». Van en un componente propio porque el perfil ya está en su techo de
 * líneas y se muestran en dos lugares de la misma ficha.
 */
@Component({
  selector: 'app-profile-affiliation-links',
  imports: [RouterLink, AppButtonLink],
  template: `
    <a app-button variant="outline" [size]="size()" routerLink="/my-account/affiliations" data-testid="profile-affiliations-link">
      Invitaciones y solicitudes
    </a>
    <a app-button variant="outline" [size]="size()" routerLink="/my-account/my-procedures" data-testid="profile-my-procedures-link">
      Procedimientos que hago
    </a>
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileAffiliationLinks {
  readonly size = input<ButtonSize>('md');
}
