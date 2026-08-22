import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_SECTIONS } from './core/navigation/navigation.map';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import {
  ROLES_ROUTE_DATA,
  SECTION_ROUTE_DATA,
  restringePorRol,
  titleOf,
} from './core/navigation/navigation.types';
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

    expect(raiz?.redirectTo).toBe('dashboard');
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
   * Ninguna **pantalla** puede quedar fuera del árbol que el registro declara.
   *
   * Una ruta hija es legítima de dos maneras: **es** una sección, o **cuelga**
   * de una —el alta, la ficha de un registro, un flujo alternativo—. Lo que
   * sigue prohibido es una pantalla que no se pueda alcanzar desde ninguna
   * sección: esa es una pantalla a la que el menú nunca lleva y que nadie
   * recuerda mantener.
   *
   * Las redirecciones quedan fuera porque no son pantallas: son las direcciones
   * viejas, en castellano, que apuntan a una sección que sí está registrada. Su
   * regla propia es la prueba de abajo, que es más exigente que ésta.
   */
  it('toda pantalla hija pertenece a una sección del registro', () => {
    const declaradas = APP_SECTIONS.map((s) => s.path);

    /**
     * Pantallas que a propósito no cuelgan de ninguna sección.
     *
     * El muro salió del menú con R2-1 —el ítem del paciente pasó a ser la guía
     * de doctores— pero la pantalla sigue en pie y se alcanza por enlace
     * directo. Es una decisión de producto, no un olvido: por eso figura acá y
     * no como sección, y por eso esta lista es explícita y corta. Cualquier
     * pantalla que no esté en ella y no cuelgue de una sección sigue siendo un
     * error.
     */
    const sinSeccionAProposito = [
      'feed',
      // TJ-1 · el alta del profesional. No es una sección porque no es un lugar
      // al que se vuelve: es una tarea con principio y fin, y una vez completa
      // no tiene nada que mostrar. Se llega por el aviso del panel, no por el
      // menú — una entrada permanente a algo que se hace una vez sería ruido
      // para todos los médicos que ya lo completaron.
      'onboarding',
    ];

    const huerfanas = hijas.filter((r) => {
      const path = r.path ?? '';
      if (path === '' || r.redirectTo !== undefined || sinSeccionAProposito.includes(path)) {
        return false;
      }
      return !declaradas.some((seccion) => path === seccion || path.startsWith(`${seccion}/`));
    });

    expect(huerfanas.map((r) => r.path)).toEqual([]);
  });

  /**
   * El rol de la sección se hace cumplir también en sus hijas.
   *
   * Sin esto, la sección rebota a quien no tiene el rol y su formulario lo deja
   * pasar: un paciente que escriba `/administration/geolocation/trips/new`
   * llega a la pantalla aunque `/administration/geolocation` lo devuelva al
   * panel. La API responde 403 y no hay fuga, pero la pantalla no debería
   * ofrecerse.
   *
   * La regla se comprueba contra el árbol y no contra una lista de rutas: la
   * próxima hija que alguien cuelgue de una sección con `roles` sin ponerle el
   * guard hace fallar esto, que es exactamente lo que se quiere.
   *
   * Las excepciones se nombran una por una y se explican en `app.routes.ts`:
   * son hijas cuyo endpoint acepta un rol que la sección no declara, y el
   * guard nunca niega lo que la API permite.
   */
  describe('el guard de rol de la sección', () => {
    const SIN_GUARD_A_PROPOSITO: readonly string[] = [
      'administration/patients/assisted-registration',
      'administration/brokers/:brokerId',
      'administration/organizations/:tenantId',
    ];

    const seccionDe = (path: string) =>
      APP_SECTIONS.filter((s) => path.startsWith(`${s.path}/`)).sort(
        (a, b) => b.path.length - a.path.length,
      )[0];

    const hijasDeSeccionConRoles = hijas.filter((r) => {
      const path = r.path ?? '';
      if (path === '' || r.redirectTo !== undefined) {
        return false;
      }
      const section = seccionDe(path);
      return section !== undefined && restringePorRol(section);
    });

    it('lo lleva toda pantalla hija cuya sección declara roles', () => {
      const destapadas = hijasDeSeccionConRoles
        .filter((r) => !SIN_GUARD_A_PROPOSITO.includes(r.path ?? ''))
        .filter((r) => !(r.canActivate ?? []).includes(seccionRolesGuard));

      expect(destapadas.map((r) => r.path)).toEqual([]);
    });

    it('las excepciones existen, cuelgan de una sección con roles y siguen sin guard', () => {
      for (const path of SIN_GUARD_A_PROPOSITO) {
        const ruta = hijas.find((r) => r.path === path);

        expect(ruta, path).toBeDefined();
        const section = seccionDe(path);
        expect(section, path).toBeDefined();
        expect(restringePorRol(section!), path).toBe(true);
        expect((ruta?.canActivate ?? []).includes(seccionRolesGuard), path).toBe(false);
      }
    });

    it('cubre a las pantallas de operación, que salen todas de la misma fábrica', () => {
      const operacion = hijasDeSeccionConRoles.filter((r) =>
        (r.path ?? '').startsWith('administration/geolocation/'),
      );

      expect(operacion.length).toBeGreaterThan(0);
      expect(operacion.every((r) => (r.canActivate ?? []).includes(seccionRolesGuard))).toBe(true);
    });

    /**
     * El caso inverso: hijas de una sección **sin** roles que son de un rol
     * concreto. «Mi perfil» la abre cualquiera; configurar el perfil
     * profesional, la vitrina pública y los artículos médicos son de quien
     * atiende, y lo declaran en `data` para que el mismo guard las cierre
     * (feedback de la analista, barrido del 18/08/2026).
     */
    it('las hijas de «Mi perfil» que son de quien atiende lo declaran y llevan el guard', () => {
      const DE_QUIEN_ATIENDE = ['my-account/edit', 'my-account/preview', 'my-account/articles'];

      for (const path of DE_QUIEN_ATIENDE) {
        const ruta = hijas.find((r) => r.path === path);

        expect(ruta, path).toBeDefined();
        expect((ruta?.canActivate ?? []).includes(seccionRolesGuard), path).toBe(true);
        expect(ruta?.data?.[ROLES_ROUTE_DATA], path).toEqual(['CLINICIAN', 'PRACTITIONER']);
      }
    });
  });

  /**
   * Las direcciones viejas tienen que llevar a algún lado real.
   *
   * Una redirección a una ruta que no existe es peor que no tenerla: promete
   * que el favorito sigue sirviendo y termina en el comodín. Se comprueba
   * contra el árbol declarado —secciones y pantallas hijas—, no contra una
   * lista escrita a mano, para que borrar una sección haga fallar esto.
   */
  it('cada dirección vieja redirige a una ruta que existe', () => {
    const destinos = [
      ...APP_SECTIONS.map((s) => `/${s.path}`),
      ...hijas.filter((r) => r.redirectTo === undefined).map((r) => `/${r.path ?? ''}`),
      ...routes.filter((r) => r.redirectTo === undefined).map((r) => `/${r.path ?? ''}`),
    ];

    // `redirectTo` admite además una función desde Angular 19; las tablas de
    // direcciones viejas son todas de texto, y el estrechamiento lo deja dicho.
    const redirecciones = [...hijas, ...routes].filter(
      (r): r is typeof r & { redirectTo: string } =>
        typeof r.redirectTo === 'string' && (r.path ?? '') !== '',
    );

    // Que existan: si la tabla se vacía por un refactor, esta prueba pasaría
    // sin comprobar nada.
    expect(redirecciones.length).toBeGreaterThan(15);

    for (const redireccion of redirecciones) {
      expect(redireccion.pathMatch, redireccion.path).toBe('full');
      expect(destinos, redireccion.path).toContain(redireccion.redirectTo);
    }
  });

  /**
   * Y no pueden tapar a ninguna pantalla.
   *
   * El router prueba en orden de declaración, así que una dirección vieja
   * declarada antes de las pantallas se probaría primero. Hoy ninguna podría
   * ganar —son textos distintos y van con `pathMatch: 'full'`—, pero el día que
   * una ruta nueva se llame igual que una vieja, la que gana tiene que ser la
   * que pinta algo. Se fija por orden y no por confianza en que no pase.
   *
   * El comodín queda fuera de la comparación: va último por definición, y una
   * dirección vieja declarada **después** de él nunca se alcanzaría — que es el
   * error opuesto y el que de verdad rompería los favoritos.
   */
  it('las direcciones viejas se declaran después de toda pantalla y antes del comodín', () => {
    for (const lista of [hijas, routes]) {
      const pantallas = lista
        .map((r, indice) => ({ r, indice }))
        .filter(({ r }) => typeof r.redirectTo !== 'string' && r.path !== '**');
      const viejas = lista
        .map((r, indice) => ({ r, indice }))
        .filter(({ r }) => typeof r.redirectTo === 'string' && (r.path ?? '') !== '');

      if (pantallas.length === 0 || viejas.length === 0) {
        continue;
      }

      const ultimaPantalla = pantallas[pantallas.length - 1]?.indice ?? 0;
      const primeraVieja = viejas[0]?.indice ?? 0;
      const ultimaVieja = viejas[viejas.length - 1]?.indice ?? 0;
      const comodin = lista.findIndex((r) => r.path === '**');

      expect(primeraVieja, `${viejas[0]?.r.path}`).toBeGreaterThan(ultimaPantalla);

      if (comodin !== -1) {
        expect(ultimaVieja, `${viejas[viejas.length - 1]?.r.path}`).toBeLessThan(comodin);
      }
    }
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

      expect(
        fijasDespues.map((r) => r.path),
        parametrica.path,
      ).toEqual([]);
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
   *
   * ## Por qué lleva techo propio
   *
   * Resuelve un `import()` por cada sección disponible, y hoy son dos docenas:
   * es de las pocas pruebas del repo cuyo costo **crece con el producto**. Con
   * los cinco segundos por defecto pasaba aislada y se agotaba dentro de la
   * suite completa —donde compite por CPU con otras 2 400—, y el síntoma era un
   * timeout que no dice nada sobre las rutas. Aumentar el techo acá no tapa
   * ningún defecto: no hay aserción que dependa de cuánto tarde.
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
  }, 30_000);

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

/**
 * El comprobante (FAR-I5) vive en `…/:orderId/receipt`, declarado DESPUÉS del
 * paramétrico `…/:orderId`: que resuelva depende del retroceso del router —
 * el mismo supuesto que el bloque del buscador fija arriba. Los guards se
 * neutralizan a propósito: acá se prueba el matching, no la sesión (el guard
 * ya lo cubre el bloque de cobertura de roles).
 */
describe('la ruta del comprobante de farmacia (FAR-I5)', () => {
  let router: Router;
  let location: Location;

  /**
   * Vacía los guards en TODO el árbol (la ruta vive como hija del shell y
   * lleva el suyo propio), sólo donde había: una ruta `redirectTo` no admite
   * `canActivate` ni vacío (NG04014).
   */
  function sinGuards(arbol: typeof routes): typeof routes {
    return arbol.map((ruta) => ({
      ...ruta,
      ...(ruta.canActivate === undefined ? {} : { canActivate: [] }),
      ...(ruta.children === undefined ? {} : { children: sinGuards(ruta.children) }),
    }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(sinGuards(routes))] });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  it('`/:orderId/receipt` no se la traga el paramétrico del detalle', async () => {
    const ok = await router.navigateByUrl('/my-account/pharmacy-orders/abc/receipt');
    expect(ok).not.toBe(false);
    expect(location.path()).toBe('/my-account/pharmacy-orders/abc/receipt');
  });
});
