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
import { timeout, type Subscription } from 'rxjs';

import { ReverseGeocodingClient } from '../../../../core/data-access/geo/reverse-geocoding.client';
import {
  PatientAddressBookClient,
  type PatientAddress,
} from '../../../../core/data-access/profiles/patient-address-book.client';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../../core/data-access/terminology/bo-municipalities.service';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type { PinMap, PuntoGeo } from '../../../../shared/components/organisms/map/map-pin.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { errorMessageOf } from '../../../../shared/forms/form-support';
import { LocationPicker } from '../../../auth/shared-registration/location-picker/location-picker';

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
 * El formulario reusa las mismas piezas que el alta: el mapa de departamentos
 * con su localidad (`app-location-picker`) y el plano para el punto exacto
 * (`app-map`), con la calle escrita desde el punto por la API.
 */
@Component({
  selector: 'app-address-book',
  imports: [
    Alert,
    AppButton,
    AppInput,
    AppMap,
    Badge,
    FormField,
    LocationPicker,
    NavIcon,
    ViewStateHost,
  ],
  templateUrl: './address-book.html',
  styleUrl: './address-book.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressBook {
  private readonly cliente = inject(PatientAddressBookClient);
  private readonly geocodificador = inject(ReverseGeocodingClient);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogs = inject(DialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** El pedido de calle en curso: un punto nuevo lo cancela. */
  private pedidoDeCalle: Subscription | null = null;

  protected readonly estado = signal<ViewState<readonly PatientAddress[]>>(loading());
  protected readonly ramas = signal<readonly RamaDepartamento[]>([]);
  protected readonly catalogoCaido = signal(false);

  /* ---- el formulario ---------------------------------------------------- */

  protected readonly edicion = signal<Edicion>(null);
  protected readonly nombre = signal('');
  protected readonly municipio = signal<string | null>(null);
  protected readonly calle = signal('');
  protected readonly punto = signal<PuntoGeo | null>(null);
  protected readonly preferida = signal(false);
  protected readonly intentoGuardar = signal(false);
  protected readonly guardando = signal(false);
  protected readonly buscandoCalle = signal(false);
  protected readonly avisoDeCalle = signal('');
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

  protected readonly errorDeMunicipio = computed(() =>
    this.intentoGuardar() && this.municipio() === null ? 'Elija el departamento y la ciudad.' : '',
  );

  protected readonly pines = computed<readonly PinMap[]>(() => {
    const p = this.punto();
    return p === null ? [] : [{ id: 'direccion', lat: p.lat, lng: p.lng, titulo: 'Este lugar' }];
  });

  constructor() {
    this.cargar();
    this.cargarMunicipios();
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

  protected cargarMunicipios(): void {
    this.municipios
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ramas) => {
          this.catalogoCaido.set(false);
          this.ramas.set(ramas);
        },
        error: () => this.catalogoCaido.set(true),
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
    this.municipio.set(base?.municipalityConceptId ?? null);
    this.calle.set(base?.lines ?? '');
    this.punto.set(
      base?.latitude !== undefined && base.longitude !== undefined
        ? { lat: base.latitude, lng: base.longitude }
        : null,
    );
    this.preferida.set(false);
    this.intentoGuardar.set(false);
    this.avisoDeCalle.set('');
    this.errorDeEscritura.set(null);
    this.calleDelPunto = '';
    this.enfocar('.libreta__subtitulo');
  }

  protected cancelar(): void {
    this.cerrarFormulario();
  }

  /** Cierra el formulario y devuelve el foco a «Agregar dirección». */
  private cerrarFormulario(): void {
    this.pedidoDeCalle?.unsubscribe();
    this.buscandoCalle.set(false);
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

  /* ---- el punto y la calle ------------------------------------------------ */

  /**
   * Un toque en el plano: el pin va ahí y se pide la calle. La calle sólo se
   * escribe si el campo está vacío o tiene la que puso el mismo pedido anterior:
   * lo que tecleó la persona no se pisa.
   */
  protected fijarPunto(punto: PuntoGeo): void {
    const anterior = this.calleDelPunto;
    this.punto.set({ lat: punto.lat, lng: punto.lng });
    this.buscandoCalle.set(true);
    this.avisoDeCalle.set('Buscando el nombre de la calle…');
    const pedido = this.punto();
    this.pedidoDeCalle?.unsubscribe();
    this.pedidoDeCalle = this.geocodificador
      .streetAt(punto.lat, punto.lng)
      .pipe(timeout(10_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (calle) => {
          if (this.punto() !== pedido) return;
          this.buscandoCalle.set(false);
          if (!calle.found || !calle.line) {
            this.avisoDeCalle.set('No encontramos la calle de este punto: escríbala usted.');
            return;
          }
          const actual = this.calle().trim();
          if (actual !== '' && actual !== anterior) {
            this.avisoDeCalle.set('Dejamos la calle que usted escribió. Revise que corresponda al punto.');
            return;
          }
          this.calle.set(calle.line);
          this.calleDelPunto = calle.line;
          this.avisoDeCalle.set(
            'Escribimos la calle a partir del punto (datos de © OpenStreetMap). Revísela.',
          );
        },
        error: () => {
          if (this.punto() !== pedido) return;
          this.buscandoCalle.set(false);
          this.avisoDeCalle.set('Ahora no podemos traer la calle: escríbala usted.');
        },
      });
  }

  private calleDelPunto = '';

  /* ---- escribir ----------------------------------------------------------- */

  protected guardar(): void {
    const edicion = this.edicion();
    if (edicion === null || this.guardando()) return;
    this.intentoGuardar.set(true);
    if (this.errorDeNombre() !== '' || this.errorDeMunicipio() !== '') return;

    const punto = this.punto();
    const lugar = {
      municipalityConceptId: this.municipio()!,
      lines: this.calle().trim(),
      ...(punto === null ? {} : { latitude: punto.lat, longitude: punto.lng }),
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
