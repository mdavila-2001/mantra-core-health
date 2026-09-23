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

import type { AnfitrionDeEscenario, EscenarioDeComponente } from './escenario.types';
import { registroDeSalidas } from './registro-de-salidas';

/* ============================================================================
    Escenarios de `ContentDialog`.

    Un contenedor vacío no acredita un modal: lo que hay que ver es contenido
    proyectado, el pie con sus acciones fuera del área con scroll, y los tres
    gestos de cierre —el botón, `Escape` y el fondo— pasando por el mismo
    camino. Y la parte que más se rompe: con cambios pendientes, esos gestos
    tienen que preguntar en vez de perder lo escrito.
    ========================================================================== */

const CLAVE = 'shared/components/organisms/content-dialog/content-dialog';
const FUENTE = 'src/app/features/component-stock/escenarios/content-dialog.escenarios.ts';

export const VARIANTES_DE_CONTENT_DIALOG = ['descartable', 'con-cambios', 'sm', 'xl'] as const;
export type VarianteDeContentDialog = (typeof VARIANTES_DE_CONTENT_DIALOG)[number];

/**
 * Anfitrión de `ContentDialog` para el banco.
 *
 * Se abre al montarse —es lo que se vino a ver— y deja un botón para volver a
 * abrirlo después de cerrarlo. En `con-cambios` el formulario arranca con
 * texto escrito, así que `Escape` y el fondo emiten `dismissAttempt` y el
 * anfitrión pregunta; recién «Descartar» cierra.
 */
