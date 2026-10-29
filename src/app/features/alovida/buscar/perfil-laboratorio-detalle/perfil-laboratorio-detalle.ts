/* V65-10·D · Perfil del laboratorio
   Portada de V65-buscador/publico/V65-10-perfil-laboratorio-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-buscar-perfil-laboratorio-detalle',
  imports: [RouterLink],
  templateUrl: './perfil-laboratorio-detalle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarPerfilLaboratorioDetalle {}
