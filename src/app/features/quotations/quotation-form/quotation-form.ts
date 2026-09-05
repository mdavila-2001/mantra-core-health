import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../../core/data-access/profiles/profiles.types';
import { QuotationsClient } from '../../../core/data-access/quotations/quotations.client';
import type {
  Installment,
  InterestCalculationMethod,
  NewQuotation,
  SimulatePaymentPlanResponse,
} from '../../../core/data-access/quotations/quotations.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ServiceCatalogItem,
} from '../../../core/data-access/services-catalog/services-catalog.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { QUOTATION_PDF_DOWNLOADER } from '../../../shared/utils/quotation-pdf/quotation-pdf';
import { QUOTATIONS_ROUTE } from '../quotations.routes';

/** Tope del buscador de pacientes. La API pagina por cursor; acá alcanza una página. */
const TOPE_PACIENTES = 25;

/** Tope del buscador de servicios, igual que en `services-catalog` y `my-services`. */
const TOPE_SERVICIOS = 25;

/** Cuántas reservas recientes del paciente se ofrecen como cita asociada. */
const TOPE_CITAS = 20;

/**
 * Espera antes de simular. Mismo orden de magnitud que
 * `SEARCH_DEBOUNCE_MS` de `app-search-field`: alcanza para no disparar una
 * petición por cada tecla y sigue sintiéndose «en vivo».
 */
const DEBOUNCE_SIMULACION_MS = 350;

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const METODOS: readonly SelectOption<InterestCalculationMethod>[] = [
  { value: 'FLAT', label: 'Cuota fija (FLAT)' },
  { value: 'FRENCH', label: 'Francés (amortización)' },
];

/** `Date` local → `YYYY-MM-DD`. Mismo criterio que `fechaIso` de `profiles.client.ts`. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * **Nueva cotización** (FT-24) — un paciente, un servicio del catálogo (FT-22)
 * y un plan de pagos simulado en vivo.
 *
 * ## Los organismos que reusa, y por qué
 *
 * - El **selector de paciente** es el mismo par que arma `clinical-record.ts`:
 *   `app-search-field` + `app-data-table` sobre `ProfilesClient.searchPatients`.
 *   No existe un componente `PatientSearch` aparte en el repo — es esta misma
 *   combinación la que cada pantalla que necesita elegir un paciente vuelve a
 *   montar sobre el cliente real, y este formulario hace lo mismo en vez de
 *   inventar un selector nuevo.
 * - El **selector de servicio** reusa igual el par `app-search-field` +
 *   `app-data-table`, pero sobre `ServicesCatalogClient.search` — el mismo
 *   cliente y el mismo organismo que arma `services-catalog.ts` (el catálogo
 *   administrado) y `my-services.ts` (la lectura de quien atiende). FT-22 no
 *   publica un organismo de selección aparte: es este grid el que ambas
 *   pantallas ya usan para lo mismo.
 *
 * ## La cita asociada es opcional, y se resuelve con lo que ya existe
 *
 * No hay tiempo en esta iteración de construir un buscador de turnos nuevo.
 * En cambio, al elegir un paciente se piden sus reservas recientes con
 * `SchedulingClient.searchBookings({ patientProfileId })` — el mismo cliente
 * real de agenda— y se ofrecen en un `app-select` simple. El valor que viaja
 * es `booking.appointmentId` cuando la reserva tiene cita clínica detrás (es
 * lo único que el backend de cotizaciones puede querer decir con
 * `appointmentId`); a falta de eso, se ofrece igual el `booking.id` de la
 * reserva como referencia — mejor dejar constancia de qué turno originó la
 * cotización que forzar a elegir entre "nada" y un identificador que no es el
 * de una cita clínica. El campo es opcional de punta a punta: el select
 * siempre ofrece "Sin cita asociada" y guardar sin elegir ninguna es un caso
 * válido.
 *
 * ## El simulador llama al backend en vivo, con espera
 *
 * Cada cambio de precio, plazo, tasa, método o fecha de atención dispara
 * `QuotationsClient.simulatePaymentPlan` tras `DEBOUNCE_SIMULACION_MS`, con
 * el mismo patrón de «última respuesta gana» que `my-services.ts` usa para su
 * paginación (`llegoTarde`): una respuesta que llega tarde de un juego de
 * parámetros ya reemplazado se descarta.
 */
