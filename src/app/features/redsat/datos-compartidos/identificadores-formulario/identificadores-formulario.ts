/* V02-07·F · Nuevo identificador
   Portada de V02-common/sesion-autenticada/V02-07-identificadores-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-identificadores-formulario',
  imports: [RouterLink],
  templateUrl: './identificadores-formulario.html',
})
export class DatosCompartidosIdentificadoresFormulario {}
