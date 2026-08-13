/* V04-02·F · Nueva membresía
   Portada de V04-directory/security-admin/V04-02-membresias-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-organizaciones-membresias-formulario',
  imports: [RouterLink],
  templateUrl: './membresias-formulario.html',
})
export class OrganizacionesMembresiasFormulario {}
