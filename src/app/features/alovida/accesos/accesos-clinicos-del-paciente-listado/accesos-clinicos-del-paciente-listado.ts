/* V06-06·L · Accesos clínicos del paciente
   Portada de V06-authz/clinical-approver/V06-06-accesos-clinicos-del-paciente-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-clinicos-del-paciente-listado',
  imports: [RouterLink],
  templateUrl: './accesos-clinicos-del-paciente-listado.html',
})
export class AccesosClinicosDelPacienteListado {}
