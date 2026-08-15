import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
 * ```
 *
 * ## Accesibilidad
 *
 * Es una lista ordenada (`<ol>`): el orden de las fases es información, no
 * estilo. El paso activo lleva `aria-current="step"`, y el estado de cada uno
 * viaja también como texto para el lector de pantalla —«completado», «paso
 * actual»— porque el color y el ✓ solos no alcanzan.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.html',
  styleUrl: './stepper.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stepper {
  /** Los pasos, en orden, cada uno con su estado ya resuelto. */
  readonly steps = input.required<readonly StepperStep[]>();

  /** Nombre accesible del recorrido, p. ej. «Crear agenda». */
  readonly label = input<string>('');

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
}
