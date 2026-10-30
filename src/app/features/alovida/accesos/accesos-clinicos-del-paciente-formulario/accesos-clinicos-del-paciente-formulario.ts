/* V06-06·F · Otorgar acceso clínico
   Portada de V06-authz/clinical-approver/V06-06-accesos-clinicos-del-paciente-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-clinicos-del-paciente-formulario',
  imports: [RouterLink],
  templateUrl: './accesos-clinicos-del-paciente-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosClinicosDelPacienteFormulario {}
