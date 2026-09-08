import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { Checkbox } from '@shared/components/atoms/checkbox/checkbox';
import { FORM_CONTROL_CONTEXT } from '@shared/forms/form-control.context';
import { createValueAccessorBridge } from '@shared/forms/value-accessor';

/** Una respuesta ofrecida. */
export interface OpcionDeCasilla {
  readonly value: string;
  readonly label: string;
}

/**
 * Grupo de casillas: **cuáles de éstas**, frente al «sí o no» de una casilla
 * suelta.
 *
 * ```html
 * <app-form-field label="Factores de riesgo">
 *   <app-checkbox-group formControlName="factores" [options]="opciones" />
 * </app-form-field>
 * ```
 *
 * ## El grupo es el control, no cada casilla
 *
 * Igual que `app-radio-group`, y por el mismo motivo: el formulario ve **un**
 * control con **una** respuesta —el array de lo marcado—, que es lo que la
 * persona percibe. El `ControlValueAccessor` va acá.
 *
 * Antes esto se armaba en la plantilla del motor con un `@for` de
 * `app-checkbox` sueltos, cada uno con `[checked]` calculado y `(checkedChange)`
 * escribiendo en el control. Con `checked` siendo un `model`, esa ida y vuelta
 * tiene dos dueños para el mismo estado —el model interno de cada casilla y el
 * valor del control— y marcar una segunda opción desmarcaba la primera. Con el
 * grupo como control hay un solo dueño y el problema no existe.
 *
 * ## El orden es el de la lista, no el de los clics
 *
 * Lo marcado se guarda en el orden en que se ofreció. La respuesta se lee
 * después en una ficha clínica, y leerla en el orden en que alguien fue
 * pulsando no dice nada.
 */
@Component({
  selector: 'app-checkbox-group',
  imports: [Checkbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    class: 'app-checkbox-group',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-disabled]': 'isDisabled() || null',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxGroup),
      multi: true,
    },
  ],
  /**
   * Las casillas de dentro **no** heredan el contexto del campo.
   *
   * `app-checkbox` toma su `id` de `FORM_CONTROL_CONTEXT` cuando lo hay, y ese
   * contrato está pensado para **un** control por campo. Con cinco casillas
   * bajo el mismo `app-form-field`, las cinco recibían el mismo `id` y sus
   * cinco `<label for>` apuntaban todos al primero: pulsar «Diabetes» marcaba
   * «Tabaquismo». Además son ids repetidos en el documento, que es HTML
   * inválido y deja a un lector de pantalla leyendo cinco veces la misma
   * etiqueta.
   *
   * Cortado acá, cada casilla cae en su `ownId`, que es único por instancia.
   * `viewProviders` y no `providers`: alcanza a la plantilla —las casillas— y
   * no al propio grupo, que sigue necesitando el contexto del campo para su
   * `aria-labelledby` y su estado de error.
   */
  viewProviders: [{ provide: FORM_CONTROL_CONTEXT, useValue: null }],
  styles: `
    :host {
      display: grid;
      /* En columna y no en fila: los rótulos son de largo desigual —«Dolor
         torácico», «Tos»— y en fila las casillas quedan a distancias distintas,
         que es lo que hace marcar la de al lado. */
      gap: var(--sp-2);
    }
  `,
  template: `
    @for (opcion of options(); track opcion.value) {
      <app-checkbox
        [label]="opcion.label"
        [checked]="estaMarcada(opcion.value)"
        [disabled]="isDisabled()"
        (checkedChange)="alternar(opcion.value, $event)"
      />
    }
  `,
})
export class CheckboxGroup implements ControlValueAccessor {
  /**
   * El campo que envuelve al grupo.
   *
   * `skipSelf` para saltarse el `viewProviders` de más arriba, que apaga el
   * contexto **para las casillas** y de paso lo apagaría también para el propio
   * grupo: sin esto el grupo se queda sin `aria-labelledby` y pierde su nombre
   * accesible, que es justo lo que el contrato del campo existe para dar.
   */
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true, skipSelf: true });

  /** Puente con el formulario. Vacío e inofensivo si el grupo va suelto. */
  private readonly formBridge = createValueAccessorBridge<readonly string[]>();

  readonly options = input<readonly OpcionDeCasilla[]>([]);
  readonly value = model<readonly string[]>([]);
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);

  readonly isDisabled = computed(() => this.disabled() || this.formBridge.disabledByForm());

  /** Un grupo no se etiqueta con `for`: apunta al label del campo. */
  protected readonly labelledBy = computed(() => this.field?.labelId() ?? null);

  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  protected readonly required = computed(() => this.field?.required() === true);

  constructor() {
    this.field?.controlLabelable.set(false);
  }

  // --- ControlValueAccessor --------------------------------------------------

  /**
   * Tolera que llegue algo que no sea un array: `''` es lo que deja un
   * `FormControl` recién creado sin valor inicial, y `''.includes(opcion)`
   * respondería que sí a cualquier subcadena —marcando opciones que nadie
   * marcó—.
   */
  writeValue(value: readonly string[] | null): void {
    this.value.set(Array.isArray(value) ? value : []);
  }

  registerOnChange(fn: (value: readonly string[]) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  protected estaMarcada(opcion: string): boolean {
    return this.value().includes(opcion);
  }

  /**
   * Marca o desmarca una opción.
   *
   * Marca tocado en el mismo gesto y no al perder el foco: elegir ya es la
   * interacción completa, y esperar al blur retrasaría el mensaje de un grupo
   * obligatorio sin responder.
   */
  protected alternar(opcion: string, marcada: boolean): void {
    if (this.isDisabled()) {
      return;
    }

    const marcadas = new Set(this.value());
    if (marcada) {
      marcadas.add(opcion);
    } else {
      marcadas.delete(opcion);
    }

    const enOrden = this.options()
      .map((o) => o.value)
      .filter((v) => marcadas.has(v));

    this.value.set(enOrden);
    this.formBridge.emitChange(enOrden);
    this.formBridge.emitTouched();
  }
}
