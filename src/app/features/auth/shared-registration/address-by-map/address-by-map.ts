import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';
import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { Select as AppSelect } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMap } from '@shared/components/organisms/map/map-pin.types';
import { CARGADOR_DE_PROVINCIAS } from '@shared/components/organisms/map/provinces';
import { provinciaDeMunicipio, resolverUbicacion } from '@shared/geo/bolivia-locator';

import { NOTICE_REWRITE_ADDRESS, type Coordinates } from '../map-location-picker/map-location-picker';

/** El acercamiento al punto elegido: el mismo que `app-map` usa para un solo pin. */
const ZOOM_AL_ELEGIR = 15;

/** Cuánto se espera al navegador antes de dar la ubicación por perdida. */
const GPS_TIMEOUT_MS = 10_000;

/**
 * Une la calle y el distrito en la «línea de dirección» que viaja a la API.
 *
 * El distrito **no tiene columna propia** (`common.addresses` guarda `lines`,
 * municipio, departamento y coordenadas), pero la persona lo escribió y no se
 * tira: va pegado a la calle, que es un texto libre. Si ya empieza con
 * «Distrito» se respeta; si no, se le antepone para que se lea como lo que es.
 *
 * @returns La línea completa, o `''` si no se escribió ni calle ni distrito.
 */
export function unirCalleYDistrito(calle: string, distrito: string): string {
  const c = calle.trim();
  const d = distrito.trim();
  if (d === '') return c;
  const rotulado = /^distrito\b/i.test(d) ? d : `Distrito ${d}`;
  return c === '' ? rotulado : `${c}, ${rotulado}`;
}

/**
 * La dirección, **empezando por el mapa**.
 *
 * ## El flujo
 *
 * 1. Se ve el mapa de Bolivia entero, con sus provincias, esperando un toque.
 * 2. Al tocar, el mapa se acerca al punto y **aparece, ya lleno, el
 *    formulario**: calle, distrito, municipio, provincia y departamento.
 * 3. La persona corrige lo que haga falta y escribe la calle. Tocar el mapa de
 *    nuevo mueve el punto y vuelve a llenar lo que sale del lugar.
 *
 * Reemplaza al selector que pedía primero un departamento, después una ciudad,
 * después la calle y, aparte, un punto en el mapa que había que confirmar.
 * Acá **el punto es lo primero**, y tocarlo es la confirmación: lo que se ve
 * en el formulario es lo que viaja.
 *
 * ## Qué sale del mapa y qué escribe la persona
 *
 * Departamento, provincia y municipio salen de cruzar el punto con los
 * límites que el producto ya trae (`resolverUbicacion`); no hay llamada a un
 * geocodificador. **La calle y el distrito los escribe la persona**: no hay
 * capa de calles ni de distritos, y una calle inventada es peor que un campo
 * vacío. La provincia se muestra pero no se guarda aparte: el código del
 * municipio ya la define.
 *
 * ## Si el mapa no alcanza
 *
 * Quien no puede apuntar —teclado, lector de pantalla, un punto que el mapa no
 * ubica— tiene «Completar a mano», que abre el mismo formulario sin punto, con
 * los selects de departamento y municipio. Nada de esto frena el alta: la
 * obligatoriedad (si la hay) es la del municipio, y la valida quien monta el
 * componente.
 *
 * ## Qué sale
 *
 * Cuatro `model`: `municipio` (el `conceptId`, que es lo que viaja), `calle`,
 * `distrito` y `punto`. El departamento **no** sale: lo deriva el backend del
 * código del municipio.
 */
