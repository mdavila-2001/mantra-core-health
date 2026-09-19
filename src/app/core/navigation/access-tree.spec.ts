import {
  ACCESS_AREAS,
  ACCESS_AREA_TONES,
  buildAccessTree,
  gruposSinZona,
  MAXIMO_DE_ZONAS,
  SECCIONES_FUERA_DEL_ARBOL,
} from './access-tree';
import { APP_SECTIONS } from './navigation.map';
import { isVisibleTo, type AppSection } from './navigation.types';

/**
 * El árbol tiene **una sola obligación** y todo lo demás sale de ella: ninguna
 * sección que la sesión pueda abrir se puede quedar sin zona.
 *
 * El reparto es la clase de código que se rompe en silencio: alguien agrega una
 * sección al registro, no cae en ningún `paths`, ningún cajón la reclama, y
 * desaparece del panel sin que falle nada. Las pruebas de acá son ese fallo
 * ruidoso.
 */
describe('el registro de zonas', () => {
  it('no ofrece más de cinco zonas: es lo que se abarca de un vistazo', () => {
    expect(ACCESS_AREAS.length).toBeLessThanOrEqual(MAXIMO_DE_ZONAS);
  });

  it('cada zona tiene identificador propio y un tono del sistema', () => {
    const ids = ACCESS_AREAS.map((zona) => zona.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const zona of ACCESS_AREAS) {
      expect(ACCESS_AREA_TONES).toContain(zona.tone);
    }
  });

  it('todos los grupos del menú tienen un cajón que los reciba', () => {
    // Sin esto, agregar un grupo a `NAV_GROUPS` escondería sus secciones.
    expect(gruposSinZona()).toEqual([]);
  });

  it('ningún grupo tiene dos cajones: el destino de una sección es uno solo', () => {
    const cajones = ACCESS_AREAS.flatMap((zona) => zona.catchAllGroups);
    expect(new Set(cajones).size).toBe(cajones.length);
  });

  it('ninguna ruta está declarada en dos zonas', () => {
    const rutas = ACCESS_AREAS.flatMap((zona) => zona.paths);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('toda ruta declarada existe en el registro de navegación', () => {
    // Una ruta escrita con un error de tipeo no falla: la zona simplemente no
    // la encuentra y la sección se va al cajón, que es peor que un error.
    const existentes = new Set(APP_SECTIONS.map((seccion) => seccion.path));
    const inventadas = ACCESS_AREAS.flatMap((zona) => zona.paths).filter(
      (ruta) => !existentes.has(ruta),
    );

    expect(inventadas).toEqual([]);
  });
});

describe('buildAccessTree', () => {
  /** Las secciones que un rol alcanza, tal como se las pasa el panel. */
  function seccionesDe(roles: readonly string[]): readonly AppSection[] {
    return APP_SECTIONS.filter((seccion) => isVisibleTo(seccion, roles, ['t-1']));
  }

  /** Todas las rutas repartidas, sin importar en qué zona cayeron. */
  function rutasRepartidas(roles: readonly string[]): readonly string[] {
    return buildAccessTree(seccionesDe(roles)).flatMap((zona) =>
      zona.sections.map((seccion) => seccion.path),
    );
  }

  it.each([['PRACTITIONER'], ['PATIENT'], ['SECURITY_ADMIN'], ['SUPERADMIN'], ['BILLING']])(
    'no pierde ninguna sección de %s por el camino',
    (rol) => {
      const esperadas = seccionesDe([rol])
        .map((seccion) => seccion.path)
        .filter((ruta) => !SECCIONES_FUERA_DEL_ARBOL.includes(ruta));

      expect([...rutasRepartidas([rol])].sort()).toEqual([...esperadas].sort());
    },
  );

  it('tampoco reparte la misma sección en dos zonas', () => {
    const rutas = rutasRepartidas(['SUPERADMIN']);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('no ofrece el panel dentro del panel', () => {
    expect(rutasRepartidas(['PRACTITIONER'])).not.toContain('dashboard');
  });

  /**
   * Pedido del 19/09/2026 · la zona «Administración» del médico. Salen del
   * árbol, no del registro: la ruta sigue abriendo —«Mi consultorio propio» se
   * llega desde «Mi perfil»—.
   */
  it.each([
    ['administration/my-practice'],
    ['administration/pharmacy-orders'],
    ['administration/pharmacy-campaigns'],
    ['administration/pharmacy-profile'],
  ])('no ofrece %s en «Tus accesos» aunque la sesión lo alcance', (ruta) => {
    expect(seccionesDe(['PRACTITIONER']).map((s) => s.path)).toContain(ruta);
    expect(rutasRepartidas(['PRACTITIONER'])).not.toContain(ruta);
  });

  /**
   * Corrección del 10/09/2026 · la tarjeta genérica «Directorios».
   *
   * La aserción es **localizada** a propósito: no dice «no existe el texto
   * Directorios», porque el rótulo de la zona y el renglón del menú lateral
   * tienen que seguir estando. Dice que el panel no ofrece la portada
   * (`directories`) y que sí ofrece los directorios concretos.
   */
  it('la zona Directorios no ofrece la portada, y sí los directorios concretos', () => {
    const red = buildAccessTree(seccionesDe(['PRACTITIONER'])).find(
      (zona) => zona.area.id === 'red',
    );

    // La zona sigue en pie, con su rótulo.
    expect(red?.area.label).toBe('Directorios');

    const rutas = red?.sections.map((seccion) => seccion.path) ?? [];
    expect(rutas).not.toContain('directories');
    expect(rutas).toContain('clinics-directory');
    expect(rutas).toContain('laboratory-directory');
    expect(rutas).toContain('pharmacies-directory');
  });

  /**
   * La otra mitad del pedido: sacarla del panel **no** puede sacarla del menú.
   * Sin esto, un `filter` de más en el registro haría desaparecer el renglón sin
   * que ninguna prueba se queje.
   */
  it('la portada sigue en el registro, para el menú lateral', () => {
    const portada = APP_SECTIONS.find((seccion) => seccion.path === 'directories');

    expect(portada).toBeDefined();
    expect(portada?.label).toBe('Directorios');
    // Fuera del menú NO está: es la sección que ocupa el renglón desde el 08/09.
    expect(portada?.fueraDelMenuPara).toBeUndefined();
  });

  it('lo declarado explícitamente le gana al cajón del grupo', () => {
    // «Chats» es del grupo `General` —cuyo cajón es «La red»— y su lugar es
    // «Mi gente». Si el explícito no ganara, dependería del orden de las zonas.
    const arbol = buildAccessTree(seccionesDe(['PRACTITIONER']));
    const gente = arbol.find((zona) => zona.area.id === 'gente');
    const red = arbol.find((zona) => zona.area.id === 'red');

    expect(gente?.sections.map((s) => s.path)).toContain('messaging');
    expect(red?.sections.map((s) => s.path)).not.toContain('messaging');
  });

  it('el cajón recoge lo que ninguna zona nombró', () => {
    // «Intervenciones» no está declarada en ningún `paths`: llega a «Consultas»
    // por ser del grupo `Atención`, y eso es lo que hace que una sección nueva
    // aparezca sin tocar el registro de zonas.
    //
    // El ejemplo era «Glosario» hasta el 19/09/2026, cuando las siete tarjetas
    // que sobraban en la zona del médico salieron del árbol. El cajón sigue
    // siendo la red de seguridad: se mira desde una silla que no es la suya.
    const consulta = buildAccessTree(seccionesDe(['SURGEON'])).find(
      (zona) => zona.area.id === 'consulta',
    );

    expect(consulta?.sections.map((s) => s.path)).toContain('interventions');
  });

  /**
   * El pedido del 19/09/2026: la zona del médico abre tres tarjetas, no diez.
   *
   * La aserción nombra las tres **y** las siete que salieron: sin la segunda
   * mitad, agregar una sección de `Atención` al registro la devolvería a la
   * zona por el cajón sin que nada se queje, que es exactamente lo que este
   * archivo existe para impedir.
   */
  it('la zona de Consultas le abre tres tarjetas al médico', () => {
    const consulta = buildAccessTree(seccionesDe(['PRACTITIONER'])).find(
      (zona) => zona.area.id === 'consulta',
    );

    expect(consulta?.sections.map((s) => s.path)).toEqual([
      'schedule',
      'progress-notes',
      'medical-records',
    ]);
  });

  /**
   * La otra mitad del mismo pedido: sacarlas del panel no las saca del producto.
   *
   * Cuatro conservan su renglón en el menú lateral y las otras tres se llegan
   * desde la pantalla que las usa; lo que ninguna puede es desaparecer del
   * registro, que sería quitar la función en vez de ordenar el panel.
   */
  it('las siete que salieron de la zona siguen en el registro', () => {
    const fuera = [
      'diagnostics',
      'lab-visits',
      'questionnaires',
      'form-builder',
      'glossary',
      'my-services',
      'my-quotations',
    ];

    for (const ruta of fuera) {
      expect(APP_SECTIONS.find((seccion) => seccion.path === ruta)).toBeDefined();
    }

    // Las cuatro que el médico abre por el menú lateral no pueden quedar sin
    // puerta: si alguien les pusiera `fueraDelMenuPara`, se volverían huérfanas.
    for (const ruta of ['form-builder', 'glossary', 'my-services', 'my-quotations']) {
      const seccion = APP_SECTIONS.find((s) => s.path === ruta)!;
      expect(seccion.fueraDelMenuPara ?? []).not.toContain('PRACTITIONER');
    }
  });

  it('una zona sin nada adentro no se dibuja', () => {
    // El paciente no administra nada: la zona de organización no tiene que
    // aparecer vacía diciéndole que hay algo que no puede ver.
    const ids = buildAccessTree(seccionesDe(['PATIENT'])).map((zona) => zona.area.id);
    expect(ids).not.toContain('organizacion');
  });

  it('lo que ya tiene pantalla va antes que lo que está en construcción', () => {
    const arbol = buildAccessTree(seccionesDe(['SUPERADMIN']));

    for (const zona of arbol) {
      const disponibilidades = zona.sections.map((s) => s.availability);
      const primeraPlanificada = disponibilidades.indexOf('planificada');
      if (primeraPlanificada === -1) continue;

      expect(disponibilidades.slice(primeraPlanificada)).not.toContain('disponible');
    }
  });

  it('cuenta sólo lo que se puede abrir: la cifra de la tarjeta no promete pantallas que faltan', () => {
    for (const zona of buildAccessTree(seccionesDe(['SUPERADMIN']))) {
      expect(zona.disponibles).toBe(
        zona.sections.filter((s) => s.availability === 'disponible').length,
      );
    }
  });

  it('sin secciones no hay zonas, y no una fila de tarjetas vacías', () => {
    expect(buildAccessTree([])).toEqual([]);
  });
});
