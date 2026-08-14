/* V02-08·A · Registrar el resultado del escaneo
   Portada de V02-common/security-admin/V02-08-versiones-internas-escanear.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-datos-compartidos-versiones-internas-escanear',
  imports: [RouterLink],
  templateUrl: './versiones-internas-escanear.html',
})
export class DatosCompartidosVersionesInternasEscanear {}
