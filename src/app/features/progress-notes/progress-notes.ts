import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ClinicalClient } from '@core/data-access/clinical/clinical.client';
import type { ChartNote } from '@core/data-access/clinical/clinical.types';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, Booking } from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Link } from '@shared/components/atoms/link/link';
import { Card } from '@shared/components/molecules/card/card';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import type { FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';
import { FilterBar } from '@shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { PROGRESS_NOTES_PDF_DOWNLOADER } from '@shared/utils/progress-notes-pdf/progress-notes-pdf';

import { miRecursoDeAgenda } from '../agenda/mi-recurso';
import { patientChartRoute } from '../clinical-record/clinical-record.routes';

/**
 * Los períodos que se ofrecen, en días.
 *
 * Noventa y no más: `GET /scheduling/bookings` comparte con los cupos un tope
 * de ventana de 92 días, así que pedir un año volvería con 400.
 */
export const PERIODOS = [7, 30, 90] as const;

/** El período por omisión. */
const DIAS_POR_OMISION = 30;

/** Cuántas reservas se traen del período. El filtrado es sobre esta página. */
const TOPE = 200;

/**
 * El estado de una atención, derivado y no leído.
 *
 * El backend manda `statusConceptId`, que dice en qué estado está la
 * **reserva**. Lo que esta pantalla pregunta es otra cosa —«¿la cerré o me
 * quedó abierta?»— y eso sale de cruzar ese estado con las marcas de tiempo.
 */
export type EstadoDeAtencion = 'completada' | 'en-curso' | 'sin-cerrar';

/** Cómo se llama cada estado en pantalla. */
export const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDeAtencion, string>> = {
  completada: 'Completada',
  'en-curso': 'En curso',
  'sin-cerrar': 'Llegó y no se cerró',
};

/** Los códigos de reserva que cuentan como cerrada. */
const CODIGOS_COMPLETADA = new Set(['BOOKING_COMPLETED', 'BOOKING_FULFILLED']);

/** El código de la reserva que está siendo atendida ahora. */
const CODIGO_EN_CURSO = 'BOOKING_IN_PROGRESS';

/** Una atención registrada, ya resuelta para pintar. */
export interface AtencionRegistrada {
  /** El id de la reserva. Es la identidad de la fila. */
  readonly id: string;
  readonly profileId: string;
  readonly paciente: string;
  readonly motivo: string | null;
  readonly cuando: Date;
  readonly estado: EstadoDeAtencion;
  readonly estadoLabel: string;
  /** La tipología de la cita, o `null` si la reserva no tiene cita detrás. */
  readonly tipo: string | null;
  /** Por dónde entró la reserva, o `null` si no se registró. */
  readonly canal: string | null;
  /** El expediente completo de esa persona. */
  readonly ruta: string;
}

/** Una nota de la atención, ya lista para leerse. */
export interface NotaDeLaAtencion {
  readonly id: string;
  readonly motivo: string | null;
  readonly subjetivo: string | null;
  readonly objetivo: string | null;
  readonly evaluacion: string | null;
  readonly plan: string | null;
  readonly firmada: boolean;
  readonly cuando: Date;
}

/**
 * **Evoluciones** — la sexta de las ocho opciones del panel del médico (§4.H
 * del plan de UX del 22/08/2026).
 *
 * ## Una fila por atención, no por persona
 *
 * Antes agrupaba por paciente y cada fila llevaba al expediente, o sea al
 * **mismo destino** que «Ver expediente» del Archivo clínico: dos secciones
 * distintas que terminaban en la misma pantalla, y ninguna de las dos mostraba
 * una evolución. La pregunta que trae acá no es «a quién atendí» —eso lo
 * contesta la agenda— sino «qué vengo escribiendo», y eso se contesta con una
 * fila por **atención** y con lo que se escribió en cada una.
 *
 * ## Lo que todavía falta del backend, dicho de frente
 *
 * `M15 chart` expone `POST /charts/notes` y `PUT /charts/notes/:id/versions`
 * —se escriben y se versionan— pero **no tiene lectura de colección**: no
 * existe `GET /charts/notes?practitionerId&from&to`. Así que la lista sale de
 * `GET /scheduling/bookings`, que es lo que sí se puede leer, y el texto de
 * cada evolución se trae **bajo demanda** al abrir una fila: una petición por
 * clic contra `GET /charts/patients/:id/chart`, no N al cargar la pantalla.
 *
 * Dentro de esa lectura, las notas de *esa* atención se reconocen por su día:
 * el contrato no ata una nota a una reserva, sólo a un encuentro
 * (`ChartNote.encounterId`), y el encuentro no viaja en la reserva. Cuando
 * exista la lectura por profesional y fecha, la fila se alimenta de ahí y esto
 * deja de estimarse. Queda anotado en `PENDIENTES-BACKEND.md`.
 */
@Component({
  selector: 'app-progress-notes',
  imports: [
    AppButton,
    AppButtonLink,
    Card,
    ContentDialog,
    DatePipe,
    FilterBar,
    Link,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './progress-notes.html',
  styleUrl: './progress-notes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressNotes {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly clinical = inject(ClinicalClient);
  private readonly auth = inject(AuthService);
  private readonly descargarPdf = inject(PROGRESS_NOTES_PDF_DOWNLOADER);

  /**
   * El estado de la lectura, con las reservas **crudas**.
   *
   * Las filas son un `computed` sobre esto y sobre las etiquetas: cuando el
   * catálogo contesta —siempre después— los estados se actualizan solos.
   */
  protected readonly estado = signal<ViewState<readonly Booking[]>>(loading());

  /** Las etiquetas de los conceptos que aparecieron, y sólo de ésos. */
  private readonly etiquetas = signal<ReadonlyMap<string, EtiquetaDeConcepto>>(new Map());

  /** Los días que se están mirando. Cambiarlo vuelve a consultar. */
  protected readonly dias = signal<number>(DIAS_POR_OMISION);

  protected readonly periodos = PERIODOS;

  /** Lo que la barra de filtros tiene puesto, incluido `q`. */
  private readonly filtros = signal<Readonly<Record<string, string>>>({});

  /** Todas las atenciones del período, sin filtrar. */
  protected readonly atenciones = computed<readonly AtencionRegistrada[]>(() => {
    const actual = this.estado();
    return actual.status === 'ready' ? aAtenciones(actual.data, this.etiquetas()) : [];
  });

  /**
   * Las que se ven: el filtrado es en cliente sobre la página ya traída.
   *
   * En cliente y no en el servidor porque `GET /scheduling/bookings` no acepta
   * ni estado ni tipo ni texto: filtrar allá exigiría endpoints que no existen.
   * Con el tope de 200 del período, la página entera está en memoria.
   */
  protected readonly visibles = computed<readonly AtencionRegistrada[]>(() => {
    const filtros = this.filtros();
    const busqueda = (filtros['q'] ?? '').trim().toLowerCase();
    return this.atenciones().filter((fila) => {
      if (filtros['estado'] !== undefined && filtros['estado'] !== fila.estado) {
        return false;
      }
      if (filtros['tipo'] !== undefined && filtros['tipo'] !== fila.tipo) {
        return false;
      }
      if (filtros['canal'] !== undefined && filtros['canal'] !== fila.canal) {
        return false;
      }
      if (busqueda === '') {
        return true;
      }
      return (
        fila.paciente.toLowerCase().includes(busqueda) ||
        (fila.motivo ?? '').toLowerCase().includes(busqueda)
      );
    });
  });

  /**
   * Los filtros, armados con lo que **aparece en el período**.
   *
   * No se ofrecen los value sets completos: un selector con doce tipologías de
   * las que once no tienen ninguna atención sólo produce listas vacías.
   */
  protected readonly filtrosDisponibles = computed<readonly FilterDef[]>(() => {
    const filas = this.atenciones();
    const estados = [...new Set(filas.map((f) => f.estado))];
    const tipos = [...new Set(filas.map((f) => f.tipo))].filter(esTexto);
    const canales = [...new Set(filas.map((f) => f.canal))].filter(esTexto);
    return [
      {
        key: 'estado',
        label: 'Estado',
        asChips: true,
        options: estados.map((code) => ({ value: code, label: ETIQUETA_DE_ESTADO[code] })),
      },
      {
        key: 'tipo',
        label: 'Tipo de cita',
        options: tipos.map((code) => ({ value: code, label: code })),
      },
      {
        key: 'canal',
        label: 'Canal',
        options: canales.map((code) => ({ value: code, label: code })),
      },
    ];
  });

  /** Si hay algo puesto: lo dice el resumen y viaja al PDF. */
  protected readonly hayFiltro = computed(() => Object.keys(this.filtros()).length > 0);

  /**
   * Hay algo que imprimir sólo cuando la lectura terminó bien.
   *
   * Un botón de exportar sobre un estado de carga o de error produce un papel
   * en blanco con membrete, que se lee como «el sistema perdió tus
   * atenciones» — exactamente lo que esta pantalla existe para no decir.
   */
  protected readonly sePuedeExportar = computed(() => this.estado().status === 'ready');

  protected readonly resumen = computed(() => {
    if (this.estado().status !== 'ready') {
      return null;
    }
    const vistas = this.visibles().length;
    const total = this.atenciones().length;
    const cuenta = `${vistas} ${vistas === 1 ? 'atención' : 'atenciones'}`;
    return vistas === total
      ? `${cuenta} en los últimos ${this.dias()} días.`
      : `${cuenta} de ${total} en los últimos ${this.dias()} días.`;
  });

  /* ── El detalle de una atención ─────────────────────────────────────────── */

  /** La fila cuyo detalle está abierto, o `null`. */
  protected readonly abierta = signal<AtencionRegistrada | null>(null);

  /** Las notas de esa atención, mientras el modal está abierto. */
  protected readonly notas = signal<ViewState<readonly NotaDeLaAtencion[]>>(loading());

  /**
   * Las notas a pintar. Vacío en cualquier estado que no sea `ready`.
   *
   * Se resuelve acá y no en la plantilla porque `ViewState` es una unión: sólo
   * una de sus ramas tiene `data`, y `tsc` no revisa las plantillas —el error
   * aparecería recién al compilar, como un 404 de ruta.
   */
  protected readonly notasVisibles = computed<readonly NotaDeLaAtencion[]>(() => {
    const actual = this.notas();
    return actual.status === 'ready' ? actual.data : [];
  });

  constructor() {
    this.cargar();
  }

  /** Cambia la ventana y vuelve a consultar: el período no se filtra en cliente. */
  protected verPeriodo(dias: number): void {
    if (dias === this.dias()) {
      return;
    }
    this.dias.set(dias);
    this.cargar();
  }

  protected fijarFiltros(valores: Readonly<Record<string, string>>): void {
    this.filtros.set(valores);
  }

  /** Abre el detalle y recién ahí pide el expediente de esa persona. */
  protected verEvolucion(fila: AtencionRegistrada): void {
    this.abierta.set(fila);
    this.notas.set(loading());
    this.clinical.getChart(fila.profileId).subscribe({
      next: (chart) => {
        const delDia = chart.notes.filter((nota) => mismoDia(nota.createdAt, fila.cuando));
        this.notas.set(
          delDia.length === 0
            ? empty(
                { label: 'Abrir el expediente completo', route: fila.ruta },
                'No hay ninguna nota escrita el día de esta atención.',
              )
            : ready(delDia.map(aNota)),
        );
      },
      error: (error: unknown) =>
        this.notas.set(errorToViewState<readonly NotaDeLaAtencion[]>(error)),
    });
  }

  protected cerrarEvolucion(): void {
    this.abierta.set(null);
  }

  /** Baja el período en PDF, con **lo que se está viendo**. */
  protected exportar(): void {
    if (this.estado().status !== 'ready') {
      return;
    }
    this.descargarPdf({
      profesional: this.auth.displayName() ?? '',
      dias: this.dias(),
      filtro: this.hayFiltro() ? this.enPalabras() : null,
      atenciones: this.visibles().map((fila) => ({
        cuando: fila.cuando,
        paciente: fila.paciente,
        motivo: fila.motivo,
        estado: fila.estadoLabel,
        tipo: fila.tipo,
      })),
    });
  }

  /** Lo que está filtrado, para que el papel lo diga. */
  private enPalabras(): string {
    const filtros = this.filtros();
    const partes: string[] = [];
    const q = (filtros['q'] ?? '').trim();
    if (q !== '') {
      partes.push(`búsqueda «${q}»`);
    }
    const estado = filtros['estado'];
    if (estado !== undefined) {
      partes.push(`estado ${ETIQUETA_DE_ESTADO[estado as EstadoDeAtencion] ?? estado}`);
    }
    if (filtros['tipo'] !== undefined) {
      partes.push(`tipo ${filtros['tipo']}`);
    }
    if (filtros['canal'] !== undefined) {
      partes.push(`canal ${filtros['canal']}`);
    }
    return partes.join(' · ');
  }

  protected cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();
    if (perfil === null || tenantId === null) {
      this.estado.set(SIN_AGENDA);
      return;
    }

    this.estado.set(loading());
    miRecursoDeAgenda(this.scheduling, tenantId, perfil).subscribe({
      next: (propio) => {
        if (propio === null) {
          this.estado.set(SIN_AGENDA);
          return;
        }
        this.leerAtenciones(propio);
      },
      error: (error: unknown) => this.estado.set(errorToViewState<readonly Booking[]>(error)),
    });
  }

  private leerAtenciones(recurso: AgendaResource): void {
    const hasta = new Date();
    const desde = new Date();
    desde.setDate(desde.getDate() - this.dias());
    desde.setHours(0, 0, 0, 0);

    this.scheduling
      .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: TOPE })
      .subscribe({
        next: (pagina) => {
          const ocurridas = pagina.items.filter(ocurrio);
          this.estado.set(
            ocurridas.length === 0
              ? empty(
                  // «Consultas médicas» y no «Mis citas»: es el rótulo real de
                  // `/schedule`. «Mis citas» es `my-account/appointments`, la
                  // pantalla del **paciente** —declarada `hiddenFor:
                  // ['PRACTITIONER']`—, así que el enlace nombraba una pantalla
                  // que quien lo lee no puede abrir. Resuelto al mezclar las dos
                  // ramas el 2026-09-10, que cambiaron esta misma línea.
                  { label: 'Ir a Consultas médicas', route: '/schedule' },
                  `No registrás atenciones en los últimos ${this.dias()} días.`,
                )
              : ready(ocurridas),
          );
          this.pedirEtiquetas(ocurridas);
        },
        error: (error: unknown) => this.estado.set(errorToViewState<readonly Booking[]>(error)),
      });
  }

  private pedirEtiquetas(citas: readonly Booking[]): void {
    const ids = [
      ...new Set(
        citas.flatMap((cita) =>
          [cita.statusConceptId, cita.typeConceptId, cita.bookingChannelConceptId].filter(esTexto),
        ),
      ),
    ];
    if (ids.length === 0) {
      return;
    }
    this.terminology.readConceptLabels(ids).subscribe({
      next: (etiquetas) =>
        this.etiquetas.set(
          new Map([...etiquetas].map(([id, o]) => [id, { code: o.code, display: o.display }])),
        ),
      // Si el catálogo no responde, las filas siguen en pantalla con su texto
      // neutro: perder una etiqueta no justifica perder la lista.
      error: () => this.etiquetas.set(new Map()),
    });
  }
}

