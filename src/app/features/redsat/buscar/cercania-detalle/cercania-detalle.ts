/* V65-12·D · Cerca mío
   Portada de V65-buscador/publico/V65-12-cercania-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-cercania-detalle',
  imports: [RouterLink],
  templateUrl: './cercania-detalle.html',
})
export class BuscarCercaniaDetalle {}
