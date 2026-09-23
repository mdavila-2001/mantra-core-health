/* V03-12·F · Política de catálogo
   Portada de V03-terminology/security-admin/V03-12-politicas-de-catalogo-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-politicas-de-catalogo-formulario',
  imports: [RouterLink],
  templateUrl: './politicas-de-catalogo-formulario.html',
})
export class TerminologiaPoliticasDeCatalogoFormulario {}
