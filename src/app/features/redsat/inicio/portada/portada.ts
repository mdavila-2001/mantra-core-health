/* AloVida — la plataforma de operaciones de salud de Mantra Core
   Portada de landing/index.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';
import { RedsatThemeToggleDirective } from '@core/redsat/redsat-theme-toggle.directive';

@Component({
  selector: 'app-redsat-inicio-portada',
  imports: [RouterLink, RedsatThemeToggleDirective],
  templateUrl: './portada.html',
})
export class InicioPortada {}
