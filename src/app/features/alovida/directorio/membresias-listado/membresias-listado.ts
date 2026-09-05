/* V04-02·L · Membresías
   Portada de V04-directory/security-admin/V04-02-membresias-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-membresias-listado',
  imports: [RouterLink],
  templateUrl: './membresias-listado.html',
})
export class DirectorioMembresiasListado {}
