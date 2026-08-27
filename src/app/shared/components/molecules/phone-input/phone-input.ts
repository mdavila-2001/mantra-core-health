import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { Input } from '../../atoms/input/input';
import { PaisBandera } from './pais-bandera';
import {
  PAISES_TELEFONO,
  PAIS_POR_DEFECTO,
  agrupar,
  ejemploDe,
  nacionalDelNumero,
  paisDelNumero,
  type PaisTelefono,
} from './phone-input.paises';

export { PAISES_TELEFONO, PAIS_POR_DEFECTO } from './phone-input.paises';
export type { IsoPais, PaisTelefono } from './phone-input.paises';

/** Prefijo internacional de Bolivia, el país por defecto del campo. */
export const PREFIJO_BOLIVIA = PAIS_POR_DEFECTO.prefijo;

/** Cuántos dígitos tiene un número boliviano. */
export const DIGITOS_TELEFONO_BOLIVIA = PAIS_POR_DEFECTO.digitos;

/** Ver `idLista`: un id por instancia, para que `aria-controls` apunte bien. */
let siguienteId = 0;

/**
 * Campo de teléfono: el país se elige, la persona escribe el número nacional.
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
 * ## Por qué ahora se elige el país
 *
 * La versión anterior fijaba `+591` como constante, con esta nota: «el día que
 * haya que aceptar un número extranjero, lo que cambia es este componente —un
 * desplegable de país delante del número—, no las pantallas que lo usan». Ese
 * día llegó, y la promesa se cumple: **ninguna pantalla cambió**. El campo
 * sigue exponiendo un `ControlValueAccessor` de string y sigue abriendo en
 * Bolivia; lo único nuevo es que se puede cambiar.
 *
 * El catálogo es corto y cerrado a propósito — ver `phone-input.paises.ts`.
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
 * sólo vive lo que es del teléfono: el país, el filtro de dígitos y el
 * agrupado.
 */
@Component({
  selector: 'app-phone-input',
  imports: [Input, PaisBandera],
  templateUrl: './phone-input.html',
  styleUrl: './phone-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'alApuntarFuera($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInput),
      multi: true,
    },
  ],
})
export class PhoneInput implements ControlValueAccessor {
  /**
   * El marcador. Por defecto es el número de ejemplo del país elegido, así que
   * al cambiar de país cambia solo: un marcador boliviano en un campo argentino
   * enseña un largo que ese país no usa.
   */
  readonly placeholder = input<string | null>(null);
  readonly hasError = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Ver `Input.testId`: el `<input>` real vive dos componentes más adentro. */
  readonly testId = input<string | null>(null);

  protected readonly paises = PAISES_TELEFONO;
  protected readonly idLista = `paises-${(siguienteId += 1)}`;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');

  /** El país elegido. Abre en Bolivia; `writeValue` lo corrige si el valor trae otro. */
  protected readonly pais = signal<PaisTelefono>(PAIS_POR_DEFECTO);

  /** Los dígitos tecleados, sin prefijo y sin separadores. */
  private readonly digitos = signal('');

  /** Si el formulario deshabilitó el control. Ver `ValueAccessorBridge`. */
  private readonly disabledByForm = signal(false);

  protected readonly abierto = signal(false);

  /** Qué fila está resaltada en el desplegable, para el teclado. */
  protected readonly resaltado = signal(0);

  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  /** Lo que ve la persona: los dígitos agrupados como agrupa su país. */
  protected readonly texto = computed(() => agrupar(this.digitos(), this.pais().grupos));

