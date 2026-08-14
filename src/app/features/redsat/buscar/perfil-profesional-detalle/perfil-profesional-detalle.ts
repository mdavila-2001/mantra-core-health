/* V65-07·D · Perfil del profesional
   Portada de V65-buscador/publico/V65-07-perfil-profesional-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-perfil-profesional-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-profesional-detalle.html',
})
export class BuscarPerfilProfesionalDetalle {}
