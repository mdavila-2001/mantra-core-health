/* V06-10·F · Nueva concesión de alcance
   Portada de V06-authz/security-admin/V06-10-alcance-de-recurso-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-alcance-de-recurso-formulario',
  imports: [RouterLink],
  templateUrl: './alcance-de-recurso-formulario.html',
})
export class AccesosAlcanceDeRecursoFormulario {}
