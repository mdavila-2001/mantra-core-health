import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../core/data-access/api';
import { SurveysHome } from './questionnaires';

/* ============================================================================
    El listado de encuestas como gestor: buscar, filtrar y tres vacíos.

    Lo que estas pruebas fijan:

    1. El buscador acota por título **y** por consigna, sin distinguir acentos.
    2. El filtro por estado acota por grupo, y el recuento de cada grupo es el
       de las encuestas cargadas, no el de las visibles.
    3. **«No hay encuestas» y «el filtro no encontró nada» son dos estados
       distintos**, con dos marcas distintas en el DOM. Es la regla S3 del M34
       llevada al listado: un vacío de la consulta que se dibuja como vacío del
       dominio le dice a alguien con doce encuestas que no tiene ninguna, y le
       ofrece crear otra en vez de aflojar el filtro.
    4. Control negativo: sin criterios puestos no se esconde nada.

    Lo que NO acreditan: que la API filtre. No filtra —`GET /surveys/templates`
    no declara `?q=` ni `?status=`—, y por eso el filtrado es de cliente sobre
    lo ya cargado. Estas pruebas no emiten ninguna petición más que la lectura
    inicial, y `http.verify()` lo hace cumplir.
    ========================================================================== */

/** Una fila del listado tal como viaja por el cable. */
function encuestaEnCable(
  id: string,
  title: string,
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE',
  description?: string,
): Record<string, unknown> {
  return {
    id,
    title,
    ...(description === undefined ? {} : { description }),
    status,
    latestVersionNumber: 1,
    published: status !== 'DRAFT',
    questionCount: 3,
  };
}

/**
 * El catálogo sintético: cuatro encuestas, una por grupo salvo los borradores,
 * que son dos para que «Borradores» y «Todas» no den lo mismo por casualidad.
 */
const CATALOGO: readonly Record<string, unknown>[] = [
  encuestaEnCable('s-1', 'Satisfacción post-consulta', 'DRAFT', 'Cómo te fue con el turno.'),
  encuestaEnCable('s-2', 'Adherencia al tratamiento', 'DRAFT'),
  encuestaEnCable('s-3', 'Encuesta de ingreso', 'ACTIVE', 'Antecedentes y medicación.'),
  encuestaEnCable('s-4', 'Derivación a kinesiología', 'INACTIVE'),
];

