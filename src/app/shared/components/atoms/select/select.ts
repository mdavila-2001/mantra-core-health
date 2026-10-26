import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '@shared/forms/form-control.context';
import { createValueAccessorBridge } from '@shared/forms/value-accessor';
import { AppButton } from '../button/button';
import type { SelectOption } from './select.types';
import { cerrarConSalida, fijarOrigenDelPanel } from '@shared/motion/panel-motion';

/**
 * Desde cuántas opciones aparece el buscador. Con diez o menos se ven todas de
 * un vistazo y un buscador sólo estorba: los nueve departamentos de Bolivia
 * entran sin él (carril 03). La disciplina sale del `OptionSelect` de ATLAS.
 */
export const SEARCH_FROM = 10;

/** Una opción a la vista, con su posición en la lista completa. */
interface Row<T> {
  /** Índice en `options()`: es lo que identifica a la opción, no su texto. */
  readonly index: number;
  readonly option: SelectOption<T>;
}

/** Minúsculas y sin tildes: «cardiologia» encuentra «Cardiología». */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Desplegable de una opción que se elige en un **modal**, igual que
 * `app-tree-select` y el calendario.
 *
 * Antes era un `<select>` nativo: la lista la pintaba el sistema operativo,
 * distinta en cada navegador, sin tokens, sin modo oscuro y sin lugar para
 * explicar qué significa cada opción. Ahora el campo es un botón que abre un
 * `<dialog>` con la lista, un buscador desde {@link SEARCH_FROM} opciones y la
 * descripción de cada una en segunda línea cuando la trae.
 *
 * Teclado completo: Enter, Espacio o flecha abajo abren; flechas, Inicio y Fin
 * recorren; Enter elige; Escape o un clic en el velo cierran y devuelven el
 * foco al campo.
 *
 * La API es la de siempre (`value`, `options`, `placeholder`, `hasError`,
 * `ariaLabel`, `ControlValueAccessor`): ninguna pantalla cambia. El valor que
 * sale es literalmente el que entró en `options`, nunca el texto al que el DOM
 * lo degradaría.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [AppButton],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-select-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
})
export class Select<T> implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });
  private readonly document = inject(DOCUMENT);

  /** Puente con el formulario. Vacío e inofensivo si el desplegable va suelto. */
  private readonly formBridge = createValueAccessorBridge<T | null>();

  readonly value = model<T | null>(null);
  readonly options = input<readonly SelectOption<T>[]>([]);
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Seleccionar opción');
  readonly hasError = input<boolean>(false);

  /**
   * Nombre accesible para el desplegable que va **suelto**, sin
   * `app-form-field` alrededor: el `placeholder` no nombra al control. Dentro
   * de un campo se ignora, porque el `<label>` ya lo nombra y un `aria-label`
   * le ganaría por precedencia.
   */
  readonly ariaLabel = input<string>('');
  readonly searchable = input<boolean | undefined>(undefined);

  /**
   * El valor elegido puede ocupar **dos** renglones antes de cortar con «…».
   * Opt-in: por omisión el valor va en uno, como siempre (filtros, tamaño de
   * página). Lo piden las altas, donde una opción larga elegida («S.R.L. ·
   * Sociedad de Responsabilidad Limitada») se cortaba justo en lo que dice.
   */
  readonly multilineValue = input<boolean>(false);

  readonly focused = output<FocusEvent>();
  readonly blurred = output<FocusEvent>();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLUListElement>>('list');

  protected readonly isFocused = signal(false);
  protected readonly isOpen = signal(false);
  protected readonly query = signal('');
  /** Posición, dentro de `visible()`, de la fila señalada por el teclado. */
  protected readonly active = signal(0);

  /** Deshabilitado por la plantilla **o** por el formulario. */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

  private readonly ownId = nextControlId('select');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly listId = computed(() => `${this.controlId()}-lista`);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly accessibleLabel = computed(() =>
    this.field !== null ? null : this.ariaLabel() || null,
  );
  protected readonly required = computed(() => this.field?.required() === true);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /** Índice de la opción elegida, o `-1` si ninguna lo está. */
  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );

  protected readonly selectedLabel = computed(() => {
    const index = this.selectedIndex();
    return index >= 0 ? this.options()[index].label : this.placeholder();
  });

  protected readonly isSearchable = computed(
    () => this.searchable() ?? (this.options().length > SEARCH_FROM),
  );

  /** Las opciones que pasan el filtro, por etiqueta y por descripción. */
  protected readonly visible = computed<readonly Row<T>[]>(() => {
    const term = normalize(this.query());
    const rows = this.options().map((option, index) => ({ index, option }));
    if (term === '') {
      return rows;
    }
    return rows.filter(({ option }) =>
      normalize(`${option.label} ${option.description ?? ''}`).includes(term),
    );
  });

  protected readonly activeId = computed(() =>
    this.visible().length > 0 ? this.optionId(this.active()) : null,
  );

  /**
   * El título del modal es el rótulo del campo: quien abre la lista tiene que
   * seguir sabiendo qué está eligiendo. Suelto, cae en su `aria-label` o en el
   * placeholder.
   */
  protected readonly dialogTitle = signal('');

  protected readonly wrapperClasses = computed(() => {
    const classes = ['select-wrapper'];
    if (this.invalid()) {
      classes.push('status-error');
    }
    if (this.isFocused() || this.isOpen()) {
      classes.push('is-focused');
    }
    if (this.isDisabled()) {
      classes.push('is-disabled');
    }
    return classes.join(' ');
  });

  constructor() {
    // Abrir el diálogo y llevar el foco adentro recién cuando el @if lo pintó.
    // Sólo depende de que el diálogo exista y esté abierto: si leyera las
    // opciones, una pantalla que pasa un arreglo nuevo al cambiar el valor lo
    // volvería a abrir justo al elegir, antes de que el @if lo saque.
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog || !this.isOpen()) {
        return;
      }
      untracked(() => {
        this.showModal(dialog);
        // Nace del control que lo abrió (ver `.panel-muelle` en styles.css).
        fijarOrigenDelPanel(
          dialog.querySelector<HTMLElement>('.select-panel'),
          dialog,
          this.trigger().nativeElement,
        );
        const target = this.search()?.nativeElement ?? this.list()?.nativeElement;
        target?.focus();
        this.scrollActiveIntoView();
      });
    });
  }

  protected optionId(position: number): string {
    return `${this.listId()}-${position}`;
  }

  // --- ControlValueAccessor ------------------------------------------------
  // `writeValue` escribe la señal y NO avisa al formulario: devolverle el valor
  // que él mismo acaba de mandar es la receta del bucle infinito.

  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  // --- Abrir, elegir, cerrar -------------------------------------------------

  protected open(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }
    this.query.set('');
    this.dialogTitle.set(this.resolveTitle());
    // Se abre señalando lo ya elegido: quien vuelve a cambiarlo empieza ahí.
    this.active.set(Math.max(this.selectedIndex(), 0));
    this.isOpen.set(true);
  }

  /**
   * Cierra el modal. `conSalida` anima la salida del panel (140 ms) antes de
   * cerrar; es lo que corresponde al descartar (Escape, velo, «Cancelar»).
   *
   * **Elegir no usa la salida.** Mientras el panel sale el `<dialog>` sigue
   * siendo modal: la página de atrás está inerte y ni un clic ni el foco entran.
   * Quien elegía un colega y pasaba de inmediato al campo de al lado perdía lo
   * que escribía —en «Crear grupo médico», medido en Chromium, un clic y el
   * tecleo dentro de los ~300 ms siguientes se perdían, y el foco terminaba en
   * el botón del desplegable porque al acabar la salida `trigger.focus()` se lo
   * robaba al campo—. Elegir es el final: la página se libera en el acto.
   */
  protected close(conSalida = true): void {
    if (!this.isOpen()) {
      return;
    }
    // Cerrar el elemento antes de que el @if lo saque del DOM: un `<dialog>`
    // que se quita abierto deja el velo puesto y la página bloqueada.
    const dialog = this.dialog()?.nativeElement;
    const cerrar = (): void => {
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      }
      this.isOpen.set(false);
      this.trigger().nativeElement.focus();
    };
    if (!conSalida) {
      cerrar();
      return;
    }
    // Salida corta hacia el control; sin animación posible cierra en el acto.
    cerrarConSalida(dialog?.querySelector<HTMLElement>('.select-panel'), cerrar);
  }

  /** Elige la opción `index` de `options()` y cierra: elegir ES el final. */
  protected choose(index: number): void {
    const option = this.options()[index];
    if (!option || option.disabled) {
      return;
    }
    this.value.set(option.value);
    this.formBridge.emitChange(option.value);
    this.close(false);
  }

  /** Un clic en el velo cierra: es un clic sobre el `<dialog>` fuera del panel. */
  protected handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  protected handleSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected handleTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.open();
    }
  }

  protected handleDialogKeydown(event: KeyboardEvent): void {
    // El teclado de este modal es suyo: dentro de otro diálogo (la hora del
    // calendario), un Escape que subiera cerraría también al de afuera.
    event.stopPropagation();
    const last = this.visible().length - 1;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.moveTo(Math.min(this.active() + 1, last));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveTo(Math.max(this.active() - 1, 0));
        return;
      case 'Home':
        if (this.typingInSearch(event)) {
          return;
        }
        event.preventDefault();
        this.moveTo(0);
        return;
      case 'End':
        if (this.typingInSearch(event)) {
          return;
        }
        event.preventDefault();
        this.moveTo(last);
        return;
      case 'Enter':
        event.preventDefault();
        this.chooseActive();
        return;
      case ' ':
        // En el buscador, el espacio es parte de lo que se escribe.
        if (this.typingInSearch(event)) {
          return;
        }
        event.preventDefault();
        this.chooseActive();
        return;
      default:
        return;
    }
  }

  private typingInSearch(event: KeyboardEvent): boolean {
    return event.target === this.search()?.nativeElement;
  }

  private chooseActive(): void {
    const row = this.visible()[this.active()];
    if (row) {
      this.choose(row.index);
    }
  }

  private moveTo(position: number): void {
    if (position < 0) {
      return;
    }
    this.active.set(position);
    this.scrollActiveIntoView();
  }

  private scrollActiveIntoView(): void {
    const id = this.activeId();
    const row = id ? this.document.getElementById(id) : null;
    // `scrollIntoView` no existe en jsdom.
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }

  private resolveTitle(): string {
    const labelId = this.field?.labelId();
    const label = labelId ? this.document.getElementById(labelId) : null;
    // Sólo el texto propio del rótulo: el asterisco y el «(obligatorio)» para
    // lectores de pantalla son elementos hijos y en un título sobran.
    const clean = Array.from(label?.childNodes ?? [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clean || this.ariaLabel() || this.placeholder() || 'Elegir una opción';
  }

  /**
   * Sube el diálogo a la capa superior. El `typeof` es por jsdom, que no
   * implementa `showModal`; ver la nota gemela en `date-picker.ts`.
   */
  private showModal(dialog: HTMLDialogElement): void {
    if (dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      return;
    }
    dialog.setAttribute('open', '');
  }

  // --- Foco del campo ----------------------------------------------------------

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    // Abrir el modal saca el foco del botón, pero la persona sigue en el campo:
    // marcarlo «tocado» ahí pintaría el error de obligatorio antes de elegir.
    if (this.isOpen()) {
      return;
    }
    this.formBridge.emitTouched();
    this.blurred.emit(event);
  }
}
