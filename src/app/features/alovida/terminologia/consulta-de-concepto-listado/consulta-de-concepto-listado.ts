/* V03-02·L · Consulta de concepto
   Portada de V03-terminology/sesion-autenticada/V03-02-consulta-de-concepto-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-consulta-de-concepto-listado',
  imports: [RouterLink],
  templateUrl: './consulta-de-concepto-listado.html',
})
export class TerminologiaConsultaDeConceptoListado {}
