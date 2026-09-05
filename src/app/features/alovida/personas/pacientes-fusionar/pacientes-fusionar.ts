/* V05-01·A · Fusionar pacientes
   Portada de V05-profiles/security-admin/V05-01-pacientes-fusionar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-pacientes-fusionar',
  imports: [RouterLink],
  templateUrl: './pacientes-fusionar.html',
})
export class PersonasPacientesFusionar {}
