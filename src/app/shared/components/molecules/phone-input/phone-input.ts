import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { Input } from '../../atoms/input/input';

/**
 * Prefijo internacional de Bolivia, el único que este campo compone.
 *
 * Va como constante y no como opción porque hoy no hay dónde elegir otro: el
 * producto opera en Bolivia y el número que se guarda se usa para llamar o
 * mandar un mensaje desde acá. El día que haya que aceptar un número
 * extranjero, lo que cambia es este componente —un desplegable de país delante
 * del número—, no las pantallas que lo usan.
 */
export const PREFIJO_BOLIVIA = '+591';

/** Cuántos dígitos tiene un número boliviano, fijo y sin excepciones. */
export const DIGITOS_TELEFONO_BOLIVIA = 8;

/** Cómo se agrupan esos ocho dígitos al mostrarlos: `7001 2345`. */
const CORTE_DE_GRUPO = 4;

/**
 * Campo de teléfono boliviano: el prefijo lo pone el campo, la persona escribe
 * los ocho dígitos.
 *
 * ```html
 * <app-phone-input formControlName="phone" testId="registro-telefono" />
 * ```
 *
 * ## Qué problema resuelve
 *
 * El campo era un `<input type="text">` con `+591 70012345` de marcador. Eso
 * deja tres cosas a la persona que el campo puede hacer solo, y que en el
 * registro público se pagan caro:
 *
 * - **Escribir el prefijo.** La mitad lo escribe y la mitad no, así que la base
 *   termina con `+591 70012345`, `70012345` y `591 7001-2345` como tres formas
 *   del mismo número, y buscar un paciente por su teléfono deja de funcionar.
 * - **Adivinar el formato.** Puntos, guiones, paréntesis: el patrón del backend
 *   los acepta todos, así que nadie se entera de que eligió mal hasta que otro
 *   humano lee el dato.
 * - **Teclear en el teclado equivocado.** Sin `inputmode`, el móvil abre el
 *   alfabético para escribir ocho dígitos.
 *
 * Acá el prefijo es parte del campo —se ve, no se escribe y no se puede
 * borrar—, lo que se teclea son dígitos y nada más, y se muestran agrupados
 * `7001 2345` mientras el formulario guarda `+591 70012345`, que es la forma
 * única que valida el `@Matches` del backend.
 *
 * ## Lo que se guarda no es lo que se ve
 *
 * Se ve `7001 2345`; se guarda `+591 70012345`. Es deliberado: el espacio de
 * grupo es ayuda de lectura y no dato, y persistirlo obligaría a limpiarlo en
 * cada consulta. Con el campo vacío se guarda cadena vacía —no `+591` suelto—,
 * porque un prefijo sin número es un teléfono que no existe y el alta lo
 * mandaría como si lo fuera.
 *
 * ## Por qué envuelve al átomo en vez de dibujar su propio `<input>`
 *
 * Porque el foco, el error, el estado deshabilitado y el `aria-describedby` del
 * campo ya están resueltos en `app-input`, y una copia de esa fontanería se
 * desincroniza en el primer arreglo que sólo se hace en una de las dos. Acá
 * sólo vive lo que es del teléfono: el prefijo, el filtro de dígitos y el
 * agrupado.
 */
@Component({
  selector: 'app-phone-input',
  imports: [Input],
  templateUrl: './phone-input.html',
  styleUrl: './phone-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInput),
      multi: true,
    },
  ],
})
export class PhoneInput implements ControlValueAccessor {
  readonly placeholder = input<string>('7001 2345');
  readonly hasError = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Ver `Input.testId`: el `<input>` real vive dos componentes más adentro. */
  readonly testId = input<string | null>(null);

  /** Los dígitos tecleados, sin prefijo y sin separadores. */
  private readonly digitos = signal('');

  /** Si el formulario deshabilitó el control. Ver `ValueAccessorBridge`. */
  private readonly disabledByForm = signal(false);

  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  /** Lo que ve la persona: los dígitos agrupados de a cuatro. */
  protected readonly texto = computed(() => agrupar(this.digitos()));

  protected readonly prefijo = PREFIJO_BOLIVIA;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: string | null): void {
    this.digitos.set(soloDigitos(value ?? ''));
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

  /**
   * Único punto por donde entra lo que la persona teclea.
   *
   * Se filtra a dígitos y se corta a ocho **antes** de avisar al formulario:
   * así el control nunca ve un valor que después habría que limpiar, y el
   * mensaje de error habla del número y no de los caracteres.
   */
  protected alEscribir(valor: string | number | null): void {
    const digitos = soloDigitos(String(valor ?? '')).slice(0, DIGITOS_TELEFONO_BOLIVIA);
    this.digitos.set(digitos);
    this.onChange(digitos === '' ? '' : `${PREFIJO_BOLIVIA} ${digitos}`);
  }

  protected alSalir(): void {
    this.onTouched();
  }
}

/**
 * Quita todo lo que no sea dígito y, si venía, el prefijo del país.
 *
 * El prefijo se saca acá y no en `writeValue` porque llega por dos caminos —el
 * valor que el formulario escribe y lo que alguien pega en el campo— y los dos
 * tienen que dar el mismo resultado. Se contempla `591` con y sin `+` porque es
 * como se copia un número desde una agenda.
 */
function soloDigitos(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  const sinPais = digitos.startsWith('591') ? digitos.slice(3) : digitos;
  return sinPais.slice(0, DIGITOS_TELEFONO_BOLIVIA);
}

/** `70012345` -> `7001 2345`. Ayuda de lectura, no dato. */
function agrupar(digitos: string): string {
  if (digitos.length <= CORTE_DE_GRUPO) {
    return digitos;
  }
  return `${digitos.slice(0, CORTE_DE_GRUPO)} ${digitos.slice(CORTE_DE_GRUPO)}`;
}
