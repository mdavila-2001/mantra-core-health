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
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../../core/data-access/profiles/profiles.types';
import { QuotationsClient } from '../../../core/data-access/quotations/quotations.client';
import type {
  NewQuotation,
  PaymentFrequency,
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
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { QUOTATION_PDF_DOWNLOADER } from '../../../shared/utils/quotation-pdf/quotation-pdf';
import {
  addPeriods,
  buildSchedule,
  fromCents,
  MAX_INSTALLMENTS,
  rebalance,
  remainingCents,
  renumber,
  toCents,
  toInstallments,
  type PlanRow,
} from '../flexible-payment-plan';
import { QUOTATION_PATIENT_QUERY_PARAM, QUOTATIONS_ROUTE } from '../quotations.routes';

/** Tope del buscador de pacientes. La API pagina por cursor; acá alcanza una página. */
const TOPE_PACIENTES = 25;

/** Tope del buscador de servicios, igual que en `services-catalog` y `my-services`. */
const TOPE_SERVICIOS = 25;

/** Cuántas reservas recientes del paciente se ofrecen como cita asociada. */
const TOPE_CITAS = 20;

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const FRECUENCIAS: readonly SegmentedOption<PaymentFrequency>[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
];

const FORMATO_MONTO = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `YYYY-MM-DD` → `Date` local, sin el corrimiento de huso de `new Date(iso)`. */
function fechaDeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number) as [number, number, number];
  return new Date(anio, mes - 1, dia);
}

