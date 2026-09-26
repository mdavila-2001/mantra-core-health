/* V04-02·A · Dar de baja la membresía
   Portada de V04-directory/security-admin/V04-02-membresias-dar-de-baja.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-directorio-membresias-dar-de-baja',
  imports: [RouterLink],
  templateUrl: './membresias-dar-de-baja.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioMembresiasDarDeBaja {}
