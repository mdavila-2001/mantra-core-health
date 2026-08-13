/* V02-04·F · Nueva versión
   Portada de V02-common/sesion-autenticada/V02-04-versiones-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-versiones-formulario',
  imports: [RouterLink],
  templateUrl: './versiones-formulario.html',
})
export class DatosCompartidosVersionesFormulario {}
