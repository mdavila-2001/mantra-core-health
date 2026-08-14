/* V05-09·L · Profesionales
   Portada de V05-profiles/security-admin/V05-09-profesionales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-profesionales-listado',
  imports: [RouterLink],
  templateUrl: './profesionales-listado.html',
})
export class PersonasProfesionalesListado {}
