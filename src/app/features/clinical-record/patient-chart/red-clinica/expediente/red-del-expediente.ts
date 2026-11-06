import { computed, DestroyRef, inject, Injectable, signal, type WritableSignal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap, type Subscription } from 'rxjs';

import type { ClinicalSummary, Condition, PatientChart } from '../../../../../core/data-access/clinical/clinical.types';
import { DiagnosticsClient } from '../../../../../core/data-access/diagnostics/diagnostics.client';
import { ProceduresClient } from '../../../../../core/data-access/procedures/procedures.client';
import type { DentalCatalog } from '../../../../../core/data-access/procedures/procedures.types';
import { ReferralsClient } from '../../../../../core/data-access/referrals/referrals.client';
import { SchedulingClient } from '../../../../../core/data-access/scheduling/scheduling.client';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../../core/data-access/terminology/terminology.types';
import { dataOf } from '../../../../../core/view-state/view-state';
import type { DiagnosisState } from '../../../../../shared/clinical/diagnosis-state';
import type { Tone } from '../../../../../shared/components/tone/tone.types';
import { SIN_DATO, TOPE } from '../../patient-chart.constants';
import { ASPECTO_DEL_TIPO, TIPOS_DEL_RECORRIDO, type TipoDelRecorrido } from '../../recorrido-clinico/recorrido-clinico.model';
import { construirRed } from '../../recorrido-clinico/red-clinica.adaptador';
import type { FilaPresentada, Rotulador } from '../../recorrido-clinico/red-clinica.fuente';
import type { CertezaDiagnostica } from '../../recorrido-clinico/red-clinica.model';
import type { ProfesionalQueMira } from '../superficie/guia-de-la-red';
import { faltasDeLasLecturas, lecturasCargando, leerLasLecturas, type LecturasDeLaRed } from '../lecturas/red-clinica-lecturas';
import { nodosDeLaRed } from '../red-clinica-del-expediente';
import type { DetalleDeBloque } from '../red-clinica-del-expediente.fuente';

/** What the network reads from a chart row (`FilaClinica`, structurally). */
export interface FilaDeLaRed {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly estado: string;
  readonly cuando: Date | null;
  readonly detalle: string;
  readonly estadoTono?: Tone;
  readonly decision?: string;
  readonly estadoDx?: DiagnosisState;
  readonly condicionOriginal?: Pick<Condition, 'codeConceptId'>;
  readonly cita?: string;
  readonly diagnostico?: string;
}

/** What the network reads from the chart screen: its two reads, its blocks and its filters. */
export interface FuenteDeLaRedDelExpediente {
  readonly profileId: () => string;
  readonly datos: () => { readonly resumen: ClinicalSummary; readonly chart: Pick<PatientChart, 'notes' | 'carePlans'> } | null;
  readonly bloques: () => readonly { readonly clave: string; readonly filas: readonly FilaDeLaRed[] }[];
  /** The chart's filter by type: the network draws what it lets through, and «limpiar» empties it. */
  readonly tiposOcultos: WritableSignal<ReadonlySet<TipoDelRecorrido>>;
  readonly etiquetas: () => ConceptLabels;
  readonly perfilPropio: () => ProfesionalQueMira | null;
}

/** The certainty the network reads, from the diagnosis' C3 state. */
const CERTEZA_DEL_ESTADO: Readonly<Record<DiagnosisState, CertezaDiagnostica>> = {
  IN_STUDY: 'presuntivo',
  ACTIVE: 'confirmado',
  REFUTED: 'descartado',
  HISTORIC: 'historico',
};

/**
 * **The network by episodes of a chart (Recorrido): its reads and its records.**
 *
 * Besides the blocks, the network reads appointments, referrals, studies and
 * procedures, with the usual services. They are requested on entering the
 * view —the other two do not use them— and each read fails on its own:
 * without referrals, the network is drawn anyway and says so above.
 *
 * Provided by the chart screen (one per screen), which connects it to its
 * reads with `conectar`: the state outlives switching views, like the rest of
 * the chart.
 */
