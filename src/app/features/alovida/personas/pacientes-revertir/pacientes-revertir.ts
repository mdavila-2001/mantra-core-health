/* V05-01·A · Revertir la fusión
   Portada de V05-profiles/security-admin/V05-01-pacientes-revertir.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-personas-pacientes-revertir',
  imports: [RouterLink],
  templateUrl: './pacientes-revertir.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonasPacientesRevertir {}
