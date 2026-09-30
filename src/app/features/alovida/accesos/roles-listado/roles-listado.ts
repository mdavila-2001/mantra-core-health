/* V06-11·L · Roles
   Portada de V06-authz/security-admin/V06-11-roles-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-roles-listado',
  imports: [RouterLink],
  templateUrl: './roles-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosRolesListado {}
