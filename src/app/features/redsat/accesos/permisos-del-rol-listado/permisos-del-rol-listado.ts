/* V06-13·L · Permisos del rol
   Portada de V06-authz/security-admin/V06-13-permisos-del-rol-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-accesos-permisos-del-rol-listado',
  imports: [RouterLink],
  templateUrl: './permisos-del-rol-listado.html',
})
export class AccesosPermisosDelRolListado {}
