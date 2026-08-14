/* V03-07·L · Conceptos
   Portada de V03-terminology/sesion-autenticada/V03-07-conceptos-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-terminologia-conceptos-listado',
  imports: [RouterLink],
  templateUrl: './conceptos-listado.html',
})
export class TerminologiaConceptosListado {}
