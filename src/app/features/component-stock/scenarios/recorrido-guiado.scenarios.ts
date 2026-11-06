import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import {
  RecorridoGuiado,
  type PasoActualDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado';
import { armarRecorridoGuiado } from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado.model';

import { outputsRecord } from './exit-log';
import { AHORA, EPISODIO_SINUSITIS, HISTORIA_DE_DEMOSTRACION, LECTOR, NODOS } from './recorrido-guiado.historia-demo';
import type { ComponentScenario, ScenarioHost } from './scenario.types';

/* ============================================================================
    Scenarios of the guided tour (Strip 4 of the clinical network).

    Since 06/11/2026 the control is mounted on the chart's Tour
    (`patient-chart/red-clinica/superficie/`), over the patient's real reads;
    this bench's «simulador» variant, which read the same, was retired as
    redundant. The states documenting the isolated control remain (story,
    episode, empty): the steps come from the **real model**
    (`armarRecorridoGuiado`) over a demonstration story
    (`recorrido-guiado.historia-demo.ts`) typed with the same
    `core/data-access/` types, and next to it a list of the records acts as a
    fake network —revealed, focused or hidden— to see what `pasoActual` emits.
    Touching a record of that list counts as an interaction with the network
    and pauses playback.

    It is retired by deleting these files and its line in `scenarios.ts`.
    ========================================================================== */

const KEY = 'features/clinical-record/patient-chart/recorrido-guiado/recorrido-guiado';
const SOURCE = 'src/app/features/component-stock/scenarios/recorrido-guiado.scenarios.ts';

export const RECORRIDO_GUIADO_VARIANTS = ['historia', 'episodio', 'vacio'] as const;
export type RecorridoGuiadoVariant = (typeof RECORRIDO_GUIADO_VARIANTS)[number];

@Component({
  selector: 'app-scenario-recorrido-guiado',
  imports: [RecorridoGuiado],
  templateUrl: './recorrido-guiado.scenarios.html',
  styleUrl: './recorrido-guiado.scenarios.css',
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
