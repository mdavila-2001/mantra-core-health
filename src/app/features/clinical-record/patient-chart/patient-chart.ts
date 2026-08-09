import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type {
  ClinicalSummary,
  PatientChart as ExpedienteDePaciente,
} from '../../../core/data-access/clinical/clinical.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record';

/** Tope por bloque. La API aplica 50 si no se pide otro. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Nombre legible de cada bloque, para el aviso de recorte. */
const NOMBRE_DE_BLOQUE: Readonly<Record<string, string>> = {
  conditions: 'diagnósticos',
  allergies: 'alergias',
  medicationRequests: 'medicación',
  observations: 'observaciones',
  encounters: 'encuentros',
  notes: 'notas',
  carePlans: 'planes de cuidados',
  documents: 'documentos',
};

/** Una fila de cualquiera de las tablas del expediente, ya sin uuid. */
export interface FilaClinica {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly estado: string;
  readonly cuando: Date | null;
  readonly detalle: string;
}

/** Lo que la pantalla necesita de las dos lecturas, ya unido. */
interface Expediente {
  readonly resumen: ClinicalSummary;
  readonly chart: ExpedienteDePaciente;
}

/**
 * **Expediente clínico** de una persona — `clinical` (M08) + `chart` (M15).
 *
 * ## Dos lecturas, una pantalla
 *
 * `GET /clinical/patients/:id/summary` trae lo estructurado —diagnósticos,
 * alergias, medicación, observaciones, encuentros— y
 * `GET /charts/patients/:id/chart` lo narrativo —notas, planes, documentos—.
 * La separación es de escritura: quien atiende no piensa en dos módulos.
 *
 * Van en `forkJoin` y **la pantalla exige las dos**: media historia clínica es
 * peor que ninguna, porque no se distingue de una historia completa que no
 * tiene alergias registradas.
 *
 * ## El nombre del paciente es opcional a propósito
 *
 * Ninguna de las dos lecturas lo trae, y `GET /profiles/patients/:id` pide
 * `SECURITY_ADMIN` — un rol que quien atiende no tiene. Se intenta y, si
 * responde `403`, el encabezado dice «Expediente clínico» y sigue. Tumbar el
 * expediente porque no se pudo poner un nombre en el título sería cambiar un
 * problema cosmético por uno clínico.
 *
 * ## Lo que quedó recortado se dice
 *
 * `truncated` nombra los bloques cortados por el tope. Un expediente al que le
 * faltan notas sin avisar es un expediente que miente, y en clínica esa mentira
 * se lee como «no hay antecedentes».
 */
