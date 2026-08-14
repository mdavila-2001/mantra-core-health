/* V03-09·F · Nueva designación
   Portada de V03-terminology/security-admin/V03-09-designaciones-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-terminologia-designaciones-formulario',
  imports: [RouterLink],
  templateUrl: './designaciones-formulario.html',
})
export class TerminologiaDesignacionesFormulario {}
