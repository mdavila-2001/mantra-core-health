/* V04-07·F · Nueva organización hija
   Portada de V04-directory/security-admin/V04-07-organizaciones-hijas-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-organizaciones-hijas-formulario',
  imports: [RouterLink],
  templateUrl: './organizaciones-hijas-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioOrganizacionesHijasFormulario {}
