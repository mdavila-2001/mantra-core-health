/* V06-02·A · Revocar la representación legal
   Portada de V06-authz/security-admin/V06-02-representaciones-legales-revocar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-representaciones-legales-revocar',
  imports: [RouterLink],
  templateUrl: './representaciones-legales-revocar.html',
})
export class AccesosRepresentacionesLegalesRevocar {}
