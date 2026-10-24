import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  signal,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { PATIENT_TIPS } from '../patient-home.copy';

/**
 * «¿Sabía que…?» — un consejo sobre cómo usar AloVida.
 *
 * Uno por día, y otro cuando se pide: para quien se aburre rápido, descubrir
 * una función por vez es más llevadero que leer un manual. Los puntos de abajo
 * dicen cuántos hay y en cuál está. Los textos y por qué no son médicos, en
 * `patient-home.copy.ts`.
 */
@Component({
  selector: 'app-patient-tip-card',
  imports: [AppButton],
  templateUrl: './patient-tip-card.html',
  styleUrl: './patient-tip-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientTipCard {
  protected readonly consejoIndice = signal(0);
  protected readonly totalConsejos = PATIENT_TIPS.length;
  protected readonly puntosDeConsejo = PATIENT_TIPS.map((_, indice) => indice);
  protected readonly consejo = computed(
    () => PATIENT_TIPS[this.consejoIndice() % PATIENT_TIPS.length],
  );

  constructor() {
    // El de hoy se decide en el navegador: el servidor no sabe qué día es para
    // quien mira, y elegirlo allá cambiaría el texto al hidratar.
    afterNextRender(() => this.consejoIndice.set(dayOfYear(new Date())));
  }

  protected otroConsejo(): void {
    this.consejoIndice.update((indice) => indice + 1);
  }
}

/** El número de día del año: el consejo de hoy es el mismo toda la jornada. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}
