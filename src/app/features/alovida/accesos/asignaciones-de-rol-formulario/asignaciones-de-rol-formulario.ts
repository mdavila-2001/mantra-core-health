/* V06-16·F · Asignar un rol
   Portada de V06-authz/security-admin/V06-16-asignaciones-de-rol-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-asignaciones-de-rol-formulario',
  imports: [RouterLink],
  templateUrl: './asignaciones-de-rol-formulario.html',
})
export class AccesosAsignacionesDeRolFormulario {}