@Component({
  selector: 'app-quotation-form',
  imports: [
    Alert,
    AppButton,
    DataTable,
    DatePicker,
    FormField,
    Input,
    PageHeader,
    SearchField,
    Select,
  ],
  templateUrl: './quotation-form.html',
  styleUrl: './quotation-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationForm {
  private readonly quotations = inject(QuotationsClient);
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);
  private readonly descargarPdf = inject(QUOTATION_PDF_DOWNLOADER);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly opcionesDeMetodo = METODOS;

  private readonly celdaAccionPaciente =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('celdaAccionPaciente');
  private readonly celdaAccionServicio =
    viewChild.required<TemplateRef<{ $implicit: ServiceCatalogItem }>>('celdaAccionServicio');

  /* ---- práctica --------------------------------------------------------------
     Igual que `my-services` y `services-catalog`: el catálogo de servicios
     cuelga de la práctica elegida, y con una sola no hay nada que elegir. */

  private readonly practicas = toSignal(
    this.catalog.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(() =>
    (this.practicas() ?? []).map((practica) => ({ value: practica.id, label: practica.name })),
  );

  protected readonly practicaElegida = linkedSignal<readonly Practice[] | undefined, string | null>({
    source: this.practicas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  protected readonly hayQueElegirPractica = computed(() => this.opcionesDePractica().length > 1);

  protected cambiarPractica(practiceId: string | null): void {
    this.practicaElegida.set(practiceId);
  }

  /* ---- paciente ---------------------------------------------------------------- */

  protected readonly pacienteElegido = signal<PatientListItem | null>(null);
  protected readonly busquedaDePaciente = signal('');
  protected readonly resultadosDePacientes = signal<ViewState<readonly PatientListItem[]>>(
    empty({ label: 'Escribí para buscar' }, 'Buscá un paciente por nombre o código.'),
  );

  protected readonly columnasDePacientes = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1 },
    { key: 'patientCode', header: 'Código', priority: 2 },
    { key: 'accion', header: '', priority: 1, cell: this.celdaAccionPaciente() },
  ]);

  protected readonly porPaciente = (fila: PatientListItem): string => fila.profileId;

  protected buscarPaciente(texto: string): void {
    this.busquedaDePaciente.set(texto);
    if (texto.trim() === '') {
      this.resultadosDePacientes.set(
        empty({ label: 'Escribí para buscar' }, 'Buscá un paciente por nombre o código.'),
      );
      return;
    }

    this.resultadosDePacientes.set(loading());
    this.profiles.searchPatients({ query: texto, limit: TOPE_PACIENTES }).subscribe({
      next: (pagina) =>
        this.resultadosDePacientes.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty({ label: 'Volver a buscar' }, `Nadie coincide con «${texto}».`),
        ),
      error: (error: unknown) =>
        this.resultadosDePacientes.set(errorToViewState<readonly PatientListItem[]>(error)),
    });
  }

  protected elegirPaciente(paciente: PatientListItem): void {
    this.pacienteElegido.set(paciente);
    this.citaElegida.set(null);
    this.cargarCitas(paciente.profileId);
  }

  protected quitarPaciente(): void {
    this.pacienteElegido.set(null);
    this.citasDelPaciente.set([]);
    this.citaElegida.set(null);
  }

  /* ---- fecha de atención -------------------------------------------------------- */

  protected readonly fechaDeAtencion = signal<Date | null>(null);

  /* ---- cita asociada (opcional) -------------------------------------------------
     Ver el comentario de la clase: se puebla desde las reservas recientes del
     paciente, con `SchedulingClient.searchBookings`. */

  protected readonly citasDelPaciente = signal<readonly Booking[]>([]);
  protected readonly citaElegida = signal<string | null>(null);

  protected readonly opcionesDeCita = computed<readonly SelectOption<string>[]>(() =>
    this.citasDelPaciente().map((cita) => ({
      value: cita.appointmentId ?? cita.id,
      label:
        cita.startAt !== undefined
          ? FORMATO_FECHA_HORA.format(cita.startAt)
          : `Reserva ${cita.id.slice(0, 8)}`,
    })),
  );

  private cargarCitas(patientProfileId: string): void {
    this.scheduling.searchBookings({ patientProfileId, limit: TOPE_CITAS }).subscribe({
      next: (pagina) => this.citasDelPaciente.set(pagina.items),
      // Las citas son un atajo opcional: si la lectura falla, el select queda
      // vacío y la cotización se sigue pudiendo armar sin cita asociada.
      error: () => this.citasDelPaciente.set([]),
    });
  }

  /* ---- servicio médico (FT-22) --------------------------------------------------- */

  protected readonly servicioElegido = signal<ServiceCatalogItem | null>(null);
  protected readonly busquedaDeServicio = signal('');
  protected readonly resultadosDeServicios = signal<ViewState<readonly ServiceCatalogItem[]>>(
    loading(),
  );

  protected readonly columnasDeServicios = computed<readonly ColumnDef<ServiceCatalogItem>[]>(
    () => [
      { key: 'code', header: 'Código', priority: 2 },
      { key: 'name', header: 'Servicio', priority: 1 },
      { key: 'defaultPrice', header: 'Precio de referencia', priority: 1, align: 'end' },
      { key: 'accion', header: '', priority: 1, cell: this.celdaAccionServicio() },
    ],
  );

  protected readonly porServicio = (fila: ServiceCatalogItem): string => fila.id;

  protected buscarServicio(texto: string): void {
    this.busquedaDeServicio.set(texto);
    this.cargarServicios();
  }

  private cargarServicios(): void {
    const practiceId = this.practicaElegida();
    if (practiceId === null) {
      this.resultadosDeServicios.set(
        empty({ label: 'Elegir una práctica' }, 'Elegí una práctica para ver su catálogo.'),
      );
      return;
    }

    this.resultadosDeServicios.set(loading());
    const texto = this.busquedaDeServicio();

    this.catalog
      .search(practiceId, { limit: TOPE_SERVICIOS, ...(texto === '' ? {} : { query: texto }) })
      .subscribe({
        next: (pagina) =>
          this.resultadosDeServicios.set(
            pagina.items.length > 0
              ? ready(pagina.items)
              : empty(
                  { label: 'Ver todo el catálogo' },
                  texto === ''
                    ? 'Esta práctica todavía no tiene servicios en su catálogo.'
                    : `Ningún servicio coincide con «${texto}».`,
                ),
          ),
        error: (error: unknown) =>
          this.resultadosDeServicios.set(errorToViewState<readonly ServiceCatalogItem[]>(error)),
      });
  }

  protected elegirServicio(servicio: ServiceCatalogItem): void {
    this.servicioElegido.set(servicio);
    // Prellenado editable (AC del enunciado): el precio de referencia entra
    // como punto de partida, pero el signal queda libre para que el
    // profesional lo cambie sin que nada lo vuelva a pisar.
    this.precioOfrecido.set(servicio.defaultPrice);
  }

  /* ---- precio ofrecido ------------------------------------------------------------ */

  protected readonly precioOfrecido = signal('');

  protected fijarPrecio(valor: string | number | null): void {
    this.precioOfrecido.set(valor === null ? '' : String(valor));
  }

  /* ---- simulador interactivo -------------------------------------------------------- */

  protected readonly tasaDeInteres = signal<number | null>(0);
  protected readonly plazoEnCuotas = signal<number | null>(1);
  protected readonly metodo = signal<InterestCalculationMethod>('FLAT');

  protected fijarTasa(valor: string | number | null): void {
    this.tasaDeInteres.set(valor === null || valor === '' ? null : Number(valor));
  }

  protected fijarPlazo(valor: string | number | null): void {
    this.plazoEnCuotas.set(valor === null || valor === '' ? null : Number(valor));
  }

  protected readonly simulacion = signal<ViewState<SimulatePaymentPlanResponse>>(
    empty(
      { label: 'Completá los datos' },
      'Elegí un servicio, una fecha de atención y un plazo válido para simular el plan de pagos.',
    ),
  );

  protected readonly cuotas = computed<readonly Installment[]>(
    () => dataOf(this.simulacion())?.installments ?? [],
  );

  /* Accesores angostados por estado, mismo criterio que `ViewStateHost`: la
     plantilla no puede angostar una unión invocando el signal dos veces, así
     que el angostado se hace acá una sola vez. */
  protected readonly simulando = computed(() => this.simulacion().status === 'loading');
  protected readonly simulacionConError = computed(() => this.simulacion().status === 'error');
  protected readonly simulacionVacia = computed(() => {
    const estado = this.simulacion();
    return estado.status === 'empty' ? estado : null;
  });

  /** Descarta una respuesta de simulación que llegó tarde (ver el comentario de la clase). */
  private tokenDeSimulacion = 0;

  constructor() {
    // Cambiar de práctica, o el filtro del buscador, es un catálogo nuevo: el
    // efecto vuelve a pedir la primera página con los parámetros vigentes.
    effect(() => {
      this.practicaElegida();
      untracked(() => this.cargarServicios());
    });

    // El simulador: cada cambio de precio, plazo, tasa, método o fecha
    // dispara la llamada tras `DEBOUNCE_SIMULACION_MS`. `effect` con
    // `setTimeout` + `onCleanup`, el mismo patrón que usa `app-search-field`
    // para su propia espera.
    effect((onCleanup) => {
      const precioTexto = this.precioOfrecido();
      const cuotas = this.plazoEnCuotas();
      const tasa = this.tasaDeInteres();
      const metodo = this.metodo();
      const fecha = this.fechaDeAtencion();

      const precio = Number(precioTexto);
      const parametrosValidos =
        precioTexto.trim() !== '' &&
        !Number.isNaN(precio) &&
        cuotas !== null &&
        cuotas >= 1 &&
        tasa !== null &&
        tasa >= 0 &&
        fecha !== null;

      if (!parametrosValidos) {
        untracked(() => {
          this.tokenDeSimulacion += 1;
          this.simulacion.set(
            empty(
              { label: 'Completá los datos' },
              'Elegí un servicio, una fecha de atención y un plazo válido para simular el plan de pagos.',
            ),
          );
        });
        return;
      }

      const temporizador = setTimeout(() => {
        untracked(() =>
          // `fecha`, `cuotas` y `tasa` ya se comprobaron no nulos arriba.
          this.simular(precio, cuotas, tasa, metodo, fecha as Date),
        );
      }, DEBOUNCE_SIMULACION_MS);
      onCleanup(() => clearTimeout(temporizador));
    });
  }

  private simular(
    offeredPrice: number,
    installmentCount: number,
    interestRatePercent: number,
    interestCalculationMethod: InterestCalculationMethod,
    attentionDate: Date,
  ): void {
    const token = ++this.tokenDeSimulacion;
    this.simulacion.set(loading());

    this.quotations
      .simulatePaymentPlan({
        offeredPrice,
        installmentCount,
        interestRatePercent,
        interestCalculationMethod,
        attentionDate: fechaIso(attentionDate),
      })
      .subscribe({
        next: (respuesta) => {
          if (token !== this.tokenDeSimulacion) {
            return;
          }
          this.simulacion.set(ready(respuesta));
        },
        error: (error: unknown) => {
          if (token !== this.tokenDeSimulacion) {
            return;
          }
          this.simulacion.set(errorToViewState<SimulatePaymentPlanResponse>(error));
        },
      });
  }

  /* ---- validez de la oferta ---------------------------------------------------------- */

  protected readonly validaHasta = signal<Date | null>(null);

  /* ---- exportar (PDF) ------------------------------------------------------------------ */

  protected exportar(): void {
    const paciente = this.pacienteElegido();
    const servicio = this.servicioElegido();
    if (paciente === null || servicio === null) {
      this.toasts.warning('Elegí un paciente y un servicio antes de exportar.');
      return;
    }

    const fecha = this.fechaDeAtencion();
    const validez = this.validaHasta();

    this.descargarPdf({
      patientName: paciente.displayName ?? paciente.patientCode,
      serviceName: servicio.name,
      offeredPrice: Number(this.precioOfrecido()) || 0,
      interestRatePercent: this.tasaDeInteres() ?? 0,
      interestCalculationMethod: this.metodo(),
      installmentCount: this.plazoEnCuotas() ?? 0,
      attentionDate: fecha === null ? '' : fechaIso(fecha),
      validUntil: validez === null ? '' : fechaIso(validez),
      installments: this.cuotas(),
    });
  }

  /* ---- guardar ---------------------------------------------------------------------- */

  protected readonly guardando = signal(false);
  protected readonly errorAlGuardar = signal<string | null>(null);

  protected readonly puedeGuardar = computed(
    () =>
      this.pacienteElegido() !== null &&
      this.servicioElegido() !== null &&
      this.practicaElegida() !== null &&
      this.fechaDeAtencion() !== null &&
      this.validaHasta() !== null &&
      this.plazoEnCuotas() !== null &&
      this.plazoEnCuotas()! >= 1 &&
      this.tasaDeInteres() !== null &&
      this.tasaDeInteres()! >= 0 &&
      this.precioOfrecido().trim() !== '' &&
      !Number.isNaN(Number(this.precioOfrecido())) &&
      !this.guardando(),
  );

  protected guardar(): void {
    const paciente = this.pacienteElegido();
    const servicio = this.servicioElegido();
    const practiceId = this.practicaElegida();
    const fecha = this.fechaDeAtencion();
    const validez = this.validaHasta();
    const cuotas = this.plazoEnCuotas();
    const tasa = this.tasaDeInteres();
    const precio = Number(this.precioOfrecido());

    if (
      paciente === null ||
      servicio === null ||
      practiceId === null ||
      fecha === null ||
      validez === null ||
      cuotas === null ||
      tasa === null ||
      Number.isNaN(precio)
    ) {
      this.errorAlGuardar.set(
        'Completá paciente, servicio, fecha de atención, plazo, tasa y validez de la oferta.',
      );
      return;
    }

    if (this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.errorAlGuardar.set(null);

    const citaId = this.citaElegida();

    const nuevaCotizacion: NewQuotation = {
      practiceId,
      patientProfileId: paciente.profileId,
      attentionDate: fechaIso(fecha),
      ...(citaId === null ? {} : { appointmentId: citaId }),
      serviceCatalogId: servicio.id,
      offeredPrice: precio,
      ...(servicio.currencyConceptId === undefined
        ? {}
        : { currencyConceptId: servicio.currencyConceptId }),
      paymentPlanInstallmentCount: cuotas,
      interestRatePercent: tasa,
      interestCalculationMethod: this.metodo(),
      validUntil: fechaIso(validez),
    };

    this.quotations.createQuotation(nuevaCotizacion).subscribe({
      next: (creada) => {
        this.guardando.set(false);
        this.toasts.success(`Cotización de «${creada.serviceNameSnapshot}» guardada.`, 'Cotización creada');
        void this.router.navigateByUrl(QUOTATIONS_ROUTE);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorAlGuardar.set(mensajeDelServidor(error));
      },
    });
  }
}

/** Qué decir cuando el guardado o la simulación fallan. */
function mensajeDelServidor(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = readApiError(error);
    if (cuerpo !== null && cuerpo.message !== '') {
      return cuerpo.message;
    }
  }
  return 'No pudimos guardar la cotización. Probá de nuevo.';
}
