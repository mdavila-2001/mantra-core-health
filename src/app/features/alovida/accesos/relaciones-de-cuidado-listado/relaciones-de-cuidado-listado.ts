/* V06-01·L · Relaciones de cuidado
   Portada de V06-authz/clinician/V06-01-relaciones-de-cuidado-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-relaciones-de-cuidado-listado',
  imports: [RouterLink],
  templateUrl: './relaciones-de-cuidado-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosRelacionesDeCuidadoListado {}
