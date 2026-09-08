import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { FactListDisposicion, Hecho } from './fact-list.types';

/**
 * La tabla campo → valor de una ficha.
 *
 * ```html
 * <app-fact-list
 *   [hechos]="[
 *     { etiqueta: 'Código', valor: unit.code, icono: 'tag' },
 *     { etiqueta: 'Sedes', valor: '1', icono: 'building' },
 *   ]"
 * />
 * ```
 *
 * ## Qué reemplaza
 *
 * Las fichas de este producto listaban sus datos como una pila de `<span>`
 * sueltos: «Sysmex XN-550», «Sede principal», «Operativo», «Próxima
 * calibración: 08/06/2027», cuatro renglones grises del mismo tamaño y sin
 * decir cuál es cuál. Se leían de arriba abajo adivinando, y dos equipos
 * seguidos no se podían comparar porque el tercer renglón de uno no era el
 * mismo dato que el tercero del otro.
 *
 * Una tabla campo → valor arregla las dos cosas a la vez: cada dato dice cómo
 * se llama, y los nombres quedan alineados, así que comparar dos fichas es
 * recorrer una columna.
 *
 * ## Por qué `<dl>` y no `<table>`
 *
 * Porque esto **no es una tabla de datos**: no hay dos ejes ni encabezados de
 * columna, hay pares de nombre y valor. `<dl>` es exactamente eso y es lo que
 * un lector de pantalla anuncia como lista de descripciones; un `<table>` de
 * dos columnas obligaría a inventar dos encabezados («Campo», «Valor») que
 * nadie necesita leer veinte veces.
 *
 * ## Las filas sin valor no se dibujan
 *
 * `valor: null` se descarta acá y no en cada llamador. Es lo que deja escribir
 * la lista entera de corrido —todos los campos posibles de la ficha— sin un
 * `@if` por campo, y lo que garantiza que ninguna ficha muestre «Sede: —».
 */
@Component({
  selector: 'app-fact-list',
  imports: [NavIcon],
  templateUrl: './fact-list.html',
  styleUrl: './fact-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"lista-hechos lista-hechos--" + disposicion()',
  },
})
export class FactList {
  /** Los pares, en el orden en que se leen. Los de valor `null` no se pintan. */
  readonly hechos = input.required<readonly Hecho[]>();

  /** Cómo se reparten. Ver `FactListDisposicion`. */
  readonly disposicion = input<FactListDisposicion>('filas');

  /**
   * Nombre accesible de la lista, cuando el encabezado de la card no alcanza.
   *
   * Vacío por omisión: dentro de una `app-card` con su `<h2>`, la lista ya está
   * bajo un encabezado y ponerle otro nombre la anunciaría dos veces.
   */
  readonly etiqueta = input('');

  protected readonly visibles = computed<readonly Hecho[]>(() =>
    this.hechos().filter((hecho) => hecho.valor !== null && hecho.valor !== ''),
  );
}
