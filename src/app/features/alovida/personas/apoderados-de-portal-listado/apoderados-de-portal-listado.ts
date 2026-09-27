/* V05-04·L · Apoderados de portal
   Portada de V05-profiles/security-admin/V05-04-apoderados-de-portal-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-apoderados-de-portal-listado',
  imports: [RouterLink],
  templateUrl: './apoderados-de-portal-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasApoderadosDePortalListado {}
