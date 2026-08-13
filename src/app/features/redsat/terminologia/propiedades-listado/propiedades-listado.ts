/* V03-10·L · Propiedades
   Portada de V03-terminology/security-admin/V03-10-propiedades-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-terminologia-propiedades-listado',
  imports: [RouterLink],
  templateUrl: './propiedades-listado.html',
})
export class TerminologiaPropiedadesListado {}
