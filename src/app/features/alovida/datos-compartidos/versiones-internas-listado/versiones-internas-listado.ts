/* V02-08·L · Versiones (archivos)
   Portada de V02-common/security-admin/V02-08-versiones-internas-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-datos-compartidos-versiones-internas-listado',
  imports: [RouterLink],
  templateUrl: './versiones-internas-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosCompartidosVersionesInternasListado {}
