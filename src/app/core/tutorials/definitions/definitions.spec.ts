import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../auth/session.store';
import { TutorialRegistry } from '../tutorial.registry';
import { TUTORIALS } from './index';

/**
 * Las definiciones reales, contra el código real.
 *
 * ## Por qué esta prueba lee el árbol de plantillas
 *
 * La regla del catálogo es que **ningún tutorial enseña algo que no exista**, y
 * esa regla no se puede sostener a mano: un tutorial apunta a
 * `data-tutorial-id="agenda-ventana"` y basta con que alguien rediseñe la
 * agenda para que el paso se saltee en silencio. Nadie se entera, porque un paso
 * saltado no rompe nada — que es exactamente lo que el motor promete.
 *
 * Así que la garantía tiene que estar acá: cada objetivo declarado en una
 * definición existe en alguna plantilla. Si alguien borra un
 * `appTutorialTarget`, esta prueba se pone en rojo en el mismo commit, con el
 * nombre del objetivo. Es la contrapartida de que el motor sea tolerante.
 */

/** Los `appTutorialTarget` puestos en las plantillas, literales o interpolados. */
function objetivosDeclarados(): { literales: Set<string>; hayDinamicos: boolean } {
  const literales = new Set<string>();
  let hayDinamicos = false;

  const recorrer = (directorio: string): void => {
    for (const entrada of readdirSync(directorio)) {
      const ruta = join(directorio, entrada);
      if (statSync(ruta).isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (!ruta.endsWith('.html')) {
        continue;
      }
      const contenido = readFileSync(ruta, 'utf8');

      for (const coincidencia of contenido.matchAll(/appTutorialTarget="([^"{]+)"/g)) {
        literales.add(coincidencia[1]);
      }
      // Los que se arman con una expresión (`[appTutorialTarget]="'nav-' + …"`)
      // no se pueden resolver leyendo el archivo. Se anota que existen para no
      // afirmar de más en el mensaje de la prueba.
      if (/\[appTutorialTarget\]=/.test(contenido)) {
        hayDinamicos = true;
      }
    }
  };

  recorrer(join(process.cwd(), 'src', 'app'));
  return { literales, hayDinamicos };
}

/** Objetivos que produce una expresión y no un literal, así que se declaran acá. */
const OBJETIVOS_DINAMICOS = new Set([
  // `[appTutorialTarget]="'nav-' + item.route.slice(1)"` en el armazón: hay uno
  // por sección del menú, y su nombre sale de la ruta.
  'nav-tutorials',
]);

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

describe('Definiciones de tutoriales', () => {
  let registry: TutorialRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(TutorialRegistry);
  });

  /** El catálogo real tiene que pasar su propia validación. */
  it('el catálogo se registra sin ningún problema de configuración', () => {
    registry.register(TUTORIALS);

    expect(registry.issues()).toEqual([]);
    expect(registry.all()).toHaveLength(TUTORIALS.length);
  });

  /**
   * La contrapartida de que el motor tolere un objetivo ausente: acá sí se
   * exige que exista, para que borrarlo se vea en el commit que lo borra.
   */
  it('cada objetivo de cada paso existe en alguna plantilla', () => {
    const { literales } = objetivosDeclarados();
    const faltantes: string[] = [];

    for (const tutorial of TUTORIALS) {
      for (const paso of tutorial.steps) {
        if (paso.target === undefined) {
          continue;
        }
        if (!literales.has(paso.target) && !OBJETIVOS_DINAMICOS.has(paso.target)) {
          faltantes.push(`${tutorial.id}/${paso.id} → ${paso.target}`);
        }
      }
    }

    expect(faltantes).toEqual([]);
  });

  /** Un solo tutorial puede abrirse solo: dos peleando por hacerlo es el caos. */
  it('sólo un tutorial arranca automáticamente', () => {
    const automaticos = TUTORIALS.filter((tutorial) => tutorial.autoStart === true);

    expect(automaticos).toHaveLength(1);
    expect(automaticos[0].id).toBe('bienvenida');
  });

  /** Cada paso explica una sola acción: los cuerpos largos no se leen. */
  it('los cuerpos de los pasos son breves', () => {
    const largos = TUTORIALS.flatMap((tutorial) =>
      tutorial.steps
        .filter((paso) => paso.body.length > 220)
        .map((paso) => `${tutorial.id}/${paso.id}`),
    );

    expect(largos).toEqual([]);
  });

  /* ---- filtrado por rol sobre el catálogo real ---------------------------- */

  it('un paciente no ve los tutoriales clínicos', () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    registry.register(TUTORIALS);

    const ids = registry.available().map((tutorial) => tutorial.id);
    expect(ids).not.toContain('expediente-clinico');
    expect(ids).not.toContain('agenda-del-dia');
    // Pero sí los generales: cualquiera que entre tiene algo que aprender.
    expect(ids).toContain('bienvenida');
  });

  it('quien atiende ve los clínicos y el de su perfil profesional', () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    registry.register(TUTORIALS);

    const ids = registry.available().map((tutorial) => tutorial.id);
    expect(ids).toContain('agenda-del-dia');
    expect(ids).toContain('expediente-clinico');
    expect(ids).toContain('perfil-profesional');
    // Y no el de facturación, que es de otro rol.
    expect(ids).not.toContain('contabilidad');
  });
});
