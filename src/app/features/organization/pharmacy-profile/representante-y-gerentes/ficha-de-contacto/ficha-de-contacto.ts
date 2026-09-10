import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Link } from '../../../../../shared/components/atoms/link/link';
import type { ContactoDeLaEmpresa } from '../../pharmacy-profile.types';

/**
 * **Una persona de la empresa**: su cargo, su nombre y por dónde se la ubica.
 *
 * Presentacional puro y **uno solo para los cuatro** —el representante legal y
 * los tres gerentes—: el registro del cliente les pide exactamente los mismos
 * datos, y escribir cuatro veces los mismos tres campos garantiza que el día
 * que uno cambie, cambien tres y se olvide el cuarto.
 *
 * El celular es opcional porque el representante legal no lo declara. Lo que
 * cada cargo agregue —el enlace al poder, por ejemplo— entra proyectado: esta
 * ficha no sabe de pestañas ni de documentos.
 */
@Component({
  selector: 'app-ficha-de-contacto',
  imports: [Link],
  templateUrl: './ficha-de-contacto.html',
  styleUrl: './ficha-de-contacto.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contacto',
  },
})
export class FichaDeContacto {
  readonly contacto = input.required<ContactoDeLaEmpresa>();
}
