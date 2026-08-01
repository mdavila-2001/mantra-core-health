import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';
import { TEXTAREA_NEAR_LIMIT_RATIO, type TextareaLimitBand } from './textarea.types';

/**
 * Campo de texto de varias líneas: notas de evolución, indicaciones,
 * observaciones. Mismo borde, estados y foco que `app-input`.
 *
 * ```html
 * <app-form-field label="Evolución" hint="Queda en la historia clínica">
 *   <app-textarea [(value)]="evolucion" [maxLength]="2000" [autoResize]="true" />
 * </app-form-field>
 * ```
 *
 * Envuelto en `app-form-field` toma de él el `id`, el `aria-describedby` y la
 * obligatoriedad — nunca se le pasan a mano. Suelto, cae en su propio id.
 *
 * Implementa `ControlValueAccessor`, así que también funciona con
 * `formControlName`; el valor que devuelve es **siempre `string`** (a
 * diferencia de `app-input type="number"`, donde el `0` es un número y
 * confundirlo con `''` ya costó un defecto).
 */
@Component({
  selector: 'app-textarea',
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Textarea),
      multi: true,
    },
  ],
  host: {
    '[class.app-textarea-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
})
export class Textarea implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Sin `required`: un formulario reactivo escribe el valor antes de que la vista exista. */
  private readonly control = viewChild<ElementRef<HTMLTextAreaElement>>('control');

  readonly value = model<string>('');

  readonly placeholder = input<string>('');
  readonly rows = input<number>(3);

  /** Techo del crecimiento automático; a partir de ahí el contenido hace scroll. */
  readonly maxRows = input<number>(10);

  /** Sin límite declarado no hay contador: un número suelto no informa nada. */
  readonly maxLength = input<number | null>(null);

  readonly autoResize = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly hasError = input(false, { transform: booleanAttribute });

  readonly focused = output<FocusEvent>();
  readonly blurred = output<FocusEvent>();

  protected readonly isFocused = signal(false);

  /** Lo baja el `setDisabledState` de un formulario reactivo. */
  private readonly disabledByForm = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  private readonly baseId = nextControlId('textarea');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.baseId);
  protected readonly limitHintId = `${this.baseId}-limit`;
  protected readonly required = computed(() => this.field?.required() === true);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /**
   * El del campo MÁS el del límite: describir el largo máximo no puede costar
   * el hint ni el mensaje de error que ya venían.
   */
  protected readonly describedBy = computed<string | null>(() => {
    const ids = [this.field?.describedBy(), this.maxLength() === null ? null : this.limitHintId];
    const presentes = ids.filter((id): id is string => Boolean(id));
    return presentes.length > 0 ? presentes.join(' ') : null;
  });

  protected readonly characterCount = computed(() => this.value().length);

  protected readonly counterText = computed(() => `${this.characterCount()} / ${this.maxLength()}`);

  /**
   * En qué banda del límite está el texto. El anuncio cuelga de acá —y no del
   * conteo— para que solo hable al cruzar el umbral y al tocar el techo.
   */
  protected readonly limitBand = computed<TextareaLimitBand>(() => {
    const max = this.maxLength();
    if (max === null || max <= 0) {
      return 'none';
    }
    if (this.characterCount() >= max) {
      return 'reached';
    }
    return this.characterCount() >= max * TEXTAREA_NEAR_LIMIT_RATIO ? 'near' : 'none';
  });

  /** Frase sin cifras variables: cambia al cambiar de banda, no al tipear. */
  protected readonly limitAnnouncement = computed(() => {
    const max = this.maxLength();
    switch (this.limitBand()) {
      case 'reached':
        return `Alcanzaste el límite de ${max} caracteres.`;
      case 'near':
        return `Te estás acercando al límite de ${max} caracteres.`;
      default:
        return '';
    }
  });

  protected readonly wrapperClasses = computed(() => {
    const classes = ['textarea-wrapper'];
    if (this.invalid()) {
      classes.push('status-error');
    }
    if (this.isFocused()) {
      classes.push('is-focused');
    }
    if (this.isDisabled()) {
      classes.push('is-disabled');
    }
    return classes.join(' ');
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Un valor inicial largo ya llega con su alto: medir en el navegador y
    // nunca en la ruta de render, que bajo SSR no tiene DOM.
    afterNextRender(() => this.growToContent());
  }

  /* ---- ControlValueAccessor ---------------------------------------------- */

  writeValue(value: unknown): void {
    this.value.set(value === null || value === undefined ? '' : String(value));
    this.growToContent();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }

  /* ---- interacción -------------------------------------------------------- */

  protected handleInput(event: Event): void {
    if (this.isDisabled()) {
      // `aria-disabled` no frena la escritura por sí solo y un formulario
      // deshabilitado no debe cambiar de valor por un evento sintético.
      return;
    }
    const target = event.target as HTMLTextAreaElement;
    this.value.set(target.value);
    this.onChange(target.value);
    this.growToContent();
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.onTouched();
    this.blurred.emit(event);
  }

  /**
   * Crece con el contenido. El TOPE no se calcula acá: lo declara el CSS con
   * `max-height` a partir de `--_textarea-max-rows`, así el alto máximo sigue
   * a la interlínea del sistema sin que este código mida tipografía.
   */
  private growToContent(): void {
    if (!this.autoResize() || !this.isBrowser) {
      return;
    }
    const element = this.control()?.nativeElement;
    if (!element) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }
}
