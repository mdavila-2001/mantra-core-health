/* V04-06·L · Sucursales
   Portada de V04-directory/security-admin/V04-06-sucursales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-sucursales-listado',
  imports: [RouterLink],
  templateUrl: './sucursales-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioSucursalesListado {}
