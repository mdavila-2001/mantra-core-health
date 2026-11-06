import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type {
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../core/data-access/clinical/clinical.types';
import type {
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import {
  RecorridoGuiado,
  type PasoActualDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado';
import {
  armarRecorridoGuiado,
  type LectorDelRecorrido,
  type RegistrosDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado.model';

import { outputsRecord } from './exit-log';
import type { ComponentScenario, ScenarioHost } from './scenario.types';

/* ============================================================================
    Escenarios del recorrido guiado (Franja 4 de la red clínica).

    Desde el 06/11/2026 el control va montado en el Recorrido del expediente
    (`patient-chart/red-clinica/superficie/`), sobre las lecturas reales de la
    paciente; la variante «simulador» de este banco, que leía lo mismo, se
    retiró por redundante. Quedan los estados que documentan el control
    aislado (historia, episodio, vacío): los pasos salen del **modelo real** (`armarRecorridoGuiado`)
    sobre una historia de demostración tipada con los mismos tipos de
    `core/data-access/`, y al lado se dibuja una lista de los registros que
    hace de red de mentira —revelado, enfocado u oculto— para ver lo que emite
    `pasoActual`. Tocar un registro de esa lista cuenta como interacción con la
    red y pausa la reproducción.

    Se retira borrando este archivo y su línea en `scenarios.ts`.
    ========================================================================== */

const KEY = 'features/clinical-record/patient-chart/recorrido-guiado/recorrido-guiado';
const SOURCE = 'src/app/features/component-stock/scenarios/recorrido-guiado.scenarios.ts';

export const RECORRIDO_GUIADO_VARIANTS = ['historia', 'episodio', 'vacio'] as const;
export type RecorridoGuiadoVariant = (typeof RECORRIDO_GUIADO_VARIANTS)[number];

/* -- La historia de demostración ------------------------------------------ */

const dia = (mes: number, d: number, hora = 13): Date => new Date(Date.UTC(2026, mes - 1, d, hora));
const u = (n: number): string => `00000de3-0000-4000-a000-${String(n).padStart(12, '0')}`;

const ID = {
  e1: u(1),
  e2: u(2),
  e3: u(3),
  migrana: u(10),
  sinusitis: u(11),
  tac: u(20),
  informe: u(21),
  paracetamol: u(30),
  amoxicilina: u(31),
  claritromicina: u(32),
  cita1: u(40),
  cita2: u(41),
  cita3: u(42),
  derivacion: u(50),
} as const;

const NOMBRES: Record<string, string> = {
  'demo-migrana': 'Migraña',
  'demo-sinusitis': 'Sinusitis aguda',
  'demo-tac': 'Tomografía de cráneo',
  'demo-paracetamol': 'Paracetamol 500 mg',
  'demo-amoxicilina': 'Amoxicilina 500 mg',
  'demo-claritromicina': 'Claritromicina 500 mg',
};

const SERVICIOS: Record<string, string> = {
  [ID.e1]: 'Medicina general',
  [ID.e2]: 'Neurología',
  [ID.e3]: 'Otorrinolaringología',
};

const LECTOR: LectorDelRecorrido = {
  etiqueta: (id) => (id === undefined ? undefined : NOMBRES[id]),
  servicioDeAtencion: (a) => SERVICIOS[a.id],
};

const atencion = (id: string, cuando: Date, motivo: string): Encounter => ({
  id,
  statusConceptId: 'demo-estado',
  startAt: cuando,
  reasonText: motivo,
});

const receta = (
  id: string,
  med: string,
  encounterId: string,
  cuando: Date,
  extra: Partial<MedicationRequest> & Record<string, unknown> = {},
): MedicationRequest => ({ id, medicationConceptId: med, statusConceptId: 'demo-estado', encounterId, createdAt: cuando, ...extra });

const cita = (id: string, cuando: Date, extra: Partial<Booking> = {}): Booking => ({
  id,
  statusConceptId: 'demo-estado',
  startAt: cuando,
  createdAt: dia(1, 1),
  ...extra,
});

const migrana: Condition = {
  id: ID.migrana,
  codeConceptId: 'demo-migrana',
  encounterId: ID.e1,
  createdAt: dia(2, 3),
  verification: {
    outcome: 'REFUTED',
    decidedAt: dia(2, 17, 15).toISOString(),
    decidedByProfileId: u(900),
    reasonText: 'La tomografía no muestra hallazgos compatibles.',
    basedOn: { kind: 'ANALYSIS', serviceRequestId: ID.tac, encounterId: ID.e2 },
  },
  replacedByConditionId: ID.sinusitis,
};

const sinusitis: Condition = {
  id: ID.sinusitis,
  codeConceptId: 'demo-sinusitis',
  encounterId: ID.e2,
  createdAt: dia(2, 17),
  verification: {
    outcome: 'CONFIRMED',
    decidedAt: dia(2, 17, 16).toISOString(),
    decidedByProfileId: u(900),
    reasonText: null,
    basedOn: null,
  },
};

const tac: DiagnosticOrder = {
  id: ID.tac,
  patientProfileId: u(800),
  encounterId: ID.e1,
  codeConceptId: 'demo-tac',
  statusConceptId: 'demo-estado',
  createdAt: dia(2, 3, 14),
  reasonConditionId: ID.migrana,
};

const informe: DiagnosticReport = {
  id: ID.informe,
  patientProfileId: u(800),
  serviceRequestId: ID.tac,
  codeConceptId: 'demo-tac',
  lifecycleStatusConceptId: 'demo-estado',
  currentReleasedVersionId: u(700),
  createdAt: dia(2, 10),
};

const derivacion: Referral = {
  id: ID.derivacion,
  patientProfileId: u(800),
  statusConceptId: 'demo-estado',
  status: 'ACCEPTED',
  createdAt: dia(2, 17),
  sourceEncounterId: ID.e2,
  targetDisplayName: 'Otorrinolaringología de Clínica Norte',
  diagnosisText: 'Sinusitis aguda que no cede',
  targetEncounterId: ID.e3,
};

export const HISTORIA_DE_DEMOSTRACION: RegistrosDelRecorrido = {
  atenciones: [
    atencion(ID.e1, dia(2, 3), 'Cefalea de dos semanas'),
    atencion(ID.e2, dia(2, 17), 'Control de cefalea'),
    atencion(ID.e3, dia(3, 2), 'Sinusitis que no cede'),
  ],
  diagnosticos: [migrana, sinusitis],
  ordenes: [tac],
  informes: [informe],
  recetas: [
    receta(ID.paracetamol, 'demo-paracetamol', ID.e1, dia(2, 3)),
    receta(ID.amoxicilina, 'demo-amoxicilina', ID.e2, dia(2, 17), {
      indicationConditionId: ID.sinusitis,
      doseText: '1 comprimido',
      frequencyText: 'cada 8 horas',
      replacedByRequestId: ID.claritromicina,
    }),
    receta(ID.claritromicina, 'demo-claritromicina', ID.e3, dia(3, 2), { indicationConditionId: ID.sinusitis }),
  ],
  citas: [
    cita(ID.cita1, dia(2, 3)),
    cita(ID.cita2, dia(2, 17), { followUpOf: { bookingId: ID.cita1, encounterId: ID.e1, startAt: dia(2, 3) } }),
    cita(ID.cita3, dia(3, 20), { followUpOf: { bookingId: ID.cita2, encounterId: ID.e2 } }),
  ],
  derivaciones: [derivacion],
};

/** El reloj de la demostración: la reconsulta del 20 mar queda en el futuro. */
const AHORA = dia(3, 10);

/** Los registros de la red de mentira, en el orden en que se dibujan. */
const NODOS: readonly { readonly id: string; readonly rotulo: string }[] = [
  { id: ID.e1, rotulo: 'Consulta · Medicina general' },
  { id: ID.migrana, rotulo: 'Migraña (presuntivo → descartado)' },
  { id: ID.tac, rotulo: 'Tomografía de cráneo' },
  { id: ID.informe, rotulo: 'Informe de la tomografía' },
  { id: ID.paracetamol, rotulo: 'Paracetamol 500 mg' },
  { id: ID.cita2, rotulo: 'Reconsulta del 17 feb' },
  { id: ID.e2, rotulo: 'Consulta · Neurología' },
  { id: ID.sinusitis, rotulo: 'Sinusitis aguda (confirmado)' },
  { id: ID.amoxicilina, rotulo: 'Amoxicilina 500 mg' },
  { id: ID.derivacion, rotulo: 'Derivación a Otorrinolaringología' },
  { id: ID.e3, rotulo: 'Consulta · Otorrinolaringología' },
  { id: ID.claritromicina, rotulo: 'Claritromicina 500 mg' },
  { id: ID.cita3, rotulo: 'Reconsulta del 20 mar' },
];

const EPISODIO_SINUSITIS: readonly string[] = [
  ID.e2,
  ID.sinusitis,
  ID.amoxicilina,
  ID.derivacion,
  ID.e3,
  ID.claritromicina,
];

@Component({
  selector: 'app-scenario-recorrido-guiado',
  imports: [RecorridoGuiado],
  template: `
    <div class="escenario-guiado">
      <app-recorrido-guiado
        [pasos]="pasos()"
        [episodio]="episodio()"
        [nombreDelEpisodio]="episodio() === null ? null : 'Sinusitis aguda'"
        [interaccionEnLaRed]="toques()"
        (pasoActual)="alCambiar($event)"
      />

      <section class="escenario-guiado__red" aria-label="Red de demostración" data-testid="escenario-red">
        <h3 class="escenario-guiado__titulo">Red de demostración</h3>
        <p class="escenario-guiado__nota">
          Hace de red: muestra lo que emite el control. Tocar un registro cuenta como interacción con la red y pausa.
        </p>
        <ul class="escenario-guiado__nodos">
          @for (nodo of nodos; track nodo.id) {
            <li>
              <button
                type="button"
                class="escenario-guiado__nodo"
                [class.is-revelado]="revelados().has(nodo.id)"
                [class.is-enfocado]="enfocados().has(nodo.id)"
                [attr.aria-pressed]="enfocados().has(nodo.id)"
                [attr.data-estado]="enfocados().has(nodo.id) ? 'enfocado' : revelados().has(nodo.id) ? 'revelado' : 'oculto'"
                (click)="tocar(nodo.id)"
              >
                {{ nodo.rotulo }}
              </button>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .escenario-guiado {
      display: grid;
      gap: var(--sp-4);
    }
    .escenario-guiado__red {
      display: grid;
      gap: var(--sp-2);
      padding: var(--sp-4);
      border: 1px dashed var(--border-default);
      border-radius: var(--r-lg);
    }
    .escenario-guiado__titulo {
      margin: 0;
      font-size: var(--fs-body-lg);
    }
    .escenario-guiado__nota {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .escenario-guiado__nodos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .escenario-guiado__nodo {
      padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-pill);
      background: var(--bg-surface-alt);
      color: var(--text-tertiary);
      font: inherit;
      font-size: var(--fs-caption);
      opacity: 0.55;
      cursor: pointer;
    }
    .escenario-guiado__nodo.is-revelado {
      opacity: 1;
      color: var(--text-primary);
      background: var(--bg-surface);
    }
    .escenario-guiado__nodo.is-enfocado {
      border-color: var(--brand-primary);
      background: var(--st-primary-bg);
      color: var(--st-primary-fg);
      font-weight: 600;
    }
    .escenario-guiado__nodo:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioRecorridoGuiado implements ScenarioHost {
  readonly variante = input<RecorridoGuiadoVariant>('historia');

  private readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  protected readonly nodos = NODOS;
  protected readonly toques = signal(0);

  protected readonly pasos = computed(() =>
    this.variante() === 'vacio' ? [] : armarRecorridoGuiado(HISTORIA_DE_DEMOSTRACION, LECTOR, AHORA),
  );
  protected readonly episodio = computed(() => (this.variante() === 'episodio' ? EPISODIO_SINUSITIS : null));

  private readonly actual = signal<PasoActualDelRecorrido | null>(null);
  protected readonly revelados = computed(() => new Set(this.actual()?.revelados ?? []));
  protected readonly enfocados = computed(() => new Set(this.actual()?.enfocar ?? []));

  protected alCambiar(evento: PasoActualDelRecorrido): void {
    this.actual.set(evento);
    this.record.anotar('pasoActual', `paso ${evento.indice + 1} de ${evento.total} · ${evento.enfocar.length} nodo(s) enfocado(s)`);
  }

  protected tocar(id: string): void {
    this.toques.update((n) => n + 1);
    this.record.anotar('interaccionEnLaRed', NODOS.find((n) => n.id === id)?.rotulo ?? '');
  }
}

export const RECORRIDO_GUIADO_SCENARIOS: readonly ComponentScenario[] = [
  {
    id: `${KEY}#historia`,
    clave: KEY,
    variante: 'historia',
    titulo: 'Historia completa: cefalea → sinusitis',
    seVe: 'Paso 1 de 5 del 3 feb 2026 con la narración de la primera consulta; la línea de progreso con cinco segmentos y la red de demostración con cuatro registros enfocados.',
    interacciones: [
      '«Siguiente», flecha derecha o un segmento → pasoActual con el foco del paso nuevo.',
      '«Reproducir» avanza solo y se detiene en el último paso; con movimiento reducido queda deshabilitado.',
      'Tocar un registro de la red → interaccionEnLaRed y la reproducción se pausa.',
    ],
    salidasEsperadas: ['pasoActual', 'interaccionEnLaRed'],
    host: ScenarioRecorridoGuiado,
    fuente: SOURCE,
    nivelDePrueba: 'correcto',
  },
  {
    id: `${KEY}#episodio`,
    clave: KEY,
    variante: 'episodio',
    titulo: 'Siguiendo sólo el episodio de sinusitis',
    seVe: 'Paso 1 de 2 con la etiqueta «Siguiendo: Sinusitis aguda»; sólo se enfocan registros del episodio.',
    interacciones: ['«Siguiente» → pasoActual del 2 mar 2026 con la llegada por derivación.'],
    salidasEsperadas: ['pasoActual', 'interaccionEnLaRed'],
    host: ScenarioRecorridoGuiado,
    fuente: SOURCE,
    nivelDePrueba: 'limite',
  },
  {
    id: `${KEY}#vacio`,
    clave: KEY,
    variante: 'vacio',
    titulo: 'Sin registros',
    seVe: 'El aviso de que todavía no hay registros para recorrer y qué lo va a llenar; sin controles.',
    interacciones: ['No hay controles: nada que emitir.'],
    salidasEsperadas: [],
    host: ScenarioRecorridoGuiado,
    fuente: SOURCE,
    nivelDePrueba: 'limite',
  },
];
