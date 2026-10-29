/* V06-08·L · Categorías de permiso
   Portada de V06-authz/security-admin/V06-08-categorias-de-permiso-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-categorias-de-permiso-listado',
  imports: [RouterLink],
  templateUrl: './categorias-de-permiso-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosCategoriasDePermisoListado {}
