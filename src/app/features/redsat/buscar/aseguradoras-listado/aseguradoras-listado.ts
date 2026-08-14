/* V65-06·L · Aseguradoras y convenios
   Portada de V65-buscador/publico/V65-06-aseguradoras-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-aseguradoras-listado',
  imports: [RouterLink],
  templateUrl: './aseguradoras-listado.html',
})
export class BuscarAseguradorasListado {}
