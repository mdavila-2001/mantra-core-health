import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { ReferralsClient } from '../../../core/data-access/referrals/referrals.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { PACIENTE } from '../../../core/mock/fixtures/people';
import {
  RecorridoGuiado,
  type PasoActualDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado';
import {
  armarRecorridoGuiado,
  type PasoDelRecorrido,
  type RegistrosDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado.model';

import { outputsRecord } from './exit-log';
import type { ScenarioHost } from './scenario.types';

/* ============================================================================
    El recorrido guiado sobre la historia del simulador de `pid-paciente`.

    Lee por los clientes reales de `core/data-access/` —resumen clínico, circuito
    diagnóstico, derivaciones y citas— contra el backend simulado (el stock sólo
    existe con `mockBackend`), resuelve los conceptos con `TerminologyClient` y
    arma los pasos con el modelo real. Es la prueba de que la narración
    funciona con los vínculos de la Franja 1 y no sólo con la historia escrita
    a mano del escenario «historia».

    Se retira sin rastro junto con `recorrido-guiado.scenarios.ts`.
    ========================================================================== */

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly detalle: string }
  | { readonly tipo: 'listo'; readonly pasos: readonly PasoDelRecorrido[]; readonly fallidas: readonly string[] };

const TOPE = 200;

@Component({
  selector: 'app-scenario-recorrido-guiado-simulador',
  imports: [RecorridoGuiado],
  template: `
    @switch (estado().tipo) {
      @case ('cargando') {
        <p data-testid="simulador-cargando">Leyendo la historia de la paciente de prueba en el simulador…</p>
      }
      @case ('error') {
        <p role="alert" data-testid="simulador-error">No se pudo leer la historia: {{ detalleDeError() }}</p>
      }
      @default {
        @if (fallidas().length > 0) {
          <p class="simulador__aviso" data-testid="simulador-parcial">
            Lectura parcial: no respondieron {{ fallidas().join(', ') }}. El recorrido cuenta lo que sí llegó.
          </p>
        }
        <app-recorrido-guiado [pasos]="pasos()" (pasoActual)="alCambiar($event)" />
      }
    }
  `,
  styles: `
    .simulador__aviso {
      margin: 0 0 var(--sp-3);
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioRecorridoGuiadoSimulador implements ScenarioHost {
  /** El banco la fija con `setInput`; este anfitrión tiene una sola variante. */
  readonly variante = input('simulador');

  private readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  protected readonly estado = signal<Estado>({ tipo: 'cargando' });

  private readonly clinical = inject(ClinicalClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly referrals = inject(ReferralsClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);

  constructor() {
    const paciente = PACIENTE.id;
    const fallidas: string[] = [];
    const tolerante = <T>(nombre: string, fuente: Observable<T>, vacio: T): Observable<T> =>
      fuente.pipe(
        catchError(() => {
          fallidas.push(nombre);
          return of(vacio);
        }),
      );

    forkJoin({
      resumen: this.clinical.getSummary(paciente, TOPE),
      circuito: tolerante('estudios', this.diagnostics.getPatientDiagnostics(paciente, TOPE), null),
      derivaciones: tolerante('derivaciones', this.referrals.listByPatient(paciente), []),
      citas: tolerante(
        'citas',
        this.scheduling
          .searchBookings({ patientProfileId: paciente, includeCancelled: true, limit: TOPE })
          .pipe(map((p) => p.items)),
        [],
      ),
    })
      .pipe(
        switchMap((d) => {
          const registros: RegistrosDelRecorrido = {
            atenciones: d.resumen.encounters,
            diagnosticos: d.resumen.conditions,
            recetas: d.resumen.medicationRequests,
            internaciones: d.resumen.careEpisodes,
            ordenes: d.circuito?.orders ?? [],
            informes: d.circuito?.reports ?? [],
            derivaciones: d.derivaciones,
            citas: d.citas,
          };
          return this.terminology
            .readConceptLabels(conceptosDe(registros))
            .pipe(
              catchError(() => of<ConceptLabels>(new Map())),
              map((etiquetas) => ({ registros, etiquetas })),
            );
        }),
      )
      .subscribe({
        next: ({ registros, etiquetas }) => {
          const pasos = armarRecorridoGuiado(registros, {
            etiqueta: (id) => (id === undefined ? undefined : etiquetas.get(id)?.display),
            codigo: (id) => (id === undefined ? undefined : etiquetas.get(id)?.code),
          });
          this.estado.set({ tipo: 'listo', pasos, fallidas: [...fallidas] });
        },
        error: (e: unknown) =>
          this.estado.set({ tipo: 'error', detalle: e instanceof Error ? e.message : 'error inesperado' }),
      });
  }

  protected pasos(): readonly PasoDelRecorrido[] {
    const e = this.estado();
    return e.tipo === 'listo' ? e.pasos : [];
  }

  protected fallidas(): readonly string[] {
    const e = this.estado();
    return e.tipo === 'listo' ? e.fallidas : [];
  }

  protected detalleDeError(): string {
    const e = this.estado();
    return e.tipo === 'error' ? e.detalle : '';
  }

  protected alCambiar(evento: PasoActualDelRecorrido): void {
    this.record.anotar('pasoActual', `paso ${evento.indice + 1} de ${evento.total} · ${evento.paso.titulo}`);
  }
}

/** Todos los conceptos que la narración puede nombrar. */
function conceptosDe(r: RegistrosDelRecorrido): string[] {
  const ids: (string | undefined)[] = [
    ...(r.atenciones ?? []).map((a) => a.classConceptId),
    ...(r.diagnosticos ?? []).flatMap((c) => [c.codeConceptId, c.verificationStatusConceptId]),
    ...(r.recetas ?? []).map((m) => m.medicationConceptId),
    ...(r.internaciones ?? []).map((e) => e.typeConceptId),
    ...(r.ordenes ?? []).map((o) => o.codeConceptId),
    ...(r.informes ?? []).map((i) => i.codeConceptId),
    ...(r.citas ?? []).flatMap((c) => [c.statusConceptId, c.serviceConceptId]),
  ];
  return ids.filter((id): id is string => id !== undefined);
}