@Component({
  selector: 'app-escenario-content-dialog',
  imports: [AppButton, ContentDialog, FormField, Input],
  template: `
    <button app-button type="button" variant="primary" (clicked)="abrir()">Abrir el modal</button>
    <p class="escenario__nota">Último cierre: {{ ultimoCierre() }}</p>

    @if (abierto()) {
      <app-content-dialog
        heading="Registrar una nota"
        description="Escenario del banco: contenido proyectado y acciones en el pie."
        [size]="size()"
        [dismissible]="!hayCambios()"
        (opened)="registro.anotar('opened')"
        (dismissAttempt)="pedirDescarte()"
        (closed)="cerrada()"
      >
        <form class="escenario__cuerpo" (submit)="$event.preventDefault(); guardar()">
          <app-form-field label="Título" [required]="true">
            <app-input [(value)]="titulo" placeholder="Control de presión" />
          </app-form-field>
          <app-form-field label="Nota" hint="Lo que se escriba acá no se guarda en ningún lado.">
            <app-input [(value)]="nota" placeholder="Escribí algo…" />
          </app-form-field>

          @if (preguntandoDescarte()) {
            <p class="escenario__descarte" role="alert" data-testid="escenario-descarte">
              Hay cambios sin guardar. ¿Descartarlos?
              <button app-button type="button" size="sm" variant="danger" (clicked)="descartar()">
                Descartar
              </button>
              <button
                app-button
                type="button"
                size="sm"
                variant="ghost"
                (clicked)="preguntandoDescarte.set(false)"
              >
                Seguir editando
              </button>
            </p>
          }
        </form>

        <button dialog-actions app-button type="button" variant="primary" (clicked)="guardar()">
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
export class EscenarioContentDialog implements AnfitrionDeEscenario {
  readonly variante = input<VarianteDeContentDialog>('descartable');

  protected readonly registro = registroDeSalidas();
  readonly salidas = this.registro.salidas;

  protected readonly abierto = signal(true);
  protected readonly preguntandoDescarte = signal(false);
  protected readonly ultimoCierre = signal('todavía ninguno');

  /**
   * El borrador. En `con-cambios` arranca escrito para que haya qué proteger;
   * `linkedSignal` lo vuelve a sembrar si el banco cambia la variante.
   */
  protected readonly titulo = linkedSignal(() =>
    this.variante() === 'con-cambios' ? 'Control de presión' : '',
  );
  protected readonly nota = linkedSignal(() =>
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
  protected readonly hayCambios = computed(() => this.titulo() !== '' || this.nota() !== '');

  protected abrir(): void {
    this.preguntandoDescarte.set(false);
    this.abierto.set(true);
  }

  protected pedirDescarte(): void {
    this.registro.anotar('dismissAttempt');
    this.preguntandoDescarte.set(true);
  }

  protected descartar(): void {
    this.titulo.set('');
    this.nota.set('');
    this.preguntandoDescarte.set(false);
    // Sin cambios, el siguiente cierre va derecho: se cierra desde acá.
    this.abierto.set(false);
    this.registro.anotar('closed', 'tras descartar');
    this.ultimoCierre.set('descartando los cambios');
  }

  /** Es una intención, no un resultado: acá no hay nada que persista. */
  protected guardar(): void {
    this.registro.anotar('guardarSolicitado', this.titulo() || '(sin título)');
    this.ultimoCierre.set('pidiendo guardar');
    this.titulo.set('');
    this.nota.set('');
    this.abierto.set(false);
  }

  protected cerrada(): void {
    this.registro.anotar('closed');
    this.ultimoCierre.set('por el botón, Escape o el fondo');
    this.abierto.set(false);
  }
}

export const ESCENARIOS_DE_CONTENT_DIALOG: readonly EscenarioDeComponente[] = [
  {
    id: `${CLAVE}#descartable`,
    clave: CLAVE,
    variante: 'descartable',
    titulo: 'Modal con contenido, ancho md',
    seVe: 'Abierto al montar: título, bajada, dos campos proyectados y «Guardar» en el pie. El foco cae en «Cerrar».',
    interacciones: [
      'Se abre → opened.',
      '«Cerrar», Escape o clic en el fondo → closed. Si se abrió con «Abrir el modal», el foco vuelve a ese botón; la primera apertura es automática al montar y no hay a dónde volver.',
      '«Guardar» → guardarSolicitado (es una intención: nada se persiste).',
    ],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: EscenarioContentDialog,
    fuente: FUENTE,
  },
  {
    id: `${CLAVE}#con-cambios`,
    clave: CLAVE,
    variante: 'con-cambios',
    titulo: 'Edición con cambios pendientes, ancho lg',
    seVe: 'Abierto con el borrador ya escrito. Escape y el fondo NO cierran: preguntan. Quien pregunta es este anfitrión, no el organismo: con `dismissible` en false `ContentDialog` sólo emite `dismissAttempt` (content-dialog.ts:108-123) y el descarte lo decide el consumidor.',
    interacciones: [
      'Escape o clic en el fondo → dismissAttempt, y aparece «¿Descartarlos?».',
      '«Descartar» → closed tras descartar. «Seguir editando» deja el modal donde está.',
      'Borrar los dos campos y cerrar → closed de una, porque ya no hay qué descartar.',
    ],
    salidasEsperadas: ['opened', 'dismissAttempt', 'closed', 'guardarSolicitado'],
    host: EscenarioContentDialog,
    fuente: FUENTE,
  },
  {
    id: `${CLAVE}#sm`,
    clave: CLAVE,
    variante: 'sm',
    titulo: 'Ancho sm (confirmación breve)',
    seVe: 'El mismo contenido en el panel más angosto. En móvil (390) los cuatro anchos colapsan al mismo modal.',
    interacciones: ['Igual que «descartable».'],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: EscenarioContentDialog,
    fuente: FUENTE,
  },
  {
    id: `${CLAVE}#xl`,
    clave: CLAVE,
    variante: 'xl',
    titulo: 'Ancho xl (listado con navegación interna)',
    seVe: 'El mismo contenido en el panel más ancho.',
    interacciones: ['Igual que «descartable».'],
    salidasEsperadas: ['opened', 'closed', 'guardarSolicitado'],
    host: EscenarioContentDialog,
    fuente: FUENTE,
  },
];
