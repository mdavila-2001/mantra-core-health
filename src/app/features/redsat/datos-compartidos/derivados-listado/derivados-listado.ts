/* V02-09·L · Derivados
   Portada de V02-common/sesion-autenticada/V02-09-derivados-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-derivados-listado',
  imports: [RouterLink],
  templateUrl: './derivados-listado.html',
})
export class DatosCompartidosDerivadosListado {}
