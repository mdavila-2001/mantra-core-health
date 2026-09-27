import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { FormsClient } from '../../../../core/data-access/forms/forms.client';
import type { FormInstanceListItem } from '../../../../core/data-access/forms/forms.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Cómo quedó la búsqueda de respuestas del encuentro. */
type EstadoDeRespuestas = 'buscando' | 'listo' | 'error';

const FORMATO = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * **La respuesta del formulario médico** a la que pertenece lo que se emite.
 *
 * Receta, orden de análisis, plan de cuidados y reconsulta nacen de lo que se
 * respondió en el formulario médico de la cita. Este selector los ata a esa
 * respuesta, y la atadura es obligatoria: sin respuesta no hay nada que emitir.
 *
 * ## Cargada por defecto
 *
 * La respuesta más reciente del encuentro viene elegida. Con una sola el
 * selector queda **deshabilitado**: no hay nada que decidir, y un control que
 * se puede tocar sin opciones reales invita a dudar. Con varias queda
 * habilitado, con la más reciente arriba y elegida.
 *
 * Sólo cuentan las respuestas **cerradas**: una instancia abierta es un
 * formulario a medio llenar, no una respuesta.
 *
 * Sin respuesta avisa qué falta; quien lo usa bloquea su botón mirando
 * `seleccionada()`, que queda en `null`.
 */
@Component({
  selector: 'app-form-response-picker',
  imports: [Alert, FormField, Select],
  template: `
    @if (encounterId() === null) {
      <app-alert
        tone="info"
        title="Abrí el encuentro primero"
        data-testid="respuesta-sin-encuentro"
      >
        Lo que se emite en la cita cuelga de la respuesta del formulario médico, y esa respuesta es
        de un encuentro.
      </app-alert>
    } @else if (estado() === 'buscando') {
      <p class="respuesta__estado" role="status">Buscando la respuesta del formulario médico…</p>
    } @else if (estado() === 'error') {
      <app-alert
        tone="error"
        title="No pudimos traer la respuesta del formulario"
        data-testid="respuesta-error"
      >
        Sin saber a qué respuesta pertenece no se puede emitir. Cerrá y volvé a abrir para
        reintentar.
      </app-alert>
    } @else if (respuestas().length === 0) {
      <app-alert tone="warning" title="Falta el formulario médico" data-testid="respuesta-falta">
        Completá primero el «Formulario médico» de esta cita. Todo lo que se emite queda asociado a
        esa respuesta.
      </app-alert>
    } @else {
      <app-form-field
        icon="survey"
        label="Respuesta del formulario médico"
        [required]="true"
        [hint]="
          respuestas().length === 1
            ? 'La única respuesta de esta cita; queda asociada sola.'
            : 'Hay más de una respuesta en esta cita: elegí de cuál sale.'
        "
      >
        <app-select
          data-testid="respuesta-del-formulario"
          [options]="opciones()"
          [value]="seleccionada()"
          [disabled]="respuestas().length === 1"
          (valueChange)="seleccionada.set($event)"
        />
      </app-form-field>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .respuesta__estado {
      margin: 0;
      color: var(--text-muted);
      font-size: var(--fs-caption);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormResponsePicker {
  private readonly forms = inject(FormsClient);

  /** El encuentro de la cita. */
  readonly encounterId = input<string | null>(null);

  /** La respuesta elegida, o `null` mientras no haya ninguna. */
  readonly seleccionada = model<string | null>(null);

  protected readonly estado = signal<EstadoDeRespuestas>('buscando');

  /** Las respuestas cerradas del encuentro, la más reciente primero. */
  protected readonly respuestas = signal<readonly FormInstanceListItem[]>([]);

  protected readonly opciones = computed<readonly SelectOption<string | null>[]>(() =>
    this.respuestas().map((respuesta, indice) => ({
      value: respuesta.id,
      label: `Formulario médico · ${FORMATO.format(new Date(respuesta.closedAt ?? respuesta.createdAt))}${indice === 0 ? ' · la más reciente' : ''}`,
    })),
  );

  constructor() {
    effect(() => {
      const encuentro = this.encounterId();
      untracked(() => this.cargar(encuentro));
    });
  }

  private cargar(encuentro: string | null): void {
    this.respuestas.set([]);
    this.seleccionada.set(null);
    if (encuentro === null) {
      this.estado.set('listo');
      return;
    }
    this.estado.set('buscando');
    this.forms.listInstancesByEncounter(encuentro).subscribe({
      next: (listado) => {
        if (this.encounterId() !== encuentro) return;
        const cerradas = listado.items
          .filter((item) => item.closedAt !== undefined)
          .slice()
          .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
        this.respuestas.set(cerradas);
        this.seleccionada.set(cerradas[0]?.id ?? null);
        this.estado.set('listo');
      },
      error: () => {
        if (this.encounterId() !== encuentro) return;
        this.estado.set('error');
      },
    });
  }
}
