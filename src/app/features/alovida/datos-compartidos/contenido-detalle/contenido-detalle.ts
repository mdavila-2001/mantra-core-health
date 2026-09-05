/* V02-02 · Contenido
   Portada de V02-common/sesion-autenticada/V02-02-contenido-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-contenido-detalle',
  imports: [RouterLink],
  templateUrl: './contenido-detalle.html',
})
export class DatosCompartidosContenidoDetalle {}
