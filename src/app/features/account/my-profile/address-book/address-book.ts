import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  PatientAddressBookClient,
  type PatientAddress,
} from '../../../../core/data-access/profiles/patient-address-book.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { errorMessageOf } from '../../../../shared/forms/form-support';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
  type TestIds,
} from '../../../auth/shared-registration/map-location-picker/map-location-picker';
import { confirmedLocality, samePoint } from '../../../auth/shared-registration/point-locality';

/** Lo que se está editando: una dirección existente, una nueva, o nada. */
type Edicion = { readonly id: string | null; readonly kind: PatientAddress['kind'] } | null;

/**
 * «Mis direcciones»: la libreta del paciente, para los envíos (pedido del
 * cliente del 26/10/2026: «varias ubicaciones guardadas, como si fuera pedidos
 * ya para los envíos»).
 *
 * Es el contenedor: trae la libreta, la muestra y escribe. Cada escritura
 * devuelve la libreta releída de la API, que es la que se pinta —la pantalla
 * nunca supone el orden ni cuál quedó preferida—.
 *
 * El formulario es el mismo selector del alta (`app-map-location-picker`):
 * el mapa abierto, el punto como lo único que se marca —y obligatorio—, y
 * debajo lo que sale de él en sólo lectura: la calle (la trae la API), el mapa
 * de Bolivia acercado, departamento, provincia, municipio y zona (pedido del
 * cliente del 26/10/2026).
 */
