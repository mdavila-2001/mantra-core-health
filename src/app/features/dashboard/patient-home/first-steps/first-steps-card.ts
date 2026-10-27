import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { NavIconName } from '../../../../core/navigation/navigation.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { MIS_TURNOS_ROUTE } from '../../../account/appointments/appointments.routes';
import { MI_HISTORIA_ROUTE } from '../../../account/medical-record/medical-record.routes';
import { PHARMACY_ROUTE } from '../../../account/pharmacy/pharmacy.routes';
import { FirstStepsStore } from './first-steps.store';

/** Una misión de la lista: qué hacer, adónde ir y si ya está hecha. */
export interface FirstStep {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly icon: NavIconName;
  /** Adónde lleva. `null` en la que ya viene hecha y en la que abre el recorrido. */
  readonly route: string | null;
  readonly done: boolean;
}

/**
 * «Primeros pasos» — la lista que acompaña al paciente hasta conocer AloVida.
 *
 * Tres ideas sostienen el diseño, y las tres vienen de cómo se engancha alguien
 * que se aburre rápido:
 *
 * - **Empieza con un paso hecho** («Crear su cuenta»). Quien ve la barra ya
 *   avanzada termina más que quien la ve en cero.
 * - **Una sola cosa resaltada**: la siguiente. Siete botones iguales son una
 *   decisión; uno resaltado es una invitación.
 * - **Un final que se festeja**: al completar todo aparece la medalla. Lo que se
 *   recuerda de una experiencia es su mejor momento y su final.
 *
 * Las misiones son puertas a pantallas que ya existen: la tarjeta no agrega
 * funciones, enseña dónde están.
 */
@Component({
  selector: 'app-first-steps-card',
  imports: [AppButton, AppButtonLink, NavIcon, RouterLink],
  templateUrl: './first-steps-card.html',
  styleUrl: './first-steps-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstStepsCard {
  private readonly store = inject(FirstStepsStore);

  /** Si ya tiene o tuvo una cita: lo resuelve el inicio con la API, no la memoria local. */
  readonly hasAppointment = input(false);
  /** Si completó el recorrido guiado. */
  readonly tourDone = input(false);

  /** Pide abrir el recorrido guiado; lo arranca el inicio, que conoce el motor. */
  readonly startTour = output<void>();

  protected readonly steps = computed<readonly FirstStep[]>(() => {
    // Leer la señal para que la lista se recalcule al volver de cada pantalla.
    this.store.visited();
    return [
      {
        id: 'cuenta',
        title: 'Crear su cuenta',
        hint: '¡Hecho! Ya es parte de AloVida.',
        icon: 'key',
        route: null,
        done: true,
      },
      {
        id: 'recorrido',
        title: 'Hacer el recorrido de un minuto',
        hint: 'Le mostramos dónde está cada cosa.',
        icon: 'teach',
        route: null,
        done: this.tourDone(),
      },
      {
        id: 'medicos',
        title: 'Conocer a los médicos',
        hint: 'Busque por especialidad y vea dónde atiende cada uno.',
        icon: 'stethoscope',
        route: '/directory',
        done: this.store.hasVisited('/directory'),
      },
      {
        id: 'cita',
        title: 'Pedir una cita',
        hint: 'Elija día y hora sin hacer filas ni llamar.',
        icon: 'calendar',
        route: MIS_TURNOS_ROUTE,
        done: this.hasAppointment() || this.store.hasVisited(`${MIS_TURNOS_ROUTE}/book`),
      },
      {
        id: 'historia',
        title: 'Mirar su historia clínica',
        hint: 'Sus consultas, recetas y estudios, todo junto.',
        icon: 'heart',
        route: MI_HISTORIA_ROUTE,
        done: this.store.hasVisited(MI_HISTORIA_ROUTE),
      },
      {
        id: 'farmacia',
        title: 'Pasear por la farmacia',
        hint: 'Compare precios y vea qué farmacia le queda cerca.',
        icon: 'pill',
        route: PHARMACY_ROUTE,
        done: this.store.hasVisited(PHARMACY_ROUTE),
      },
    ];
  });

  protected readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  protected readonly total = computed(() => this.steps().length);
  protected readonly percent = computed(() =>
    Math.round((this.doneCount() / this.total()) * 100),
  );
  protected readonly complete = computed(() => this.doneCount() === this.total());

  /** La que se resalta: la primera que falta. */
  protected readonly nextId = computed(
    () => this.steps().find((step) => !step.done)?.id ?? null,
  );

  /** Una frase de ánimo que cambia con el avance. */
  protected readonly cheer = computed(() => {
    const left = this.total() - this.doneCount();
    if (left === 0) return '¡Lo logró! Ya conoce todo lo importante.';
    if (left === 1) return '¡Le falta uno solo!';
    if (this.doneCount() <= 1) return 'Buen comienzo. Vamos con el siguiente.';
    return `¡Va muy bien! Le faltan ${left}.`;
  });

  /** Oculta la tarjeta: sólo se ofrece cuando ya está todo hecho. */
  readonly dismissed = this.store.dismissed;

  /** Si la lista está plegada (pedido del cliente, 27/10/2026). */
  protected readonly collapsed = this.store.collapsed;

  protected toggleCollapsed(): void {
    this.store.toggleCollapsed();
  }

  protected dismiss(): void {
    this.store.dismiss();
  }
}
