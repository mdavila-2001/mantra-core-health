/* V65-01·L · Buscador
   Portada de V65-buscador/publico/V65-01-buscador-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-buscador-listado',
  imports: [RouterLink],
  templateUrl: './buscador-listado.html',
})
export class BuscarBuscadorListado {}
