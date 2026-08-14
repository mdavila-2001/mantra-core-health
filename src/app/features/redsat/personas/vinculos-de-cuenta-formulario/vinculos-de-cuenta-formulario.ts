/* V05-08·F · Nuevo vínculo de cuenta
   Portada de V05-profiles/security-admin/V05-08-vinculos-de-cuenta-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-redsat-personas-vinculos-de-cuenta-formulario',
  imports: [RouterLink],
  templateUrl: './vinculos-de-cuenta-formulario.html',
})
export class PersonasVinculosDeCuentaFormulario {}
