/* V06-03·A · Revocar el acceso clínico
   Portada de V06-authz/security-admin/V06-03-accesos-clinicos-revocar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-accesos-clinicos-revocar',
  imports: [RouterLink],
  templateUrl: './accesos-clinicos-revocar.html',
})
export class AccesosClinicosRevocar {}
