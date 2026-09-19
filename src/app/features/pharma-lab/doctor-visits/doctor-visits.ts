import { DatePipe, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { PharmaLabClient } from '../../../core/data-access/pharma-lab/pharma-lab.client';
import type {
  PublishedAgenda,
  VisitRecord,
  VisitRequest,
} from '../../../core/data-access/pharma-lab/pharma-lab.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmaLabConcepts, type ConceptDictionary } from '../../../core/data-access/pharma-lab/pharma-lab-concepts.client';
import {
  esperaDecisionDelDoctor,
  toVisitStatusPresentation,
  type VisitStatusPresentation,
} from '../visit-status';
import { mensajeDeError } from '../visitor-visits/visitor-visits';

/** Nombre del día de la semana, con 0 = domingo, como lo declara la agenda. */
const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** Datos de la pantalla de visitas del doctor. */
export interface DoctorVisitsData {
  readonly requests: readonly VisitRequest[];
  readonly records: readonly VisitRecord[];
  readonly agenda: PublishedAgenda | null;
  readonly concepts: ConceptDictionary;
}

interface FilaDeSolicitud {
  readonly id: string;
  /** Cuándo empieza. `Date` y no texto: la plantilla la formatea con el idioma. */
  readonly cuando: Date;
  /** Cuándo termina, derivado de la duración: una visita ocupa un rango. */
  readonly hasta: Date;
  readonly duracion: number;
  readonly modalidad: string;
  readonly motivo: string;
  readonly lugar: string;
  /** Tono, forma y palabra. No un `string`: es información de estado. */
  readonly estado: VisitStatusPresentation;
  /** Si la fila ofrece decisión o ya está resuelta. */
  readonly porResponder: boolean;
  /** La fecha ya escrita, para el nombre de fila del lector de pantalla. */
  readonly fecha: string;
}

interface FilaDeFranja {
  readonly id: string;
  readonly dia: string;
  readonly desde: string;
  readonly hasta: string;
  readonly duracion: string;
  readonly modalidad: string;
  readonly lugar: string;
}

interface FilaDeRegistro {
  readonly id: string;
  readonly cuando: Date;
  readonly lugar: string;
  readonly temas: string;
  readonly confirmacion: string;
  readonly fecha: string;
}

/**
 * Las visitas de laboratorio que recibe el doctor (carril 17, spec 5396-5421).
 *
 * ## Está separada de la agenda de pacientes, pero se lee igual
 *
 * La especificación pide que una visita comercial **no se mezcle** con la
 * agenda clínica (5399), y no se mezcla: vive en su ruta, con sus datos y su
 * propia bandeja. Lo que sí comparten es el calendario real —el backend rechaza
 * una visita que se superponga con una consulta— y, desde este cambio, la forma
 * de leerse: una visita ocupa veinte minutos del día igual que una consulta.
 *
 * Por eso usa las mismas piezas que `features/agenda`: la fecha con el
 * `DatePipe` del idioma activo en vez de `toLocaleString`, el estado con
 * `app-status-seal` —tono, forma y palabra, que es lo que exige el sistema de
 * diseño para información de estado— y las acciones como íconos con su globo.
 * Lo que espera respuesta encabeza la lista, como en «Consultas».
 *
 * ## Sin agenda configurada no hay error
 *
 * Un doctor que nunca configuró horarios de visita no está en un estado roto:
 * simplemente no recibe visitadores. Por eso la agenda se pide tolerando el 404
 * y la pantalla lo dice con palabras en vez de mostrar un fallo.
 */
@Component({
  selector: 'app-doctor-visits',
  imports: [
    AppButton,
    DataTable,
    DatePipe,
    PageHeader,
    StatusSeal,
    Tab,
    Tabs,
    Tooltip,
    ViewStateHost,
  ],
  templateUrl: './doctor-visits.html',
  styleUrl: './doctor-visits.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorVisits {
  private readonly api = inject(PharmaLabClient);
  private readonly conceptsApi = inject(PharmaLabConcepts);
  /** El idioma activo, para escribir la fecha fuera de la plantilla. */
  private readonly idioma = inject(LOCALE_ID);

  protected readonly state = signal<ViewState<DoctorVisitsData>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly aviso = signal<string | null>(null);

  /** La solicitud con una operación en vuelo, para el botón que la disparó. */
  protected readonly operando = signal<string | null>(null);

  /* ---- las tres tablas, en el organismo del sistema (refactor UX) --------
     Eran `<table>` escritas a mano: a 390 px empujaban la página de costado y
     no tenían prioridad de columnas, detalle plegable ni indicio de scroll. */

  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: FilaDeSolicitud }>>('celdaCuando');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaDeSolicitud }>>('celdaEstado');
  private readonly celdaDecision =
    viewChild.required<TemplateRef<{ $implicit: FilaDeSolicitud }>>('celdaDecision');
  private readonly celdaFranja =
    viewChild.required<TemplateRef<{ $implicit: FilaDeFranja }>>('celdaFranja');
  private readonly celdaRegistro =
    viewChild.required<TemplateRef<{ $implicit: FilaDeRegistro }>>('celdaRegistro');

  /**
   * Las solicitudes, con las que esperan respuesta **encabezando la lista**.
   *
   * Mismo criterio que la agenda de pacientes (ALV-019): en una bandeja de
   * cosas por responder, lo que ordena es qué falta contestar, no la fecha.
   * Dentro de cada grupo, la más próxima primero.
   */
  protected readonly solicitudes = computed<ViewState<readonly FilaDeSolicitud[]>>(() => {
    const datos = this.data();
    if (datos === null) return loading();

    const filas = datos.requests.map((request) => this.aFila(request));
    return ready(
      [...filas].sort((a, b) =>
        a.porResponder === b.porResponder
          ? a.cuando.getTime() - b.cuando.getTime()
          : a.porResponder
            ? -1
            : 1,
      ),
    );
  });

  /** Cuántas esperan respuesta: el aviso que encabeza la lista. */
  protected readonly porResponder = computed(() => {
    const estado = this.solicitudes();
    return estado.status === 'ready' ? estado.data.filter((fila) => fila.porResponder).length : 0;
  });

  /**
   * El mismo orden de columnas que «Consultas»: cuándo, por qué, cómo, dónde,
   * en qué estado, y la decisión al final.
   */
  protected readonly columnasDeSolicitudes = computed<readonly ColumnDef<FilaDeSolicitud>[]>(
    () => [
      { key: 'cuando', header: 'Fecha y hora', priority: 1, cell: this.celdaCuando() },
      { key: 'motivo', header: 'Motivo de la visita', priority: 1 },
      { key: 'modalidad', header: 'Modalidad', priority: 3 },
      { key: 'lugar', header: 'Lugar', priority: 3 },
      { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
      // Prioridad 2: en el teléfono va al detalle de la fila, como las acciones
      // de la agenda. Con Fecha, Motivo y Estado la tabla ya llena los 400 px.
      { key: 'decision', header: 'Decisión', priority: 2, cell: this.celdaDecision() },
    ],
  );

  protected readonly franjas = computed<ViewState<readonly FilaDeFranja[]>>(() => {
    const agenda = this.data()?.agenda;
    if (agenda === undefined || agenda === null) return loading();
    return ready(
      agenda.windows.map((ventana, indice) => ({
        id: `franja-${indice}`,
        dia: this.dia(ventana.weekday),
        desde: ventana.startTime,
        hasta: ventana.endTime,
        duracion: `${ventana.slotDurationMinutes} min`,
        modalidad: this.concepto(ventana.modalityConceptId),
        lugar: ventana.location ?? '—',
      })),
    );
  });

  protected readonly columnasDeFranjas = computed<readonly ColumnDef<FilaDeFranja>[]>(() => [
    { key: 'dia', header: 'Día', priority: 1 },
    // «Desde» y «Hasta» eran dos columnas para un solo dato —una franja—, y en
    // el teléfono se partían a dos renglones. Ahora es una celda, como el cupo
    // de la agenda: la hora de inicio arriba y hasta cuándo debajo.
    { key: 'franja', header: 'Franja', priority: 1, cell: this.celdaFranja() },
    { key: 'duracion', header: 'Duración', priority: 2 },
    { key: 'modalidad', header: 'Modalidad', priority: 3 },
    { key: 'lugar', header: 'Lugar', priority: 3 },
  ]);

  protected readonly registros = computed<ViewState<readonly FilaDeRegistro[]>>(() => {
    const datos = this.data();
    if (datos === null) return loading();
    return ready(
      datos.records.map((record) => ({
        id: record.id,
        cuando: record.occurredAt,
        lugar: record.location ?? '—',
        temas: record.topicsDiscussed ?? '—',
        confirmacion: this.concepto(record.confirmationConceptId),
        fecha: this.enPalabras(record.occurredAt),
      })),
    );
  });

  protected readonly columnasDeRegistros = computed<readonly ColumnDef<FilaDeRegistro>[]>(() => [
    { key: 'cuando', header: 'Fecha y hora', priority: 1, cell: this.celdaRegistro() },
    { key: 'temas', header: 'Temas tratados', priority: 1 },
    { key: 'confirmacion', header: 'Confirmación', priority: 3 },
    { key: 'lugar', header: 'Lugar', priority: 2 },
  ]);

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  /** Nombres de fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeSolicitud = (fila: FilaDeSolicitud): string =>
    `la solicitud del ${fila.fecha}`;
  protected readonly nombreDeFranja = (fila: FilaDeFranja): string =>
    `la franja del ${fila.dia} de ${fila.desde} a ${fila.hasta}`;
  protected readonly nombreDeRegistro = (fila: FilaDeRegistro): string =>
    `la visita del ${fila.fecha}`;

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected concepto(conceptId: string | undefined): string {
    return this.data()?.concepts.label(conceptId) ?? '—';
  }

  protected dia(weekday: number): string {
    return DIAS[weekday] ?? `Día ${weekday}`;
  }

  protected aceptar(fila: FilaDeSolicitud): void {
    this.operando.set(fila.id);
    this.api.acceptVisit(fila.id).subscribe({
      next: (resultado) => {
        this.aviso.set(`Visita ${this.concepto(resultado.statusConceptId)}.`);
        this.load();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.aviso.set(mensajeDeError(error));
      },
    });
  }

  protected rechazar(fila: FilaDeSolicitud): void {
    this.operando.set(fila.id);
    this.api.rejectVisit(fila.id, 'Sin disponibilidad en ese horario').subscribe({
      next: (resultado) => {
        this.aviso.set(`Visita ${this.concepto(resultado.statusConceptId)}.`);
        this.load();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.aviso.set(mensajeDeError(error));
      },
    });
  }

  /**
   * De la solicitud de la API a la fila de la tabla.
   *
   * El estado se resuelve **por código de catálogo** y no por rótulo: comparar
   * contra la cadena «Solicitada» ataba la oferta de «Aceptar» al idioma del
   * diccionario, y bastaba un `display` en inglés para que una solicitud
   * pendiente dejara de ofrecer decisión.
   */
  private aFila(request: VisitRequest): FilaDeSolicitud {
    const concepts = this.data()?.concepts;
    const estado = toVisitStatusPresentation(
      concepts?.code(request.statusConceptId),
      concepts?.label(request.statusConceptId) ?? 'Sin estado',
    );

    // El horario vigente es el propuesto cuando lo hay: una reprogramación en
    // curso que muestre la fecha original muestra una fecha que ya no existe.
    const cuando = request.proposedStartAt ?? request.requestedStartAt;

    return {
      id: request.id,
      cuando,
      hasta: new Date(cuando.getTime() + request.durationMinutes * 60_000),
      duracion: request.durationMinutes,
      modalidad: this.concepto(request.modalityConceptId),
      motivo: request.reason,
      lugar: request.location ?? '—',
      estado,
      porResponder: esperaDecisionDelDoctor(estado),
      fecha: this.enPalabras(cuando),
    };
  }

  /** La fecha escrita como la escribe la agenda, para los rótulos de fila. */
  private enPalabras(cuando: Date): string {
    return formatDate(cuando, "EEEE d 'de' MMMM, HH:mm", this.idioma);
  }

  private load(): void {
    this.state.set(loading());
    forkJoin({
      requests: this.api.listDoctorVisitRequests(),
      records: this.api.listDoctorVisitRecords(),
      // Un doctor sin agenda de visitas no es un error: es alguien que no recibe
      // visitadores. El 404 se traduce a «no configurada», no a pantalla rota.
      agenda: this.api.getOwnAgenda().pipe(catchError(() => of(null))),
      concepts: this.conceptsApi.load(),
    }).subscribe({
      next: (partes) => {
        this.operando.set(null);
        this.state.set(ready(partes));
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.state.set(errorToViewState<DoctorVisitsData>(error));
      },
    });
  }
}
