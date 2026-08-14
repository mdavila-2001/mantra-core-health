/* V06-12·F · Configurar el enmascaramiento de campos
   Portada de V06-authz/security-admin/V06-12-permisos-de-campo-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-accesos-permisos-de-campo-formulario',
  imports: [RouterLink],
  templateUrl: './permisos-de-campo-formulario.html',
})
export class AccesosPermisosDeCampoFormulario {}
