/* V65-03·L · Medicamentos y farmacias
   Portada de V65-buscador/publico/V65-03-medicamentos-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-medicamentos-listado',
  imports: [RouterLink],
  templateUrl: './medicamentos-listado.html',
})
export class BuscarMedicamentosListado {}
