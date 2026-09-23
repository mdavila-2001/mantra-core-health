/* V05-06·L · Credenciales
   Portada de V05-profiles/security-admin/V05-06-credenciales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-credenciales-listado',
  imports: [RouterLink],
  templateUrl: './credenciales-listado.html',
})
export class PersonasCredencialesListado {}
