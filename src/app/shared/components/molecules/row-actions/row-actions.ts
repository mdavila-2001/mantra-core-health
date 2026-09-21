import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { Menu } from '../menu/menu';
import { MenuItem } from '../menu/menu-item/menu-item';
import { MenuTrigger } from '../menu/menu-trigger/menu-trigger';
import { ROW_ACTIONS_INLINE_MAX, type RowAction } from './row-actions.types';

/**
 * Las acciones de una fila, según ADR-0012.
 *
 * ```html
 * <app-row-actions
 *   [actions]="acciones"
 *   fila="la solicitud de Ana Pérez"
 *   (actionSelected)="ejecutar($event, solicitud)"
 * />
 * ```
 *
 * ## Qué resuelve
 *
 * Que la regla no se pueda aplicar mal. Hasta dos acciones se dibujan como
 * botones **con su texto** en la fila; con tres o más, la fila muestra un
 * único disparador y las acciones viven en un desplegable, cada una con su
 * texto. Quien lo usa no elige entre las dos formas: pasa la lista y la forma
 * sale de cuántas son.
 *
 * ## Por qué sobre `app-menu` y no un desplegable nuevo
 *
 * Porque `molecules/menu/` ya resolvió lo difícil, y lo difícil de un menú
 * dentro de una tabla es que el `overflow` de la tabla lo recorta: el panel
 * **se muda al `<body>`** mientras está abierto y vuelve a su lugar al
 * cerrarse. Trae además el teclado completo —flechas con vuelta, `Home`/`End`,
 * `Enter`/`Espacio`, `Escape` que cierra y **devuelve el foco** al disparador—
 * y el contrato ARIA del disparador, que lo lleva `appMenuTrigger`.
 *
 * Este componente no reimplementa nada de eso ni cambia su comportamiento por
 * omisión: lo compone.
 *
 * ## El nombre accesible dice de qué fila es
 *
 * Veinte filas con veinte botones llamados «Acciones» son veinte botones
 * indistinguibles para quien no ve la pantalla. Por eso `fila` describe a cuál
 * pertenece y el disparador se anuncia «Acciones de la solicitud de Ana
 * Pérez». Sin `fila` el botón se anuncia con su texto visible, que es lo
 * mínimo aceptable, no lo bueno.
 *
 * Vale igual para la forma en fila: veinte botones «Retirar» son tan
 * indistinguibles como veinte «Acciones». Con `fila`, cada uno se anuncia
 * «Retirar — la sede X». Ese pegado usa una raya y no «de»; el porqué está en
 * `inlineLabel`.
 */
@Component({
  selector: 'app-row-actions',
  imports: [AppButton, Menu, MenuItem, MenuTrigger, NavIcon],
  templateUrl: './row-actions.html',
  styleUrl: './row-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'row-actions',
  },
})
export class RowActions {
  readonly actions = input.required<readonly RowAction[]>();

  /**
   * De qué fila son estas acciones, en palabras: «la solicitud de Ana Pérez»,
   * «la cita del 12/07». Entra en el nombre accesible del disparador.
   */
  readonly fila = input<string>('');

  /** El texto visible del disparador cuando las acciones van al desplegable. */
  readonly label = input<string>('Acciones');

  /** Emite el `code` de la acción elegida, venga del botón o del menú. */
  readonly actionSelected = output<string>();

  /** Con tres o más, la fila no las aguanta: van al desplegable. */
  protected readonly collapses = computed(
    () => this.actions().length > ROW_ACTIONS_INLINE_MAX,
  );

  protected readonly triggerLabel = computed(() => {
    const fila = this.fila().trim();
    return fila === '' ? this.label() : `${this.label()} de ${fila}`;
  });

  /**
   * El nombre accesible de una accion dibujada en la fila.
   *
   * Sin `fila` devuelve `null`, y entonces el nombre es el texto visible, que
   * es lo correcto: un `aria-label` que repite el texto solo agrega ruido.
   *
   * Con `fila` se pega con una raya y no con «de», al reves que el disparador.
   * No es un capricho: el texto del disparador es un sustantivo puesto por
   * este componente («Acciones»), y «Acciones de la sede X» se lee natural; el
   * de una accion es una frase verbal que escribe quien lo usa —«Dejar de
   * atender»— y ninguna preposicion fija sirve para todas. La raya se lee como
   * una pausa y no le impone gramatica al texto ajeno.
   *
   * El texto visible queda dentro del nombre accesible, que es lo que pide
   * WCAG 2.5.3: quien dicta por voz lo que ve sigue pudiendo activarlo.
   */
  protected inlineLabel(action: RowAction): string | null {
    const fila = this.fila().trim();
    return fila === '' ? null : `${action.label} — ${fila}`;
  }

  protected select(action: RowAction): void {
    if (action.disabled) {
      return;
    }
    this.actionSelected.emit(action.code);
  }
}
