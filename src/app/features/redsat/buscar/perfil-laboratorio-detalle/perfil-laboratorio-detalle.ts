/* V65-10·D · Perfil del laboratorio
   Portada de V65-buscador/publico/V65-10-perfil-laboratorio-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-perfil-laboratorio-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-laboratorio-detalle.html',
})
export class BuscarPerfilLaboratorioDetalle {}
