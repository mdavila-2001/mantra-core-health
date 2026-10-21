import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '@shared/forms/form-control.context';
import { createValueAccessorBridge } from '@shared/forms/value-accessor';
import type { SelectOption } from './select.types';

/** Valor del `<option>` que representa «nada elegido». */
const NO_SELECTION = '';

/**
 * Desplegable con soporte buscable integrado y sobre `<select>` nativo (teclado y accesibilidad
 * de plataforma gratis).
 */
@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-select-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
    '(document:click)': 'handleDocumentClick($event)',
    '(keydown.escape)': 'closeSearch()',
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
  private readonly elementRef = inject(ElementRef);
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  /** Puente con el formulario. Vacío e inofensivo si el desplegable va suelto. */
  private readonly formBridge = createValueAccessorBridge<T | null>();

  readonly value = model<T | null>(null);
  readonly options = input<readonly SelectOption<T>[]>([]);
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Seleccionar opción');
  readonly hasError = input<boolean>(false);
  readonly searchable = input<boolean>(true);
  readonly searchPlaceholder = input<string>('Buscar...');

  /** Búsqueda interactiva */
  readonly isSearchOpen = signal(false);
  readonly searchTerm = signal('');
  readonly activeSearchIndex = signal(-1);
  readonly searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /**
   * Nombre accesible para el desplegable que va **suelto**, sin
   * `app-form-field` alrededor.
   *
   * Hace falta porque el `placeholder` **no nombra al control**: se renderiza
   * como un `<option hidden>`, y un lector de pantalla lo lee como una opción
   * más, no como «de qué es este desplegable». Un `<select>` sin nombre se
   * anuncia como «cuadro combinado» a secas, que no le dice nada a nadie.
   *
   * Lo destapó la auditoría de axe sobre el paginado —regla `select-name`,
   * impacto crítico— y afectaba también a los dos filtros de `app-filter-bar`.
   *
   * Mismo criterio que `app-search-field`, que ya resolvía esto con un `<label>`
   * invisible: quien monta el control suelto tiene que nombrarlo.
   */
  readonly ariaLabel = input<string>('');

  readonly focused = output<FocusEvent>();
  readonly blurred = output<FocusEvent>();

  protected readonly isFocused = signal(false);

  /**
   * Deshabilitado por la plantilla **o** por el formulario: `disabled` es un
   * `input()` de solo lectura y `setDisabledState` no puede escribirlo.
   */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

  private readonly ownId = nextControlId('select');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);

  /**
   * El `aria-label` se emite **solo fuera de un campo**.
   *
   * Dentro, el `<label>` del campo ya nombra al control, y un `aria-label`
   * ganaría por precedencia: quien pasara los dos vería en el lector de
   * pantalla algo distinto de lo que hay escrito en la pantalla. Ignorarlo acá
   * hace imposible ese desacuerdo.
   */
  protected readonly accessibleLabel = computed(() =>
    this.field !== null ? null : this.ariaLabel() || null,
  );
  protected readonly required = computed(() => this.field?.required() === true);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /**
   * Índice de la opción elegida, o `-1` si ninguna lo está.
   *
   * Número y no texto porque la plantilla lo compara contra el `$index` del
   * `@for` para marcar el `<option>` con `[selected]`. Ver el comentario de
   * `select.html`: marcar la opción es lo único que funciona cuando el control
   * nace con valor, porque el `<select>` recibe sus propiedades antes de que
   * sus opciones existan.
   */
  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );

  /** Si la búsqueda interactiva está habilitada */
  readonly isSearchable = computed(
    () => this.searchable() && this.options().length >= 3 && !this.isDisabled(),
  );

  /** Etiqueta de la opción actualmente elegida */
  readonly selectedOptionLabel = computed(() => {
    const idx = this.selectedIndex();
    return idx >= 0 ? this.options()[idx]?.label : null;
  });

  /** Opciones filtradas en tiempo real por el término de búsqueda */
  readonly filteredOptions = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const opts = this.options();
    if (!query) return opts;
    return opts.filter((opt) => opt.label.toLowerCase().includes(query));
  });

  toggleSearch(event?: MouseEvent): void {
    if (this.isDisabled()) return;
    if (this.isSearchable()) {
      event?.preventDefault();
      event?.stopPropagation();
      const open = !this.isSearchOpen();
      this.isSearchOpen.set(open);
      if (open) {
        this.searchTerm.set('');
        this.activeSearchIndex.set(-1);
        setTimeout(() => this.searchInputRef()?.nativeElement.focus(), 0);
      }
    }
  }

  closeSearch(): void {
    this.isSearchOpen.set(false);
    this.searchTerm.set('');
    this.activeSearchIndex.set(-1);
  }

  handleDocumentClick(event: MouseEvent): void {
    if (this.isSearchOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeSearch();
    }
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.activeSearchIndex.set(-1);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const items = this.filteredOptions();
    if (items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (this.activeSearchIndex() + 1) % items.length;
      this.activeSearchIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (this.activeSearchIndex() - 1 + items.length) % items.length;
      this.activeSearchIndex.set(prev);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.activeSearchIndex();
      if (idx >= 0 && idx < items.length) {
        this.chooseOption(items[idx]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
    }
  }

  chooseOption(option: SelectOption<T>): void {
    if (option.disabled) return;
    this.commit(option.value);
    this.closeSearch();
  }

  protected readonly wrapperClasses = computed(() => {
    const classes = ['select-wrapper'];
    if (this.invalid()) {
      classes.push('status-error');
    }
    if (this.isFocused() || this.isSearchOpen()) {
      classes.push('is-focused');
    }
    if (this.isDisabled()) {
      classes.push('is-disabled');
    }
    if (this.isSearchable()) {
      classes.push('is-searchable');
    }
    return classes.join(' ');
  });

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

  protected handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target.value === NO_SELECTION) {
      this.commit(null);
      return;
    }
    const option = this.options()[Number(target.value)];
    this.commit(option ? option.value : null);
  }

  /** Único punto por donde entra una elección de la persona. */
  private commit(value: T | null): void {
    this.value.set(value);
    this.formBridge.emitChange(value);
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.formBridge.emitTouched();
    this.blurred.emit(event);
  }
}
