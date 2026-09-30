/* V03-12·L · Políticas de catálogo
   Portada de V03-terminology/security-admin/V03-12-politicas-de-catalogo-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-politicas-de-catalogo-listado',
  imports: [RouterLink],
  templateUrl: './politicas-de-catalogo-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaPoliticasDeCatalogoListado {}
