/* V06-16·L · Asignaciones de rol
   Portada de V06-authz/security-admin/V06-16-asignaciones-de-rol-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-asignaciones-de-rol-listado',
  imports: [RouterLink],
  templateUrl: './asignaciones-de-rol-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosAsignacionesDeRolListado {}
