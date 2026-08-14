/* V04-04·F · Cambiar el rol de la membresía
   Portada de V04-directory/security-admin/V04-04-roles-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-organizaciones-roles-formulario',
  imports: [RouterLink],
  templateUrl: './roles-formulario.html',
})
export class OrganizacionesRolesFormulario {}
