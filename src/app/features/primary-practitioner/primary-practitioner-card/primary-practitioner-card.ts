import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  PrimaryPractitionerClient,
  type PrimaryPractitioner,
} from '../../../core/data-access/profiles/primary-practitioner.client';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { COPY, nombreDe, noEsPaciente } from '../primary-practitioner.copy';

type Fase = 'cargando' | 'listo' | 'oculto' | 'error';

/**
 * **«Su médico de cabecera»** en el inicio del paciente.
 *
 * Muestra quién es y lleva a su ficha; si no eligió a nadie, dice qué es un
 * médico de cabecera y lleva a la guía, que es donde está el botón para
 * elegirlo. El vacío siempre ofrece la próxima acción.
 */
@Component({
  selector: 'app-primary-practitioner-card',
  imports: [AppButton, AppButtonLink, Card, DatePipe, NavIcon, RouterLink],
  templateUrl: './primary-practitioner-card.html',
  styleUrl: './primary-practitioner-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryPractitionerCard {
  private readonly client = inject(PrimaryPractitionerClient);

  protected readonly copy = COPY;
  protected readonly fase = signal<Fase>('cargando');
  protected readonly medico = signal<PrimaryPractitioner | null>(null);
  protected readonly nombreDe = nombreDe;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.client.getOwn().subscribe({
      next: (eleccion) => {
        this.medico.set(eleccion.current);
        this.fase.set('listo');
      },
      error: (error: unknown) => this.fase.set(noEsPaciente(error) ? 'oculto' : 'error'),
    });
  }
}
