import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { Input } from '../../atoms/input/input';
import { Spinner } from '../../atoms/spinner/spinner';
import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
  type FormControlContext,
} from '@shared/forms/form-control.context';
import { SEARCH_DEBOUNCE_MS } from './search-field.types';

/**
 * Campo de búsqueda de un listado: input + lupa + botón de limpiar, con un
 * `app-spinner` mientras la consulta viaja.
 *
 * ```html
 * <app-search-field [(value)]="filtro" [loading]="buscando()"
 *                   label="Buscar paciente por documento o apellido"
 *                   (searched)="buscarPacientes($event)" />
 * ```
 *
 * `searched` sale **con espera** mientras se tipea, y **al instante** con
 * Enter o al limpiar: quien aprieta Enter ya decidió, y hacerlo esperar
 * 300 ms se siente roto. `Escape` limpia el campo.
 *
 * Se nombra solo: publica `FORM_CONTROL_CONTEXT` y emite su propio `<label>`
 * invisible, así que **no necesita un `app-form-field` alrededor**. Si igual
 * se lo envuelve, delega en el campo externo y no emite label propio, para no
 * terminar con dos nombres accesibles.
 *
 * La molécula **no anuncia los resultados**: eso lo hace quien los muestra,
 * que es el único que sabe cuántos son.
 */
@Component({
  selector: 'app-search-field',
  imports: [Input, Spinner, AppButton],
  templateUrl: './search-field.html',
  styleUrl: './search-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FORM_CONTROL_CONTEXT, useExisting: forwardRef(() => SearchField) }],
  host: {
    class: 'search-field',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class SearchField implements FormControlContext {
  /** El campo que lo envuelva, si existe. `skipSelf` salta el que publica él mismo. */
  private readonly outerField = inject(FORM_CONTROL_CONTEXT, {
    optional: true,
    skipSelf: true,
  });

  /**
   * `read: ElementRef` es obligatorio: una referencia de plantilla sobre un
   * componente devuelve **la instancia**, no su elemento, y buscar el
   * `<input>` nativo ahí adentro falla en silencio.
   */
  private readonly inputHost = viewChild('inputHost', { read: ElementRef });

  readonly value = model<string>('');
  readonly placeholder = input<string>('Buscar');
  readonly debounceMs = input<number>(SEARCH_DEBOUNCE_MS);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Nombre accesible del campo. Sin campo externo, es lo único que lo nombra. */
  readonly label = input<string>('Buscar');

  /**
   * Nombre en pasado, no `search`: un output llamado como un evento nativo del
   * DOM se dispara también cuando ese evento burbujea desde adentro.
   */
  readonly searched = output<string>();

  /* ---- FormControlContext: el campo se nombra a sí mismo ------------------ */

  private readonly baseId = nextControlId('search');
  readonly controlLabelable = signal(true);
  readonly controlId = computed(() => this.outerField?.controlId() ?? `${this.baseId}-control`);
  readonly labelId = computed(() => this.outerField?.labelId() ?? `${this.baseId}-label`);
  readonly describedBy = computed(() => this.outerField?.describedBy() ?? null);
  readonly invalid = computed(() => this.outerField?.invalid() === true);
  readonly required = computed(() => this.outerField?.required() === true);

  /** Sin campo externo el label propio es el único nombre; con él, sobraría. */
  protected readonly ownsLabel = computed(() => this.outerField === null);

  /** Último valor ya avisado: evita que la espera repita lo que salió al instante. */
  private readonly emitted = signal<string | null>(null);

  /** La primera corrida del efecto es el valor inicial, no una búsqueda. */
  private isFirstRun = true;

  constructor() {
    effect((onCleanup) => {
      const valor = this.value();
      const espera = untracked(() => this.debounceMs());

      if (this.isFirstRun) {
        // Un valor precargado (un filtro que viene de la ruta) no dispara nada.
        this.isFirstRun = false;
        this.emitted.set(valor);
        return;
      }

      if (untracked(() => this.emitted()) === valor) {
        return;
      }

      const temporizador = setTimeout(() => this.emitNow(valor), espera);
      onCleanup(() => clearTimeout(temporizador));
    });
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      // quien aprieta Enter ya decidió: no lo hagas esperar la ventana
      this.emitNow(this.value());
      return;
    }
    if (event.key === 'Escape' && this.value()) {
      // Escape solo se roba el evento si hay algo que limpiar
      event.preventDefault();
      this.clear();
    }
  }

  protected clear(): void {
    this.value.set('');
    this.emitNow('');
    this.focusInput();
  }

  /**
   * Avisa ya y deja constancia, para que el temporizador pendiente —si lo
   * hay— se encuentre con que su valor ya salió y no lo repita.
   */
  private emitNow(valor: string): void {
    if (untracked(() => this.emitted()) === valor) {
      return;
    }
    this.emitted.set(valor);
    this.searched.emit(valor);
  }

  /**
   * Tras limpiar, el foco vuelve al campo: si se quedara en el botón que
   * desaparece, caería al `<body>` y se pierde el lugar en la página.
   *
   * Alcanza el `<input>` nativo por el DOM y no por una API del átomo: el
   * `app-input` no expone `focus()` y agregárselo sería tocar una pieza fuera
   * del alcance de esta tanda.
   */
  private focusInput(): void {
    const host = this.inputHost()?.nativeElement as HTMLElement | undefined;
    host?.querySelector('input')?.focus();
  }
}
