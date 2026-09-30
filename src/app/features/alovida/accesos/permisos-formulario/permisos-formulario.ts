/* V06-09·F · Nuevo permiso
   Portada de V06-authz/security-admin/V06-09-permisos-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-permisos-formulario',
  imports: [RouterLink],
  templateUrl: './permisos-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosPermisosFormulario {}
