/* V65-04·L · Hospitales y clínicas
   Portada de V65-buscador/publico/V65-04-hospitales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-hospitales-listado',
  imports: [RouterLink],
  templateUrl: './hospitales-listado.html',
})
export class BuscarHospitalesListado {}
