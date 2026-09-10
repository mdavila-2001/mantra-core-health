import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FichaDeContacto } from './ficha-de-contacto/ficha-de-contacto';
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
  selector: 'app-representante-y-gerentes',
  imports: [AppButton, Chip, FichaDeContacto, Skeleton, ViewStateHost],
  templateUrl: './representante-y-gerentes.html',
  styleUrl: './representante-y-gerentes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepresentanteYGerentes {
  readonly state = input.required<ViewState<GenteDeLaEmpresa>>();

  /** La persona pidió reintentar; el dueño de los datos decide qué hacer. */
  readonly retry = output<void>();

  /** Pidieron ver el poder del representante, que vive en «Documentos». */
  readonly poderPedido = output<void>();

  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  protected readonly gente = computed(() => dataOf(this.state()));
}