/** Lo que de un concepto hace falta acá: su código y su etiqueta. */
interface EtiquetaDeConcepto {
  readonly code: string;
  readonly display: string;
}

/** Descarta los ausentes conservando el tipo. */
function esTexto(valor: string | null | undefined): valor is string {
  return typeof valor === 'string';
}

function aNota(nota: ChartNote): NotaDeLaAtencion {
  return {
    id: nota.noteId,
    motivo: nota.chiefComplaintText ?? null,
    subjetivo: nota.subjectiveText ?? null,
    objetivo: nota.objectiveText ?? null,
    evaluacion: nota.assessmentText ?? null,
    plan: nota.planText ?? null,
    firmada: nota.signedAt !== undefined,
    cuando: nota.createdAt,
  };
}

/** Dos instantes del mismo día calendario. */
export function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Si la reserva **ocurrió**.
 *
 * Una reserva futura o cancelada no es una atención, y listarla acá diría que
 * se escribió una evolución que no existe. El criterio es `checkedInAt`
 * —llegó— o que la hora de fin ya haya pasado.
 */
function ocurrio(cita: Booking): boolean {
  if (cita.patientProfileId === undefined || cita.startAt === undefined) {
    return false;
  }
  return cita.checkedInAt !== undefined || (cita.endAt?.getTime() ?? 0) <= Date.now();
}

