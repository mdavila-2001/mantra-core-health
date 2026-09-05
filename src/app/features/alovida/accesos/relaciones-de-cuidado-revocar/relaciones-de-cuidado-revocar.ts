/* V06-01·A · Revocar la relación de cuidado
   Portada de V06-authz/clinician/V06-01-relaciones-de-cuidado-revocar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-relaciones-de-cuidado-revocar',
  imports: [RouterLink],
  templateUrl: './relaciones-de-cuidado-revocar.html',
})
export class AccesosRelacionesDeCuidadoRevocar {}
