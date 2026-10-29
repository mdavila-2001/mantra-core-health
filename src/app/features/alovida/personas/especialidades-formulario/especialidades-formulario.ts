/* V05-11·F · Nueva especialidad
   Portada de V05-profiles/security-admin/V05-11-especialidades-formulario.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-especialidades-formulario',
  imports: [RouterLink],
  templateUrl: './especialidades-formulario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasEspecialidadesFormulario {}
