/* AloVida — la plataforma de operaciones de salud de Mantra Core
   Portada de landing/index.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { AlovidaThemeToggleDirective } from '@core/alovida/alovida-theme-toggle.directive';

@Component({
  selector: 'app-alovida-inicio-portada',
  imports: [RouterLink, AlovidaThemeToggleDirective],
  templateUrl: './portada.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPortada {}
