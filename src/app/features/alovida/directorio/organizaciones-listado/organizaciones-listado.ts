/* V04-01·L · Organizaciones
   Portada de V04-directory/security-admin/V04-01-organizaciones-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-organizaciones-listado',
  imports: [RouterLink],
  templateUrl: './organizaciones-listado.html',
})
export class DirectorioOrganizacionesListado {}
