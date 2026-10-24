import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { EstadoDeDocumento } from '../document-availability';

interface Aviso {
  readonly texto: string;
  readonly tono: 'neutro' | 'ok';
  readonly icono: NavIconName;
}

/**
 * C-10 / MD-01 · la línea de estado del documento, debajo del par
 * número + departamento.
 *
 * El error en sí lo pinta el campo (con su borde y su mensaje); esto sólo dice
 * en qué anda la comprobación, para que «comprobando» y «disponible» no sean
 * silencio. Es `role="status"`: el lector lo anuncia sin robar el foco. No
 * transmite nada sólo por color: cada estado tiene su texto y su icono.
 *
 * También dice cuando no hay con qué elegir el departamento: con
 * `caido` pinta el aviso con su «Reintentar» en el lugar del
 * desplegable (el campo del departamento pasa a `custom`; ver
 * `campoDepartamentoEmisor`).
 */
@Component({
  selector: 'app-document-availability-status',
  imports: [AppButton, NavIcon],
  templateUrl: './document-availability-status.html',
  styleUrl: './document-availability-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentAvailabilityStatus {
  readonly estado = input<EstadoDeDocumento>('sin-dato');
  /** El catálogo de departamentos no cargó: en vez del estado, el aviso con su reintento. */
  readonly caido = input(false, { transform: booleanAttribute });
  readonly reintentar = output<void>();

  protected readonly aviso = computed<Aviso | null>(() => {
    switch (this.estado()) {
      case 'falta-departamento':
        return {
          texto: 'Elija el departamento de emisión para comprobar si el documento está libre.',
          tono: 'neutro',
          icono: 'pin',
        };
      case 'comprobando':
        return { texto: 'Comprobando el documento…', tono: 'neutro', icono: 'clock' };
      case 'libre':
        return { texto: 'Documento disponible.', tono: 'ok', icono: 'check-circle' };
      // «Ya registrado» lo dice el campo, con su borde y su mensaje: repetirlo
      // acá era un segundo texto rojo, con otro tono y otra redacción, que el
      // lector anunciaba dos veces (segunda pasada, 2026-10-24).
      case 'tomado':
        return null;
      case 'sin-respuesta':
        return {
          texto: 'No pudimos comprobar el documento ahora. Lo revisamos al enviar.',
          tono: 'neutro',
          // No `refresh`: prometería un reintento que no hay.
          icono: 'history',
        };
      default:
        return null;
    }
  });
}
