import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';

import type { BranchLocationClient } from '../../../core/data-access/directory/branch-location.client';
import type { PuntoGeo } from '../../../shared/components/organisms/map/map-pin.types';
import {
  coordinatesFromMapUrl,
  isWebUrl,
  type BranchCoordinates,
} from '../../../shared/utils/branch-import/branch-import';

const LINK_DEBOUNCE_MS = 500;

/**
 * The point of the branch being edited: marked on the map or read from the pasted link.
 * A link the browser cannot read (a short `maps.app.goo.gl` one) is asked to the API.
 * Created in a component field initializer (it unsubscribes with the component).
 */
export class BranchLocationState {
  readonly point = signal<BranchCoordinates | null>(null);
  /** Why the link gave no point, or that it is being read; empty otherwise. */
  readonly note = signal('');
  private readonly links = new Subject<string>();

  constructor(
    private readonly client: BranchLocationClient,
    private readonly tenantId: () => string | null,
  ) {
    this.links
      .pipe(
        debounceTime(LINK_DEBOUNCE_MS),
        switchMap((url) => {
          const tenantId = this.tenantId();
          return tenantId === null
            ? of(null)
            : this.client.preview(tenantId, url).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((found) => {
        if (found?.resolved && found.latitude !== undefined && found.longitude !== undefined) {
          this.point.set({ latitude: found.latitude, longitude: found.longitude });
          this.note.set('');
        } else {
          this.note.set('No pudimos leer el punto de ese enlace: márquelo tocando el mapa.');
        }
      });
  }

  /** Opens the dialog with the branch's own point (or none). */
  reset(point: BranchCoordinates | null): void {
    this.point.set(point);
    this.note.set('');
  }

  /** Someone touched the map: that point wins over whatever link was pasted. */
  pick(point: PuntoGeo): void {
    this.point.set({ latitude: point.lat, longitude: point.lng });
    this.note.set('');
  }

  /** The link text changed: read the point from it, or ask the API for it. */
  fromLink(url: string): void {
    const text = url.trim();
    this.note.set('');
    if (text === '' || !isWebUrl(text)) return;
    const local = coordinatesFromMapUrl(text);
    if (local !== null) {
      this.point.set(local);
      return;
    }
    this.note.set('Buscando el punto de ese enlace…');
    this.links.next(text);
  }
}
