import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { SavedPlaces } from '../../../core/data-access/profiles/saved-places';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { SearchOrigin, SearchOriginSource } from './search-origin-picker.types';

/** Mismo margen que ya usaba `/nearby-places`: diez segundos y cinco minutos de caché. */
const GPS_TIMEOUT_MS = 10_000;
const GPS_MAX_AGE_MS = 300_000;

/**
 * **Desde dónde buscar** (FT-19 · subtarea B.2).
 *
 * Antes de este componente, `/nearby-places` sólo sabía pedirle la ubicación
 * al navegador: quien la negaba, o entraba desde un escritorio sin antena,
 * se quedaba sin poder ver nada cercano. El paciente ya declara su domicilio
 * y su trabajo en «Mi perfil» —con coordenadas, desde que existe
 * `app-ubicacion-picker`— y ese dato es justo lo que hacía falta para no
 * depender del permiso del navegador.
 *
 * ## Qué hace, y qué no hace
 *
 * Ofrece los lugares guardados y, siempre, «Ubicación actual». **No pide
 * nada por su cuenta**: sólo llama a `getCurrentPosition` cuando la persona
 * toca esa opción, igual que el resto del producto. Y no persiste nada: el
 * origen elegido vive en la pantalla que lo consume, no acá.
 *
 * ## La siembra, una sola vez
 *
 * Al llegar los lugares guardados, si todavía no hay origen elegido
 * (`origin() === null`), se elige la casa —o el trabajo, si no hay casa—
 * automáticamente: es la lectura más útil por defecto, y es la que evita
 * pedir el GPS sin necesidad. Una vez que el consumidor tiene un origen —el
 * sembrado o uno que la persona eligió—, el efecto no vuelve a tocarlo.
 */
@Component({
  selector: 'app-search-origin-picker',
  imports: [Alert, AppButton, RouterLink, SegmentedControl],
  templateUrl: './search-origin-picker.html',
  styleUrl: './search-origin-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchOriginPicker {
  private readonly documento = inject(DOCUMENT);

  /** Los lugares guardados del perfil; `null` mientras se están cargando. */
  readonly places = input.required<SavedPlaces | null>();

  /** El origen activo, controlado por quien consume el componente. */
  readonly origin = input<SearchOrigin | null>(null);

  /** El origen elegido. Nunca `null`: mientras no hay uno, no se emite nada. */
  readonly originChange = output<SearchOrigin>();

  /** Si se está esperando al navegador ahora mismo. */
  protected readonly locating = signal(false);

  /** Si el navegador negó —o no pudo dar— la ubicación actual. */
  protected readonly denied = signal(false);

  constructor() {
    effect(() => {
      const places = this.places();
      if (places === null || this.origin() !== null) {
        return;
      }
      const predeterminado = places.home ?? places.work;
      if (predeterminado === null) {
        return;
      }
      this.originChange.emit({
        source: places.home !== null ? 'home' : 'work',
        lat: predeterminado.lat,
        lng: predeterminado.lng,
      });
    });
  }

  /** Si hay al menos un lugar guardado: decide entre el selector y el botón único. */
  protected readonly hasSavedPlace = computed(() => {
    const places = this.places();
    return places !== null && (places.home !== null || places.work !== null);
  });

  /** Las opciones del selector: sólo los lugares que existen, y siempre «actual». */
  protected readonly options = computed<readonly SegmentedOption<SearchOriginSource>[]>(() => {
    const places = this.places();
    const opciones: SegmentedOption<SearchOriginSource>[] = [];
    if (places?.home) {
      opciones.push({ value: 'home', label: 'Tu casa', icon: 'home' });
    }
    if (places?.work) {
      opciones.push({ value: 'work', label: 'Tu trabajo', icon: 'briefcase' });
    }
    opciones.push({ value: 'current', label: 'Ubicación actual', icon: 'pin' });
    return opciones;
  });

  /** El valor activo del selector: el origen elegido, o «actual» mientras no hay ninguno. */
  protected readonly selected = computed<SearchOriginSource>(
    () => this.origin()?.source ?? 'current',
  );

  /** Reacciona a una opción del selector. */
  protected elegir(source: SearchOriginSource): void {
    const places = this.places();
    if (source === 'home' && places?.home) {
      this.denied.set(false);
      this.originChange.emit({ source: 'home', ...places.home });
      return;
    }
    if (source === 'work' && places?.work) {
      this.denied.set(false);
      this.originChange.emit({ source: 'work', ...places.work });
      return;
    }
    this.useCurrentLocation();
  }

  /**
   * Pide la ubicación al navegador.
   *
   * Un fallo —negado, no disponible, o sin API porque el render es de
   * servidor— deja el origen anterior como estaba: es la comodidad la que
   * falla, no la búsqueda.
   */
  protected useCurrentLocation(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      this.denied.set(true);
      return;
    }

    this.locating.set(true);
    this.denied.set(false);
    geo.getCurrentPosition(
      (posicion) => {
        this.locating.set(false);
        this.originChange.emit({
          source: 'current',
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
      },
      () => {
        this.locating.set(false);
        this.denied.set(true);
      },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: GPS_MAX_AGE_MS },
    );
  }
}
