/* V05-02·F · Nuevo vínculo de identidad
   Portada de V05-profiles/security-admin/V05-02-vinculos-de-identidad-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-vinculos-de-identidad-formulario',
  imports: [RouterLink],
  templateUrl: './vinculos-de-identidad-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasVinculosDeIdentidadFormulario {}
