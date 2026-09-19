import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { FORM_CONTROL_CONTEXT, nextControlId } from '@shared/forms/form-control.context';
import { createValueAccessorBridge } from '@shared/forms/value-accessor';
import {
  comoRespuesta,
  marcadasDeFila,
  type OpcionDeCuadricula,
  type RespuestaDeCuadricula,
} from './grid-group.types';

/**
 * Cuadrícula de preguntas: **la misma pregunta sobre varios sujetos**.
 *
 * ```html
 * <app-form-field label="¿Con qué frecuencia?">
 *   <app-grid-group formControlName="sintomas" [rows]="filas" [columns]="escala" />
 * </app-form-field>
 * ```
 *
 * ## Por qué no son N preguntas sueltas
 *
 * «Nunca / A veces / Siempre» sobre ocho síntomas, servido como ocho preguntas,
 * repite la escala ocho veces y obliga a releerla en cada una. En cuadrícula la
 * escala se escribe una vez arriba y las ocho filas se contestan de corrido,
 * que es de lo que vive cualquier escala clínica —y es la razón por la que
 * existe en todo editor de formularios—.
 *
 * ## Una tabla de verdad, no una rejilla de CSS
 *
 * Las columnas son encabezados (`<th scope="col">`) y las filas también
 * (`<th scope="row">`): es lo que deja a un lector de pantalla decir en qué
 * celda está sin que la persona tenga que recordar la cabecera. Cada control
 * lleva además su propio nombre accesible —«Tos, A veces»—, porque una casilla
 * anunciada como «casilla, sin marcar» a secas no dice qué se estaría
 * contestando.
 *
 * En pantalla angosta la tabla se despliega en bloques —una fila por tarjeta,
 * con el rótulo de la columna al lado de cada control— en vez de estrecharse
 * hasta ser ilegible. Los rótulos de esos bloques salen de `data-columna` por
 * CSS: el nombre accesible ya viaja en el control, así que no se duplica nada
 * de lo que se anuncia.
 *
 * ## Qué guarda
 *
 * Un objeto con **una entrada por fila respondida** — ver
 * {@link RespuestaDeCuadricula}—. Las filas sin responder no aparecen, que es
 * lo que deja contarlas para «requerir una respuesta en cada fila».
 *
 * ## Una respuesta por columna
 *
 * Con `oneResponsePerColumn`, una columna ya usada en una fila **deja de
 * ofrecerse** en las demás: es la restricción de un ordenamiento sin empates
 * («de la más a la menos importante»). Se apaga la celda en vez de dejar
 * marcarla y avisar después, que es lo que hace el editor de formularios del
 * que sale la regla: un error que se puede volver imposible no debería llegar a
 * ocurrir.
 */
@Component({
  selector: 'app-grid-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-grid-group',
    '[attr.aria-invalid]': 'invalid() || null',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GridGroup),
      multi: true,
    },
  ],
  templateUrl: './grid-group.html',
  styleUrl: './grid-group.css',
})
export class GridGroup implements ControlValueAccessor {
  /** El campo que envuelve a la cuadrícula, para tomar de él su nombre. */
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  protected readonly formBridge = createValueAccessorBridge<RespuestaDeCuadricula>();

  /** Las filas, en el orden en que se preguntan. */
  readonly rows = input<readonly OpcionDeCuadricula[]>([]);

  /** Las columnas: las respuestas que cada fila puede elegir. */
  readonly columns = input<readonly OpcionDeCuadricula[]>([]);

  /** Si cada fila admite varias columnas. En falso, una sola. */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Si una columna usada en una fila deja de ofrecerse en las demás. */
  readonly oneResponsePerColumn = input(false, { transform: booleanAttribute });

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly hasError = input(false, { transform: booleanAttribute });

  /**
   * Cómo se llama la cuadrícula entera, cuando no va dentro de un campo.
   *
   * Dentro de un `app-form-field` sobra: el rótulo del campo ya la nombra y es
   * lo que sale en el `<caption>`.
   */
  readonly ariaLabel = input<string>('');