@Component({
  selector: 'app-address-by-map',
  imports: [AppButton, AppMap, AppSelect, FormField, Input],
  templateUrl: './address-by-map.html',
  styleUrl: './address-by-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressByMap {
  private readonly document = inject(DOCUMENT);
  private readonly cargarProvincias = inject(CARGADOR_DE_PROVINCIAS);

  /** El árbol del catálogo: cada departamento con sus municipios. */
  readonly ramas = input.required<readonly RamaDepartamento[]>();

  /** Prefijo de los `data-testid`. */
  readonly testId = input('address');

  /** Identificador del pin en el mapa. No es un uuid a propósito. */
  readonly pinId = input('direccion');

  /** Nombre accesible del mapa. */
  readonly etiquetaMapa = input('Mapa de Bolivia: toque el lugar');

  /** Lo que se le pide tocar («el lugar donde vive»). */
  readonly indicacion = input('Toque en el mapa el lugar donde queda. El resto se completa solo.');

  /** Cómo se llama el pin. */
  readonly etiquetaDelPin = input('El punto que marcó');

  readonly calleLabel = input('Calle y número (opcional)');
  readonly calleHint = input('Como la escribiría en un sobre.');
  readonly callePlaceholder = input('Av. Banzer, 3er anillo #42');
  readonly calleTestId = input<string | null>(null);

  /**
   * La explicación del municipio, la que el campo muestra al apuntarlo o al
   * enfocarlo. Vacía —lo normal— no dibuja nada. Ver `description` en
   * `app-form-field`.
   */
  readonly municipioDescription = input('');

  /** Si el municipio lleva asterisco. La validación vive en quien monta esto. */
  readonly required = input(false);

  /** El error del municipio, cuando quien monta esto lo tiene. */
  readonly errorMessage = input('');

  /** El `conceptId` del municipio: lo único del lugar que viaja a la API. */
  readonly municipio = model<string | null>(null);

  /** La calle y el número, escritos por la persona. */
  readonly calle = model('');

  /** El distrito, escrito por la persona. Ver {@link unirCalleYDistrito}. */
  readonly distrito = model('');

  /** El punto elegido en el mapa, o `null`. Salir hacia el padre es confirmarlo. */
  readonly punto = model<Coordinates | null>(null);

  /** La provincia que dedujo el mapa. No viaja: el municipio ya la define. */
  protected readonly provincia = signal<string | null>(null);

  /** El departamento elegido a mano, cuando todavía no hay municipio. */
  private readonly departamentoManual = signal<string | null>(null);

  /** Si se pidió el formulario sin punto («Completar a mano»). */
  private readonly aMano = signal(false);

  protected readonly resolviendo = signal(false);
  protected readonly pidiendoGps = signal(false);
  protected readonly gpsRechazado = signal(false);

  /** El último toque cayó fuera de Bolivia, o el mapa no supo ubicarlo. */
  protected readonly sinLugar = signal(false);

  /** Si el mapa vació una calle escrita al moverse el punto (D-06). */
  protected readonly calleVaciada = signal(false);

  protected readonly anuncio = signal('');
  protected readonly avisoReescribir = NOTICE_REWRITE_ADDRESS;

  /** Para descartar la respuesta de un toque que ya fue pisado por otro. */
  private turno = 0;

  /** El formulario aparece con un punto, con un municipio ya elegido, o a mano. */
  protected readonly conFormulario = computed(
    () =>
      this.punto() !== null ||
      this.municipio() !== null ||
      this.departamentoManual() !== null ||
      this.aMano(),
  );

  /** El departamento vigente: el del municipio elegido, si lo hay; si no, el manual. */
  protected readonly departamento = computed<string | null>(() => {
    const municipio = this.municipio();
    if (municipio !== null) {
      const rama = this.ramas().find((r) => r.municipios.some((m) => m.conceptId === municipio));
      if (rama !== undefined) return rama.conceptId;
    }
    return this.departamentoManual();
  });

  protected readonly opcionesDepartamento = computed<readonly SelectOption<string>[]>(() =>
    this.ramas().map((r) => ({ value: r.conceptId, label: r.nombre })),
  );

  protected readonly opcionesMunicipio = computed<readonly SelectOption<string>[]>(() => {
    const rama = this.ramas().find((r) => r.conceptId === this.departamento());
    return rama === undefined ? [] : rama.municipios.map((m) => ({ value: m.conceptId, label: m.nombre }));
  });

  protected readonly pines = computed<readonly PinMap[]>(() => {
    const punto = this.punto();
    if (punto === null) return [];
    return [{ id: this.pinId(), lat: punto.lat, lng: punto.lng, titulo: this.etiquetaDelPin() }];
  });

  /**
   * Un toque sobre el mapa: se averigua dónde cayó y, **si cae en Bolivia**, el
   * punto queda, el mapa se acerca y se llena el formulario.
   *
   * No se toca nada antes de saber dónde cayó: un toque en Brasil o en el
   * océano no puede vaciar la calle que la persona ya había escrito ni abrir un
   * formulario sin lugar. Si no se puede ubicar, queda lo que había y se avisa.
   */
  protected elegirPunto(punto: Coordinates): void {
    void this.aplicar({ lat: punto.lat, lng: punto.lng });
  }

  private async aplicar(elegido: Coordinates): Promise<void> {
    const turno = ++this.turno;
    this.resolviendo.set(true);
    this.sinLugar.set(false);
    this.gpsRechazado.set(false);
    const lugar = await resolverUbicacion(elegido, this.ramas(), this.cargarProvincias);
    if (turno !== this.turno) return;
    this.resolviendo.set(false);

    if (lugar.departamento === null && lugar.municipio === null) {
      this.sinLugar.set(true);
      this.anuncio.set('Ese punto no está en Bolivia. Toque un lugar dentro del país.');
      return;
    }

    // D-06 (pedido del cliente del 22/09/2026): tocar el mapa deja en blanco la
    // dirección escrita, porque ya no describe este punto.
    this.calleVaciada.set(this.calle().trim() !== '' || this.distrito().trim() !== '');
    this.calle.set('');
    this.distrito.set('');
    this.punto.set(elegido);
    this.provincia.set(lugar.provincia);
    this.departamentoManual.set(lugar.departamento?.conceptId ?? null);
    this.municipio.set(lugar.municipio?.conceptId ?? null);
    this.anuncio.set(
      `Punto marcado: ${[lugar.municipio?.nombre, lugar.provincia, lugar.departamento?.nombre]
        .filter((x): x is string => x !== undefined && x !== null)
        .join(', ')}. Revise los datos.`,
    );
  }

  protected usarMiUbicacion(): void {
    const geo = this.document.defaultView?.navigator?.geolocation;
    if (!geo) {
      this.gpsRechazado.set(true);
      return;
    }
    this.pidiendoGps.set(true);
    geo.getCurrentPosition(
      (posicion) => {
        this.pidiendoGps.set(false);
        this.elegirPunto({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
      },
      () => {
        this.pidiendoGps.set(false);
        this.gpsRechazado.set(true);
      },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: 300_000 },
    );
  }

  protected completarAMano(): void {
    this.aMano.set(true);
  }

  protected elegirDepartamento(conceptId: string | null): void {
    this.departamentoManual.set(conceptId);
    this.provincia.set(null);
    const actual = this.municipio();
    if (actual === null) return;
    const rama = this.ramas().find((r) => r.conceptId === conceptId);
    if (!(rama?.municipios.some((m) => m.conceptId === actual) ?? false)) this.municipio.set(null);
  }

  protected elegirMunicipio(conceptId: string | null): void {
    this.municipio.set(conceptId);
    this.provincia.set(null);
    if (conceptId === null) return;
    const rama = this.ramas().find((r) => r.municipios.some((m) => m.conceptId === conceptId));
    const municipio = rama?.municipios.find((m) => m.conceptId === conceptId);
    if (rama === undefined || municipio === undefined) return;
    const turno = ++this.turno;
    void provinciaDeMunicipio(municipio, rama.sigla, this.cargarProvincias).then((nombre) => {
      if (turno === this.turno) this.provincia.set(nombre);
    });
  }

  protected escribirCalle(valor: string | number | null): void {
    this.calle.set(valor === null ? '' : String(valor));
    this.calleVaciada.set(false);
  }

  protected escribirDistrito(valor: string | number | null): void {
    this.distrito.set(valor === null ? '' : String(valor));
  }

  /** Vuelve al principio: el mapa de Bolivia entero y nada elegido. */
  protected empezarDeNuevo(): void {
    this.turno++;
    this.resolviendo.set(false);
    this.punto.set(null);
    this.municipio.set(null);
    this.calle.set('');
    this.distrito.set('');
    this.provincia.set(null);
    this.departamentoManual.set(null);
    this.aMano.set(false);
    this.sinLugar.set(false);
    this.calleVaciada.set(false);
    this.anuncio.set('Se limpió la dirección. Toque el mapa para empezar de nuevo.');
  }

  protected readonly zoomAlElegir = ZOOM_AL_ELEGIR;
}
