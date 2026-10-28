import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { OrganizationSelectContainer } from '../../../shared/components/molecules/organization-select/organization-select-container';
import type { OrganizationChoice } from '../../../shared/components/molecules/organization-select/organization-select.types';
import { AffiliationDialog } from '../affiliation-dialog/affiliation-dialog';

/**
 * El campo «Organización» de lo que se publica: el selector con sus datos y,
 * cuando el médico elige «Afiliarme a otra organización…», el formulario de
 * solicitud en un modal, sin cambiar de pantalla.
 *
 * Vive en `features/` y no al lado del selector porque el formulario de
 * afiliación es de una pantalla (`features/account`): una molécula de
 * `shared/` no puede importarlo (ver `OrganizationSelectContainer`). Lo usa
 * «Publicar agenda»; el modal del día puede usarlo igual.
 *
 * La ayuda del campo dice por qué una organización puede no estar: el
 * selector solo ofrece aquellas donde la afiliación ya está aprobada.
 */
@Component({
  selector: 'app-organization-field',
  imports: [AffiliationDialog, FormField, OrganizationSelectContainer],
  template: `
    <app-form-field
      label="Organización"
      hint="Su consultorio, o una organización que ya aprobó su afiliación."
    >
      <app-organization-select-container
        [disabled]="disabled()"
        (selected)="selected.emit($event)"
        (affiliationRequested)="affiliating.set(true)"
      />
    </app-form-field>

    @if (affiliating()) {
      <app-affiliation-dialog (closed)="affiliating.set(false)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationField {
  /** El campo no se puede cambiar, por ejemplo mientras se publica. */
  readonly disabled = input(false);

  /** El médico eligió dónde publicar. «Afiliarme…» no emite: pedir no es elegir. */
  readonly selected = output<OrganizationChoice>();

  /** El modal de afiliación está abierto. */
  protected readonly affiliating = signal(false);
}
