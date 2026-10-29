/* V03-09·L · Designaciones
   Portada de V03-terminology/security-admin/V03-09-designaciones-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-terminologia-designaciones-listado',
  imports: [RouterLink],
  templateUrl: './designaciones-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologiaDesignacionesListado {}
