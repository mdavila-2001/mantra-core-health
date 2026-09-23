/* V04-01·F · Nueva organización
   Portada de V04-directory/superadmin/V04-01-organizaciones-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-organizaciones-formulario',
  imports: [RouterLink],
  templateUrl: './organizaciones-formulario.html',
})
export class DirectorioOrganizacionesFormulario {}
