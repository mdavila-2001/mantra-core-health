/* V03-13·L · Conjuntos de valor
   Portada de V03-terminology/security-admin/V03-13-conjuntos-de-valor-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-conjuntos-de-valor-listado',
  imports: [RouterLink],
  templateUrl: './conjuntos-de-valor-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaConjuntosDeValorListado {}
