/* V65-09·D · Perfil de la farmacia
   Portada de V65-buscador/publico/V65-09-perfil-farmacia-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-perfil-farmacia-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-farmacia-detalle.html',
})
export class BuscarPerfilFarmaciaDetalle {}
