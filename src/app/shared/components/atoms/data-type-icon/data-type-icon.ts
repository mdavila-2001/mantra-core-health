import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * El ícono del tipo de dato de un campo de formulario.
 *
 * ```html
 * <app-data-type-icon [tipo]="campo.dataType" />
 * ```
 *
 * ## Por qué acepta cualquier cadena
 *
 * Porque `dataType` viaja como texto del backend y el catálogo técnico es más
 * largo que lo que un generador de formularios ofrece: `uuid`, `json`,
 * `binary`, `reference`, `code`… y además el simulador del catálogo clínico usa
 * las mayúsculas del seed (`NUMBER`, `TEXT`, `BOOLEAN`). Cerrar el tipo aquí
 * obligaría a traducir en cada llamador y dejaría sin ícono justo a los campos
 * que vienen del estándar.
 *
 * Lo que no se reconoce cae en el ícono de texto, que es el tipo por defecto de
 * todo campo: es un valor honesto, no un hueco.
 *
 * ## Cada dibujo es el control con el que se completa
 *
 * Igual que `question-type-icon`: los renglones de un texto, el `123` de un
 * número, la casilla de un sí/no, el almanaque de una fecha. Se reconocen sin
 * leer la etiqueta, que es lo único que un ícono aporta.
 *
 * Siempre `aria-hidden`: el nombre del campo va escrito al lado.
 */
@Component({
  selector: 'app-data-type-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'icono-tipo-dato',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (familia()) {
        @case ('parrafo') {
          <!-- Caja con varios renglones: un texto largo. -->
          <rect x="3" y="5" width="18" height="14" rx="2.2" />
          <path d="M6.6 9.6h10.8M6.6 12.6h10.8M6.6 15.6h5.4" />
        }
        @case ('numero') {
          <!-- La almohadilla: el signo de «número» en cualquier formulario. -->
          <path d="M9.2 3.6 7.4 20.4M16.6 3.6l-1.8 16.8" />
          <path d="M4.4 8.8h15.6M3.8 15.2h15.6" />
        }
        @case ('booleano') {
          <!-- Casilla marcada: se responde sí o no. -->
          <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3" />
          <path d="m7.8 12.2 2.8 2.8 5.6-6" />
        }
        @case ('fecha') {
          <!-- Almanaque con un día señalado. -->
          <rect x="3.2" y="5" width="17.6" height="16" rx="2.4" />
          <path d="M3.2 9.8h17.6" />
          <path d="M8.2 3v4M15.8 3v4" />
          <path d="M8.4 14h.01M12 14h.01M15.6 14h.01M8.4 17.4h.01M12 17.4h.01" />
        }
        @case ('eleccion') {
          <!-- Tres círculos en columna con el del medio marcado: se elige una
               de varias. Redondos y no cuadrados, que es la convención que
               separa «una sola» de «varias» en cualquier formulario. -->
          <circle cx="5.4" cy="6.4" r="2.2" />
          <circle cx="5.4" cy="12" r="2.2" />
          <circle cx="5.4" cy="17.6" r="2.2" />
          <circle cx="5.4" cy="12" r=".9" fill="currentColor" stroke="none" />
          <path d="M10.6 6.4h9.6M10.6 12h9.6M10.6 17.6h9.6" />
        }
        @case ('casillas') {
          <!-- Los mismos tres renglones pero con cuadrados, y dos marcados:
               se puede elegir más de una. -->
          <rect x="3.2" y="4.2" width="4.4" height="4.4" rx="1.2" />
          <rect x="3.2" y="9.8" width="4.4" height="4.4" rx="1.2" />
          <rect x="3.2" y="15.4" width="4.4" height="4.4" rx="1.2" />
          <path d="m4.2 6.4 1 1 1.4-1.6M4.2 17.6l1 1 1.4-1.6" />
          <path d="M10.6 6.4h9.6M10.6 12h9.6M10.6 17.6h9.6" />
        }
        @default {
          <!-- Una línea de escritura sobre su renglón: un texto corto. Es el
               tipo por omisión de todo campo, así que es también el genérico. -->
          <path d="M4 18.4h16" />
          <path d="M7.2 14.4V7.6a1.6 1.6 0 0 1 3.2 0v6.8" />
          <path d="M7.2 11h3.2" />
          <path d="M14 14.4V9.2a1.6 1.6 0 0 1 3.2 0v5.2" />
        }
      }
    </svg>
  `,
})
export class DataTypeIcon {
  /** El tipo tal como viene: `string`, `NUMBER`, `boolean`, `date`, `code`… */
  readonly tipo = input.required<string>();

  /**
   * Sólo para `code`: si admite varias respuestas.
   *
   * Va aparte del tipo porque en el contrato son dos cosas distintas —el tipo
   * es `code` en los dos casos y lo que cambia es la cardinalidad—, y porque
   * los círculos y los cuadrados son justamente lo que le dice a quien mira
   * cuántas puede marcar.
   */
  readonly multiple = input(false, { transform: booleanAttribute });

  protected readonly familia = computed(() => familiaDe(this.tipo(), this.multiple()));
}

/** Las familias que el set dibuja. El resto cae en texto corto. */
export type FamiliaDeDato =
  | 'texto'
  | 'parrafo'
  | 'numero'
  | 'booleano'
  | 'fecha'
  | 'eleccion'
  | 'casillas';

/**
 * De un tipo técnico a su familia visual.
 *
 * Se normaliza a minúsculas porque conviven dos vocabularios: el del contrato
 * (`string`, `integer`) y el del seed del catálogo clínico (`TEXT`, `NUMBER`).
 * Son el mismo dato escrito distinto, y un ícono que dependiera de la caja
 * dejaría sin dibujo a la mitad de los campos.
 */
export function familiaDe(tipo: string, multiple = false): FamiliaDeDato {
  const t = tipo.toLowerCase();
  if (t === 'text' || t === 'textarea') return 'parrafo';
  if (t === 'integer' || t === 'decimal' || t === 'number' || t === 'numeric') return 'numero';
  if (t === 'boolean' || t === 'bool') return 'booleano';
  if (t === 'date' || t === 'datetime' || t === 'timestamp') return 'fecha';
  // `code` es el tipo técnico de un campo de elección: el dato guardado es uno
  // de los códigos ofrecidos. Cuántos se pueden elegir no está en el tipo —es
  // la cardinalidad— y por eso viaja aparte.
  if (t === 'code' || t === 'select' || t === 'radio') {
    return multiple ? 'casillas' : 'eleccion';
  }
  return 'texto';
}
