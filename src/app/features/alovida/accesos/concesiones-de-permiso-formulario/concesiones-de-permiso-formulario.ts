/* V06-15·F · Nueva concesión de permiso
   Portada de V06-authz/security-admin/V06-15-concesiones-de-permiso-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-concesiones-de-permiso-formulario',
  imports: [RouterLink],
  templateUrl: './concesiones-de-permiso-formulario.html',
})
export class AccesosConcesionesDePermisoFormulario {}
