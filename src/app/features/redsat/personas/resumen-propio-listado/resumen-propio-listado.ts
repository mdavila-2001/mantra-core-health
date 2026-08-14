/* V05-03·L · Resumen propio
   Portada de V05-profiles/sesion-autenticada/V05-03-resumen-propio-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-resumen-propio-listado',
  imports: [RouterLink],
  templateUrl: './resumen-propio-listado.html',
})
export class PersonasResumenPropioListado {}
