/* V05-01·A · Revertir la fusión
   Portada de V05-profiles/security-admin/V05-01-pacientes-revertir.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-pacientes-revertir',
  imports: [RouterLink],
  templateUrl: './pacientes-revertir.html',
})
export class PersonasPacientesRevertir {}
