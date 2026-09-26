/* V02-06·L · Direcciones
   Portada de V02-common/sesion-autenticada/V02-06-direcciones-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-direcciones-listado',
  imports: [RouterLink],
  templateUrl: './direcciones-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosDireccionesListado {}
