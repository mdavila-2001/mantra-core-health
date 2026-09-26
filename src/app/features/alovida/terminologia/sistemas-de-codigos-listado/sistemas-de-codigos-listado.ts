/* V03-05·L · Sistemas de códigos
   Portada de V03-terminology/security-admin/V03-05-sistemas-de-codigos-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-sistemas-de-codigos-listado',
  imports: [RouterLink],
  templateUrl: './sistemas-de-codigos-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaSistemasDeCodigosListado {}
