/* V02-09·F · Nuevo derivado
   Portada de V02-common/sesion-autenticada/V02-09-derivados-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-derivados-formulario',
  imports: [RouterLink],
  templateUrl: './derivados-formulario.html',
})
export class DatosCompartidosDerivadosFormulario {}
