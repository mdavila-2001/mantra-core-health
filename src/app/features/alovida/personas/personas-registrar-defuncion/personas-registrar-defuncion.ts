/* V05-07·A · Registrar la defunción
   Portada de V05-profiles/security-admin/V05-07-personas-registrar-defuncion.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-registrar-defuncion',
  imports: [RouterLink],
  templateUrl: './personas-registrar-defuncion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasRegistrarDefuncion {}
