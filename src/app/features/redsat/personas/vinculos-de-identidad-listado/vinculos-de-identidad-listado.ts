/* V05-02·L · Vínculos de identidad
   Portada de V05-profiles/security-admin/V05-02-vinculos-de-identidad-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-vinculos-de-identidad-listado',
  imports: [RouterLink],
  templateUrl: './vinculos-de-identidad-listado.html',
})
export class PersonasVinculosDeIdentidadListado {}
