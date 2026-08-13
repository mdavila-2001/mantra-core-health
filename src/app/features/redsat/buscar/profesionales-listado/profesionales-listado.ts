/* V65-02·L · Profesionales
   Portada de V65-buscador/publico/V65-02-profesionales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-profesionales-listado',
  imports: [RouterLink],
  templateUrl: './profesionales-listado.html',
})
export class BuscarProfesionalesListado {}
