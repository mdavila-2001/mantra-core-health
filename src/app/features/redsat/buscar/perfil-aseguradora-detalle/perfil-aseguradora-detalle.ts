/* V65-11·D · Perfil de la aseguradora
   Portada de V65-buscador/publico/V65-11-perfil-aseguradora-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-perfil-aseguradora-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-aseguradora-detalle.html',
})
export class BuscarPerfilAseguradoraDetalle {}
