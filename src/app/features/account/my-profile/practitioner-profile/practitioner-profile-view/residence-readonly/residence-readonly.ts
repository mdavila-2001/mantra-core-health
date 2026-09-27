import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../../../../core/data-access/terminology/bo-municipalities.service';
import { LocationPicker } from '../../../../../auth/registro-compartido/location-picker/location-picker';

/**
 * El municipio de residencia en la ficha del médico, **sólo para mirar**.
 *
 * Son los mismos controles del editor —el mapa de departamentos y el select de
 * municipio—, cargados con lo guardado y bloqueados (pedido del 25/09/2026):
 * el departamento se ve marcado y el municipio elegido, pero ninguno se puede
 * cambiar desde acá. Para cambiarlo está «Editar perfil».
 *
 * Vive aparte porque es lo único de la ficha que pide un catálogo: la vista
 * sigue recibiendo todo por `input` y sin saber de dónde sale.
 */
@Component({
  selector: 'app-residence-readonly',
  imports: [LocationPicker],
  template: `
    @if (ramas().length > 0) {
      <app-location-picker
        [readonly]="true"
        testId="perfil-residencia"
        [ramas]="ramas()"
        [value]="municipioId()"
        mapLabel="Mapa de Bolivia con el departamento donde vivís"
        municipalityLabel="Localidad de residencia"
        municipalityHint="Para cambiarla, entrá a «Editar perfil»."
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResidenceReadonly {
  /** El `conceptId` del municipio guardado. */
  readonly municipioId = input.required<string>();

  /**
   * El catálogo. Si no llega, no se dibuja nada: el nombre del municipio ya
   * está escrito en los datos de contacto, así que no se pierde información.
   */
  protected readonly ramas = toSignal(
    inject(BoMunicipalitiesCatalog)
      .listar()
      .pipe(catchError(() => of([] as readonly RamaDepartamento[]))),
    { initialValue: [] as readonly RamaDepartamento[] },
  );
}
