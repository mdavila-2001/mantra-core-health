import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { TutorialProgressStore, TUTORIAL_STORAGE } from './tutorial-progress.store';
import type { TutorialDefinition, TutorialProgress } from './tutorial.types';

/**
 * El progreso.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El versionado no obliga a repetir por una tilde.** Sólo un cambio de
 *    mayor vuelve a marcar pendiente un tutorial completado; si cualquier
 *    corrección lo hiciera, la gente dejaría de hacerlos.
 * 2. **El progreso es por cuenta, no del navegador.** Un mostrador compartido es
 *    el caso normal en una clínica, y heredar el avance del anterior convierte
 *    la ayuda en ruido.
 * 3. **Un almacenamiento caído no tumba nada.** Modo privado, cuota llena o una
 *    política de empresa degradan a memoria, no a pantalla rota.
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

/** Un adaptador en memoria: las pruebas no dependen del `localStorage` real. */
class MemoriaStorage {
  readonly datos = new Map<string, ReadonlyMap<string, TutorialProgress>>();
  read(clave: string): ReadonlyMap<string, TutorialProgress> {
    return this.datos.get(clave) ?? new Map();
  }
  write(clave: string, progreso: ReadonlyMap<string, TutorialProgress>): void {
    this.datos.set(clave, progreso);
  }
}

describe('TutorialProgressStore', () => {
  let store: TutorialProgressStore;
  let storage: MemoriaStorage;
  let session: SessionStore;

  beforeEach(() => {
    storage = new MemoriaStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: TUTORIAL_STORAGE, useValue: storage }],
    });
    store = TestBed.inject(TutorialProgressStore);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(usuario: string): void {
    session.start({
      accessToken: jwt({ sub: usuario, roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
  }

  it('un tutorial sin registro está pendiente', () => {
    expect(store.statusOf(tutorial())).toBe('pendiente');
    expect(store.of('t-1').repetitions).toBe(0);
  });

  it('empezar y completar cuentan una repetición', () => {
    const t = tutorial();
    store.started(t, 'p-1');
    expect(store.statusOf(t)).toBe('en-curso');

    store.completed(t);
    expect(store.statusOf(t)).toBe('completado');
    expect(store.of('t-1').repetitions).toBe(1);
  });

  /* ---- versionado -------------------------------------------------------- */

  /** Una corrección de texto no puede costarle a nadie repetir diez pasos. */
  it('un cambio de versión menor no obliga a repetir', () => {
    store.completed(tutorial({ version: '1.0' }));

    expect(store.statusOf(tutorial({ version: '1.3' }))).toBe('completado');
  });

  /** El recorrido cambió de verdad: lo que se aprendió ya no es lo que hay. */
  it('un cambio de versión mayor vuelve a marcarlo pendiente', () => {
    store.completed(tutorial({ version: '1.0' }));

    expect(store.statusOf(tutorial({ version: '2.0' }))).toBe('pendiente');
  });

  /* ---- reinicio ---------------------------------------------------------- */

  it('reiniciar vuelve a cero sin borrar las repeticiones', () => {
    const t = tutorial();
    store.completed(t);
    store.completed(t);
    store.reset('t-1');

    expect(store.statusOf(t)).toBe('pendiente');
    expect(store.of('t-1').stepId).toBeNull();
    // Reiniciar para repasar no debería aparentar que nunca lo hizo.
    expect(store.of('t-1').repetitions).toBe(2);
  });

  /* ---- requisitos -------------------------------------------------------- */

  it('los requisitos se cumplen cuando el requisito está completado', () => {
    const base = tutorial({ id: 'base' });
    const avanzado = tutorial({ id: 'avanzado', prerequisites: ['base'] });

    expect(store.prerequisitesMet(avanzado, [base, avanzado])).toBe(false);
    store.completed(base);
    expect(store.prerequisitesMet(avanzado, [base, avanzado])).toBe(true);
  });

  /**
   * Un requisito de otro rol no se exige: exigir algo que esta sesión no puede
   * hacer dejaría el tutorial inalcanzable para siempre.
   */
  it('un requisito ausente del catálogo de la sesión no se exige', () => {
    const avanzado = tutorial({ id: 'avanzado', prerequisites: ['de-otro-rol'] });

    expect(store.prerequisitesMet(avanzado, [avanzado])).toBe(true);
  });

  /* ---- avance general ---------------------------------------------------- */

  it('el avance cuenta los completados sobre el catálogo', () => {
    const a = tutorial({ id: 'a' });
    const b = tutorial({ id: 'b' });
    store.completed(a);

    expect(store.progressOver([a, b])).toBe(0.5);
    expect(store.progressOver([])).toBe(0);
  });

  /* ---- por cuenta -------------------------------------------------------- */

  /**
   * Un mostrador compartido es el caso normal en una clínica: heredar el avance
   * de quien estuvo antes ofrecería como completados tutoriales que esta persona
   * nunca vio.
   */
  it('cambiar de cuenta cambia el progreso', () => {
    abrirSesion('u-1');
    TestBed.tick();
    store.completed(tutorial());
    expect(store.statusOf(tutorial())).toBe('completado');

    abrirSesion('u-2');
    TestBed.tick();
    expect(store.statusOf(tutorial())).toBe('pendiente');

    // Y volver a entrar con la primera recupera lo suyo.
    abrirSesion('u-1');
    TestBed.tick();
    expect(store.statusOf(tutorial())).toBe('completado');
  });
});

/**
 * El adaptador real del navegador, aparte: es el único que puede fallar por algo
 * que no controlamos, y su contrato es «degrada, no rompe».
 */
describe('TutorialProgressStore con el almacenamiento caído', () => {
  it('sigue funcionando en memoria cuando escribir falla', () => {
    const roto = {
      read: () => new Map<string, TutorialProgress>(),
      write: () => {
        throw new Error('cuota llena');
      },
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TUTORIAL_STORAGE, useValue: roto }],
    });
    const store = TestBed.inject(TutorialProgressStore);

    // No poder persistir el avance no puede tumbar la pantalla que la persona
    // está usando: el fallo no se propaga y el estado en memoria queda bien.
    expect(() => store.completed(tutorial())).not.toThrow();
    expect(store.statusOf(tutorial())).toBe('completado');
  });
});
