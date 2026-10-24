/* V05-10·F · Nueva autorización de jurisdicción
   Portada de V05-profiles/security-admin/V05-10-autorizaciones-de-jurisdiccion-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-autorizaciones-de-jurisdiccion-formulario',
  imports: [RouterLink],
  templateUrl: './autorizaciones-de-jurisdiccion-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasAutorizacionesDeJurisdiccionFormulario {}
