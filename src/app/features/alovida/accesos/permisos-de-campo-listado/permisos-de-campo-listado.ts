/* V06-12·L · Permisos de campo
   Portada de V06-authz/security-admin/V06-12-permisos-de-campo-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-permisos-de-campo-listado',
  imports: [RouterLink],
  templateUrl: './permisos-de-campo-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosPermisosDeCampoListado {}
