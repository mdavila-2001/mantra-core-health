import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

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

/** El atributo con el que la plantilla marca el botón de la acción principal. */
export const ACCION_PRIMARIA = 'data-accion-primaria';

/**
 * Apila las acciones del formulario cuando no entran en un renglón: la
 * primaria arriba y a todo el ancho, las demás debajo.
 *
 * Con `flex-wrap` solo, a 390 px quedaban en escalera —«Atrás» arriba a la
 * izquierda y el envío debajo, sin ocupar el ancho— y a 320 de otra forma. El
 * CSS no sabe si una fila envolvió, así que se mide.
 *
 * ## El orden de lectura es el orden visual
 *
 * Invertir la columna con `column-reverse` dibujaba el envío arriba pero el
 * tabulador seguía en el orden del DOM: contraseña → «Atrás» → envío (WCAG
 * 2.4.3, 1.3.2). Cuando se apila, esta directiva **mueve** el botón principal
 * al principio del DOM, y lo devuelve a su lugar cuando vuelven a entrar en un
 * renglón: ancho, «Atrás» queda a la izquierda y el envío a la derecha, en ese
 * orden también para el teclado. Un marcador (comentario) guarda el sitio de
 * origen; el botón se mueve sin recrearse, así que sus eventos y su estado
 * siguen donde estaban, y si tenía el foco se lo devuelve.
 *
 * ## Cuándo mide
 *
 * Un `ResizeObserver` sobre la barra **no puede** cambiar la barra dentro de su
 * propio callback: el navegador lo detecta como bucle («ResizeObserver loop
 * completed with undelivered notifications») y el `ErrorHandler` global lo
 * registra. Por eso la medición se difiere a un `requestAnimationFrame`,
 * cancelando la pendiente. También observa los cambios de sus hijos
 * (`MutationObserver`): el rótulo del envío cambia en la última página sin que
 * la barra cambie de tamaño. Sus propias mutaciones se descartan con
 * `takeRecords()` para que no se llamen a sí mismas.
 */
@Directive({ selector: '[appApilarAlEnvolver]' })
export class ApilarAlEnvolver {
  /** La clase que apila: la define la hoja de quien usa la directiva. */
  readonly appApilarAlEnvolver = input.required<string>();

  private readonly barra = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private marcador: Comment | null = null;
  private movido: HTMLElement | null = null;
  private pendiente: number | null = null;
  private mutaciones: MutationObserver | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const tamano = new ResizeObserver(() => this.programar());
      tamano.observe(this.barra);
      this.mutaciones = new MutationObserver(() => this.programar());
      this.mutaciones.observe(this.barra, { childList: true, subtree: true, characterData: true });
      this.programar();
      destroyRef.onDestroy(() => {
        tamano.disconnect();
        this.mutaciones?.disconnect();
        if (this.pendiente !== null) cancelAnimationFrame(this.pendiente);
        this.devolver();
      });
    });
  }

  private programar(): void {
    if (this.pendiente !== null) cancelAnimationFrame(this.pendiente);
    this.pendiente = requestAnimationFrame(() => {
      this.pendiente = null;
      this.medir();
    });
  }

  private medir(): void {
    const clase = this.appApilarAlEnvolver();
    const activo = document.activeElement;
    const teniaFoco = activo instanceof HTMLElement && this.barra.contains(activo) ? activo : null;

    // Con el DOM como está y sin apilar: ¿envuelven?
    this.barra.classList.remove(clase);
    const botones = [...this.barra.children].filter(
      (hijo): hijo is HTMLElement => hijo instanceof HTMLElement && hijo.offsetParent !== null,
    );
    const primero = botones[0];
    // Otro renglón es empezar por debajo del primer botón entero, no un par de
    // píxeles más abajo (botones de distinta altura en la misma fila).
    const envuelve =
      primero !== undefined &&
      botones.some((boton) => boton.offsetTop >= primero.offsetTop + primero.offsetHeight);

    if (envuelve) {
      this.barra.classList.add(clase);
      this.subirLaPrimaria();
    } else {
      this.devolver();
    }

    this.mutaciones?.takeRecords();
    if (teniaFoco !== null && teniaFoco.isConnected && document.activeElement !== teniaFoco) {
      teniaFoco.focus({ preventScroll: true });
    }
  }

  /** Pone el botón principal primero en el DOM, dejando un marcador donde estaba. */
  private subirLaPrimaria(): void {
    const primaria = this.barra.querySelector<HTMLElement>(`:scope > [${ACCION_PRIMARIA}]`);
    if (primaria === null || primaria === this.movido) return;
    this.devolver();
    this.marcador = document.createComment('accion-primaria');
    primaria.before(this.marcador);
    this.movido = primaria;
    this.barra.prepend(primaria);
  }

  /** Devuelve el botón principal a su sitio, si Angular no lo cambió mientras tanto. */
  private devolver(): void {
    const { marcador, movido } = this;
    this.marcador = null;
    this.movido = null;
    if (marcador === null) return;
    if (marcador.isConnected && movido?.isConnected === true && movido.parentNode === this.barra) {
      marcador.replaceWith(movido);
    } else {
      marcador.remove();
    }
  }
}
