/* V02-01·A · Eliminar el archivo
   Portada de V02-common/sesion-autenticada/V02-01-archivos-eliminar.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-archivos-eliminar',
  imports: [RouterLink],
  templateUrl: './archivos-eliminar.html',
})
export class DatosCompartidosArchivosEliminar {}
