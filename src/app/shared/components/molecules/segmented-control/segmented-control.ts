import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChildren,
} from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { SegmentedOption } from './segmented-control.types';

/**
 * Selector de vista: dos o más opciones excluyentes con forma de botón.
 *
 * ## Por qué existe (FT-04)
 *
 * En «Mis citas», «Lista» y «Calendario» eran dos `app-button` sueltos, y el
 * inactivo iba en variante `ghost` —sin fondo ni borde—. El resultado era que
 * la opción que **no** estaba puesta no se veía como un botón sino como texto,
 * así que no se descubría que hubiera otra vista. El pedido del cliente fue
 * literal: que se vean y se comporten como un selector de dos botones.
 *
 * Se resuelve una vez y en el sistema de diseño, no en la pantalla: el mismo
 * control lo necesitan los directorios («mapa» / «lista») y cualquier vista con
 * dos representaciones de la misma colección. Dos selectores que se ven
 * distinto en dos pantallas son dos productos.
 *
 * ## Accesibilidad
 *
 * Es un `radiogroup`, no un grupo de interruptores: elegir «Calendario»
 * **deselecciona** «Lista», que es exactamente la semántica de un radio y no la
 * de dos `aria-pressed` independientes. De ahí salen gratis el anuncio correcto
 * («Lista, 1 de 2, seleccionado») y el recorrido con flechas.
 *
 * Tabulación rodante: un solo `tabindex="0"` —el de la opción activa— para que
 * Tab entre y salga del control en un paso, y las flechas muevan dentro. A
 * diferencia de las pestañas, acá la activación es **automática**: mover con la
 * flecha cambia la vista, porque es lo que un radiogroup hace y no dispara
 * ninguna carga cara.
 *
 * ```html
 * <app-segmented-control
 *   [options]="vistas"
 *   [value]="vista()"
 *   ariaLabel="Cómo ver tus citas"
 *   (valueChange)="elegirVista($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-segmented-control',
  imports: [NavIcon],
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedControl<T extends string = string> {
  readonly options = input.required<readonly SegmentedOption<T>[]>();
  readonly value = input.required<T>();

  /** Qué se está eligiendo. Obligatorio: un radiogroup sin nombre no se anuncia. */
  readonly ariaLabel = input.required<string>();

  /** `sm` para barras de herramientas; `md` cuando el control encabeza la vista. */
  readonly size = input<'sm' | 'md'>('sm');

  readonly valueChange = output<T>();

  private readonly botones = viewChildren<ElementRef<HTMLButtonElement>>('opcion');

  /**
   * Índice de la opción activa, o `-1` si **ninguna** lo está.
   *
   * Ninguna activa es un estado legítimo y no un error: una pregunta de sí/no
   * todavía sin responder no tiene por qué mostrar «Sí» apretado. Antes esto
   * devolvía `0` ante un valor desconocido, así que un control sin respuesta se
   * dibujaba con la primera opción elegida —y decía, además, `aria-checked` en
   * ella—: la persona veía contestado lo que no contestó.
   *
   * Los selectores de vista que ya usaban el control pasan siempre un valor de
   * la lista, así que para ellos no cambia nada.
   */
  protected readonly activo = computed(() =>
    this.options().findIndex((opcion) => opcion.value === this.value()),
  );

  /**
   * Qué opción entra en el orden de tabulación.
   *
   * La activa, y la primera cuando no hay ninguna: un radiogroup sin nada
   * marcado se tabula por su primer radio —lo dice la guía de ARIA— y dejar
   * todos en `-1` sacaría el control del recorrido del teclado, que es peor que
   * cualquier cosa que esto resuelva.
   */
  protected readonly enfocable = computed(() => Math.max(this.activo(), 0));

  protected elegir(opcion: SegmentedOption<T>): void {
    if (opcion.disabled === true || opcion.value === this.value()) {
      return;
    }
    this.valueChange.emit(opcion.value);
  }

  /**
   * Flechas y Home/End mueven **y eligen**, con vuelta al otro extremo.
   *
   * Espacio también elige, porque es lo que un radio hace aunque acá el foco ya
   * implique la selección: quien viene de un formulario lo va a intentar.
   */
  protected alTeclado(event: KeyboardEvent, desde: number): void {
    const destino = this.siguiente(event.key, desde);
    if (destino === null) {
      if (event.key === ' ') {
        event.preventDefault();
        this.elegir(this.options()[desde]);
      }
      return;
    }
    event.preventDefault();
    const opcion = this.options()[destino];
    // `preventScroll: true`: sin él, el navegador reencuadra el contenedor
    // scrolleable (el control suele vivir dentro de un modal) cada vez que una
    // flecha mueve el foco entre «Sí» y «No», y la pantalla salta aunque el
    // control ya estuviera a la vista.
    this.botones()[destino]?.nativeElement.focus({ preventScroll: true });
    this.elegir(opcion);
  }

  private siguiente(key: string, desde: number): number | null {
    const utilizables = this.options()
      .map((opcion, indice) => ({ opcion, indice }))
      .filter(({ opcion }) => opcion.disabled !== true)
      .map(({ indice }) => indice);
    if (utilizables.length === 0) {
      return null;
    }
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return this.paso(utilizables, desde, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
        return this.paso(utilizables, desde, -1);
      case 'Home':
        return utilizables[0];
      case 'End':
        return utilizables[utilizables.length - 1];
      default:
        return null;
    }
  }

  private paso(utilizables: readonly number[], desde: number, direccion: 1 | -1): number {
    const posicion = utilizables.indexOf(desde);
    if (posicion < 0) {
      return utilizables[0];
    }
    return utilizables[(posicion + direccion + utilizables.length) % utilizables.length];
  }
}
