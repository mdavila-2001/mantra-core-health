/* V65-08·D · Perfil de la organización
   Portada de V65-buscador/publico/V65-08-perfil-organizacion-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-buscar-perfil-organizacion-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-organizacion-detalle.html',
})
export class BuscarPerfilOrganizacionDetalle {}
