import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { Observable } from 'rxjs';

import {
  PrimaryPractitionerClient,
  type OwnPrimaryPractitioner,
} from '../../../core/data-access/profiles/primary-practitioner.client';
import { describeApiFailure } from '../../../core/http/api-failure';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { COPY, httpStatusOf, displayNameOf, isNotPatient } from '../primary-practitioner.copy';

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
 * La lectura pasa por `ViewState` y `app-view-state-host` (M34): sin conexión,
 * error con ID de petición y reintento son los del sistema. Lo que se muestra
 * después de pulsar es lo que **devolvió la API** (la elección releída); si la
 * API rechaza porque la elección cambió (409) o el profesional ya no existe
 * (404), se relee para no dejar en pantalla un estado que la base ya no tiene.
 *
 * La autoridad es la API: si el profesional no acepta pacientes nuevos el
 * botón se apaga, pero la regla la hace cumplir el servidor con un 422.
 */
@Component({
  selector: 'app-primary-practitioner-choice',
  imports: [Alert, AppButton, Card, DatePipe, NavIcon, ViewStateHost],
  templateUrl: './primary-practitioner-choice.html',
  styleUrl: './primary-practitioner-choice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryPractitionerChoice {
  private readonly client = inject(PrimaryPractitionerClient);
  private readonly injector = inject(Injector);

  /** El profesional de la ficha. */
  readonly practitionerProfileId = input.required<string>();
  /** `false` sólo si el profesional declaró que no recibe pacientes nuevos. */
  readonly acceptsNewPatients = input<boolean | undefined>(undefined);

  protected readonly copy = COPY;
  protected readonly estado = signal<ViewState<OwnPrimaryPractitioner>>(loading());
  /** La cuenta no es de paciente: el bloque no se dibuja. */
  protected readonly oculto = signal(false);
  protected readonly guardando = signal(false);
  protected readonly fallo = signal<string | null>(null);
  /** El aviso que queda tras guardar, para el lector de pantalla. */
  protected readonly aviso = signal<string | null>(null);

  /** El botón de la acción, para devolverle el foco tras pulsarlo. */
  private readonly accion = viewChild('accion', { read: ElementRef });

  protected readonly actual = computed(() => dataOf(this.estado())?.current ?? null);
  protected readonly esEste = computed(
    () => this.actual()?.practitionerProfileId === this.practitionerProfileId(),
  );
  protected readonly nombreActual = computed(() => {
    const actual = this.actual();
    return actual === null ? '' : displayNameOf(actual);
  });
  protected readonly cerrado = computed(() => this.acceptsNewPatients() === false && !this.esEste());

  constructor() {
    // La elección no depende del profesional de la ficha: es la del paciente.
    // Al navegar a otra ficha el padre vuelve a crear este bloque.
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.fallo.set(null);
    this.aviso.set(null);
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

  protected elegir(): void {
    this.guardar(this.client.setOwn(this.practitionerProfileId()), (eleccion) =>
      eleccion.current === null ? null : `Listo: ${displayNameOf(eleccion.current)} es ahora su médico de cabecera.`,
    );
  }

  protected quitar(): void {
    this.guardar(this.client.removeOwn(), () => 'Listo: ya no tiene médico de cabecera.');
  }

  private guardar(
    peticion: Observable<OwnPrimaryPractitioner>,
    avisoDe: (eleccion: OwnPrimaryPractitioner) => string | null,
  ): void {
    this.guardando.set(true);
    this.fallo.set(null);
    this.aviso.set(null);
    peticion.subscribe({
      next: (eleccion) => {
        this.estado.set(ready(eleccion));
        this.aviso.set(avisoDe(eleccion));
        this.guardando.set(false);
        this.devolverFoco();
      },
      error: (error: unknown) => {
        const status = httpStatusOf(error);
        this.fallo.set(status === 404 ? COPY.noDisponible : describeApiFailure(error, COPY.errorAlGuardar));
        this.guardando.set(false);
        // 409: la elección cambió en otro lado. 404: el profesional ya no está.
        // En los dos casos lo que hay en pantalla puede ser viejo.
        if (status === 404 || status === 409) this.releer();
      },
    });
  }

  /** Relee la elección sin pasar por «cargando», para no borrar el aviso. */
  private releer(): void {
    this.client.getOwn().subscribe({
      next: (eleccion) => this.estado.set(ready(eleccion)),
      error: () => undefined,
    });
  }

  /**
   * El botón pulsado sale del DOM cuando cambia la situación (elegir y quitar
   * son botones distintos): sin esto el foco caería al principio de la página.
   */
  private devolverFoco(): void {
    afterNextRender(() => (this.accion()?.nativeElement as HTMLElement | undefined)?.focus(), {
      injector: this.injector,
    });
  }
}
