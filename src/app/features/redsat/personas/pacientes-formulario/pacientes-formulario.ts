/* V05-01·F · Nuevo paciente
   Portada de V05-profiles/security-admin/V05-01-pacientes-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-pacientes-formulario',
  imports: [RouterLink],
  templateUrl: './pacientes-formulario.html',
})
export class PersonasPacientesFormulario {}
