import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { TutorialRegistry } from './tutorial.registry';
import type { TutorialDefinition } from './tutorial.types';

/**
 * El catálogo de tutoriales y su validación.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Una configuración rota se ve, no se traga.** Los tutoriales los va a
 *    escribir gente que no escribió el motor, y el error típico —un requisito
 *    que apunta a un tutorial renombrado— no se descubre leyendo el archivo.
 * 2. **Una configuración rota no tumba la aplicación.** Es ayuda, no
 *    infraestructura: los inejecutables se descartan y el resto sigue.
 * 3. **El filtrado por rol es el mismo que el del menú.** Dos reglas de
 *    visibilidad distintas es cómo se llega a un tutorial que enseña una
 *    sección que no aparece.
 */

/** base64url **sobre UTF-8**, como el token real. */
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

/** Un tutorial mínimo válido, para variar sólo lo que cada prueba mira. */
function tutorial(parcial: Partial<TutorialDefinition> = {}): TutorialDefinition {
  return {
    id: 't-1',
    version: '1.0',
    title: 'Un tutorial',
    description: 'Sirve para probar.',
    category: 'General',
    estimatedMinutes: 1,
    level: 'inicial',
    steps: [{ id: 'p-1', title: 'Paso', body: 'Cuerpo.' }],
    ...parcial,
  };
}

