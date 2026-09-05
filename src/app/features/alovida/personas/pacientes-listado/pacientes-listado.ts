/* V05-01·L · Pacientes
   Portada de V05-profiles/security-admin/V05-01-pacientes-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-pacientes-listado',
  imports: [RouterLink],
  templateUrl: './pacientes-listado.html',
})
export class PersonasPacientesListado {}
