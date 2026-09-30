/* V04-04·F · Cambiar el rol de la membresía
   Portada de V04-directory/security-admin/V04-04-roles-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-roles-formulario',
  imports: [RouterLink],
  templateUrl: './roles-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioRolesFormulario {}
