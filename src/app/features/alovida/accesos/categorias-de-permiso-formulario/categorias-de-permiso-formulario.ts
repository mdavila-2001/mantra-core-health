/* V06-08·F · Nueva categoría de permiso
   Portada de V06-authz/security-admin/V06-08-categorias-de-permiso-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-categorias-de-permiso-formulario',
  imports: [RouterLink],
  templateUrl: './categorias-de-permiso-formulario.html',
})
export class AccesosCategoriasDePermisoFormulario {}