/** `Date` local → `YYYY-MM-DD`. Mismo criterio que `fechaIso` de `profiles.client.ts`. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * **Nueva cotización** (FT-24) — un paciente, un servicio del catálogo (FT-22)
 * y un plan de pagos flexible, sin interés.
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
 * ## Plan de pagos flexible, no simulador de crédito
 *
 * Un consultorio no presta plata: reparte el precio de un tratamiento en
 * cuotas. No hay tasa ni método de amortización. El cronograma se arma en
 * pantalla con `flexible-payment-plan.ts` —anticipo, cantidad de cuotas,
 * frecuencia y primer vencimiento— y después se edita cuota por cuota. Viaja
 * entero en el `POST /quotations`; no hay ida y vuelta al servidor para
 * «simular».
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
    SegmentedControl,
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
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly opcionesDeFrecuencia = FRECUENCIAS;
  protected readonly topeDeCuotas = MAX_INSTALLMENTS;

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
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDePaciente = (fila: PatientListItem): string => fila.displayName ?? '';

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
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeServicio = (fila: ServiceCatalogItem): string => fila.name;

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

  /* ---- plan de pagos flexible ------------------------------------------------------
     Ver el comentario de la clase y `flexible-payment-plan.ts`. */

  protected readonly anticipo = signal<number | null>(0);
  protected readonly plazoEnCuotas = signal<number | null>(3);
  protected readonly frecuencia = signal<PaymentFrequency>('MONTHLY');
  /** Si queda vacío, la primera cuota vence un período después de la atención. */
  protected readonly primerVencimiento = signal<Date | null>(null);

  /** El cronograma en edición. Se rearma solo al cambiar los parámetros de arriba. */
  protected readonly filas = signal<readonly PlanRow[]>([]);

  protected fijarAnticipo(valor: string | number | null): void {
    this.anticipo.set(valor === null || valor === '' ? null : Number(valor));
  }

  protected fijarPlazo(valor: string | number | null): void {
    this.plazoEnCuotas.set(valor === null || valor === '' ? null : Number(valor));
  }

  private readonly precio = computed(() => {
    const texto = this.precioOfrecido();
    const valor = Number(texto);
    return texto.trim() === '' || Number.isNaN(valor) ? null : valor;
  });

  /** La fecha desde la que se cuentan los vencimientos, o `null` si falta. */
  private readonly vencimientoInicial = computed<string | null>(() => {
    const elegido = this.primerVencimiento();
    if (elegido !== null) {
      return fechaIso(elegido);
    }
    const atencion = this.fechaDeAtencion();
    return atencion === null ? null : addPeriods(fechaIso(atencion), this.frecuencia(), 1);
  });

  /** Por qué todavía no hay cronograma, o `null` si lo hay. */
  protected readonly faltaParaElPlan = computed<string | null>(() => {
    const precio = this.precio();
    const anticipo = this.anticipo() ?? 0;
    const cuotas = this.plazoEnCuotas();
    if (precio === null || precio <= 0) {
      return 'Elegí un servicio o escribí el precio para armar el plan.';
    }
    if (this.vencimientoInicial() === null) {
      return 'Elegí la fecha de atención o la del primer vencimiento.';
    }
    if (anticipo < 0 || anticipo > precio) {
      return 'El anticipo no puede ser negativo ni pasar el precio.';
    }
    if (anticipo < precio && (cuotas === null || cuotas < 1 || cuotas > MAX_INSTALLMENTS)) {
      return `La cantidad de cuotas va de 1 a ${MAX_INSTALLMENTS}.`;
    }
    return null;
  });

  /** Lo que le falta (positivo) o le sobra (negativo) al plan, en centavos. */
  private readonly diferencia = computed(() =>
    remainingCents(this.filas(), this.precio() ?? 0, this.anticipo() ?? 0),
  );

  protected readonly totalDelPlan = computed(() =>
    FORMATO_MONTO.format(
      fromCents(
        toCents(this.anticipo() ?? 0) +
          this.filas().reduce((suma, fila) => suma + toCents(fila.amount), 0),
      ),
    ),
  );

  /** El aviso de un plan que no cierra con el precio, o `null` si cierra. */
  protected readonly descuadre = computed<string | null>(() => {
    const centavos = this.diferencia();
    if (this.faltaParaElPlan() !== null || centavos === 0) {
      return null;
    }
    const monto = FORMATO_MONTO.format(fromCents(Math.abs(centavos)));
    return centavos > 0
      ? `Faltan ${monto} para cubrir el precio. Repartilo en otra cuota o soltá un monto fijado.`
      : `Las cuotas pasan el precio por ${monto}. Bajá algún monto fijado.`;
  });

  protected readonly planCierra = computed(
    () =>
      this.faltaParaElPlan() === null &&
      this.diferencia() === 0 &&
      this.filas().every((fila) => fila.amount > 0 && fila.dueDate !== ''),
  );

  protected readonly hayMontosFijados = computed(() => this.filas().some((fila) => fila.pinned));

  /** Cambiar el monto de una cuota la fija, y las libres se reparten el resto. */
  protected fijarMonto(indice: number, valor: string | number | null): void {
    const monto = valor === null || valor === '' ? 0 : Math.max(0, Number(valor));
    if (Number.isNaN(monto)) {
      return;
    }
    const filas = this.filas().map((fila, i) =>
      i === indice ? { ...fila, amount: fromCents(toCents(monto)), pinned: true } : fila,
    );
    this.filas.set(rebalance(filas, this.precio() ?? 0, this.anticipo() ?? 0));
  }

  /** Las fechas de las cuotas como `Date`, para el `app-date-picker` de cada fila. */
  protected readonly vencimientos = computed<readonly (Date | null)[]>(() =>
    this.filas().map((fila) => (fila.dueDate === '' ? null : fechaDeIso(fila.dueDate))),
  );

  protected fijarVencimiento(indice: number, fecha: Date | null): void {
    const iso = fecha === null ? '' : fechaIso(fecha);
    this.filas.update((filas) =>
      filas.map((fila, i) => (i === indice ? { ...fila, dueDate: iso } : fila)),
    );
  }

  protected soltarMonto(indice: number): void {
    const filas = this.filas().map((fila, i) => (i === indice ? { ...fila, pinned: false } : fila));
    this.filas.set(rebalance(filas, this.precio() ?? 0, this.anticipo() ?? 0));
  }

  /** Una cuota más, un período después de la última. Se reparte con las libres. */
  protected agregarCuota(): void {
    const filas = this.filas();
    if (filas.length >= MAX_INSTALLMENTS) {
      return;
    }
    const ultima = filas.at(-1)?.dueDate ?? this.vencimientoInicial();
    if (ultima === null || ultima === undefined) {
      return;
    }
    const nueva: PlanRow = {
      installmentNumber: filas.length + 1,
      dueDate: filas.length === 0 ? ultima : addPeriods(ultima, this.frecuencia(), 1),
      amount: 0,
      pinned: false,
    };
    this.filas.set(rebalance([...filas, nueva], this.precio() ?? 0, this.anticipo() ?? 0));
    this.plazoSinRearmar(this.filas().length);
  }

  protected quitarCuota(indice: number): void {
    const filas = renumber(this.filas().filter((_, i) => i !== indice));
    this.filas.set(rebalance(filas, this.precio() ?? 0, this.anticipo() ?? 0));
    this.plazoSinRearmar(filas.length);
  }

  /** Vuelve al reparto en partes iguales, con las fechas de la frecuencia elegida. */
  protected repartirEnPartesIguales(): void {
    this.rearmarPlan();
  }

  /**
   * Agregar o quitar una cuota cambia la cantidad, pero no debe rearmar el
   * cronograma y perder las fechas y montos que se escribieron a mano.
   */
  private rearmeSuspendido = false;

  private plazoSinRearmar(cantidad: number): void {
    // Sólo si cambia: con el mismo valor el efecto no corre y la marca
    // quedaría puesta, tragándose el próximo cambio de verdad.
    if (this.plazoEnCuotas() === cantidad) {
      return;
    }
    this.rearmeSuspendido = true;
    this.plazoEnCuotas.set(cantidad);
  }

  private rearmarPlan(): void {
    const precio = this.precio();
    const inicio = this.vencimientoInicial();
    if (this.faltaParaElPlan() !== null || precio === null || inicio === null) {
      this.filas.set([]);
      return;
    }
    const anticipo = this.anticipo() ?? 0;
    this.filas.set(
      buildSchedule({
        total: precio,
        downPayment: anticipo,
        // Pagado todo de anticipo, no quedan cuotas.
        installmentCount: anticipo >= precio ? 0 : (this.plazoEnCuotas() ?? 0),
        frequency: this.frecuencia(),
        firstDueDate: inicio,
      }),
    );
  }

  constructor() {
    // Cambiar de práctica, o el filtro del buscador, es un catálogo nuevo: el
    // efecto vuelve a pedir la primera página con los parámetros vigentes.
    effect(() => {
      this.practicaElegida();
      untracked(() => this.cargarServicios());
    });

    // Los parámetros del plan rearman el cronograma. Es local y es barato: no
    // hace falta espera ni ir al servidor.
    effect(() => {
      this.precio();
      this.anticipo();
      this.plazoEnCuotas();
      this.frecuencia();
      this.vencimientoInicial();
      untracked(() => {
        if (this.rearmeSuspendido) {
          this.rearmeSuspendido = false;
          return;
        }
        this.rearmarPlan();
      });
    });

    // Desde la consulta se llega con el paciente ya elegido.
    const pacienteDeLaConsulta = this.route.snapshot.queryParamMap.get(
      QUOTATION_PATIENT_QUERY_PARAM,
    );
    if (pacienteDeLaConsulta !== null && pacienteDeLaConsulta !== '') {
      this.precargarPaciente(pacienteDeLaConsulta);
    }
  }

  private precargarPaciente(profileId: string): void {
    this.profiles.getPatient(profileId).subscribe({
      next: (paciente) =>
        this.elegirPaciente({
          profileId: paciente.profileId,
          personId: paciente.personId,
          patientCode: paciente.patientCode,
          ...(paciente.displayName === undefined ? {} : { displayName: paciente.displayName }),
          deceased: paciente.deceasedAt !== undefined,
        }),
      // Si no se puede leer, se busca a mano como siempre.
      error: () => undefined,
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
      downPaymentAmount: this.anticipo() ?? 0,
      paymentFrequency: this.frecuencia(),
      attentionDate: fecha === null ? '' : fechaIso(fecha),
      validUntil: validez === null ? '' : fechaIso(validez),
      installments: toInstallments(this.filas()),
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
      this.planCierra() &&
      !this.guardando(),
  );

  protected guardar(): void {
    const paciente = this.pacienteElegido();
    const servicio = this.servicioElegido();
    const practiceId = this.practicaElegida();
    const fecha = this.fechaDeAtencion();
    const validez = this.validaHasta();
    const precio = Number(this.precioOfrecido());

    if (
      paciente === null ||
      servicio === null ||
      practiceId === null ||
      fecha === null ||
      validez === null ||
      Number.isNaN(precio)
    ) {
      this.errorAlGuardar.set(
        'Completá paciente, servicio, fecha de atención y validez de la oferta.',
      );
      return;
    }

    if (!this.planCierra()) {
      this.errorAlGuardar.set(
        this.descuadre() ?? this.faltaParaElPlan() ?? 'Revisá las fechas y montos de las cuotas.',
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
      paymentPlanInstallmentCount: this.filas().length,
      downPaymentAmount: this.anticipo() ?? 0,
      paymentFrequency: this.frecuencia(),
      installments: toInstallments(this.filas()),
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

/** Qué decir cuando el guardado falla. */
function mensajeDelServidor(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = readApiError(error);
    if (cuerpo !== null && cuerpo.message !== '') {
      return cuerpo.message;
    }
  }
  return 'No pudimos guardar la cotización. Probá de nuevo.';
}
