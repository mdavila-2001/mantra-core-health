/* V05-05·L · Personas relacionadas
   Portada de V05-profiles/security-admin/V05-05-personas-relacionadas-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-relacionadas-listado',
  imports: [RouterLink],
  templateUrl: './personas-relacionadas-listado.html',
})
export class PersonasRelacionadasListado {}
