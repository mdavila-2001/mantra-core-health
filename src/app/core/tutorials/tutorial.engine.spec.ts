import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { TutorialEngine } from './tutorial.engine';
import { TutorialProgressStore } from './tutorial-progress.store';
import { TutorialRegistry } from './tutorial.registry';
import type { TutorialDefinition } from './tutorial.types';

/**
 * El motor.
 *
 * Lo que estas pruebas fijan, que un refactor rompería en silencio:
 *
 * 1. **Nada bloquea.** Un elemento que no aparece salta el paso y queda anotado;
 *    un recorrido colgado esperando un botón que alguien borró es peor que uno
 *    al que le falta un paso.
 * 2. **Un solo tutorial a la vez.** Empezar uno cierra el anterior.
 * 3. **El progreso se guarda al avanzar**, no sólo al terminar: lo que hace que
 *    «continuar» signifique algo es que el paso quedó anotado.
 * 4. **Las acciones interactivas avanzan de verdad**, sobre el elemento real.
 */

/**
 * Un componente cualquiera para la ruta de prueba.
 *
 * **Vacío a propósito, y no el panel real**: `core/` no importa de `features/`
 * —lo hace cumplir `scripts/check-architecture.mjs` y la regla de lint— y para
 * lo que esta prueba mira —que el motor navegue antes de resolver el elemento—
 * qué se pinta del otro lado no cambia nada.
 */
@Component({ selector: 'app-destino-de-prueba', template: '' })
class DestinoDePrueba {}

/** Un tutorial mínimo. */
function tutorial(parcial: Partial<TutorialDefinition> = {}): TutorialDefinition {
  return {
    id: 't-1',
    version: '1.0',
    title: 'Un tutorial',
    description: 'Sirve para probar.',
    category: 'General',
    estimatedMinutes: 1,
    level: 'inicial',
    steps: [
      { id: 'p-1', title: 'Uno', body: 'a' },
      { id: 'p-2', title: 'Dos', body: 'b' },
      { id: 'p-3', title: 'Tres', body: 'c' },
    ],
    ...parcial,
  };
}

