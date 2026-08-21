import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { TutorialEngine } from '../../core/tutorials/tutorial.engine';
import {
  TutorialProgressStore,
  TUTORIAL_STORAGE,
} from '../../core/tutorials/tutorial-progress.store';
import { MemoriaDeTutoriales } from '../../../testing/tutorial-storage';
import { TutorialRegistry } from '../../core/tutorials/tutorial.registry';
import type { TutorialDefinition } from '../../core/tutorials/tutorial.types';
import { TutorialsCenter } from './tutorials-center';

/**
 * El centro de tutoriales.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Cada tarjeta ofrece lo que corresponde**: empezar, continuar o repetir
 *    según cómo se dejó el tutorial, que es la información con la que la persona
 *    decide.
 * 2. **Los requisitos avisan, no bloquean.** Bloquear convierte una ayuda en un
 *    trámite.
 * 3. **El avance se mide sobre lo que ESTA sesión puede hacer.** Un 30 % que
 *    nunca puede llegar a 100 no mide nada.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

function tutorial(parcial: Partial<TutorialDefinition> = {}): TutorialDefinition {
  return {
    id: 't-1',
    version: '1.0',
    title: 'Un tutorial',
    description: 'Sirve para probar.',
    category: 'General',
    estimatedMinutes: 1,
    level: 'inicial',
    steps: [{ id: 'p-1', title: 'Paso', body: 'a' }],
    ...parcial,
  };
}

describe('TutorialsCenter', () => {
  let componente: TutorialsCenter;
  let registry: TutorialRegistry;
  let progress: TutorialProgressStore;

  beforeEach(() => {
    // Progreso en memoria, nuevo por prueba: bajo jsdom `localStorage` tira, y
    // vaciarlo en el `afterEach` envenenaba el `TestBed` de los specs que
    // siguieran en el mismo worker. Ver `src/testing/tutorial-storage.ts`.
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TUTORIAL_STORAGE, useValue: new MemoriaDeTutoriales() },
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    registry = TestBed.inject(TutorialRegistry);
    progress = TestBed.inject(TutorialProgressStore);
  });

  function montar(): void {
    componente = TestBed.createComponent(TutorialsCenter).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function lista() {
    return interno<() => readonly { definicion: { id: string }; accion: string }[]>('lista')();
  }

  it('lista los tutoriales que la sesión puede hacer', () => {
    registry.register([tutorial(), tutorial({ id: 't-2', roles: ['BILLING_ADMIN'] })]);
    montar();

    expect(lista().map((f) => f.definicion.id)).toEqual(['t-1']);
  });

  /* ---- qué ofrece cada tarjeta ------------------------------------------- */

  it('un tutorial sin tocar ofrece «Empezar»', () => {
    registry.register([tutorial()]);
    montar();

    expect(lista()[0].accion).toBe('Empezar');
  });

  /**
   * Con un paso guardado, mandar al principio le haría repetir lo que ya vio.
   */
  it('un tutorial a medias ofrece «Continuar»', () => {
    registry.register([tutorial()]);
    progress.skipped('t-1', 'p-1');
    montar();

    expect(lista()[0].accion).toBe('Continuar');
  });

  it('un tutorial completado ofrece «Repetir»', () => {
    registry.register([tutorial()]);
    progress.completed(tutorial());
    montar();

    expect(lista()[0].accion).toBe('Repetir');
  });

  /* ---- requisitos --------------------------------------------------------- */

  /** Avisan y no bloquean: sigue habiendo un botón para empezarlo. */
  it('marca los requisitos pendientes sin impedir empezar', () => {
    registry.register([
      tutorial({ id: 'base', title: 'La base' }),
      tutorial({ id: 'avanzado', prerequisites: ['base'] }),
    ]);
    montar();

    const avanzado = interno<
      () => readonly {
        definicion: { id: string };
        faltanRequisitos: boolean;
        requisitosPendientes: readonly string[];
        accion: string;
      }[]
    >('lista')().find((f) => f.definicion.id === 'avanzado');

    expect(avanzado?.faltanRequisitos).toBe(true);
    expect(avanzado?.requisitosPendientes).toEqual(['La base']);
    expect(avanzado?.accion).toBe('Empezar');
  });

  /* ---- filtros ------------------------------------------------------------ */

  it('busca en el título y en la descripción', () => {
    registry.register([
      tutorial({ id: 'a', title: 'Agenda del día', description: 'Turnos.' }),
      tutorial({ id: 'b', title: 'Expediente', description: 'Cómo cambiar de organización.' }),
    ]);
    montar();

    interno<(t: string) => void>('buscar')('organización');
    expect(lista().map((f) => f.definicion.id)).toEqual(['b']);
  });

  it('filtra por categoría y por estado', () => {
    registry.register([
      tutorial({ id: 'a', category: 'General' }),
      tutorial({ id: 'b', category: 'Atención' }),
    ]);
    progress.completed(tutorial({ id: 'b' }));
    montar();

    interno<(v: string) => void>('elegirCategoria')('Atención');
    expect(lista().map((f) => f.definicion.id)).toEqual(['b']);

    interno<() => void>('limpiarFiltros')();
    interno<(v: string) => void>('elegirEstado')('completado');
    expect(lista().map((f) => f.definicion.id)).toEqual(['b']);
  });

  it('limpiar los filtros devuelve el catálogo entero', () => {
    registry.register([tutorial({ id: 'a' }), tutorial({ id: 'b' })]);
    montar();

    interno<(t: string) => void>('buscar')('nada-coincide');
    expect(lista()).toHaveLength(0);

    interno<() => void>('limpiarFiltros')();
    expect(lista()).toHaveLength(2);
  });

  /* ---- avance y recomendados --------------------------------------------- */

  it('el avance se mide sobre lo que esta sesión puede hacer', () => {
    registry.register([
      tutorial({ id: 'a' }),
      tutorial({ id: 'b' }),
      // De otro rol: no cuenta ni arriba ni abajo de la fracción.
      tutorial({ id: 'c', roles: ['BILLING_ADMIN'] }),
    ]);
    progress.completed(tutorial({ id: 'a' }));
    montar();

    expect(interno<() => number>('avance')()).toBe(50);
    expect(interno<() => number>('total')()).toBe(2);
  });

  /** Terminar lo empezado vale más que empezar otra cosa. */
  it('recomienda primero lo que quedó a medias', () => {
    registry.register([tutorial({ id: 'a' }), tutorial({ id: 'b' })]);
    progress.skipped('b', 'p-1');
    montar();

    const recomendados = interno<() => readonly { definicion: { id: string } }[]>('recomendados')();
    expect(recomendados[0].definicion.id).toBe('b');
  });

  it('no recomienda lo ya completado ni lo que tiene requisitos pendientes', () => {
    registry.register([
      tutorial({ id: 'hecho' }),
      tutorial({ id: 'base' }),
      tutorial({ id: 'trabado', prerequisites: ['base'] }),
    ]);
    progress.completed(tutorial({ id: 'hecho' }));
    montar();

    const ids = interno<() => readonly { definicion: { id: string } }[]>('recomendados')().map(
      (f) => f.definicion.id,
    );
    expect(ids).toEqual(['base']);
  });

  /* ---- acciones ----------------------------------------------------------- */

  it('«Continuar» retoma y «Repetir» arranca de cero', async () => {
    const engine = TestBed.inject(TutorialEngine);
    const empezar = vi.spyOn(engine, 'start').mockResolvedValue(true);

    registry.register([
      tutorial({ id: 'a-medias' }),
      tutorial({ id: 'terminado' }),
    ]);
    progress.skipped('a-medias', 'p-1');
    progress.completed(tutorial({ id: 'terminado' }));
    montar();

    const filas = interno<() => readonly { definicion: { id: string }; accion: string }[]>(
      'lista',
    )();
    const abrir = interno<(f: unknown) => Promise<void>>('abrir');

    await abrir(filas.find((f) => f.definicion.id === 'a-medias'));
    expect(empezar).toHaveBeenCalledWith('a-medias', false);

    await abrir(filas.find((f) => f.definicion.id === 'terminado'));
    expect(empezar).toHaveBeenCalledWith('terminado', true);
  });

  it('reiniciar vuelve el tutorial a pendiente', () => {
    registry.register([tutorial()]);
    progress.completed(tutorial());
    montar();

    interno<(f: unknown) => void>('reiniciar')(lista()[0]);
    expect(lista()[0].accion).toBe('Empezar');
  });

  /* ---- problemas de configuración ---------------------------------------- */

  /** Esta pantalla es de quien escribe tutoriales tanto como de quien los hace. */
  it('muestra los problemas de configuración que encontró el registro', () => {
    registry.register([tutorial({ prerequisites: ['fantasma'] })]);
    montar();

    expect(
      interno<() => readonly { code: string }[]>('problemas')().map((p) => p.code),
    ).toContain('requisito-inexistente');
  });
});
