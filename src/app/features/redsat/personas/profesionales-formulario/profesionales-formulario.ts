/* V05-09·F · Nuevo profesional
   Portada de V05-profiles/security-admin/V05-09-profesionales-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-profesionales-formulario',
  imports: [RouterLink],
  templateUrl: './profesionales-formulario.html',
})
export class PersonasProfesionalesFormulario {}
