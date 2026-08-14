/* V02-05·L · Puntos de contacto
   Portada de V02-common/sesion-autenticada/V02-05-puntos-de-contacto-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-puntos-de-contacto-listado',
  imports: [RouterLink],
  templateUrl: './puntos-de-contacto-listado.html',
})
export class DatosCompartidosPuntosDeContactoListado {}
