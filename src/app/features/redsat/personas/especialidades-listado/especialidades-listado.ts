/* V05-11·L · Especialidades
   Portada de V05-profiles/security-admin/V05-11-especialidades-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-especialidades-listado',
  imports: [RouterLink],
  templateUrl: './especialidades-listado.html',
})
export class PersonasEspecialidadesListado {}
