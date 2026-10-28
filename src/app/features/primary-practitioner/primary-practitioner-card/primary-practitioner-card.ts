import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  PrimaryPractitionerClient,
  type OwnPrimaryPractitioner,
} from '../../../core/data-access/profiles/primary-practitioner.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../shared/components/molecules/card/card';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { COPY, displayNameOf, isNotPatient } from '../primary-practitioner.copy';

/**
 * **«Su médico de cabecera»** en el inicio del paciente.
 *
 * Muestra quién es y lleva a su ficha; si no eligió a nadie, dice qué es un
 * médico de cabecera y lleva a la guía, que es donde está el botón para
 * elegirlo. El vacío siempre ofrece la próxima acción. Cargando, sin conexión
 * y error con ID de petición son los de `app-view-state-host` (M34).
 */
@Component({
  selector: 'app-primary-practitioner-card',
  imports: [AppButtonLink, Card, DatePipe, NavIcon, RouterLink, ViewStateHost],
  templateUrl: './primary-practitioner-card.html',
  styleUrl: './primary-practitioner-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryPractitionerCard {
  private readonly client = inject(PrimaryPractitionerClient);

  protected readonly copy = COPY;
  protected readonly estado = signal<ViewState<OwnPrimaryPractitioner>>(loading());
  /** La cuenta no es de paciente: la tarjeta no se dibuja. */
  protected readonly oculto = signal(false);
  protected readonly doctor = computed(() => dataOf(this.estado())?.current ?? null);
  protected readonly displayNameOf = displayNameOf;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.client.getOwn().subscribe({
      next: (eleccion) => this.estado.set(ready(eleccion)),
      error: (error: unknown) => {
        if (isNotPatient(error)) {
          this.oculto.set(true);
          return;
        }
        this.estado.set(errorToViewState<OwnPrimaryPractitioner>(error));
      },
    });
  }
}
