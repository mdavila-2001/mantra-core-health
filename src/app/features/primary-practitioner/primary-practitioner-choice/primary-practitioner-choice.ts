import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import {
  PrimaryPractitionerClient,
  type OwnPrimaryPractitioner,
} from '../../../core/data-access/profiles/primary-practitioner.client';
import { describeApiFailure } from '../../../core/http/api-failure';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { COPY, nombreDe, noEsPaciente } from '../primary-practitioner.copy';

/** En qué está el bloque. `oculto`: la cuenta no es de paciente. */
type Fase = 'cargando' | 'listo' | 'oculto' | 'error';

/**
 * **El botón del médico de cabecera** en la ficha de un profesional.
 *
 * Un solo botón, y lo que dice depende de la situación, para que el paciente
 * no tenga que pensar:
 *
 * - no eligió a nadie → «Elegir como mi médico de cabecera»;
 * - eligió a otro → dice quién es el actual y ofrece cambiarlo por éste;
 * - es éste → lo confirma con la fecha y ofrece dejar de tenerlo.
 *
 * Lo que se muestra después de pulsar es lo que **devolvió la API** (la
 * elección releída), nunca lo que la pantalla creía haber mandado.
 *
 * La autoridad es la API: si el profesional no acepta pacientes nuevos el
 * botón se apaga, pero la regla la hace cumplir el servidor con un 422.
 */
@Component({
  selector: 'app-primary-practitioner-choice',
  imports: [Alert, AppButton, Card, DatePipe, NavIcon],
  templateUrl: './primary-practitioner-choice.html',
  styleUrl: './primary-practitioner-choice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryPractitionerChoice {
  private readonly client = inject(PrimaryPractitionerClient);

  /** El profesional de la ficha. */
  readonly practitionerProfileId = input.required<string>();
  /** `false` sólo si el profesional declaró que no recibe pacientes nuevos. */
  readonly acceptsNewPatients = input<boolean | undefined>(undefined);

  protected readonly copy = COPY;
  protected readonly fase = signal<Fase>('cargando');
  protected readonly eleccion = signal<OwnPrimaryPractitioner>({ current: null });
  protected readonly guardando = signal(false);
  protected readonly fallo = signal<string | null>(null);
  /** El aviso que queda tras guardar, para el lector de pantalla. */
  protected readonly aviso = signal<string | null>(null);

  protected readonly actual = computed(() => this.eleccion().current);
  protected readonly esEste = computed(
    () => this.actual()?.practitionerProfileId === this.practitionerProfileId(),
  );
  protected readonly nombreActual = computed(() => {
    const actual = this.actual();
    return actual === null ? '' : nombreDe(actual);
  });
  protected readonly cerrado = computed(() => this.acceptsNewPatients() === false && !this.esEste());

  constructor() {
    // Al navegar de una ficha a otra el componente se reutiliza: se relee la
    // elección para no mostrar el estado de la ficha anterior.
    effect(() => {
      this.practitionerProfileId();
      untracked(() => this.cargar());
    });
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.fallo.set(null);
    this.aviso.set(null);
    this.client.getOwn().subscribe({
      next: (eleccion) => {
        this.eleccion.set(eleccion);
        this.fase.set('listo');
      },
      error: (error: unknown) => this.fase.set(noEsPaciente(error) ? 'oculto' : 'error'),
    });
  }

  protected elegir(): void {
    this.guardar(this.client.setOwn(this.practitionerProfileId()), (eleccion) =>
      eleccion.current === null ? null : `Listo: ${nombreDe(eleccion.current)} es ahora su médico de cabecera.`,
    );
  }

  protected quitar(): void {
    this.guardar(this.client.removeOwn(), () => 'Listo: ya no tiene médico de cabecera.');
  }

  private guardar(
    peticion: ReturnType<PrimaryPractitionerClient['getOwn']>,
    avisoDe: (eleccion: OwnPrimaryPractitioner) => string | null,
  ): void {
    this.guardando.set(true);
    this.fallo.set(null);
    this.aviso.set(null);
    peticion.subscribe({
      next: (eleccion) => {
        this.eleccion.set(eleccion);
        this.aviso.set(avisoDe(eleccion));
        this.guardando.set(false);
      },
      error: (error: unknown) => {
        this.fallo.set(describeApiFailure(error, COPY.errorAlGuardar));
        this.guardando.set(false);
      },
    });
  }
}
