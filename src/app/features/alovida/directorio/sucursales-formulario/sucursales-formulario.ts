/* V04-06·F · Nueva sucursal
   Portada de V04-directory/security-admin/V04-06-sucursales-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-sucursales-formulario',
  imports: [RouterLink],
  templateUrl: './sucursales-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioSucursalesFormulario {}