describe('TutorialRegistry', () => {
  let registry: TutorialRegistry;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(TutorialRegistry);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(roles: readonly string[]): void {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles, tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
  }

  it('registra un catálogo válido sin problemas', () => {
    registry.register([tutorial()]);

    expect(registry.all()).toHaveLength(1);
    expect(registry.issues()).toHaveLength(0);
  });

  /**
   * Reemplaza y no acumula: registrar dos veces el mismo lote —lo que pasa en
   * las pruebas y con la recarga en caliente— duplicaría todo, y el primer
   * síntoma sería un «id duplicado» que nadie escribió.
   */
  it('registrar dos veces reemplaza en vez de acumular', () => {
    registry.register([tutorial()]);
    registry.register([tutorial()]);

    expect(registry.all()).toHaveLength(1);
    expect(registry.issues()).toHaveLength(0);
  });

  it('detecta ids duplicados dentro del mismo lote', () => {
    registry.register([tutorial(), tutorial({ title: 'Otro' })]);

    expect(registry.issues().map((p) => p.code)).toContain('id-duplicado');
    // Y se queda con el primero: descartar los dos dejaría sin tutorial a quien
    // sólo lo declaró dos veces por error.
    expect(registry.all()).toHaveLength(1);
  });

  /** Un tutorial sin pasos no es un recorrido: no se ofrece. */
  it('descarta un tutorial sin pasos', () => {
    registry.register([tutorial({ steps: [] })]);

    expect(registry.issues().map((p) => p.code)).toContain('sin-pasos');
    expect(registry.all()).toHaveLength(0);
  });

  it('descarta un tutorial con pasos repetidos', () => {
    registry.register([
      tutorial({
        steps: [
          { id: 'p-1', title: 'A', body: 'a' },
          { id: 'p-1', title: 'B', body: 'b' },
        ],
      }),
    ]);

    expect(registry.issues().map((p) => p.code)).toContain('paso-duplicado');
    expect(registry.all()).toHaveLength(0);
  });

  it('exige que la versión tenga la forma mayor.menor', () => {
    registry.register([tutorial({ version: 'uno' })]);

    expect(registry.issues().map((p) => p.code)).toContain('version-invalida');
  });

  /**
   * Una ruta inventada es el error que se descubre cuando el recorrido intenta
   * navegar y no llega. Se avisa, pero **no** se descarta: el resto de los pasos
   * puede servir igual.
   */
  it('avisa de una ruta que no corresponde a ninguna sección, sin descartar', () => {
    registry.register([tutorial({ route: '/pantalla-que-no-existe' })]);

    expect(registry.issues().map((p) => p.code)).toContain('ruta-invalida');
    expect(registry.all()).toHaveLength(1);
  });

  it('acepta una ruta con parámetros sobre una sección declarada', () => {
    registry.register([tutorial({ route: '/medical-records/algun-id' })]);

    expect(registry.issues()).toHaveLength(0);
  });

  it('detecta un requisito que no existe', () => {
    registry.register([tutorial({ prerequisites: ['fantasma'] })]);

    expect(registry.issues().map((p) => p.code)).toContain('requisito-inexistente');
  });

  it('detecta un tutorial siguiente que no existe', () => {
    registry.register([tutorial({ next: 'fantasma' })]);

    expect(registry.issues().map((p) => p.code)).toContain('siguiente-inexistente');
  });

  /** Un ciclo de requisitos deja los dos tutoriales inalcanzables para siempre. */
  it('detecta requisitos circulares', () => {
    registry.register([
      tutorial({ id: 'a', prerequisites: ['b'] }),
      tutorial({ id: 'b', prerequisites: ['a'] }),
    ]);

    expect(registry.issues().map((p) => p.code)).toContain('requisito-circular');
  });

  /** Un paso cuyos roles no cruzan con los del tutorial no lo ve nadie nunca. */
  it('detecta un paso con roles imposibles', () => {
    registry.register([
      tutorial({
        roles: ['PRACTITIONER'],
        steps: [{ id: 'p-1', title: 'A', body: 'a', roles: ['BILLING_ADMIN'] }],
      }),
    ]);

    expect(registry.issues().map((p) => p.code)).toContain('rol-imposible');
  });

  /* ---- filtrado por sesión ------------------------------------------------ */

  it('esconde los tutoriales de módulos que la sesión no puede abrir', () => {
    abrirSesion(['PATIENT']);
    registry.register([tutorial({ roles: ['PRACTITIONER'] }), tutorial({ id: 't-2' })]);

    expect(registry.available().map((t) => t.id)).toEqual(['t-2']);
  });

  /** Misma regla que el menú: `SUPERADMIN` es comodín en el `RolesGuard`. */
  it('SUPERADMIN ve todos los tutoriales', () => {
    abrirSesion(['SUPERADMIN']);
    registry.register([tutorial({ roles: ['PRACTITIONER'] })]);

    expect(registry.available()).toHaveLength(1);
  });

  it('filtra los pasos por rol dentro de un tutorial que sí se ve', () => {
    abrirSesion(['PRACTITIONER']);
    registry.register([
      tutorial({
        steps: [
          { id: 'p-1', title: 'Para todos', body: 'a' },
          { id: 'p-2', title: 'Sólo facturación', body: 'b', roles: ['BILLING_ADMIN'] },
        ],
      }),
    ]);

    expect(registry.available()[0].steps.map((p) => p.id)).toEqual(['p-1']);
  });

  /** Un recorrido de cero pasos no es un recorrido: deja de ofrecerse. */
  it('un tutorial cuyos pasos se filtran todos deja de ofrecerse', () => {
    abrirSesion(['PATIENT']);
    registry.register([
      tutorial({
        steps: [{ id: 'p-1', title: 'A', body: 'a', roles: ['BILLING_ADMIN'] }],
      }),
    ]);

    expect(registry.available()).toHaveLength(0);
  });

  it('find devuelve null para un tutorial que esta sesión no puede hacer', () => {
    abrirSesion(['PATIENT']);
    registry.register([tutorial({ roles: ['PRACTITIONER'] })]);

    expect(registry.find('t-1')).toBeNull();
  });

  it('las categorías salen de lo disponible, sin repetir', () => {
    abrirSesion(['PRACTITIONER']);
    registry.register([
      tutorial({ id: 'a', category: 'General' }),
      tutorial({ id: 'b', category: 'Atención' }),
      tutorial({ id: 'c', category: 'General' }),
    ]);

    expect(registry.categories()).toEqual(['General', 'Atención']);
  });
});
