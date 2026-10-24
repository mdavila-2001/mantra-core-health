/* V02-01·A · Subir el contenido de un archivo
   Portada de V02-common/sesion-autenticada/V02-01-archivos-subir.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-archivos-subir',
  imports: [RouterLink],
  templateUrl: './archivos-subir.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosArchivosSubir {}
