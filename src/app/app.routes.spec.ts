import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';

/**
 * Lo que esta prueba fija.
 *
 * La superficie pública del buscador declara `buscar` en `app.routes.ts` y el
 * archivo **generado** `redsat.routes.ts` declara otro `buscar` con los
 * segmentos derivados del nombre de archivo de cada maqueta. Los dos conviven
 * porque el router prueba el primero y **retrocede** al siguiente cuando ningún
 * hijo coincide.
 *
 * Eso es un comportamiento del router, no una garantía que este repositorio
 * controle, y de él dependen dos cosas a la vez: que las URL limpias sean las
 * que se indexan, y que los enlaces de la bóveda que todavía apuntan a
 * `/buscar/buscador-listado` no se rompan. Si el retroceso dejara de ocurrir,
 * media superficie pública devolvería la pantalla equivocada **sin ningún
 * error**: el router simplemente no navegaría.
 */
describe('rutas públicas del buscador', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  /** Navega y devuelve si el router aceptó la URL. */
  async function resuelve(url: string): Promise<boolean> {
    const ok = await router.navigateByUrl(url);
    return ok !== false && location.path().split('?')[0] === url.split('?')[0];
  }

  // ─── Las URL que la ficha V65 declara ──────────────────────────────────────

  it.each([
    ['/buscar'],
    ['/buscar/profesionales'],
    ['/buscar/medicamentos'],
    ['/buscar/hospitales'],
    ['/buscar/diagnostico'],
    ['/buscar/aseguradoras'],
    ['/buscar/mapa'],
  ])('%s resuelve', async (url) => {
    expect(await resuelve(url)).toBe(true);
  });

  // ─── Las fichas por slug, sin guard ────────────────────────────────────────

  it.each([['/p/una'], ['/o/una'], ['/f/una'], ['/l/una'], ['/s/una']])(
    '%s resuelve sin sesión',
    async (url) => {
      expect(await resuelve(url)).toBe(true);
    },
  );

  // ─── El retroceso del router ───────────────────────────────────────────────

  /**
   * El segmento no existe en el bloque de URL limpias, así que el router tiene
   * que retroceder al `buscar` generado para encontrarlo. Es el supuesto del
   * que depende que las dos formas convivan.
   */
  it('las URL de la bóveda siguen abriendo, por retroceso al bloque generado', async () => {
    expect(await resuelve('/buscar/buscador-listado')).toBe(true);
    expect(await resuelve('/buscar/perfil-profesional-detalle')).toBe(true);
  });

  // ─── El texto buscado viaja en la URL ──────────────────────────────────────

  it('`?q=` sobrevive a la navegación: una búsqueda se puede pegar en un mensaje', async () => {
    await router.navigateByUrl('/buscar?q=cardiolog%C3%ADa');

    expect(location.path()).toContain('q=cardiolog');
  });
});
