/* V05-07·L · Personas
   Portada de V05-profiles/security-admin/V05-07-personas-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-listado',
  imports: [RouterLink],
  templateUrl: './personas-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasListado {}