@Component({
  selector: 'app-patient-chart',
  imports: [Alert, Badge, Card, DataTable, DatePipe, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './patient-chart.html',
  styleUrl: './patient-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChart {
  private readonly clinical = inject(ClinicalClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);

  private readonly celdaPrincipal =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaPrincipal');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaEstado');
  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaCuando');

  /**
   * El perfil que se está mirando, leído del segmento `:profileId`.
   *
   * De la ruta activa y no como `input()` porque la aplicación no habilita
   * `withComponentInputBinding()`: activarlo acá cambiaría cómo se enlazan las
   * entradas de todas las pantallas.
   */
  private readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  protected readonly expediente = signal<ViewState<Expediente>>(loading());

  /** Nombre del paciente si se pudo leer; vacío si el padrón está prohibido. */
  private readonly nombre = signal('');

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed(() => dataOf(this.expediente()));

  protected readonly titulo = computed(() =>
    this.nombre() === '' ? 'Expediente clínico' : this.nombre(),
  );

  protected readonly subtitulo = computed(() =>
    this.nombre() === ''
      ? 'Historia clínica y expediente de la persona atendida.'
      : 'Historia clínica y expediente.',
  );

  /**
   * La ruta de navegación, con el paciente como último escalón.
   *
   * El anteúltimo pasa a ser enlace: desde un expediente, volver a elegir otra
   * persona es la salida más pedida.
   */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: CLINICAL_RECORD_ROUTE },
      { label: this.titulo() },
    ];
  });

  /* -- Los bloques, ya traducidos ----------------------------------------- */

  protected readonly diagnosticos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.conditions ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.onsetAt ?? fila.createdAt,
      detalle: fila.resolvedAt === undefined ? '' : 'Resuelto',
    })),
  );

  protected readonly alergias = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.allergies ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.substanceConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.createdAt,
      // La criticidad es el dato que decide una conducta: va en el detalle, no
      // escondida en una columna que se pliega en móvil.
      detalle: this.label(fila.criticalityConceptId),
    })),
  );

  protected readonly medicacion = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.medicationConceptId),
      secundario: [fila.doseText, fila.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(fila.statusConceptId),
      cuando: fila.validFrom ?? fila.createdAt,
      detalle: fila.validTo === undefined ? '' : 'Con fin previsto',
    })),
  );

  protected readonly observaciones = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.observations ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.valorDe(fila),
      estado: this.label(fila.statusConceptId),
      cuando: fila.effectiveStartAt ?? null,
      detalle: this.label(fila.interpretationConceptId),
    })),
  );

  protected readonly encuentros = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.encounters ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.classConceptId),
      secundario: fila.reasonText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.startAt ?? null,
      detalle: fila.endAt === undefined ? 'En curso' : 'Cerrado',
    })),
  );

  protected readonly notas = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.notes ?? []).map((fila) => ({
      id: fila.noteId,
      principal: fila.chiefComplaintText ?? this.label(fila.noteTypeConceptId),
      secundario: fila.assessmentText ?? fila.subjectiveText ?? '',
      estado: this.label(fila.lifecycleStatusConceptId),
      cuando: fila.signedAt ?? fila.createdAt,
      // Derivado por el backend: no hace falta resolver terminología para saber
      // si la persona lo ve en su portal, y es un dato que cambia qué se escribe.
      detalle: fila.releasedToPatient ? 'Visible para la persona' : '',
    })),
  );

  protected readonly planes = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.carePlans ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.goalText ?? 'Plan sin objetivo escrito',
      secundario: `${fila.activities.length} actividad${fila.activities.length === 1 ? '' : 'es'}`,
      estado: this.label(fila.statusConceptId),
      cuando: fila.startDate ?? fila.createdAt,
      detalle: this.label(fila.intentConceptId),
    })),
  );

  protected readonly documentos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.documents ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.title ?? 'Documento sin título',
      secundario: fila.authorText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.documentDate ?? fila.createdAt,
      detalle: fila.isExternal === true ? 'Externo' : '',
    })),
  );

  /** Los ocho bloques con su rótulo, para dibujar las pestañas de una pasada. */
  protected readonly bloques = computed(() => [
    { clave: 'diagnosticos', titulo: 'Diagnósticos', filas: this.diagnosticos() },
    { clave: 'alergias', titulo: 'Alergias', filas: this.alergias() },
    { clave: 'medicacion', titulo: 'Medicación', filas: this.medicacion() },
    { clave: 'observaciones', titulo: 'Observaciones', filas: this.observaciones() },
    { clave: 'encuentros', titulo: 'Encuentros', filas: this.encuentros() },
    { clave: 'notas', titulo: 'Notas', filas: this.notas() },
    { clave: 'planes', titulo: 'Planes de cuidados', filas: this.planes() },
    { clave: 'documentos', titulo: 'Documentos', filas: this.documentos() },
  ]);

  /**
   * Aviso de recorte, en palabras.
   *
   * Se juntan los dos `truncated` porque para quien lee es un solo expediente:
   * que el corte venga de `clinical` o de `chart` es una división del backend
   * que no le cambia nada.
   */
  protected readonly recorte = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return '';
    }
    const bloques = [...datos.resumen.truncated, ...datos.chart.truncated].map(
      (clave) => NOMBRE_DE_BLOQUE[clave] ?? clave,
    );
    return bloques.length === 0 ? '' : bloques.join(', ');
  });

  protected readonly tope = TOPE;

  protected readonly columnas = computed<readonly ColumnDef<FilaClinica>[]>(() => [
    { key: 'principal', header: 'Registro', priority: 1, cell: this.celdaPrincipal() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'cuando', header: 'Fecha', priority: 2, cell: this.celdaCuando() },
    { key: 'detalle', header: 'Detalle', priority: 3 },
  ]);

  protected readonly porFila = (fila: FilaClinica): string => fila.id;

  /** El estado del bloque: hay filas, o el vacío con su explicación propia. */
  protected estadoDe(
    filas: readonly FilaClinica[],
    titulo: string,
  ): ViewState<readonly FilaClinica[]> {
    if (filas.length > 0) {
      return ready(filas);
    }
    // El vacío de un bloque clínico **no** ofrece cargar nada: esta pantalla es
    // de lectura y quien la mira puede no tener permiso de escritura. La salida
    // honesta es volver a elegir persona.
    return empty(
      { label: 'Elegir otra persona', route: CLINICAL_RECORD_ROUTE },
      `Sin ${titulo.toLowerCase()} registrados para esta persona.`,
    );
  }

  constructor() {
    // Ir de un expediente a otro reutiliza el componente: sin escuchar el
    // parámetro, el segundo seguiría mostrando los datos del primero.
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- Lectura ------------------------------------------------------------- */

  private cargar(): void {
    const profileId = this.profileId();
    this.expediente.set(loading());
    this.etiquetas.set(new Map());
    this.nombre.set('');

    if (profileId === '') {
      // S6 y no un error: sin identificador no hay recurso que buscar, y decir
      // «no encontrado» no filtra nada porque no se preguntó por nadie.
      this.expediente.set(notFound({ label: 'Elegir una persona', route: CLINICAL_RECORD_ROUTE }));
      return;
    }

    // El nombre va por su lado a propósito: es cosmético y su permiso es otro.
    // Atarlo al `forkJoin` del expediente haría que un 403 del padrón se llevara
    // puesta la historia clínica.
    this.profiles
      .getPatient(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((paciente) => {
        if (paciente !== null) {
          this.nombre.set(paciente.displayName ?? `Paciente ${paciente.patientCode}`);
        }
      });

    forkJoin({
      resumen: this.clinical.getSummary(profileId, TOPE),
      chart: this.clinical.getChart(profileId, TOPE),
    })
      .pipe(
        switchMap((datos) =>
          forkJoin({
            datos: of(datos),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(datos))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ datos, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.expediente.set(ready(datos));
        },
        error: (error: unknown) => this.expediente.set(errorToViewState<Expediente>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * El valor de una observación.
   *
   * Cinco caminos excluyentes, en el orden en que el contrato los declara. Se
   * elige el primero presente en vez de concatenar: una observación no tiene dos
   * valores, y mostrar dos casillas sugeriría que sí.
   */
  private valorDe(observacion: {
    readonly quantityValue?: string;
    readonly quantityUnitConceptId?: string;
    readonly valueDecimal?: string;
    readonly valueText?: string;
    readonly valueBoolean?: boolean;
    readonly valueConceptId?: string;
  }): string {
    if (observacion.quantityValue !== undefined) {
      const unidad = this.label(observacion.quantityUnitConceptId);
      return unidad === SIN_DATO
        ? observacion.quantityValue
        : `${observacion.quantityValue} ${unidad}`;
    }
    if (observacion.valueDecimal !== undefined) {
      return observacion.valueDecimal;
    }
    if (observacion.valueText !== undefined) {
      return observacion.valueText;
    }
    if (observacion.valueBoolean !== undefined) {
      return observacion.valueBoolean ? 'Sí' : 'No';
    }
    if (observacion.valueConceptId !== undefined) {
      return this.label(observacion.valueConceptId);
    }
    return SIN_DATO;
  }
}

/**
 * Los identificadores de concepto del expediente, sin los ausentes.
 *
 * Listados a mano —y no recorriendo las claves que terminen en `ConceptId`— por
 * lo mismo que en la ficha de paciente: una clave nueva del contrato debe
 * obligar a decidir si se muestra, no colarse en la petición sin que nadie la
 * haya puesto en pantalla.
 */
function conceptosDe({ resumen, chart }: Expediente): readonly string[] {
  return [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      fila.categoryConceptId,
      fila.clinicalStatusConceptId,
      fila.severityConceptId,
    ]),
    ...resumen.allergies.flatMap((fila) => [
      fila.substanceConceptId,
      fila.categoryConceptId,
      fila.criticalityConceptId,
      fila.clinicalStatusConceptId,
    ]),
    ...resumen.medicationRequests.flatMap((fila) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.observations.flatMap((fila) => [
      fila.codeConceptId,
      fila.statusConceptId,
      fila.interpretationConceptId,
      fila.valueConceptId,
      fila.quantityUnitConceptId,
    ]),
    ...resumen.encounters.flatMap((fila) => [fila.statusConceptId, fila.classConceptId]),
    ...chart.notes.flatMap((fila) => [fila.noteTypeConceptId, fila.lifecycleStatusConceptId]),
    ...chart.carePlans.flatMap((fila) => [fila.statusConceptId, fila.intentConceptId]),
    ...chart.documents.flatMap((fila) => [fila.categoryConceptId, fila.statusConceptId]),
  ].filter((id): id is string => id !== undefined);
}
