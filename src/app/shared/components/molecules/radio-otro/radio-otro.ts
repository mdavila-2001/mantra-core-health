import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  inject,
  signal,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { RadioGroup } from '../radio-group/radio-group';

/**
 * La opción «Otro» de un `app-radio-group`, con su renglón para escribir.
 *
 * ```html
 * <app-radio-group formControlName="fuma">
 *   <app-radio value="Nunca" label="Nunca" />
 *   <app-radio value="Fumador" label="Fumador" />
 *   <app-radio-otro [valores]="['Nunca', 'Fumador']" />
 * </app-radio-group>
 * ```
 *
 * ## Lo que se guarda es el texto
 *
 * Igual que en `app-checkbox-group`: el valor del grupo pasa a ser **lo
 * escrito**, no un código «otro». Es lo que después se lee en la ficha, y un
 * código habría que traducirlo en cada pantalla que lo muestre.
 *
 * ## Cómo sabe que está elegida
 *
 * Un radio normal se compara con su `value`; éste no tiene uno fijo. Está
 * elegida cuando el valor del grupo **no es ninguna de las opciones de la
 * lista** —por eso recibe `valores`— o cuando se la acaba de apretar y todavía
 * no se escribió nada. Ese segundo caso es estado local: el grupo queda en
 * `''`, que para un campo obligatorio es «sin responder», que es exactamente
 * lo que es un «Otro» sin texto.
 *
 * Elegir otra opción de la lista la apaga sola: lo dice el valor del grupo, no
 * hace falta avisarle.
 *
 * Comparte la hoja de estilos de `app-radio`: es un radio más, con un renglón.
 */
@Component({
  selector: 'app-radio-otro',
  standalone: true,
  templateUrl: './radio-otro.html',
  styleUrls: ['../radio/radio.css', './radio-otro.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-radio-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
})
export class RadioOtro {
  private readonly group: RadioGroup<unknown> = inject(RadioGroup);

  /** Los valores de la lista: cualquier otro valor del grupo es «Otro». */
  readonly valores = input.required<readonly string[]>();
  readonly label = input<string>('Otro:');
  readonly placeholder = input<string>('Escribí tu respuesta');
  readonly disabled = input<boolean>(false);

  protected readonly inputId = nextControlId('radio');
  protected readonly textoId = nextControlId('radio-otro-texto');

  /** Apretada sin texto todavía. Ver la nota de arriba. */
  private readonly activo = signal(false);

  protected readonly texto = signal('');

  /** El valor del grupo, cuando es texto libre; `undefined` si es de la lista. */
  private readonly textoLibre = computed<string | undefined>(() => {
    const valor = this.group.value();
    return typeof valor === 'string' && valor !== '' && !this.valores().includes(valor)
      ? valor
      : undefined;
  });

  protected readonly checked = computed(
    () => this.textoLibre() !== undefined || this.activo(),
  );

  protected readonly isDisabled = computed(() => this.disabled() || this.group.isDisabled());

  protected readonly name = computed(() => this.group.name());

  constructor() {
    effect(() => {
      const valor = this.group.value();
      const libre = this.textoLibre();
      if (libre !== undefined) {
        // Un valor guardado con texto libre vuelve con el renglón escrito.
        this.texto.set(libre);
        this.activo.set(true);
      } else if (valor !== null && valor !== '') {
        // Eligieron una de la lista: «Otro» se apaga solo.
        this.activo.set(false);
      }
    });
  }

  protected select(): void {
    if (this.isDisabled()) {
      return;
    }
    this.activo.set(true);
    this.group.select(this.texto().trim());
  }

  protected escribir(evento: Event): void {
    if (this.isDisabled()) {
      return;
    }
    this.texto.set((evento.target as HTMLInputElement).value);
    // Escribir ya es elegir: nadie escribe en el renglón de «Otro» para dejar
    // marcada otra opción.
    this.activo.set(true);
    this.group.select(this.texto().trim());
  }
}
