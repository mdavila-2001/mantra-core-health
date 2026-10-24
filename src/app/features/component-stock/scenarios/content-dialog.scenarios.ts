import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal,
} from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import {
  ContentDialog,
  type ContentDialogSize,
} from '../../../shared/components/organisms/content-dialog/content-dialog';

import type { ScenarioHost, ComponentScenario } from './scenario.types';
import { outputsRecord } from './exit-log';

/* ============================================================================
    Escenarios de `ContentDialog`.

    Un contenedor vacío no acredita un modal: lo que hay que ver es contenido
    proyectado, el pie con sus acciones fuera del área con scroll, y los tres
    gestos de cierre —el botón, `Escape` y el fondo— pasando por el mismo
    camino. Y la parte que más se rompe: con cambios pendientes, esos gestos
    tienen que preguntar en vez de perder lo escrito.
    ========================================================================== */

const KEY = 'shared/components/organisms/content-dialog/content-dialog';
const SOURCE = 'src/app/features/component-stock/scenarios/content-dialog.scenarios.ts';

export const CONTENT_DIALOG_VARIANTS = ['descartable', 'con-cambios', 'sm', 'xl'] as const;
export type ContentDialogVariant = (typeof CONTENT_DIALOG_VARIANTS)[number];

/**
 * Anfitrión de `ContentDialog` para el banco.
 *
 * Se abre al montarse —es lo que se vino a ver— y deja un botón para volver a
 * abrirlo después de cerrarlo. En `con-cambios` el formulario arranca con
 * texto escrito, así que `Escape` y el fondo emiten `dismissAttempt` y el
 * anfitrión pregunta; recién «Descartar» cierra.
 */