describe('TutorialEngine', () => {
  let engine: TutorialEngine;
  let registry: TutorialRegistry;
  let progress: TutorialProgressStore;
  let creados: HTMLElement[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'dashboard', component: DestinoDePrueba }])],
    });
    engine = TestBed.inject(TutorialEngine);
    registry = TestBed.inject(TutorialRegistry);
    progress = TestBed.inject(TutorialProgressStore);
    creados = [];
  });

  afterEach(() => {
    for (const elemento of creados) {
      elemento.remove();
    }
    localStorage.clear();
  });

  /** Pone en el documento un objetivo con el identificador dado. */
  function sembrarObjetivo(id: string): HTMLElement {
    const elemento = document.createElement('button');
    elemento.setAttribute('data-tutorial-id', id);
    // `scrollIntoView` no existe en jsdom y el motor lo llama al resolver.
    elemento.scrollIntoView = () => undefined;
    document.body.appendChild(elemento);
    creados.push(elemento);
    return elemento;
  }

  it('empieza en el primer paso y publica el total', async () => {
    registry.register([tutorial()]);

    expect(await engine.start('t-1')).toBe(true);

    const activo = engine.activeStep();
    expect(activo?.step.id).toBe('p-1');
    expect(activo?.index).toBe(1);
    expect(activo?.total).toBe(3);
    expect(activo?.isFirst).toBe(true);
    expect(engine.isRunning()).toBe(true);
  });

  it('no empieza un tutorial que esta sesión no puede hacer', async () => {
    registry.register([tutorial({ roles: ['PRACTITIONER'] })]);

    expect(await engine.start('t-1')).toBe(false);
    expect(engine.isRunning()).toBe(false);
  });

  it('avanza y retrocede sin salirse de los extremos', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    await engine.previous();
    expect(engine.activeStep()?.step.id).toBe('p-1');

    await engine.next();
    expect(engine.activeStep()?.step.id).toBe('p-2');

    await engine.previous();
    expect(engine.activeStep()?.step.id).toBe('p-1');
  });

  /** Lo que hace que «continuar» signifique algo es que el paso quedó anotado. */
  it('guarda el paso en cada avance, no sólo al terminar', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();

    expect(progress.of('t-1').stepId).toBe('p-2');
    expect(progress.of('t-1').status).toBe('en-curso');
  });

  it('en el último paso, avanzar termina el tutorial', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();
    await engine.next();

    expect(engine.activeStep()?.isLast).toBe(true);
    await engine.next();

    expect(engine.isRunning()).toBe(false);
    expect(progress.of('t-1').status).toBe('completado');
    expect(progress.of('t-1').repetitions).toBe(1);
  });

  it('terminar devuelve el tutorial encadenado, si lo hay', async () => {
    registry.register([tutorial({ next: 't-2' }), tutorial({ id: 't-2' })]);
    await engine.start('t-1');

    expect(engine.complete()).toBe('t-2');
  });

  /** Abandonar guarda el paso: es lo que distingue «continuar» de «empezar». */
  it('abandonar deja el tutorial omitido con su paso', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();
    engine.skip();

    expect(engine.isRunning()).toBe(false);
    expect(progress.of('t-1').status).toBe('omitido');
    expect(progress.of('t-1').stepId).toBe('p-2');
  });

  it('continuar retoma en el paso guardado', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();
    engine.skip();

    await engine.start('t-1', false);
    expect(engine.activeStep()?.step.id).toBe('p-2');
  });

  /**
   * El progreso viejo puede apuntar a un paso que ya no existe —el tutorial
   * cambió—. Arrancar de cero es preferible a fallar.
   */
  it('continuar en un paso que ya no existe arranca de cero', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    progress.advanced('t-1', 'paso-que-ya-no-esta');

    await engine.start('t-1', false);
    expect(engine.activeStep()?.step.id).toBe('p-1');
  });

  /** Dos recorridos superpuestos no se dibujan ni se entienden. */
  it('empezar un tutorial cierra el que estaba corriendo', async () => {
    registry.register([tutorial(), tutorial({ id: 't-2' })]);
    await engine.start('t-1');
    await engine.start('t-2');

    expect(engine.activeStep()?.tutorial.id).toBe('t-2');
    expect(progress.of('t-1').status).toBe('omitido');
  });

  /* ---- los elementos objetivo -------------------------------------------- */

  it('resuelve el elemento cuando ya está en la pantalla', async () => {
    const objetivo = sembrarObjetivo('boton-x');
    registry.register([
      tutorial({ steps: [{ id: 'p-1', title: 'Uno', body: 'a', target: 'boton-x' }] }),
    ]);

    await engine.start('t-1');
    expect(engine.activeStep()?.element).toBe(objetivo);
  });

  /**
   * **La regla que evita el cuelgue.** El elemento no llega —una petición que
   * falló, un botón que alguien borró— y el recorrido sigue en vez de quedarse
   * esperando para siempre.
   */
  it('un elemento que no aparece salta el paso y queda anotado', async () => {
    registry.register([
      tutorial({
        steps: [
          // Plazo corto: la prueba no debe depender del plazo por defecto.
          { id: 'p-1', title: 'Uno', body: 'a', target: 'no-existe', waitForTargetMs: 30 },
          { id: 'p-2', title: 'Dos', body: 'b' },
        ],
      }),
    ]);

    await engine.start('t-1');

    expect(engine.activeStep()?.step.id).toBe('p-2');
    expect(engine.failures()).toEqual([
      { tutorialId: 't-1', stepId: 'p-1', reason: 'sin-elemento' },
    ]);
  });

  it('espera a un elemento que aparece después', async () => {
    registry.register([
      tutorial({
        steps: [{ id: 'p-1', title: 'Uno', body: 'a', target: 'tardio', waitForTargetMs: 2000 }],
      }),
    ]);

    const empezando = engine.start('t-1');
    setTimeout(() => sembrarObjetivo('tardio'), 150);
    await empezando;

    expect(engine.activeStep()?.element).not.toBeNull();
    expect(engine.failures()).toHaveLength(0);
  });

  it('un paso sin objetivo no ancla en ningún elemento', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    expect(engine.activeStep()?.element).toBeNull();
  });

  /* ---- las acciones interactivas ----------------------------------------- */

  /** Es lo que separa un recorrido guiado de una práctica. */
  it('un paso de clic avanza al hacer clic en el elemento real', async () => {
    const objetivo = sembrarObjetivo('boton-x');
    registry.register([
      tutorial({
        steps: [
          { id: 'p-1', title: 'Uno', body: 'a', target: 'boton-x', advanceOn: 'click' },
          { id: 'p-2', title: 'Dos', body: 'b' },
        ],
      }),
    ]);
    await engine.start('t-1');

    objetivo.click();
    await Promise.resolve();

    expect(engine.activeStep()?.step.id).toBe('p-2');
  });

  /**
   * `change` además de `input`: un `<select>` nativo no emite `input` en todos
   * los navegadores, y el selector de ventana de la agenda es uno de los
   * objetivos que este modo tiene que cubrir.
   */
  it('un paso de escritura avanza con `change`, no sólo con `input`', async () => {
    const objetivo = sembrarObjetivo('campo-x');
    registry.register([
      tutorial({
        steps: [
          { id: 'p-1', title: 'Uno', body: 'a', target: 'campo-x', advanceOn: 'input' },
          { id: 'p-2', title: 'Dos', body: 'b' },
        ],
      }),
    ]);
    await engine.start('t-1');

    objetivo.dispatchEvent(new Event('change'));
    await Promise.resolve();

    expect(engine.activeStep()?.step.id).toBe('p-2');
  });

  /**
   * Retroceder y volver a avanzar dejaba dos escuchas sobre el mismo elemento, y
   * el recorrido saltaba de a dos pasos.
   */
  it('no acumula escuchas al ir y volver sobre un paso interactivo', async () => {
    const objetivo = sembrarObjetivo('boton-x');
    registry.register([
      tutorial({
        steps: [
          { id: 'p-1', title: 'Uno', body: 'a', target: 'boton-x', advanceOn: 'click' },
          { id: 'p-2', title: 'Dos', body: 'b' },
          { id: 'p-3', title: 'Tres', body: 'c' },
        ],
      }),
    ]);
    await engine.start('t-1');
    await engine.next();
    await engine.previous();

    objetivo.click();
    await Promise.resolve();

    expect(engine.activeStep()?.step.id).toBe('p-2');
  });

  /* ---- navegación entre rutas ------------------------------------------- */

  it('navega a la ruta del tutorial antes del primer paso', async () => {
    const router = TestBed.inject(Router);
    registry.register([tutorial({ route: '/dashboard' })]);

    await engine.start('t-1');

    expect(router.url).toBe('/dashboard');
  });
});
