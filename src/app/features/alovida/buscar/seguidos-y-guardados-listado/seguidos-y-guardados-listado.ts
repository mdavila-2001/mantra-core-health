/* V65-13·L · Seguidos y guardados
   Portada de V65-buscador/sesion-autenticada/V65-13-seguidos-y-guardados-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alovida-buscar-seguidos-y-guardados-listado',
  imports: [RouterLink],
  templateUrl: './seguidos-y-guardados-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarSeguidosYGuardadosListado {}
