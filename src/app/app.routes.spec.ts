import { APP_SECTIONS } from './core/navigation/navigation.map';
import { SECTION_ROUTE_DATA, titleOf } from './core/navigation/navigation.types';
import { SectionPlaceholder } from './features/section-placeholder/section-placeholder';
import { routes } from './app.routes';

/**
 * La promesa del armazón: **el menú nunca ofrece un destino que el router no
 * declare**. Las rutas hijas se construyen desde el mismo registro que el menú,
 * así que la promesa es estructural; estas pruebas la fijan por si alguien
 * vuelve a escribirlas a mano.
 */
describe('rutas del armazón', () => {
  const armazon = routes.find((route) => route.path === '' && route.children !== undefined);
  const hijas = armazon?.children ?? [];

  it('el armazón existe y está detrás del guard', () => {
    // S1 del M34: autorizar antes de pedir datos, y en el padre para que cubra
    // a todas las secciones sin que ninguna se acuerde de pedirlo.
    expect(armazon).toBeDefined();
    expect(armazon?.canActivate?.length).toBeGreaterThan(0);
  });

  it('entrar a la raíz lleva al panel', () => {
    const raiz = hijas.find((route) => route.path === '');

    expect(raiz?.redirectTo).toBe('panel');
    expect(raiz?.pathMatch).toBe('full');
  });

  it('cada sección del registro tiene su ruta, con su título y su sección en `data`', () => {
    for (const section of APP_SECTIONS) {
      const ruta = hijas.find((route) => route.path === section.path);

      expect(ruta, section.path).toBeDefined();
      expect(ruta?.title, section.path).toBe(titleOf(section));
      expect(ruta?.data?.[SECTION_ROUTE_DATA], section.path).toBe(section);
    }
  });

  /**
   * Ninguna ruta puede quedar fuera del árbol que el registro declara.
   *
   * Una ruta hija es legítima de dos maneras: **es** una sección, o **cuelga**
   * de una —el alta, la ficha de un registro, un flujo alternativo—. Lo que
   * sigue prohibido es una ruta que no se pueda alcanzar desde ninguna sección:
   * esa es una pantalla a la que el menú nunca lleva y que nadie recuerda
   * mantener.
   */
  it('toda ruta hija pertenece a una sección del registro', () => {
    const declaradas = APP_SECTIONS.map((s) => s.path);
    // La redirección de la raíz es la única hija sin sección: no es una
    // pantalla, es a dónde va quien entra sin ruta.
    const huerfanas = hijas.filter((r) => {
      const path = r.path ?? '';
      if (path === '') {
        return false;
      }
      return !declaradas.some((seccion) => path === seccion || path.startsWith(`${seccion}/`));
    });

    expect(huerfanas.map((r) => r.path)).toEqual([]);
  });

  /**
   * El router prueba en orden de declaración, así que un segmento fijo detrás
   * de un parámetro **no se alcanza nunca**: `:profileId` se tragaría `nuevo` y
   * la ficha intentaría cargar un paciente llamado «nuevo».
   *
   * Es el defecto que el propio backend documenta haber evitado al declarar
   * `patients/me/summary` antes que `patients/:profileId`. Acá se fija por
   * prueba en vez de por comentario.
   */
  it('los segmentos fijos van antes que los paramétricos de su misma rama', () => {
    const conParametro = hijas
      .map((r, indice) => ({ path: r.path ?? '', indice }))
      .filter((r) => r.path.includes('/:'));

    for (const parametrica of conParametro) {
      const rama = parametrica.path.slice(0, parametrica.path.indexOf('/:') + 1);
      const fijasDespues = hijas
        .map((r, indice) => ({ path: r.path ?? '', indice }))
        .filter(
          (r) =>
            r.indice > parametrica.indice &&
            r.path.startsWith(rama) &&
            !r.path.includes('/:') &&
            r.path !== rama.slice(0, -1),
        );

      expect(fijasDespues.map((r) => r.path), parametrica.path).toEqual([]);
    }
  });

  it('cada sección tiene con qué pintarse, directa o diferida', () => {
    for (const section of APP_SECTIONS) {
      const ruta = hijas.find((route) => route.path === section.path);

      expect(ruta?.component ?? ruta?.loadComponent, section.path).toBeDefined();
    }
  });

  /**
   * La prueba que de verdad importa: **`disponible` tiene que significar que hay
   * pantalla**. Comprobar que existe `loadComponent` no alcanza — el placeholder
   * también lo tiene—, así que se resuelve la carga y se mira qué llegó.
   */
  it('una sección disponible NO cae en el placeholder', async () => {
    for (const section of APP_SECTIONS.filter((s) => s.availability === 'disponible')) {
      const ruta = hijas.find((route) => route.path === section.path);
      const componente = ruta?.component ?? (await ruta?.loadComponent?.());

      expect(componente, section.path).toBeDefined();
      // Se compara por identidad y no por `name`: el compilador de Angular
      // renombra la clase (`_SectionPlaceholder`) y una prueba por texto se
      // rompería sin que nada esté mal.
      expect(componente, section.path).not.toBe(SectionPlaceholder);
    }
  });

  it('una sección planificada cae en el placeholder, y diferido', async () => {
    for (const section of APP_SECTIONS.filter((s) => s.availability === 'planificada')) {
      const ruta = hijas.find((route) => route.path === section.path);

      // Se difiere porque es el caso mayoritario: no se descarga hasta que
      // alguien entra a una sección que todavía no existe.
      expect(ruta?.component, section.path).toBeUndefined();
      expect(await ruta?.loadComponent?.(), section.path).toBe(SectionPlaceholder);
    }
  });

  it('la vitrina que el menú ofrece existe fuera del armazón', () => {
    // El ítem «Sistema de diseño» lo agrega el armazón a mano porque no es una
    // sección del producto; su ruta tiene que existir igual.
    expect(routes.some((route) => route.path === 'design-system')).toBe(true);
  });
});
