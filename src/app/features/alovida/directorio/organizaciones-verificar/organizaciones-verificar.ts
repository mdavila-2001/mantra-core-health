/* V04-01·A · Verificar la organización
   Portada de V04-directory/security-admin/V04-01-organizaciones-verificar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-organizaciones-verificar',
  imports: [RouterLink],
  templateUrl: './organizaciones-verificar.html',
})
export class DirectorioOrganizacionesVerificar {}