  readonly value = model<RespuestaDeCuadricula>({});

  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /**
   * Cómo se nombra la tabla.
   *
   * Dentro de un campo, apuntando a su rótulo (`aria-labelledby`); suelta, con
   * el texto declarado. Nunca las dos: `aria-labelledby` gana sobre
   * `aria-label` y tener ambas es una de las dos que nadie lee.
   */
  protected readonly etiquetadaPor = computed(() =>
    this.field === null ? null : this.field.labelId(),
  );

  protected readonly etiqueta = computed(() =>
    this.etiquetadaPor() !== null || this.ariaLabel() === '' ? null : this.ariaLabel(),
  );

  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);

  protected readonly required = computed(() => this.field?.required() === true);

  /** Base de los `name` de los radios: uno por fila, único en el documento. */
  private readonly base = nextControlId('cuadricula');

  constructor() {
    // Una cuadrícula no se etiqueta con `<label for>`: no es un control, son
    // muchos. El campo la nombra por su `<caption>`.
    this.field?.controlLabelable.set(false);
  }

  // --- ControlValueAccessor --------------------------------------------------

  writeValue(value: unknown): void {
    this.value.set(comoRespuesta(value));
  }

  registerOnChange(fn: (value: RespuestaDeCuadricula) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  // --- lo que la plantilla pregunta -----------------------------------------

  /** El `name` de los radios de una fila: los agrupa, que es lo que los hace excluyentes. */
  protected nombreDeFila(fila: string): string {
    return `${this.base}-${fila}`;
  }

  protected marcada(fila: string, columna: string): boolean {
    return marcadasDeFila(this.value(), fila).includes(columna);
  }

  /**
   * Si la celda no se puede usar porque su columna ya está tomada en otra fila.
   *
   * Sólo con `oneResponsePerColumn`. La celda **de la fila que la tomó** sigue
   * habilitada: es la que hay que poder pulsar para soltarla.
   */
  protected bloqueada(fila: string, columna: string): boolean {
    if (!this.oneResponsePerColumn() || this.marcada(fila, columna)) {
      return false;
    }
    return this.rows().some(
      (otra) => otra.value !== fila && marcadasDeFila(this.value(), otra.value).includes(columna),
    );
  }

  protected deshabilitada(fila: string, columna: string): boolean {
    return this.isDisabled() || this.bloqueada(fila, columna);
  }

  /**
   * Elige una columna en una fila.
   *
   * En la de opción única, volver a pulsar la columna ya elegida **la borra**:
   * es la única forma de dejar sin responder una fila que se contestó por
   * error, y un radio nativo no la ofrece. Es lo mismo que hace el estado
   * dental de la ficha, con el mismo aviso en pantalla.
   */
  protected elegir(fila: string, columna: string): void {
    if (this.deshabilitada(fila, columna)) {
      return;
    }
    const marcadas = marcadasDeFila(this.value(), fila);
    const siguiente = this.multiple()
      ? this.columnasAlternadas(marcadas, columna)
      : marcadas.includes(columna)
        ? []
        : [columna];

    this.publicar(fila, siguiente);
  }

  /** Marca o desmarca, conservando el orden en que se ofrecieron las columnas. */
  private columnasAlternadas(marcadas: readonly string[], columna: string): readonly string[] {
    const siguientes = new Set(marcadas);
    if (siguientes.has(columna)) {
      siguientes.delete(columna);
    } else {
      siguientes.add(columna);
    }
    return this.columns()
      .map((c) => c.value)
      .filter((c) => siguientes.has(c));
  }

  /**
   * Escribe la fila y avisa al formulario.
   *
   * Una fila que se queda sin respuesta se **quita** del objeto: ver
   * {@link RespuestaDeCuadricula}. Marca tocado en el mismo gesto —elegir ya es
   * la interacción completa— para que un obligatorio sin responder lo diga al
   * intentar continuar y no al perder el foco.
   */
  private publicar(fila: string, columnas: readonly string[]): void {
    const siguiente: Record<string, string | readonly string[]> = { ...this.value() };
    if (columnas.length === 0) {
      delete siguiente[fila];
    } else {
      siguiente[fila] = this.multiple() ? columnas : columnas[0];
    }
    this.value.set(siguiente);
    this.formBridge.emitChange(siguiente);
    this.formBridge.emitTouched();
  }
}
