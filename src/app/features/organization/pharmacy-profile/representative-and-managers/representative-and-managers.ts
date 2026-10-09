import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FichaDeContacto } from './contact-sheet/contact-sheet';
import { NOTA_DE_DATOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import type { GenteDeLaEmpresa } from '../pharmacy-profile.types';

/**
 * **Quién responde por la empresa**: el representante legal y los tres
 * gerentes que el registro del cliente nombra.
 *
 * Los cuatro se dibujan con la **misma** ficha de contacto: los datos que el
 * registro les pide son los mismos, y lo único propio del representante es su
 * poder, que no se copia acá —vive en la carpeta de documentos, y desde acá se
 * llega hasta él—. Duplicar el papel en dos pestañas sería tener dos versiones
 * del mismo archivo, que es justamente lo que una carpeta legal evita.
 */
@Component({
  selector: 'app-representative-and-managers',
  imports: [AppButton, Chip, FichaDeContacto, Skeleton, ViewStateHost],
  templateUrl: './representative-and-managers.html',
  styleUrl: './representative-and-managers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepresentanteYGerentes {
  readonly state = input.required<ViewState<GenteDeLaEmpresa>>();

  /** La persona pidió reintentar; el dueño de los datos decide qué hacer. */
  readonly retry = output<void>();

  /** Pidieron ver el poder del representante, que vive en «Documentos». */
  readonly poderPedido = output<void>();

  /**
   * De lectura (contra la API real): sin rótulo de ejemplo y sin el salto al
   * poder, que no está entre las licencias de la carpeta.
   */
  readonly readOnly = input(false);

  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  protected readonly gente = computed(() => dataOf(this.state()));
}