@Component({
  selector: 'app-scenario-content-dialog',
  imports: [AppButton, ContentDialog, FormField, Input],
  template: `
    <button app-button type="button" variant="primary" (clicked)="abrir()">Abrir el modal</button>
    <p class="escenario__nota">Último cierre: {{ lastClosing() }}</p>

    @if (open()) {
      <app-content-dialog
        heading="Registrar una nota"
        description="Escenario del banco: contenido proyectado y acciones en el pie."
        [size]="size()"
        [dismissible]="!hasChanges()"
        (opened)="record.anotar('opened')"
        (dismissAttempt)="requestDiscard()"
        (closed)="closed()"
      >
        <form class="escenario__cuerpo" (submit)="$event.preventDefault(); save()">
          <app-form-field label="Título" [required]="true">
            <app-input [(value)]="title" placeholder="Control de presión" />
          </app-form-field>
          <app-form-field label="Nota" hint="Lo que se escriba acá no se guarda en ningún lado.">
            <app-input [(value)]="note" placeholder="Escriba algo…" />
          </app-form-field>

          @if (discardAsking()) {
            <p class="escenario__descarte" role="alert" data-testid="escenario-descarte">
              Hay cambios sin guardar. ¿Descartarlos?
              <button app-button type="button" size="sm" variant="danger" (clicked)="discard()">
                Descartar
              </button>
              <button
                app-button
                type="button"
                size="sm"
                variant="ghost"
                (clicked)="discardAsking.set(false)"
              >
                Seguir editando
              </button>
            </p>
          }
        </form>

        <button dialog-actions app-button type="button" variant="primary" (clicked)="save()">
          Guardar
        </button>
      </app-content-dialog>
    }
  `,
  styles: `
    .escenario__cuerpo {
      display: grid;
      gap: var(--sp-4);
    }
    .escenario__nota {
      margin: var(--sp-2) 0 0;
      color: var(--text-muted);
      font-size: var(--fs-caption);
    }
    .escenario__descarte {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-2);
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioContentDialog implements ScenarioHost {
  readonly variante = input<ContentDialogVariant>('descartable');

  protected readonly record = outputsRecord();
  readonly outputs = this.record.salidas;

  protected readonly open = signal(true);
  protected readonly discardAsking = signal(false);
  protected readonly lastClosing = signal('todavía ninguno');

  /**
   * El borrador. En `con-cambios` arranca escrito para que haya qué proteger;
   * `linkedSignal` lo vuelve a sembrar si el banco cambia la variante.
   */
  protected readonly title = linkedSignal(() =>
    this.variante() === 'con-cambios' ? 'Control de presión' : '',
  );
  protected readonly note = linkedSignal(() =>
    this.variante() === 'con-cambios' ? '140/90, repetir en una semana.' : '',
  );

  protected readonly size = computed<ContentDialogSize>(() => {
    switch (this.variante()) {
      case 'sm':
        return 'sm';
      case 'xl':
        return 'xl';
      case 'con-cambios':
        return 'lg';
      default:
        return 'md';
    }
  });

  /** Lo que decide si cerrar pregunta: hay algo escrito. */
  protected readonly hasChanges = computed(() => this.title() !== '' || this.note() !== '');

  protected abrir(): void {
    this.discardAsking.set(false);
    this.open.set(true);
  }

  protected requestDiscard(): void {
    this.record.anotar('dismissAttempt');
    this.discardAsking.set(true);
  }

  protected discard(): void {
    this.title.set('');
    this.note.set('');
    this.discardAsking.set(false);
    // Sin cambios, el siguiente cierre va derecho: se cierra desde acá.
    this.open.set(false);
    this.record.anotar('closed', 'tras descartar');
    this.lastClosing.set('descartando los cambios');
  }

  /** Es una intención, no un resultado: acá no hay nada que persista. */
  protected save(): void {
    this.record.anotar('guardarSolicitado', this.title() || '(sin título)');
    this.lastClosing.set('pidiendo guardar');
    this.title.set('');
    this.note.set('');
    this.open.set(false);
  }

  protected closed(): void {
    this.record.anotar('closed');
    this.lastClosing.set('por el botón, Escape o el fondo');
    this.open.set(false);
  }
}

export const CONTENT_DIALOG_SCENARIOS: readonly ComponentScenario[] = [
  {
    id: `${KEY}#descartable`,
    clave: KEY,
    variante: 'descartable',
    titulo: 'Modal con contenido, ancho md',
    seVe: 'Abierto al montar: título, bajada, dos campos proyectados y «Guardar» en el pie. El foco cae en «Cerrar».',
    interacciones: [
      'Se abre → opened.',
      '«Cerrar», Escape o clic en el fondo → closed. Si se abrió con «Abrir el modal», el foco vuelve a ese botón; la primera apertura es automática al montar y no hay a dónde volver.',
      '«Guardar» → guardarSolicitado (es una intención: nada se persiste).',
    ],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: ScenarioContentDialog,
    fuente: SOURCE,
  },
  {
    id: `${KEY}#con-cambios`,
    clave: KEY,
    variante: 'con-cambios',
    titulo: 'Edición con cambios pendientes, ancho lg',
    seVe: 'Abierto con el borrador ya escrito. Escape y el fondo NO cierran: preguntan. Quien pregunta es este anfitrión, no el organismo: con `dismissible` en false `ContentDialog` sólo emite `dismissAttempt` (content-dialog.ts:108-123) y el descarte lo decide el consumidor.',
    interacciones: [
      'Escape o clic en el fondo → dismissAttempt, y aparece «¿Descartarlos?».',
      '«Descartar» → closed tras descartar. «Seguir editando» deja el modal donde está.',
      'Borrar los dos campos y cerrar → closed de una, porque ya no hay qué descartar.',
    ],
    salidasEsperadas: ['opened', 'dismissAttempt', 'closed', 'guardarSolicitado'],
    host: ScenarioContentDialog,
    fuente: SOURCE,
  },
  {
    id: `${KEY}#sm`,
    clave: KEY,
    variante: 'sm',
    titulo: 'Ancho sm (confirmación breve)',
    seVe: 'El mismo contenido en el panel más angosto. En móvil (390) los cuatro anchos colapsan al mismo modal.',
    interacciones: ['Igual que «descartable».'],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: ScenarioContentDialog,
    fuente: SOURCE,
  },
  {
    id: `${KEY}#xl`,
    clave: KEY,
    variante: 'xl',
    titulo: 'Ancho xl (listado con navegación interna)',
    seVe: 'El mismo contenido en el panel más ancho.',
    interacciones: ['Igual que «descartable».'],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: ScenarioContentDialog,
    fuente: SOURCE,
  },
];
