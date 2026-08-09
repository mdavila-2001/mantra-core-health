import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Link } from '../../shared/components/atoms/link/link';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';

/**
 * Pantalla para una URL que no existe.
 *
 * Antes el comodín redirigía a `/`, lo que mandaba a quien escribiera mal una
 * dirección al panel —o al login, vía el guard— **sin decirle que se había
 * equivocado**. Para quien navega con lector de pantalla, un destino inesperado
 * y silencioso es especialmente desorientador.
 *
 * Reutiliza el mismo texto que el estado **S6** del M34 y por el mismo motivo:
 * no dice si el recurso existe. Una URL desconocida y una que existe pero no se
 * puede ver tienen que verse igual.
 */
@Component({
  selector: 'app-not-found',
  imports: [EmptyState, Link, RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