@Injectable()
export class RedDelExpediente {
  private readonly scheduling = inject(SchedulingClient);
  private readonly referrals = inject(ReferralsClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);

  private fuenteConectada: FuenteDeLaRedDelExpediente | null = null;

  /** The network's four reads. `null`: not requested yet. */
  readonly lecturas = signal<LecturasDeLaRed | null>(null);
  /** The labels of those reads' concepts (and the dental codes). */
  readonly etiquetas = signal<ReadonlyMap<string, { display?: string; code?: string }>>(new Map());
  private carga: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.carga?.unsubscribe());
  }

  get fuente(): FuenteDeLaRedDelExpediente {
    if (this.fuenteConectada === null) throw new Error('RedDelExpediente: falta conectar la fuente.');
    return this.fuenteConectada;
  }

  conectar(fuente: FuenteDeLaRedDelExpediente): this {
    this.fuenteConectada = fuente;
    return this;
  }

  /** Forgets the reads (a new chart read): the next entry to the view reads again. */
  olvidar(): void {
    this.carga?.unsubscribe();
    this.lecturas.set(null);
    this.etiquetas.set(new Map());
  }

  cargar(): void {
    const profileId = this.fuente.profileId();
    this.carga?.unsubscribe();
    this.lecturas.set(lecturasCargando());
    this.carga = forkJoin({
      // `truncated`/`total` are kept: a cut reading is said, and absences are not asserted over it.
      lecturas: leerLasLecturas({
        citas: this.scheduling.searchBookings({ patientProfileId: profileId, includeCancelled: true, limit: TOPE }),
        derivaciones: this.referrals.listByPatient(profileId),
        estudios: this.diagnostics.getPatientDiagnostics(profileId, TOPE),
        procedimientos: this.procedures.listDentalProcedures({ patientProfileId: profileId, limit: TOPE }),
      }),
      catalogoDental: this.procedures
        .readDentalCatalog()
        .pipe(catchError(() => of<DentalCatalog | null>(null))),
    })
      .pipe(
        switchMap((leido) => {
          const estudios = dataOf(leido.lecturas.estudios);
          const conceptos = [
            ...(dataOf(leido.lecturas.citas) ?? []).flatMap((c) => [c.statusConceptId, c.typeConceptId]),
            ...(estudios?.orders ?? []).flatMap((o) => [o.codeConceptId, o.statusConceptId, o.priorityConceptId]),
            ...(estudios?.reports ?? []).flatMap((r) => [r.codeConceptId, r.lifecycleStatusConceptId]),
            ...(dataOf(leido.lecturas.procedimientos) ?? []).map((p) => p.statusConceptId),
          ].filter((id): id is string => id !== undefined && id !== '');
          return this.terminology.readConceptLabels(conceptos).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => ({ leido, etiquetas })),
          );
        }),
      )
      .subscribe(({ leido, etiquetas }) => {
        const mapa = new Map<string, { display?: string; code?: string }>();
        for (const [id, etiqueta] of etiquetas) {
          mapa.set(id, { display: etiqueta.display, code: etiqueta.code });
        }
        for (const codigo of leido.catalogoDental?.procedureCodes ?? []) {
          mapa.set(codigo.conceptId, { display: codigo.display });
        }
        this.etiquetas.set(mapa);
        this.lecturas.set(leido.lecturas);
      });
  }

  /** What the network could not read, apart by kind (S5 ≠ S6 ≠ S9), and what came cut (`red-clinica-lecturas.ts`). */
  readonly faltas = computed(() => faltasDeLasLecturas(this.lecturas(), TOPE));

  private readonly rotular = computed<Rotulador>(() => {
    const etiquetas = this.etiquetas();
    return (id) => (id === undefined ? {} : (etiquetas.get(id) ?? {}));
  });

  /** The network's records and links: the blocks (all of them: the filter goes apart) and what the network reads. */
  private readonly red = computed(() => {
    const datos = this.fuente.datos();
    if (datos === null) {
      return { registros: [], vinculos: [] };
    }
    const filas: FilaPresentada[] = this.fuente
      .bloques()
      .filter((bloque) => (TIPOS_DEL_RECORRIDO as readonly string[]).includes(bloque.clave))
      .flatMap((bloque) => {
        const tipo = bloque.clave as TipoDelRecorrido;
        return bloque.filas.map((fila) => ({
          id: fila.id,
          tipo,
          // A node with no title is a mute box: if the record brings no name,
          // at least it says what it is.
          titulo:
            fila.principal.trim() === '' || fila.principal === SIN_DATO
              ? ASPECTO_DEL_TIPO[tipo].singular
              : fila.principal,
          // What was decided about a diagnosis is just what the tour comes to
          // tell. «Sin registrar» is noise on a card.
          detalle: fila.decision
            ? `Decisión: ${fila.decision}`
            : fila.secundario === SIN_DATO
              ? ''
              : fila.secundario,
          estado: fila.estado === SIN_DATO ? '' : fila.estado,
          tonoDelEstado: fila.estadoTono ?? 'info',
          cuando: fila.cuando,
          ...(fila.estadoDx === undefined ? {} : { certeza: CERTEZA_DEL_ESTADO[fila.estadoDx] }),
          ...(fila.condicionOriginal === undefined
            ? {}
            : { concepto: fila.condicionOriginal.codeConceptId }),
        }));
      });
    const lecturas = this.lecturas();
    return construirRed(
      filas,
      {
        encounters: datos.resumen.encounters,
        conditions: datos.resumen.conditions,
        medicationRequests: datos.resumen.medicationRequests,
        observations: datos.resumen.observations,
        notes: datos.chart.notes,
        carePlans: datos.chart.carePlans,
        citas: lecturas === null ? null : dataOf(lecturas.citas),
        derivaciones: lecturas === null ? null : dataOf(lecturas.derivaciones),
        estudios: lecturas === null ? null : dataOf(lecturas.estudios),
        procedimientos: lecturas === null ? null : dataOf(lecturas.procedimientos),
      },
      this.rotular(),
    );
  });

  readonly registros = computed(() => this.red().registros);
  readonly vinculos = computed(() => this.red().vinculos);

  /** The analysis the blocks already show, for the nodes of those types. */
  private readonly detalleDeLosBloques = computed(() => {
    const mapa = new Map<string, DetalleDeBloque>();
    for (const bloque of this.fuente.bloques()) {
      for (const fila of bloque.filas) {
        const resumen = fila.secundario === SIN_DATO ? '' : fila.secundario;
        const extra = fila.detalle === SIN_DATO ? '' : fila.detalle;
        mapa.set(fila.id, {
          resumen,
          datos: [
            ...(extra === '' ? [] : [{ rotulo: 'Detalle', valor: extra }]),
            ...(fila.cita ? [{ rotulo: 'Consulta', valor: fila.cita }] : []),
            ...(fila.diagnostico ? [{ rotulo: 'Para', valor: fila.diagnostico }] : []),
          ],
        });
      }
    }
    return mapa;
  });

  /** The network's nodes and edges, in the panel's contract. Real ids. */
  private readonly conexion = computed(() => {
    const datos = this.fuente.datos();
    const lecturas = this.lecturas();
    return nodosDeLaRed(
      this.registros(),
      this.vinculos(),
      {
        diagnosticos: datos?.resumen.conditions ?? [],
        citas: lecturas === null ? null : dataOf(lecturas.citas),
        derivaciones: lecturas === null ? null : dataOf(lecturas.derivaciones),
        estudios: lecturas === null ? null : dataOf(lecturas.estudios),
        bloques: this.detalleDeLosBloques(),
      },
      this.rotular(),
    );
  });

  readonly nodos = computed(() => this.conexion().nodos);
  readonly aristas = computed(() => this.conexion().aristas);

  /** The panel's and the alerts' «hace N días» reference: the time of the read. */
  readonly ahora = computed(() => {
    this.fuente.datos();
    this.lecturas();
    return new Date();
  });
}
