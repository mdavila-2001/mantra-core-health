/* V06-09·F · Nuevo permiso
   Portada de V06-authz/security-admin/V06-09-permisos-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-accesos-permisos-formulario',
  imports: [RouterLink],
  templateUrl: './permisos-formulario.html',
})
export class AccesosPermisosFormulario {}
