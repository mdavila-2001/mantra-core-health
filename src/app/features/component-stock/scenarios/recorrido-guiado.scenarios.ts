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
