/* V02-01·A · Obtener el enlace de descarga
   Portada de V02-common/sesion-autenticada/V02-01-archivos-obtener-enlace.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-archivos-obtener-enlace',
  imports: [RouterLink],
  templateUrl: './archivos-obtener-enlace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosArchivosObtenerEnlace {}
