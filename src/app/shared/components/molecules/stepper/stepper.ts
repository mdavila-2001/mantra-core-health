import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { Tooltip } from '../../atoms/tooltip/tooltip';
import type { StepperStep } from './stepper.types';

/**
 * **Stepper** — indicador de avance de un flujo por fases.
 *
 * Muestra el paso actual, los ya completados y los que faltan. Es
 * **controlado**: recibe cada paso con su estado ya resuelto (`complete`,
 * `current`, `upcoming`) y sólo lo pinta. No decide cuándo un paso está hecho
 * —eso lo sabe la pantalla, que es la que persiste cada fase contra su API—;
 * un indicador que adivinara el progreso se desincronizaría del dato real.
 *
 * ```html
 * <app-stepper [steps]="pasos()" label="Crear agenda" />
 * <app-stepper [steps]="pasos()" interactive (stepSelected)="irA($event)" />
 * ```
 *
 * ## `interactive`: por qué entra apagado
 *
 * Con `interactive` cada paso deja de ser un rótulo y pasa a ser un `<button>`
 * de verdad, con su foco y su tecla. Es lo que pidió el propietario para el
 * alta (TAREA 04, AC-04-12), pero este componente **no** lo usa sólo el alta:
 * lo montan también el detalle de un pedido de farmacia, la puesta en marcha
 * del administrador y el onboarding del profesional, y ninguno de esos tres
 * tiene a dónde navegar —su avance lo manda el estado del pedido, no la
 * persona—. Encenderlo por defecto les habría agregado tres o cuatro paradas
 * de tabulación que no hacen nada, que es la peor clase de control: el que se
 * puede enfocar y no responde.
 *
 * Y **navegar no es cosa del stepper**: emite `stepSelected` con el índice
 * pedido y se queda quieto. Quien lo monta decide si se puede ir —y si hay
 * validación de por medio, la corre él—.
 *
 * ## Accesibilidad
 *
 * Es una lista ordenada (`<ol>`): el orden de las fases es información, no
 * estilo. El paso activo lleva `aria-current="step"`, y el estado de cada uno
 * viaja también como texto para el lector de pantalla —«completado», «paso
 * actual»— porque el color y el ✓ solos no alcanzan.
 *
 * En modo interactivo el paso que no se puede abrir queda con `aria-disabled`
 * y no con el atributo nativo: sigue siendo alcanzable con el teclado y dice
 * por qué no se puede ir (`disabledReason`), en vez de ser una puerta cerrada
 * sin cartel.
 *
 * ## `compact`: por qué también entra apagado
 *
 * Un recorrido de diez fases —el alta de paciente— no entra con rótulos en un
 * teléfono: los diez nombres se apilan y el indicador ocupa media pantalla,
 * que es justo lo que un indicador no puede hacer. En compacto queda el
 * marcador y el rótulo sale **de la vista**, no del recorrido: sigue en el
 * nombre accesible del paso y vuelve como globo al apuntar o al enfocar.
 *
 * Apagado por defecto porque un recorrido de tres o cuatro fases sí muestra
 * sus rótulos, y esconderlos ahí sería cambiar por dibujo lo que hoy son
 * palabras. Lo enciende quien tiene los pasos de más.
 */
@Component({
  selector: 'app-stepper',
  imports: [NavIcon, NgTemplateOutlet, Tooltip],
  templateUrl: './stepper.html',
  styleUrl: './stepper.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stepper {
  /** Los pasos, en orden, cada uno con su estado ya resuelto. */
  readonly steps = input.required<readonly StepperStep[]>();

  /** Nombre accesible del recorrido, p. ej. «Crear agenda». */
  readonly label = input<string>('');

  /**
   * Convierte cada paso en un `<button>`. Apagado por defecto: ver la nota de
   * la clase.
   */
  readonly interactive = input(false, { transform: booleanAttribute });

  /**
   * Deja el recorrido en sus marcadores: los rótulos salen de la vista.
   *
   * Apagado por defecto: ver la nota de la clase. El rótulo no se pierde —vive
   * en el `aria-label` del paso y vuelve como globo al apuntar o al enfocar—,
   * así que lo que cambia es cuánto ocupa el recorrido, no qué dice.
   */
  readonly compact = input(false, { transform: booleanAttribute });

  /**
   * El índice del paso que se pidió abrir. **Base 0**, como el arreglo.
   *
   * No se emite por un paso con `disabled`: el control sigue enfocable para
   * poder anunciar por qué no se puede ir, pero pulsarlo no propone nada.
   */
  readonly stepSelected = output<number>();

  /** Posición del paso actual, para el resumen «Paso 2 de 5». Base 1. */
  protected readonly currentPosition = computed(() => {
    const index = this.steps().findIndex((step) => step.status === 'current');
    return index === -1 ? 0 : index + 1;
  });

  /** Cuántas fases hay, para el mismo resumen. */
  protected readonly total = computed(() => this.steps().length);

  /**
   * El resumen que anuncia el lector de pantalla: «Crear agenda: paso 2 de 5».
   * Sin paso actual (todo completado) dice sólo el nombre.
   */
  protected readonly summary = computed(() => {
    const nombre = this.label().trim();
    const posicion = this.currentPosition();
    if (posicion === 0) {
      return nombre;
    }
    const progreso = `paso ${posicion} de ${this.total()}`;
    return nombre === '' ? progreso : `${nombre}: ${progreso}`;
  });

  /** El texto de estado por paso, para el lector de pantalla. */
  protected estadoTexto(step: StepperStep): string {
    switch (step.status) {
      case 'complete':
        return 'completado';
      case 'current':
        return 'paso actual';
      default:
        return 'pendiente';
    }
  }

  /**
   * El nombre accesible del botón de un paso.
   *
   * Lleva el ordinal adelante porque el botón se anuncia solo, fuera de la
   * lista: «Identidad» a secas no dice a dónde lleva ni cuál de los cinco es.
   * Sigue el rótulo visible —requisito 2.5.3 de WCAG: el nombre contiene lo que
   * se ve—, después el estado, y al final el motivo cuando el paso está
   * cerrado.
   */
  protected nombreDelPaso(step: StepperStep, index: number): string {
    const base = `Paso ${index + 1} de ${this.total()}: ${step.label}, ${this.estadoTexto(step)}`;
    const motivo = step.disabled === true ? (step.disabledReason ?? '').trim() : '';
    return motivo === '' ? base : `${base}. ${motivo}`;
  }

  /** Se propone el salto; ir o no ir lo decide quien monta el stepper. */
  protected pedirPaso(step: StepperStep, index: number): void {
    if (step.disabled === true) {
      return;
    }
    this.stepSelected.emit(index);
  }
}
