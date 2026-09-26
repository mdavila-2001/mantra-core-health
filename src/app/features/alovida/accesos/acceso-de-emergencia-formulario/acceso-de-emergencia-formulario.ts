/* V06-05·F · Acceso de emergencia
   Portada de V06-authz/clinical-approver/V06-05-acceso-de-emergencia-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-acceso-de-emergencia-formulario',
  imports: [RouterLink],
  templateUrl: './acceso-de-emergencia-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosAccesoDeEmergenciaFormulario {}
