/* V03-10·F · Propiedades del concepto
   Portada de V03-terminology/security-admin/V03-10-propiedades-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-propiedades-formulario',
  imports: [RouterLink],
  templateUrl: './propiedades-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaPropiedadesFormulario {}
