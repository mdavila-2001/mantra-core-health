import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TutorialEngine } from '../../../../core/tutorials/tutorial.engine';
import { TutorialRegistry } from '../../../../core/tutorials/tutorial.registry';
import type { TutorialDefinition } from '../../../../core/tutorials/tutorial.types';
import { DialogService } from '../../molecules/dialog/dialog-service';
import { TutorialOverlay } from './tutorial-overlay';

/**
 * La capa visual del motor.
 *
 * Lo que estas pruebas fijan, que es sobre todo accesibilidad:
 *
 * 1. **El progreso se dice con palabras**, no sólo con la barra: una barra no se
 *    escucha, y el color solo tampoco alcanza.
 * 2. **`Escape` pregunta antes de abandonar** salvo en el primer paso, donde no
 *    hay nada que perder.
 * 3. **Las flechas sólo mueven el recorrido con el foco dentro del globo**: en
 *    un paso interactivo, quien escribe en el campo resaltado las necesita.
 * 4. **El hueco se puede tocar sólo cuando el paso lo pide.**
 */

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
    ],
    ...parcial,
  };
}

describe('TutorialOverlay', () => {
  let fixture: ComponentFixture<TutorialOverlay>;
  let componente: TutorialOverlay;
  let engine: TutorialEngine;
  let registry: TutorialRegistry;
  let confirmar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmar = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: confirmar } },
      ],
    });
    engine = TestBed.inject(TutorialEngine);
    registry = TestBed.inject(TutorialRegistry);
    fixture = TestBed.createComponent(TutorialOverlay);
    componente = fixture.componentInstance;
  });

  afterEach(() => localStorage.clear());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).innerHTML;
  }

  /**
   * El armazón la monta siempre, así que estando quieta no puede dejar ni un
   * nodo: un velo o un globo escondido igual come clics y rompe el foco.
   * Angular deja su comentario ancla del `@if`, que no es un elemento.
   */
  it('no dibuja nada mientras no hay recorrido', () => {
    expect(html()).not.toContain('tutorial-globo');
    expect(html()).not.toContain('tutorial-velo');
    expect((fixture.nativeElement as HTMLElement).children).toHaveLength(0);
  });

  it('dibuja el globo con el título y el cuerpo del paso', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    const marcado = html();
    expect(marcado).toContain('Uno');
    expect(marcado).toContain('role="dialog"');
    expect(marcado).toContain('aria-modal="true"');
  });

  /** Una barra no se escucha: el progreso también va en palabras. */
  it('dice el progreso con palabras además de con la barra', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    expect(interno<() => string>('progresoEnPalabras')()).toBe('Paso 1 de 2');
    expect(html()).toContain('role="progressbar"');
  });

  it('el porcentaje acompaña al paso', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    expect(interno<() => number>('porcentaje')()).toBe(50);

    await engine.next();
    expect(interno<() => number>('porcentaje')()).toBe(100);
  });

  /* ---- teclado ------------------------------------------------------------ */

  /** No hay nada que perder todavía: preguntar sería un trámite. */
  it('Escape en el primer paso cierra sin preguntar', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    await interno<() => Promise<void>>('abandonar')();

    expect(confirmar).not.toHaveBeenCalled();
    expect(engine.isRunning()).toBe(false);
  });

  /** Un tecleo distraído no debería costar ocho pasos. */
  it('Escape después del primer paso pregunta antes de abandonar', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();

    await interno<() => Promise<void>>('abandonar')();

    expect(confirmar).toHaveBeenCalled();
    expect(engine.isRunning()).toBe(false);
  });

  it('si no se confirma, el recorrido sigue', async () => {
    confirmar.mockResolvedValue(false);
    registry.register([tutorial()]);
    await engine.start('t-1');
    await engine.next();

    await interno<() => Promise<void>>('abandonar')();

    expect(engine.isRunning()).toBe(true);
  });

  /**
   * En un paso interactivo, quien está escribiendo en el campo resaltado usa las
   * flechas para moverse por el texto: robárselas sería inaceptable.
   */
  it('las flechas no mueven el recorrido con el foco fuera del globo', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');
    fixture.detectChanges();

    // Sin enfocar el globo: el foco está en el `<body>`.
    interno<(e: KeyboardEvent) => void>('alTeclear')(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();

    expect(engine.activeStep()?.step.id).toBe('p-1');
  });

  /* ---- el hueco ----------------------------------------------------------- */

  /** No se puede pedir que toquen algo y a la vez taparlo. */
  it('un paso de clic deja el hueco abierto', async () => {
    registry.register([
      tutorial({ steps: [{ id: 'p-1', title: 'Uno', body: 'a', advanceOn: 'click' }] }),
    ]);
    await engine.start('t-1');

    expect(interno<() => boolean>('interactivo')()).toBe(true);
  });

  /** Un clic distraído en medio de una explicación no dispara una acción real. */
  it('un paso que sólo explica tapa el hueco', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    expect(interno<() => boolean>('interactivo')()).toBe(false);
  });

  it('la definición puede forzar que el hueco quede abierto', async () => {
    registry.register([
      tutorial({ steps: [{ id: 'p-1', title: 'Uno', body: 'a', interactive: true }] }),
    ]);
    await engine.start('t-1');

    expect(interno<() => boolean>('interactivo')()).toBe(true);
  });

  /* ---- geometría ---------------------------------------------------------- */

  /** Sin ancla el globo se centra: es el caso del primer y del último paso. */
  it('sin elemento objetivo no recorta el velo y centra el globo', async () => {
    registry.register([tutorial()]);
    await engine.start('t-1');

    const geometria = interno<() => { recorte: unknown; lado: string }>('geometria')();
    expect(geometria.recorte).toBeNull();
    expect(geometria.lado).toBe('center');
  });

  it('dice lo que el paso está esperando cuando espera una acción', async () => {
    registry.register([
      tutorial({ steps: [{ id: 'p-1', title: 'Uno', body: 'a', advanceOn: 'click' }] }),
    ]);
    await engine.start('t-1');

    expect(html()).toContain('Hacé clic en lo que está resaltado');
  });
});
