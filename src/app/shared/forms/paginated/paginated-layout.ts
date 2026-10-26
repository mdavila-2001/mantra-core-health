import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
} from '@angular/core';

import type { CampoDeFormulario } from './paginated-form.types';

/**
 * Cuántas columnas lleva un grupo de opciones en rejilla (`opcionesEn:
 * 'rejilla'`), en un campo ancho y en uno mediano.
 *
 * Fijas y no `auto-fill`: con pistas automáticas, «Otra institución de salud»
 * partía en dos líneas al lado de 200-750 px de pistas vacías (1366, 1920), y
 * a 1024 quedaba 4 + 1 suelta. Con el número de opciones se reparte sin
 * huérfanas:
 *
 * - **ancho**: todas en una fila hasta cinco; con más, de a tres;
 * - **mediano**: hasta tres en una fila; cuatro van 2 + 2; cinco o más, de a
 *   tres (3 + 2, 3 + 3…).
 *
 * El corte entre ancho y mediano lo pone `paginated-form.css` con una consulta
 * de contenedor sobre el campo, no sobre la ventana.
 */
export function columnasDeOpciones(campo: CampoDeFormulario): { ancha: number; media: number } {
  const total = Math.max(1, campo.options?.length ?? 1);
  return {
    ancha: total <= 5 ? total : 3,
    media: total <= 3 ? total : total === 4 ? 2 : 3,
  };
}

/**
 * Apila las acciones del formulario cuando no entran en un renglón: la
 * primaria arriba y a todo el ancho, la secundaria debajo.
 *
 * Con `flex-wrap` solo, a 390 px quedaban en escalera —«Atrás» arriba a la
 * izquierda y el envío debajo, sin ocupar el ancho— y a 320 de otra forma. El
 * CSS no sabe si una fila envolvió, así que se mide: sin la clase, si algún
 * botón quedó en otro renglón que el primero, se pone. Lo vuelve a preguntar
 * cada vez que la barra cambia de tamaño (otro ancho, otro rótulo en la última
 * página). Si los botones entran, la barra no cambia en nada.
 */
@Directive({ selector: '[appApilarAlEnvolver]' })
export class ApilarAlEnvolver {
  /** La clase que apila: la define la hoja de quien usa la directiva. */
  readonly appApilarAlEnvolver = input.required<string>();

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(() => this.medir());
      observador.observe(this.elemento);
      this.medir();
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  private medir(): void {
    const clase = this.appApilarAlEnvolver();
    const barra = this.elemento;
    barra.classList.remove(clase);
    const botones = [...barra.children].filter(
      (hijo): hijo is HTMLElement => hijo instanceof HTMLElement && hijo.offsetParent !== null,
    );
    const primero = botones[0];
    // Otro renglón es empezar por debajo del primer botón entero, no un par de
    // píxeles más abajo (botones de distinta altura en la misma fila).
    const envuelve =
      primero !== undefined &&
      botones.some((boton) => boton.offsetTop >= primero.offsetTop + primero.offsetHeight);
    barra.classList.toggle(clase, envuelve);
  }
}
