/* V02-07·L · Identificadores
   Portada de V02-common/sesion-autenticada/V02-07-identificadores-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-identificadores-listado',
  imports: [RouterLink],
  templateUrl: './identificadores-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosIdentificadoresListado {}
