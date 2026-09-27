/* V06-10·L · Concesiones de alcance de recurso
   Portada de V06-authz/security-admin/V06-10-alcance-de-recurso-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-alcance-de-recurso-listado',
  imports: [RouterLink],
  templateUrl: './alcance-de-recurso-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosAlcanceDeRecursoListado {}
