/* V06-14·F · Nueva política de acceso
   Portada de V06-authz/security-admin/V06-14-politicas-de-acceso-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-accesos-politicas-de-acceso-formulario',
  imports: [RouterLink],
  templateUrl: './politicas-de-acceso-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesosPoliticasDeAccesoFormulario {}
