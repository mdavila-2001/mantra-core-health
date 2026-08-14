/* V02-03·F · Nuevo vínculo
   Portada de V02-common/sesion-autenticada/V02-03-vinculos-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-vinculos-formulario',
  imports: [RouterLink],
  templateUrl: './vinculos-formulario.html',
})
export class DatosCompartidosVinculosFormulario {}
