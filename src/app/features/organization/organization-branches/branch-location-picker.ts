import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppMap } from '../../../shared/components/organisms/map/map';
import type { PinMap, PuntoGeo } from '../../../shared/components/organisms/map/map-pin.types';
import type { BranchCoordinates } from '../../../shared/utils/branch-import/branch-import';

const PICKED_ZOOM = 16;

/**
 * The map of the branch dialog: touch it to mark the exact point of the site.
 * It only shows and reports; whoever owns the form decides what the point does.
 */
@Component({
  selector: 'app-branch-location-picker',
  imports: [AppMap],
  template: `
    <app-map
      class="picker"
      data-testid="branches-location-map"
      [pines]="pins()"
      [centro]="center()"
      [zoom]="point() ? zoom : null"
      [seleccionable]="true"
      etiqueta="Mapa para marcar el punto exacto de la sucursal: toque el lugar"
      (pointPicked)="picked.emit($event)"
    />
  `,
  styles: ':host { display: block; inline-size: 100%; } .picker { inline-size: 100%; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchLocationPicker {
  readonly point = input<BranchCoordinates | null>(null);
  readonly picked = output<PuntoGeo>();
  protected readonly zoom = PICKED_ZOOM;

  protected readonly center = computed<PuntoGeo | null>(() => {
    const point = this.point();
    return point === null ? null : { lat: point.latitude, lng: point.longitude };
  });

  protected readonly pins = computed<readonly PinMap[]>(() => {
    const center = this.center();
    return center === null ? [] : [{ ...center, id: 'punto', titulo: 'Punto de la sucursal' }];
  });
}