@Component({
  selector: 'app-address-book',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Badge,
    FormField,
    MapLocationPicker,
    NavIcon,
    ViewStateHost,
  ],
  templateUrl: './address-book.html',
  styleUrl: './address-book.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressBook {
  private readonly cliente = inject(PatientAddressBookClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly estado = signal<ViewState<readonly PatientAddress[]>>(loading());

  /* ---- el formulario ---------------------------------------------------- */

  protected readonly edicion = signal<Edicion>(null);
  protected readonly nombre = signal('');
  /** El municipio y la calle **no se escriben**: salen del punto. */
  protected readonly municipio = signal<string | null>(null);
  protected readonly calle = signal('');
  /** El punto confirmado en el mapa, o `null`. Obligatorio. */
  protected readonly punto = signal<Coordinates | null>(null);
  /** El punto con el que se abrió (el guardado), para sembrar el mapa. */
  protected readonly puntoInicial = signal<Coordinates | null>(null);
  protected readonly preferida = signal(false);
  protected readonly intentoGuardar = signal(false);
  protected readonly guardando = signal(false);
  /** Lo último que el mapa dedujo de su punto, confirmado o no. */
  private readonly localidad = signal<LocalityFromPoint | null>(null);
  /** La dirección que se está editando, para conservar lo suyo si el punto no cambia. */
  private base: PatientAddress | null = null;
  /** Error de una escritura: se muestra junto a lo que la persona tocó. */
  protected readonly errorDeEscritura = signal<string | null>(null);
  /** El id de la fila con una acción en curso, para bloquear el doble clic. */
  protected readonly ocupada = signal<string | null>(null);

  protected readonly direcciones = computed<readonly PatientAddress[]>(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : [];
  });

  protected readonly guardadas = computed(
    () => this.direcciones().filter((d) => d.kind === 'SAVED').length,
  );

  protected readonly errorDeNombre = computed(() =>
    this.intentoGuardar() && this.edicion()?.kind === 'SAVED' && this.nombre().trim() === ''
      ? 'Póngale un nombre, como «Casa de mi mamá».'
      : '',
  );

  /** Sin punto confirmado no hay dirección: es lo único que se marca. */
  protected readonly errorDePunto = computed(() =>
    this.intentoGuardar() && this.punto() === null
      ? 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».'
      : '',
  );

  /**
   * La localidad sale del punto. Si el punto cae fuera de los municipios del
   * catálogo —o el catálogo no cargó— no hay de dónde sacarla, y la API la exige.
   */
  protected readonly errorDeMunicipio = computed(() =>
    this.intentoGuardar() && this.punto() !== null && this.municipio() === null
      ? 'No encontramos el municipio de ese punto. Márquelo dentro de Bolivia.'
      : '',
  );

  protected readonly idsMapa: TestIds = {
    mapa: 'libreta-mapa',
    confirmada: 'libreta-punto-confirmado',
    avisoGeocodificacion: 'libreta-aviso-calle',
    quitar: 'libreta-quitar-punto',
    confirmar: 'libreta-confirmar-punto',
    usarUbicacion: 'libreta-usar-ubicacion',
    marcarEnMapa: 'libreta-marcar',
  };

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.cliente
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => this.estado.set(ready(lista)),
        error: (error: unknown) => this.estado.set(errorToViewState(error)),
      });
  }

  /* ---- abrir y cerrar el formulario -------------------------------------- */

  protected agregar(): void {
    this.abrir({ id: null, kind: 'SAVED' }, null);
  }

  protected editar(direccion: PatientAddress): void {
    this.abrir({ id: direccion.id, kind: direccion.kind }, direccion);
  }

  private abrir(edicion: NonNullable<Edicion>, base: PatientAddress | null): void {
    this.edicion.set(edicion);
    this.nombre.set(base?.kind === 'SAVED' ? base.label : '');
    this.base = base;
    this.municipio.set(base?.municipalityConceptId ?? null);
    this.calle.set(base?.lines ?? '');
    const guardado =
      base?.latitude !== undefined && base.longitude !== undefined
        ? { lat: base.latitude, lng: base.longitude }
        : null;
    // El punto guardado entra confirmado: el mapa lo siembra así, y pedir que
    // lo vuelva a confirmar convertiría «sólo cambié el nombre» en un error.
    this.punto.set(guardado);
    this.puntoInicial.set(guardado);
    this.localidad.set(null);
    this.preferida.set(false);
    this.intentoGuardar.set(false);
    this.errorDeEscritura.set(null);
    this.enfocar('.libreta__subtitulo');
  }

  protected cancelar(): void {
    this.cerrarFormulario();
  }

  /** Cierra el formulario y devuelve el foco a «Agregar dirección». */
  private cerrarFormulario(): void {
    this.edicion.set(null);
    this.errorDeEscritura.set(null);
    this.enfocar('[data-testid="libreta-agregar"]');
  }

  /**
   * Lleva el foco a un elemento que recién aparece: el formulario al abrirse,
   * «Agregar» al cerrarse. Sin esto el foco cae al `body` cuando el elemento
   * que lo tenía desaparece.
   */
  private enfocar(selector: string): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(),
      { injector: this.injector },
    );
  }

  protected alternarPreferida(evento: Event): void {
    this.preferida.set((evento.target as HTMLInputElement).checked);
  }

  /* ---- el punto y lo que sale de él ---------------------------------------- */

  /** El punto confirmado (o `null` al quitarlo o moverlo sin confirmar). */
  protected confirmarPunto(punto: Coordinates | null): void {
    this.punto.set(punto);
    this.volcar();
  }

  /** Lo que el mapa dedujo del punto; se vuelca sólo si es del confirmado. */
  protected aplicarLocalidad(localidad: LocalityFromPoint | null): void {
    this.localidad.set(localidad);
    this.volcar();
  }

  /**
   * Calle y municipio, del punto confirmado.
   *
   * Sin punto quedan vacíos: lo que había describía otro lugar. Si el mapa no
   * tiene calle ahí, la calle queda vacía —la lista dirá «Sin calle escrita»—
   * y nunca se inventa. Si es el mismo punto con el que se abrió y el mapa no
   * pudo deducir algo, se conserva lo que la dirección ya tenía.
   */
  private volcar(): void {
    const punto = this.punto();
    if (punto === null) {
      this.calle.set('');
      this.municipio.set(null);
      return;
    }
    const localidad = confirmedLocality(this.localidad(), punto);
    if (localidad === null) return;
    const mismoQueElGuardado = samePoint(punto, this.puntoInicial());
    this.calle.set(localidad.calle ?? (mismoQueElGuardado ? (this.base?.lines ?? '') : ''));
    this.municipio.set(
      localidad.municipioConceptId ??
        (mismoQueElGuardado ? (this.base?.municipalityConceptId ?? null) : null),
    );
  }

  /* ---- escribir ----------------------------------------------------------- */

  protected guardar(): void {
    const edicion = this.edicion();
    if (edicion === null || this.guardando()) return;
    this.intentoGuardar.set(true);
    const punto = this.punto();
    const municipio = this.municipio();
    if (this.errorDeNombre() !== '' || punto === null || municipio === null) return;

    const lugar = {
      municipalityConceptId: municipio,
      lines: this.calle().trim(),
      latitude: punto.lat,
      longitude: punto.lng,
    };
    const pedido =
      edicion.id === null
        ? this.cliente.create({
            ...lugar,
            label: this.nombre().trim(),
            isPreferred: this.preferida(),
          })
        : this.cliente.update(edicion.id, {
            ...lugar,
            ...(edicion.kind === 'SAVED' ? { label: this.nombre().trim() } : {}),
          });

    this.guardando.set(true);
    this.errorDeEscritura.set(null);
    pedido.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lista) => {
        this.guardando.set(false);
        this.estado.set(ready(lista));
        this.cerrarFormulario();
      },
      // Lo escrito se conserva: el formulario sigue abierto con los mismos datos.
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorDeEscritura.set(this.mensajeDe(error));
      },
    });
  }

  protected preferir(direccion: PatientAddress): void {
    this.accion(direccion.id, this.cliente.prefer(direccion.id));
  }

  protected async quitar(direccion: PatientAddress): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Quitar la dirección',
      message: `«${this.tituloDe(direccion)}» deja de ofrecerse para los envíos.`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (confirmado) this.accion(direccion.id, this.cliente.remove(direccion.id));
  }

  private accion(id: string, pedido: ReturnType<PatientAddressBookClient['list']>): void {
    if (this.ocupada() !== null) return;
    this.ocupada.set(id);
    this.errorDeEscritura.set(null);
    pedido.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (lista) => {
        this.ocupada.set(null);
        this.estado.set(ready(lista));
      },
      error: (error: unknown) => {
        this.ocupada.set(null);
        this.errorDeEscritura.set(this.mensajeDe(error));
      },
    });
  }

  private mensajeDe(error: unknown): string {
    return (
      errorMessageOf(errorToViewState(error), 'No tiene permiso para cambiar estas direcciones.') ??
      'No pudimos guardar el cambio. Intente de nuevo.'
    );
  }

  /** Calle y ciudad, sin repetir la ciudad cuando la calle ya la nombra. */
  protected lineaDe(direccion: PatientAddress): string {
    const calle = direccion.lines ?? '';
    const ciudad = direccion.city ?? '';
    if (calle === '') return ciudad === '' ? 'Sin calle escrita' : `Sin calle escrita, ${ciudad}`;
    return ciudad === '' || calle.includes(ciudad) ? calle : `${calle}, ${ciudad}`;
  }

    protected tituloDe(direccion: PatientAddress): string {
    return direccion.kind === 'SAVED' ? direccion.label : `${direccion.label} (${direccion.kind === 'HOME' ? 'domicilio' : 'trabajo'})`;
  }
}
