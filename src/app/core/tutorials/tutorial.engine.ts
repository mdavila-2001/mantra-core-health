import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { TutorialProgressStore } from './tutorial-progress.store';
import { TutorialRegistry } from './tutorial.registry';
import type {
  TutorialDefinition,
  TutorialStep,
  TutorialStepFailure,
} from './tutorial.types';

/** Cuánto se espera por defecto a un elemento que todavía no está. */
const ESPERA_POR_DEFECTO_MS = 4000;

/** Cada cuánto se vuelve a buscar el elemento mientras se espera. */
const INTERVALO_DE_BUSQUEDA_MS = 120;

/** El atributo por el que se identifican los objetivos. */
export const TUTORIAL_TARGET_ATTR = 'data-tutorial-id';

/** El paso que se está mostrando, con todo lo que la capa visual necesita. */
export interface TutorialActiveStep {
  readonly tutorial: TutorialDefinition;
  readonly step: TutorialStep;
  /** Base 1: es lo que se muestra («paso 3 de 8»). */
  readonly index: number;
  readonly total: number;
  /** El elemento resaltado, o `null` si el paso no ancla en ninguno. */
  readonly element: HTMLElement | null;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

/**
 * El motor: qué paso se está mostrando y cómo se pasa al siguiente.
 *
 * ## Un solo tutorial a la vez
 *
 * Empezar uno mientras corre otro **cierra el anterior** en vez de encolarlo.
 * Dos recorridos superpuestos no se pueden dibujar y tampoco se pueden entender:
 * el estado es un paso activo o ninguno, y esa simplicidad es lo que hace que el
 * resto del motor quepa en la cabeza.
 *
 * ## Nada de esto bloquea
 *
 * Buscar el elemento, navegar a otra ruta, esperar a que aparezca algo: todo
 * está acotado en tiempo. Si el elemento no llega, el paso **se salta** y queda
 * anotado en `failures()`. Un tutorial que se cuelga esperando un botón que
 * alguien borró hace tres meses es peor que uno al que le falta un paso.
 *
 * ## Por qué el motor toca el DOM directamente
 *
 * Porque el objetivo de un paso es un elemento de **otro** componente, que no
 * sabe que existe un tutorial. Pedirle a cada pantalla que exponga referencias
 * sería acoplar toda la aplicación al motor; buscar por atributo no acopla nada
 * y el `data-tutorial-id` es un contrato explícito de una sola dirección.
 */
@Injectable({ providedIn: 'root' })
export class TutorialEngine {
  private readonly registry = inject(TutorialRegistry);
  private readonly progress = inject(TutorialProgressStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly tutorialActivo = signal<TutorialDefinition | null>(null);
  private readonly indice = signal(0);
  private readonly elemento = signal<HTMLElement | null>(null);
  private readonly buscando = signal(false);
  private readonly fallos = signal<readonly TutorialStepFailure[]>([]);

  /** Los pasos que no se pudieron mostrar. Diagnóstico, no error visible. */
  readonly failures = this.fallos.asReadonly();

  /** Si hay un recorrido en curso. */
  readonly isRunning = computed(() => this.tutorialActivo() !== null);

  /** Mientras se espera a un elemento: la capa visual muestra que está buscando. */
  readonly isSearching = this.buscando.asReadonly();

  /** El paso activo, o `null`. Es todo lo que la capa visual consume. */
  readonly activeStep = computed<TutorialActiveStep | null>(() => {
    const tutorial = this.tutorialActivo();
    if (tutorial === null) {
      return null;
    }
    const indice = this.indice();
    const step = tutorial.steps[indice];
    if (step === undefined) {
      return null;
    }
    return {
      tutorial,
      step,
      index: indice + 1,
      total: tutorial.steps.length,
      element: this.elemento(),
      isFirst: indice === 0,
      isLast: indice === tutorial.steps.length - 1,
    };
  });

  /** De 0 a 1. Para la barra del globo. */
  readonly progressRatio = computed(() => {
    const activo = this.activeStep();
    return activo === null ? 0 : activo.index / activo.total;
  });

  /**
   * Empieza un tutorial.
   *
   * `desdeElPrincipio` en `false` retoma donde quedó, que es lo que hace el
   * botón «Continuar». Si el paso guardado ya no existe —el tutorial cambió de
   * versión— se arranca de cero en vez de fallar: el progreso viejo apunta a un
   * recorrido que ya no es este.
   */
  async start(tutorialId: string, desdeElPrincipio = true): Promise<boolean> {
    const tutorial = this.registry.find(tutorialId);
    if (tutorial === null) {
      return false;
    }

    // Empezar uno cierra el anterior: dos recorridos a la vez no se dibujan ni
    // se entienden. Se cierra como omitido, que es lo que de hecho pasó.
    if (this.tutorialActivo() !== null) {
      this.skip();
    }

    const guardado = this.progress.of(tutorialId);
    const retomado = desdeElPrincipio
      ? 0
      : Math.max(
          0,
          tutorial.steps.findIndex((paso) => paso.id === guardado.stepId),
        );

    this.tutorialActivo.set(tutorial);
    this.indice.set(retomado);
    this.fallos.set([]);
    this.progress.started(tutorial, tutorial.steps[retomado]?.id ?? '');

    await this.preparar();
    return true;
  }

  /** Avanza. En el último paso, termina. */
  async next(): Promise<void> {
    const activo = this.activeStep();
    if (activo === null) {
      return;
    }
    if (activo.isLast) {
      this.complete();
      return;
    }
    this.indice.update((valor) => valor + 1);
    const siguiente = this.tutorialActivo()?.steps[this.indice()];
    if (siguiente !== undefined) {
      this.progress.advanced(activo.tutorial.id, siguiente.id);
    }
    await this.preparar();
  }

  /** Retrocede. En el primero no hace nada: no hay a dónde volver. */
  async previous(): Promise<void> {
    if (this.indice() === 0) {
      return;
    }
    this.indice.update((valor) => valor - 1);
    const activo = this.tutorialActivo();
    const paso = activo?.steps[this.indice()];
    if (activo !== undefined && activo !== null && paso !== undefined) {
      this.progress.advanced(activo.id, paso.id);
    }
    await this.preparar();
  }

  /** Se abandona a la mitad. Queda como omitido **con el paso**, para continuar. */
  skip(): void {
    const activo = this.activeStep();
    if (activo === null) {
      return;
    }
    this.progress.skipped(activo.tutorial.id, activo.step.id);
    this.limpiar();
  }

  /** Se terminó. Devuelve el tutorial encadenado, si lo hay. */
  complete(): string | null {
    const activo = this.activeStep();
    if (activo === null) {
      return null;
    }
    this.progress.completed(activo.tutorial);
    const siguiente = activo.tutorial.next ?? null;
    this.limpiar();
    return siguiente;
  }

  /**
   * Vuelve a resolver el elemento del paso actual.
   *
   * La capa visual la llama cuando la ventana cambia de tamaño o el contenido se
   * mueve: la posición del globo se calcula sobre el rectángulo del elemento, y
   * un rectángulo viejo deja el globo señalando al vacío.
   */
  async refresh(): Promise<void> {
    await this.preparar();
  }

  /**
   * Deja el paso listo: navega si hace falta y resuelve el elemento.
   *
   * El orden importa. Primero la ruta —si el paso vive en otra pantalla, el
   * elemento no puede estar todavía—, después la espera por el elemento. Al
   * revés se esperaría cuatro segundos por algo que no podía aparecer.
   */
  private async preparar(): Promise<void> {
    const activo = this.activeStep();
    if (activo === null) {
      return;
    }
    const { tutorial, step } = activo;

    const destino = step.route ?? (activo.isFirst ? tutorial.route : undefined);
    if (destino !== undefined && !this.router.url.startsWith(destino)) {
      const llego = await this.router.navigateByUrl(destino).catch(() => false);
      if (!llego) {
        this.anotarFallo(tutorial.id, step.id, 'ruta-inalcanzable');
        await this.next();
        return;
      }
    }

    if (step.target === undefined) {
      this.soltarEscuchas();
      this.elemento.set(null);
      return;
    }

    this.buscando.set(true);
    const encontrado = await this.esperarElemento(
      step.target,
      step.waitForTargetMs ?? ESPERA_POR_DEFECTO_MS,
    );
    this.buscando.set(false);

    if (encontrado === null) {
      // No se rompe nada: se anota y se sigue. Un paso menos es recuperable;
      // un recorrido colgado, no.
      this.anotarFallo(tutorial.id, step.id, 'sin-elemento');
      await this.next();
      return;
    }

    this.elemento.set(encontrado);
    encontrado.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    this.escucharLaAccion(step, encontrado);
  }

  /**
   * Engancha lo que el paso espera que la persona haga.
   *
   * Es lo que separa un recorrido guiado de una **práctica**: se aprende
   * haciendo, no mirando pasar globos. El paso avanza cuando la acción ocurre de
   * verdad sobre el elemento real, así que lo que se practicó es lo que después
   * hay que hacer.
   *
   * Los escuchas se registran con `once` y además se limpian al preparar el paso
   * siguiente: sin lo segundo, retroceder y volver a avanzar dejaría dos
   * escuchas sobre el mismo elemento y el recorrido saltaría de a dos pasos.
   *
   * No hay validación de negocio acá **a propósito**. El motor comprueba que la
   * acción ocurrió, no que su resultado sea correcto: decidir si un formulario
   * es válido es del formulario, y duplicar esa regla en una configuración de
   * tutorial es garantizar que las dos se separen.
   */
  private escucharLaAccion(step: TutorialStep, elemento: HTMLElement): void {
    this.soltarEscuchas();

    const avanzar = (): void => {
      // Sólo si el paso sigue siendo este: una acción tardía sobre el elemento
      // de un paso que ya pasó no puede empujar el recorrido.
      if (this.activeStep()?.step.id === step.id) {
        void this.next();
      }
    };

    if (step.advanceOn === 'click') {
      elemento.addEventListener('click', avanzar, { once: true });
      this.soltar = () => elemento.removeEventListener('click', avanzar);
      return;
    }

    if (step.advanceOn === 'input') {
      // `change` además de `input` porque un `<select>` nativo no emite `input`
      // en todos los navegadores, y el selector de recurso de la agenda es
      // justamente uno de los objetivos que este modo tiene que cubrir.
      elemento.addEventListener('input', avanzar, { once: true });
      elemento.addEventListener('change', avanzar, { once: true });
      this.soltar = () => {
        elemento.removeEventListener('input', avanzar);
        elemento.removeEventListener('change', avanzar);
      };
    }
  }

  /** Cancela el escucha del paso anterior, si quedaba alguno. */
  private soltarEscuchas(): void {
    this.soltar?.();
    this.soltar = null;
  }

  /** Cómo cancelar el escucha activo. `null` cuando el paso no espera acciones. */
  private soltar: (() => void) | null = null;

  /**
   * Busca el elemento, reintentando hasta el plazo.
   *
   * Sondeo y no `MutationObserver`: el elemento puede aparecer por un cambio de
   * atributo, por una plantilla que se re-renderiza o por un `@defer` que
   * resuelve, y un observador que cubra todos esos casos termina observando el
   * documento entero. Ocho sondeos por segundo durante cuatro segundos es
   * despreciable al lado de eso.
   */
  private esperarElemento(target: string, plazoMs: number): Promise<HTMLElement | null> {
    const buscar = (): HTMLElement | null =>
      this.document.querySelector<HTMLElement>(`[${TUTORIAL_TARGET_ATTR}="${target}"]`);

    const inmediato = buscar();
    if (inmediato !== null) {
      return Promise.resolve(inmediato);
    }

    return new Promise((resolver) => {
      const limite = Date.now() + plazoMs;
      const reloj = setInterval(() => {
        const encontrado = buscar();
        if (encontrado !== null) {
          clearInterval(reloj);
          resolver(encontrado);
          return;
        }
        if (Date.now() >= limite) {
          clearInterval(reloj);
          resolver(null);
        }
      }, INTERVALO_DE_BUSQUEDA_MS);
    });
  }

  private anotarFallo(
    tutorialId: string,
    stepId: string,
    reason: TutorialStepFailure['reason'],
  ): void {
    this.fallos.update((previos) => [...previos, { tutorialId, stepId, reason }]);
  }

  private limpiar(): void {
    this.soltarEscuchas();
    this.tutorialActivo.set(null);
    this.indice.set(0);
    this.elemento.set(null);
    this.buscando.set(false);
  }
}