describe('SurveysHome · buscar, filtrar y los vacíos que no se confunden', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Raíz vacía: las rutas se comparan tal cual, sin depender del entorno.
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([{ path: 'questionnaires', component: SurveysHome }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/questionnaires', SurveysHome);
  });

  afterEach(() => http.verify());

  /** Responde la lectura del listado y deja la pantalla pintada. */
  function responderListado(cuerpo: readonly Record<string, unknown>[]): void {
    http.expectOne((r) => r.url === '/surveys/templates').flush(cuerpo);
    harness.detectChanges();
  }

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  const buscar = (selector: string): HTMLElement | null => raiz().querySelector(selector);

  const titulos = (): readonly string[] =>
    Array.from(raiz().querySelectorAll('.encuestas__titulo')).map(
      (nodo) => nodo.textContent?.trim() ?? '',
    );

  /** Tipea en el buscador como lo haría una persona: evento `input` real. */
  function tipear(texto: string): void {
    const campo = raiz().querySelector<HTMLInputElement>('[data-testid="encuestas-buscar"] input');
    expect(campo).not.toBeNull();
    campo!.value = texto;
    campo!.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  /** Toca una de las opciones del filtro por estado. */
  function filtrarPor(grupo: string): void {
    const opcion = raiz().querySelector<HTMLButtonElement>(
      `[data-testid="encuestas-filtro-estado"] [data-testid="segmentado-${grupo}"]`,
    );
    expect(opcion).not.toBeNull();
    opcion!.click();
    harness.detectChanges();
  }

  describe('el buscador', () => {
    beforeEach(() => responderListado(CATALOGO));

    it('acota por título, sin distinguir mayúsculas ni acentos', () => {
      tipear('SATISFACCION');

      // «SATISFACCION» encuentra «Satisfacción»: quien busca en un listado
      // recuerda el título, no lo transcribe.
      expect(titulos()).toEqual(['Satisfacción post-consulta']);
    });

    it('también acota por la consigna, que es texto de la encuesta', () => {
      tipear('medicación');

      // «Encuesta de ingreso» no tiene esa palabra en el título: si el buscador
      // mirara sólo el título, acá no habría nada.
      expect(titulos()).toEqual(['Encuesta de ingreso']);
    });

    it('control negativo: sin texto no esconde ninguna', () => {
      tipear('kinesio');
      expect(titulos()).toHaveLength(1);

      tipear('');

      expect(titulos()).toHaveLength(CATALOGO.length);
      expect(buscar('[data-testid="encuestas-sin-resultados"]')).toBeNull();
    });
  });

  describe('el filtro por estado', () => {
    beforeEach(() => responderListado(CATALOGO));

    it('deja sólo el grupo elegido', () => {
      filtrarPor('DRAFT');

      expect(titulos()).toEqual(['Satisfacción post-consulta', 'Adherencia al tratamiento']);
    });

    it('muestra el recuento de cada grupo sobre lo cargado, no sobre lo visible', () => {
      const rotulos = (): string =>
        buscar('[data-testid="encuestas-filtro-estado"]')?.textContent ?? '';

      expect(rotulos()).toContain('Todas (4)');
      expect(rotulos()).toContain('Borradores (2)');
      expect(rotulos()).toContain('Activas (1)');
      expect(rotulos()).toContain('Desactivadas (1)');

      filtrarPor('ACTIVE');

      // Acotar la vista no reescribe los recuentos: si lo hiciera, los grupos
      // que no están puestos quedarían todos en cero y dejarían de ser una guía
      // de a dónde ir.
      expect(rotulos()).toContain('Todas (4)');
      expect(rotulos()).toContain('Borradores (2)');
    });

    it('se combina con el buscador en vez de reemplazarlo', () => {
      tipear('encuesta');
      filtrarPor('DRAFT');

      // «Encuesta de ingreso» pasa el texto pero no el estado; los borradores
      // pasan el estado pero no el texto. La intersección es vacía.
      expect(titulos()).toEqual([]);
      expect(buscar('[data-testid="encuestas-sin-resultados"]')).not.toBeNull();
    });
  });

  describe('los dos vacíos', () => {
    it('sin encuestas dibuja el vacío del dominio (S3), no el del filtro', () => {
      responderListado([]);

      expect(buscar('[data-testid="encuestas-sin-encuestas"]')).not.toBeNull();
      expect(buscar('[data-testid="encuestas-sin-resultados"]')).toBeNull();

      // Y sin nada cargado no hay nada que filtrar: los controles no están.
      expect(buscar('[data-testid="encuestas-buscar"]')).toBeNull();
      expect(buscar('[data-testid="encuestas-filtro-estado"]')).toBeNull();
    });

    it('con encuestas y filtro sin coincidencias dibuja el vacío de la consulta', () => {
      responderListado(CATALOGO);
      tipear('radiología');

      expect(buscar('[data-testid="encuestas-sin-resultados"]')).not.toBeNull();

      // El corazón del criterio: NO es el vacío del dominio. Quien tiene cuatro
      // encuestas no puede leer «todavía no tenés encuestas».
      expect(buscar('[data-testid="encuestas-sin-encuestas"]')).toBeNull();
      expect(raiz().textContent).not.toContain('Todavía no tenés encuestas');

      // Y la salida está a mano: los controles siguen en pantalla.
      expect(buscar('[data-testid="encuestas-buscar"]')).not.toBeNull();
      expect(buscar('[data-testid="encuestas-filtro-estado"]')).not.toBeNull();
    });

    it('limpiar los filtros devuelve la lista entera', () => {
      responderListado(CATALOGO);
      tipear('radiología');
      filtrarPor('ACTIVE');

      const limpiar = raiz().querySelector<HTMLButtonElement>(
        '[data-testid="encuestas-limpiar-filtros"]',
      );
      expect(limpiar).not.toBeNull();
      limpiar!.click();
      harness.detectChanges();

      expect(titulos()).toHaveLength(CATALOGO.length);
      expect(buscar('[data-testid="encuestas-sin-resultados"]')).toBeNull();
    });
  });

  describe('lo que no cambió', () => {
    it('el alta sigue en la pantalla y se abre desde el encabezado', () => {
      responderListado(CATALOGO);

      expect(buscar('[data-testid="encuestas-form"]')).toBeNull();

      const nueva = raiz().querySelector<HTMLButtonElement>('[data-testid="encuestas-nueva"]');
      expect(nueva).not.toBeNull();
      nueva!.click();
      harness.detectChanges();

      expect(buscar('[data-testid="encuestas-form"]')).not.toBeNull();
      expect(buscar('[data-testid="encuesta-titulo"]')).not.toBeNull();
      expect(buscar('[data-testid="encuesta-crear"]')).not.toBeNull();
    });
  });
});
