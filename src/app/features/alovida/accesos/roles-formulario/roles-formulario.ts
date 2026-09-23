/* V06-11·F · Nuevo rol
   Portada de V06-authz/security-admin/V06-11-roles-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-roles-formulario',
  imports: [RouterLink],
  templateUrl: './roles-formulario.html',
})
export class AccesosRolesFormulario {}
