/* V02-01·F · Nuevo archivo
   Portada de V02-common/sesion-autenticada/V02-01-archivos-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-archivos-formulario',
  imports: [RouterLink],
  templateUrl: './archivos-formulario.html',
})
export class DatosCompartidosArchivosFormulario {}
