/* V02-03·L · Vínculos
   Portada de V02-common/sesion-autenticada/V02-03-vinculos-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-vinculos-listado',
  imports: [RouterLink],
  templateUrl: './vinculos-listado.html',
})
export class DatosCompartidosVinculosListado {}
