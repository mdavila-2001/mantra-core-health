/* V05-08·F · Nuevo vínculo de cuenta
   Portada de V05-profiles/security-admin/V05-08-vinculos-de-cuenta-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-vinculos-de-cuenta-formulario',
  imports: [RouterLink],
  templateUrl: './vinculos-de-cuenta-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasVinculosDeCuentaFormulario {}
