/* V04-03·F · Asignar la membresía a una sucursal
   Portada de V04-directory/security-admin/V04-03-asignaciones-de-sucursal-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-asignaciones-de-sucursal-formulario',
  imports: [RouterLink],
  templateUrl: './asignaciones-de-sucursal-formulario.html',
})
export class DirectorioAsignacionesDeSucursalFormulario {}