  protected readonly placeholderEfectivo = computed(
    () => this.placeholder() ?? ejemploDe(this.pais()),
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // Al abrir, el foco se va a la lista: sin esto las flechas seguirían
    // moviendo el cursor dentro del número y el desplegable quedaría abierto
    // sin forma de recorrerlo con el teclado.
    effect(() => {
      if (this.abierto()) {
        this.lista()?.nativeElement.focus();
      }
    });
  }

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: string | null): void {
    const crudo = value ?? '';
    const pais = paisDelNumero(crudo);
    this.pais.set(pais);
    this.digitos.set(nacionalDelNumero(crudo, pais));
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

  // --- Número --------------------------------------------------------------

  /**
   * Único punto por donde entra lo que la persona teclea.
   *
   * Se filtra a dígitos y se corta al largo del país **antes** de avisar al
   * formulario: así el control nunca ve un valor que después habría que
   * limpiar, y el mensaje de error habla del número y no de los caracteres.
   *
   * Pasa por `nacionalDelNumero` —el mismo camino que `writeValue`— para que
   * pegar `+591 70012345` desde una agenda dé exactamente lo mismo que
   * teclear `70012345`: son el mismo teléfono y tienen que terminar en el
   * mismo valor guardado.
   */
  protected alEscribir(valor: string | number | null): void {
    this.digitos.set(nacionalDelNumero(String(valor ?? ''), this.pais()));
    this.emitir();
  }

  protected alSalir(): void {
    this.onTouched();
  }

  private emitir(): void {
    const digitos = this.digitos();
    this.onChange(digitos === '' ? '' : `${this.pais().prefijo} ${digitos}`);
  }

  // --- País ----------------------------------------------------------------

  protected alternar(): void {
    if (this.isDisabled()) {
      return;
    }
    if (this.abierto()) {
      this.abierto.set(false);
      return;
    }
    this.resaltado.set(this.paises.findIndex((p) => p.iso === this.pais().iso));
    this.abierto.set(true);
  }

  /**
   * Cambiar de país recorta el número al largo del nuevo.
   *
   * Es la decisión menos mala de las dos: guardar once dígitos bajo un prefijo
   * que admite ocho produce un teléfono que no existe, y el recorte al menos se
   * ve en el campo en el momento de hacerlo.
   */
  protected elegir(pais: PaisTelefono): void {
    this.pais.set(pais);
    this.digitos.update((d) => d.slice(0, pais.digitos));
    this.abierto.set(false);
    this.emitir();
    this.onTouched();
    this.enfocarDisparador();
  }

  protected idOpcion(indice: number): string {
    return `${this.idLista}-${indice}`;
  }

  protected alTeclearEnDisparador(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.alternar();
    }
  }

  protected alTeclearEnLista(evento: KeyboardEvent): void {
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        this.resaltado.update((i) => (i + 1) % this.paises.length);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        this.resaltado.update((i) => (i - 1 + this.paises.length) % this.paises.length);
        break;
      case 'Home':
        evento.preventDefault();
        this.resaltado.set(0);
        break;
      case 'End':
        evento.preventDefault();
        this.resaltado.set(this.paises.length - 1);
        break;
      case 'Enter':
      case ' ':
        evento.preventDefault();
        this.elegir(this.paises[this.resaltado()]);
        break;
      case 'Escape':
      case 'Tab':
        // Escape no se `preventDefault`ea a ciegas: dentro de un diálogo, el
        // que cierra es el desplegable y no el diálogo, y eso sí hay que
        // frenarlo. Tab, en cambio, tiene que seguir moviendo el foco.
        if (evento.key === 'Escape') {
          evento.preventDefault();
        }
        this.abierto.set(false);
        this.enfocarDisparador();
        break;
      default:
        break;
    }
  }

  /** Un clic fuera cierra: es lo que espera cualquiera que abrió por error. */
  protected alApuntarFuera(evento: PointerEvent): void {
    if (!this.abierto()) {
      return;
    }
    const propio = this.host.nativeElement as HTMLElement;
    if (!propio.contains(evento.target as Node)) {
      this.abierto.set(false);
    }
  }

  private enfocarDisparador(): void {
    const propio = this.host.nativeElement as HTMLElement;
    propio.querySelector<HTMLButtonElement>('.pais__disparador')?.focus();
  }
}
