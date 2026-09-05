/* V04-05·F · Transferir la membresía entre sucursales
   Portada de V04-directory/security-admin/V04-05-transferencias-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-transferencias-formulario',
  imports: [RouterLink],
  templateUrl: './transferencias-formulario.html',
})
export class DirectorioTransferenciasFormulario {}
