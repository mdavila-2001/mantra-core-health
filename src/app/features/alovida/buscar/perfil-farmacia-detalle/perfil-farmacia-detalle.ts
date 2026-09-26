/* V65-09·D · Perfil de la farmacia
   Portada de V65-buscador/publico/V65-09-perfil-farmacia-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-buscar-perfil-farmacia-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-farmacia-detalle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarPerfilFarmaciaDetalle {}
