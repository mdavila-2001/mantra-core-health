/* V03-01·L · Versiones de conjuntos de valor
   Portada de V03-terminology/security-admin/V03-01-versiones-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-versiones-listado',
  imports: [RouterLink],
  templateUrl: './versiones-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaVersionesListado {}
