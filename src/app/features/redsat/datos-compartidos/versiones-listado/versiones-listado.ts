/* V02-04·L · Versiones (archivos)
   Portada de V02-common/sesion-autenticada/V02-04-versiones-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-versiones-listado',
  imports: [RouterLink],
  templateUrl: './versiones-listado.html',
})
export class DatosCompartidosVersionesListado {}
