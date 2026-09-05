/* V03-08·F · Retirar un concepto
   Portada de V03-terminology/security-admin/V03-08-deprecacion-de-concepto-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-deprecacion-de-concepto-formulario',
  imports: [RouterLink],
  templateUrl: './deprecacion-de-concepto-formulario.html',
})
export class TerminologiaDeprecacionDeConceptoFormulario {}
