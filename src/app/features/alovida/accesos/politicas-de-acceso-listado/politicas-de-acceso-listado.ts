/* V06-14·L · Políticas de acceso
   Portada de V06-authz/security-admin/V06-14-politicas-de-acceso-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-politicas-de-acceso-listado',
  imports: [RouterLink],
  templateUrl: './politicas-de-acceso-listado.html',
})
export class AccesosPoliticasDeAccesoListado {}
