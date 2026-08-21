import { IDENTITY_VERIFICATION_ROUTE } from '../http/error-to-view-state';
import { APP_SECTIONS } from './navigation.map';
import {
  ANY_ROLE,
  isVisibleTo,
  routeOf,
  titleOf,
  NAV_GROUPS,
  NAV_ICON_NAMES,
} from './navigation.types';

/**
 * El registro es la única fuente de la navegación: si algo está mal acá, está
 * mal en el menú, en las rutas, en los títulos y en el breadcrumb a la vez.
 *
 * Lo que se fija son **invariantes**, no el contenido: agregar una sección no
 * debería romper ninguna de estas pruebas, y romper una de ellas sí debería
 * doler.
 */
describe('APP_SECTIONS', () => {
  it('no repite rutas: dos secciones con el mismo path se taparían entre sí', () => {
    const paths = APP_SECTIONS.map((s) => s.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it('las rutas son relativas al armazón: sin barra al principio ni al final', () => {
    for (const section of APP_SECTIONS) {
      // Angular las monta como hijas de `path: ''`; una barra inicial las
      // convertiría en un segmento vacío y la ruta no resolvería nunca.
      expect(section.path.startsWith('/'), section.path).toBe(false);
      expect(section.path.endsWith('/'), section.path).toBe(false);
      expect(section.path.length, section.path).toBeGreaterThan(0);
    }
  });

  it('cada ícono existe en el set cerrado del nav', () => {
    for (const section of APP_SECTIONS) {
      // El set es cerrado justamente para que no haya íconos mudos; el tipo ya
      // lo impide, pero el set podría encogerse sin que nadie mire acá.
      expect(NAV_ICON_NAMES, section.path).toContain(section.icon);
    }
  });

  it('cada grupo declarado es uno de los grupos del menú', () => {
    for (const section of APP_SECTIONS) {
      expect(NAV_GROUPS, section.path).toContain(section.group);
    }
  });

  it('ninguna sección declara una lista de roles vacía', () => {
    for (const section of APP_SECTIONS) {
      // `roles: []` no se lee como «cualquiera»: `some` sobre un array vacío es
      // `false`, así que la sección quedaría invisible para todo el mundo. Si
      // la ve cualquier sesión, la forma correcta es omitir el campo.
      expect(section.roles, section.path).not.toEqual([]);
    }
  });

  it('cada sección declara sus roles: el olvido no se lee como «universal»', () => {
    // El guardia de F-20 (18/08/2026). Tres veces seguidas una fila nueva llegó
    // sin `roles` —el glosario, «Grupos y foros»— y el menú del paciente se
    // llenó de herramientas que no son suyas. Omitir el campo y declararlo
    // universal se veían igual en el archivo; ahora hay que escribirlo:
    // `roles: [ANY_ROLE]` si de verdad la ve cualquier sesión.
    //
    // Se comprueba acá y no en el tipo a propósito: el mensaje de esta prueba
    // dice qué fila falta y por qué importa, que es lo que necesita quien llega
    // con una sección nueva. Un error del compilador diría menos.
    const sinRoles = APP_SECTIONS.filter((s) => s.roles === undefined).map((s) => s.path);

    expect(
      sinRoles,
      `Estas secciones no declaran \`roles\`: ${sinRoles.join(', ')}. Si la ve ` +
        'cualquier sesión, declaralo con `roles: [ANY_ROLE]`; si no, poné los roles ' +
        'del token que pueden verla.',
    ).toEqual([]);
  });

  it('el rol universal se declara con ANY_ROLE y lo ve cualquier sesión', () => {
    const universal = APP_SECTIONS.find((s) => s.roles?.includes(ANY_ROLE) === true);

    expect(universal, 'alguna sección universal debería declarar ANY_ROLE').toBeDefined();
    // Cualquier sesión, incluso una sin ningún rol conocido, la ve.
    expect(isVisibleTo(universal!, [])).toBe(true);
    expect(isVisibleTo(universal!, ['PATIENT'])).toBe(true);
  });

  it('«Grupos y foros» no es del paciente: son foros profesionales (F-20)', () => {
    const grupos = APP_SECTIONS.find((s) => s.path === 'groups');

    expect(grupos, 'la sección de grupos debería existir').toBeDefined();
    expect(isVisibleTo(grupos!, ['PATIENT'])).toBe(false);
    expect(isVisibleTo(grupos!, ['PRACTITIONER'])).toBe(true);
  });

  it('cada sección explica de qué es: el vacío informativo depende de eso', () => {
    for (const section of APP_SECTIONS) {
      expect(section.summary.length, section.path).toBeGreaterThan(0);
      expect(section.module.length, section.path).toBeGreaterThan(0);
    }
  });

  it('el panel es la primera sección: el breadcrumb lo usa como raíz', () => {
    expect(APP_SECTIONS[0]?.path).toBe('dashboard');
  });

  it('el panel lo ve cualquier sesión, sin importar los roles', () => {
    const panel = APP_SECTIONS[0];

    // Es el destino del login y el del cambio de organización: si un rol no
    // pudiera verlo, entrar dejaría a esa persona en una pantalla que su menú
    // no ofrece.
    expect(panel !== undefined && isVisibleTo(panel, [])).toBe(true);
  });

  it('la verificación de identidad conserva la ruta que publica la puerta del 403', () => {
    const verificar = APP_SECTIONS.find((s) => s.label === 'Verificar identidad');

    // `errorToViewState` traduce `IDENTITY_VERIFICATION_REQUIRED` en una salida
    // hacia esta ruta. Renombrarla acá rompería esa puerta sin que nada más
    // avise: el registro y el traductor de errores tienen que coincidir.
    expect(verificar).toBeDefined();
    expect(routeOf(verificar!)).toBe(IDENTITY_VERIFICATION_ROUTE);
  });

  it('el autoservicio vive en su propio grupo, separado de la gestión', () => {
    const autoservicio = APP_SECTIONS.filter((s) => s.group === 'Mi cuenta');

    // Regla del vault: «las rutas de autoservicio son del propio usuario sobre
    // sus datos y no comparten navegación con las de gestión». Una sección
    // puede restringirse al propio paciente (FAR-I2: «Mis pedidos»), pero un
    // rol de gestión en «Mi cuenta» rompería la separación.
    expect(autoservicio.length).toBeGreaterThan(0);
    for (const section of autoservicio) {
      // Declarados **siempre** (F-20): nunca por omisión, que es lo que hace
      // que un olvido se lea como «la ve cualquiera».
      //
      // Y sólo dos formas posibles: universal —son los datos propios de la
      // cuenta, así que las ve cualquier sesión— o restringida al propio
      // paciente, como «Mis pedidos» (FAR-I2), cuyo contenido nace de una
      // receta suya. Un rol de gestión acá rompería la separación.
      expect(section.roles, section.path).toBeDefined();
      expect([[ANY_ROLE], ['PATIENT']], section.path).toContainEqual(section.roles);
    }
  });

  it('el título de pestaña deriva del rótulo, para que no se separen', () => {
    const panel = APP_SECTIONS[0];

    expect(panel && titleOf(panel)).toBe('AloVida - Panel');
  });

  /* -- Carril 02 · corrección #2 ------------------------------------------- */

  it('la Guía de profesionales es solo del paciente', () => {
    const guia = APP_SECTIONS.find((s) => s.path === 'directory');

    // Corrección #2 del 15/08/2026. Nació sin `roles` —«la usa sobre todo quien
    // busca médico»— y en la práctica la veían la doctora y todo el resto. Es
    // una guía para elegir a quién consultar; a quien atiende no le toca.
    expect(guia?.roles).toEqual(['PATIENT']);
  });

  it('ni la doctora ni quien administra ven la Guía de profesionales', () => {
    const guia = APP_SECTIONS.find((s) => s.path === 'directory')!;

    expect(isVisibleTo(guia, ['USER', 'PRACTITIONER', 'CLINICIAN'])).toBe(false);
    expect(isVisibleTo(guia, ['SECURITY_ADMIN'])).toBe(false);
    expect(isVisibleTo(guia, ['PATIENT'])).toBe(true);
  });

  it('ni el comodín: «solo pacientes» incluye a SUPERADMIN', () => {
    const guia = APP_SECTIONS.find((s) => s.path === 'directory')!;

    // La corrección dice «no debe aparecer ni ser accesible para doctor u otros
    // roles», y SUPERADMIN es otro rol. Es la única sección que rompe el
    // comodín, y por eso lo declara explícito en vez de que lo decida un guard.
    expect(guia.exclusiveRoles).toBe(true);
    expect(isVisibleTo(guia, ['SUPERADMIN'])).toBe(false);
  });

  /* -- Feedback de la analista · F-03 ---------------------------------------- */

  it('el glosario no es del paciente: es herramienta de quien atiende', () => {
    const glosario = APP_SECTIONS.find((s) => s.path === 'glossary')!;

    // Nació sin `roles` («cada profesional») y por efecto colateral aparecía en
    // el menú del paciente. Decidido el 18/08/2026: se le oculta. El comodín
    // sigue valiendo —no es la Guía, no rompe la regla del registro—, así que
    // quien administra lo recorre igual.
    expect(isVisibleTo(glosario, ['USER', 'PATIENT'])).toBe(false);
    expect(isVisibleTo(glosario, ['USER', 'PRACTITIONER'])).toBe(true);
    expect(isVisibleTo(glosario, ['CLINICIAN'])).toBe(true);
    expect(isVisibleTo(glosario, ['SECURITY_ADMIN'])).toBe(true);
    expect(isVisibleTo(glosario, ['SUPERADMIN'])).toBe(true);
  });

  it('sólo la Guía rompe el comodín: el resto del registro lo respeta', () => {
    // Si `exclusiveRoles` se empezara a repartir, el comodín dejaría de servir
    // para lo que existe —que quien administra pueda recorrer el sistema— y
    // nadie se enteraría hasta que una sección deje de aparecer.
    const exclusivas = APP_SECTIONS.filter((s) => s.exclusiveRoles === true).map((s) => s.path);

    expect(exclusivas).toEqual(['directory']);
  });
});

describe('isVisibleTo', () => {
  const conRoles = {
    path: 'x',
    label: 'X',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN', 'BILLING'],
    availability: 'planificada',
    summary: 's',
    module: 'M00',
  } as const;

  it('sin roles declarados la ve cualquier sesión', () => {
    const { roles: _roles, ...sinRoles } = conRoles;

    expect(isVisibleTo(sinRoles, [])).toBe(true);
  });

  it('alcanza con tener uno de los roles: son alternativas, no requisitos', () => {
    expect(isVisibleTo(conRoles, ['BILLING'])).toBe(true);
  });

  it('sin ninguno de los roles, no se ofrece la puerta', () => {
    expect(isVisibleTo(conRoles, ['PATIENT'])).toBe(false);
  });
});