/**
 * De las reservas del período a una fila por atención.
 *
 * Las más recientes primero: la pregunta es «qué vengo escribiendo», y eso se
 * lee desde lo último hacia atrás.
 */
export function aAtenciones(
  citas: readonly Booking[],
  etiquetas: ReadonlyMap<string, EtiquetaDeConcepto>,
): readonly AtencionRegistrada[] {
  const label = (id: string | undefined): string | null =>
    id === undefined ? null : (etiquetas.get(id)?.display ?? null);

  const filas: AtencionRegistrada[] = [];
  for (const cita of citas) {
    if (!ocurrio(cita)) {
      continue;
    }
    const profileId = cita.patientProfileId as string;
    const estado = estadoDe(cita, etiquetas.get(cita.statusConceptId)?.code);
    filas.push({
      id: cita.id,
      profileId,
      // Ausente no significa «sin nombre»: significa «no te corresponde
      // verlo». Ver el contrato de `Booking.patientName`.
      paciente: cita.patientName ?? 'Paciente',
      motivo: cita.reasonText ?? null,
      cuando: cita.startAt as Date,
      estado,
      estadoLabel: ETIQUETA_DE_ESTADO[estado],
      tipo: label(cita.typeConceptId),
      canal: label(cita.bookingChannelConceptId),
      ruta: patientChartRoute(profileId),
    });
  }
  return filas.sort((a, b) => b.cuando.getTime() - a.cuando.getTime());
}

/**
 * En qué quedó la atención.
 *
 * Se mira el código de la reserva primero y las marcas de tiempo después: sin
 * el catálogo resuelto —que llega siempre más tarde que la lista— igual hay que
 * decir algo, y las marcas de tiempo alcanzan para eso.
 */
function estadoDe(cita: Booking, code: string | undefined): EstadoDeAtencion {
  if (code === CODIGO_EN_CURSO) {
    return 'en-curso';
  }
  if (code !== undefined && CODIGOS_COMPLETADA.has(code)) {
    return 'completada';
  }
  const termino = (cita.endAt?.getTime() ?? 0) <= Date.now();
  if (cita.checkedInAt !== undefined && !termino) {
    return 'en-curso';
  }
  // Llegó, su horario terminó y nadie la cerró: es lo que esta pantalla existe
  // para hacer visible.
  return cita.checkedInAt !== undefined ? 'sin-cerrar' : 'completada';
}

const SIN_AGENDA = empty(
  { label: 'Publicar mi horario', route: '/schedule/new' },
  'Todavía no tenés agenda publicada, así que no hay atenciones registradas para listar.',
);
