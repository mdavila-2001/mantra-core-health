/* V02-06·F · Nueva dirección
   Portada de V02-common/sesion-autenticada/V02-06-direcciones-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-direcciones-formulario',
  imports: [RouterLink],
  templateUrl: './direcciones-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosDireccionesFormulario {}
