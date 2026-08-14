/* V05-04·F · Nuevo apoderado de portal
   Portada de V05-profiles/security-admin/V05-04-apoderados-de-portal-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-apoderados-de-portal-formulario',
  imports: [RouterLink],
  templateUrl: './apoderados-de-portal-formulario.html',
})
export class PersonasApoderadosDePortalFormulario {}
