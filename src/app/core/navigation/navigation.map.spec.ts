import { IDENTITY_VERIFICATION_ROUTE } from '../http/error-to-view-state';
import { APP_SECTIONS } from './navigation.map';
import {
  ANY_ROLE,
  apareceEnElMenu,
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
  it('el directorio admite administración global sin tenant y conserva el acceso de aseguradora', () => {
    const directory = APP_SECTIONS.find(section => section.path === 'administration/insurance-patients')!;
    expect(isVisibleTo(directory, ['SECURITY_ADMIN'])).toBe(true);
    expect(isVisibleTo(directory, ['SUPERADMIN'], [], 'PHARMACY')).toBe(true);
    expect(isVisibleTo(directory, ['INSURANCE_OPERATOR'], ['payer-1'], 'PAYER')).toBe(true);
    expect(isVisibleTo(directory, ['USER'], ['payer-1'], 'PAYER')).toBe(true);
    expect(isVisibleTo(directory, ['PATIENT'], ['payer-1'], 'PAYER')).toBe(false);
    expect(isVisibleTo(directory, ['USER'])).toBe(false);
    expect(isVisibleTo(directory, ['USER'], ['pharmacy-1'], 'PHARMACY')).toBe(false);
    const organization = APP_SECTIONS.find(section => section.requiresTenant && !section.platformAccessRoles)!;
    expect(isVisibleTo(organization, ['SUPERADMIN'])).toBe(false);
  });
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

  it('el paciente no ve las pantallas de administración, aunque tenga organización', () => {
    // La trampa que esto cierra: `requiresTenant` se escribió creyendo que un
    // paciente «no pertenece a organización ninguna», y es falso. El alta de
    // paciente le crea una membresía en el tenant por defecto a propósito —sin
    // ella el interceptor de tenant le contesta 403 a todo—, así que llega con
    // el claim `tenants` lleno y cumplía la condición.
    //
    // Medido contra la API viva el 03/09/2026: `POST /iam/auth/register-patient`
    // + login devuelve `roles: ['USER','PATIENT']` y `tenants` de un elemento
    // («Mantra Core Default Tenant»). Por eso el paciente se pasa acá **con**
    // organización: es el caso real, no el difícil.
    const conOrganizacion = ['t-1'];
    const paraElMostrador = [
      'administration/my-organization',
      'administration/pharmacy-orders',
      'administration/pharmacy-campaigns',
      'administration/pharmacy-catalog',
      'administration/pharmacy-profile',
    ];

    for (const ruta of paraElMostrador) {
      const seccion = APP_SECTIONS.find((s) => s.path === ruta);
      expect(seccion, ruta).toBeDefined();
      // El paciente **con** organización y el tipo que corresponde: es el caso
      // difícil, y aun así no las ve.
      const tipo = ruta === 'administration/my-organization' ? null : 'PHARMACY';
      expect(isVisibleTo(seccion!, ['USER', 'PATIENT'], conOrganizacion, tipo), ruta).toBe(false);
      // Y sigue siendo de quien es: el mostrador no tiene rol propio en el
      // token, así que se comprueba con la sesión que sí lo atiende. Desde el
      // 29/09/2026 las de farmacia sólo existen para una organización
      // `PHARMACY` (`onlyForTenantTypes`).
      expect(isVisibleTo(seccion!, ['USER'], conOrganizacion, tipo), ruta).toBe(true);
      // Menos «Tu organización»: es de cualquier organización, aseguradora
      // incluida. Las tres del mostrador de farmacia sí se cierran para una
      // sesión PAYER — `administration/pharmacy-orders` lo demuestra por
      // las tres, ver `hiddenForTenantTypes` más abajo.
      const esperadoParaAseguradora = ruta === 'administration/my-organization';
      expect(isVisibleTo(seccion!, ['USER'], conOrganizacion, 'PAYER'), ruta).toBe(
        esperadoParaAseguradora,
      );
    }
  });

  it('el panel lo ve cualquier sesión, sin importar los roles', () => {
    const panel = APP_SECTIONS[0];

    // Es el destino del login y el del cambio de organización: si un rol no
    // pudiera verlo, entrar dejaría a esa persona en una pantalla que su menú
    // no ofrece.
    expect(panel !== undefined && isVisibleTo(panel, [])).toBe(true);
  });

  it('la verificación de identidad conserva la ruta que publica la puerta del 403', () => {
    const verificar = APP_SECTIONS.find((s) => s.label === 'Mi identidad');

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

  it('el Directorio de médicos es del paciente y del médico', () => {
    const guia = APP_SECTIONS.find((s) => s.path === 'directory');

    // Corrección #2 del 15/08/2026: sólo el paciente. El 24/09/2026 el cliente
    // pidió sumar al médico —«añadamos doctores al directorio en el perfil de
    // doctores también»—: buscar a un colega para derivar es parte de atender.
    expect(guia?.roles).toEqual(['PATIENT', 'PRACTITIONER']);
  });

  it('la doctora ve el Directorio de médicos; quien administra, no', () => {
    const guia = APP_SECTIONS.find((s) => s.path === 'directory')!;

    expect(isVisibleTo(guia, ['USER', 'PRACTITIONER', 'CLINICIAN'])).toBe(true);
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

  it('el generador de formularios es del doctor, y de nadie más', () => {
    const generador = APP_SECTIONS.find((s) => s.path === 'form-builder')!;

    // Pedido del 22/08/2026: la pestaña «Formularios» **sólo** en el doctor.
    // Quien administra ya tiene la suya (`administration/clinical-forms`, que
    // arma la plantilla estándar); ésta extiende una plantilla ya armada con
    // los campos de un consultorio, y eso no es una tarea de plataforma.
    expect(isVisibleTo(generador, ['USER', 'PRACTITIONER'])).toBe(true);
    expect(isVisibleTo(generador, ['CLINICIAN'])).toBe(true);
    expect(isVisibleTo(generador, ['USER', 'PATIENT'])).toBe(false);
    expect(isVisibleTo(generador, ['SECURITY_ADMIN'])).toBe(false);
    expect(isVisibleTo(generador, ['SUPERADMIN'])).toBe(false);
  });

  it('el comodín sólo lo rompen las dos secciones que lo declaran', () => {
    // Si `exclusiveRoles` se empezara a repartir, el comodín dejaría de servir
    // para lo que existe —que quien administra pueda recorrer el sistema— y
    // nadie se enteraría hasta que una sección deje de aparecer. Son dos, y
    // cada una por un pedido explícito del cliente: la Guía es sólo del
    // paciente (15/08/2026) y el generador de formularios sólo del doctor
    // (22/08/2026).
    const exclusivas = APP_SECTIONS.filter((s) => s.exclusiveRoles === true).map((s) => s.path);

    expect(exclusivas).toEqual(['directory', 'form-builder']);
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

/**
 * `hiddenForTenantTypes`: igual que `hiddenFor`, pero mirando el tipo de la
 * organización ACTIVA en vez del rol. Nace del pedido de la aseguradora
 * (2026-09-25): quitarle al menú y a la puerta el autoservicio del paciente
 * y los directorios, que no son de una organización PAYER.
 */
describe('isVisibleTo con `hiddenForTenantTypes`', () => {
  const seccionDelPaciente = {
    path: 'x',
    label: 'X',
    group: 'Mi cuenta',
    icon: 'shield',
    roles: [ANY_ROLE],
    hiddenForTenantTypes: ['PAYER'],
    availability: 'disponible',
    summary: 's',
    module: 'M00',
  } as const;

  it('una organización PAYER no la ve', () => {
    expect(isVisibleTo(seccionDelPaciente, ['USER'], ['t-1'], 'PAYER')).toBe(false);
  });

  it('ni siquiera el comodín la salva: mismo contrato que `hiddenFor`', () => {
    expect(isVisibleTo(seccionDelPaciente, ['SUPERADMIN'], ['t-1'], 'PAYER')).toBe(false);
  });

  it('otro tipo de organización no queda afectado', () => {
    expect(isVisibleTo(seccionDelPaciente, ['USER'], ['t-1'], 'PHARMACY')).toBe(true);
  });

  it('sin tipo de organización activa (claim ausente o sin elegir) no oculta nada', () => {
    expect(isVisibleTo(seccionDelPaciente, ['USER'], ['t-1'], null)).toBe(true);
    expect(isVisibleTo(seccionDelPaciente, ['USER'], ['t-1'])).toBe(true);
  });

  it('apareceEnElMenu hereda la misma regla', () => {
    expect(apareceEnElMenu(seccionDelPaciente, ['USER'], ['t-1'], 'PAYER')).toBe(false);
    expect(apareceEnElMenu(seccionDelPaciente, ['USER'], ['t-1'], 'PHARMACY')).toBe(true);
  });
});

/**
 * `onlyForTenantTypes`: la contracara de `hiddenForTenantTypes`. Nace con la
 * recepción de muestras del laboratorio, cuyo personal no tiene rol propio en
 * el token: lo único que distingue su sesión es el tipo del tenant activo.
 */
describe('isVisibleTo con `onlyForTenantTypes`', () => {
  const labSection = {
    path: 'x',
    label: 'X',
    group: 'Atención',
    icon: 'flask',
    roles: [ANY_ROLE],
    requiresTenant: true,
    hiddenFor: ['PATIENT'],
    onlyForTenantTypes: ['DIAGNOSTIC_CENTER'],
    availability: 'disponible',
    summary: 's',
    module: 'M00',
  } as const;

  it('la ve el personal de un centro de diagnóstico, aunque sólo tenga `USER`', () => {
    expect(isVisibleTo(labSection, ['USER'], ['t-1'], 'DIAGNOSTIC_CENTER')).toBe(true);
    expect(apareceEnElMenu(labSection, ['USER'], ['t-1'], 'DIAGNOSTIC_CENTER')).toBe(true);
  });

  it('otro tipo de organización no la ve, ni con el comodín', () => {
    expect(isVisibleTo(labSection, ['USER'], ['t-1'], 'PROVIDER')).toBe(false);
    expect(isVisibleTo(labSection, ['SUPERADMIN'], ['t-1'], 'PAYER')).toBe(false);
  });

  it('sin tipo de organización activa, la duda oculta', () => {
    expect(isVisibleTo(labSection, ['USER'], ['t-1'], null)).toBe(false);
    expect(isVisibleTo(labSection, ['USER'], ['t-1'])).toBe(false);
  });

  it('el paciente no la ve aunque su organización activa fuera un laboratorio', () => {
    expect(isVisibleTo(labSection, ['PATIENT'], ['t-1'], 'DIAGNOSTIC_CENTER')).toBe(false);
  });

  it('las secciones reales son las del laboratorio y las diez de la farmacia, y nada más la usa', () => {
    const flagged = APP_SECTIONS.filter((s) => s.onlyForTenantTypes !== undefined);
    // Desde el 29/09/2026 el menú de la cuenta de farmacia es plano y cerrado:
    // sus ocho pantallas sólo existen para una organización `PHARMACY`. Desde
    // el 30/09/2026 el de laboratorio también, y va después de la farmacia.
    // El 01/10/2026 los dos sumaron «Precios» y «Sucursales». El 06/10/2026
    // el centro sumó «Horarios y equipos» (mockup).
    expect(flagged.map((s) => s.path)).toEqual([
      'administration/pharmacy',
      'administration/pharmacy-catalog',
      'administration/pharmacy-categories',
      'administration/pharmacy-import',
      'administration/pharmacy-inventory',
      'administration/pharmacy-prices',
      'administration/pharmacy-orders',
      'administration/pharmacy-campaigns',
      'administration/pharmacy-profile',
      'administration/pharmacy-branches',
      'administration/laboratory',
      'laboratorio/recepcion',
      'laboratorio/cola',
      'administration/laboratory-results',
      'administration/laboratory-prices',
      'administration/center-schedule',
      'administration/laboratory-branches',
    ]);
    for (const section of flagged) {
      expect(section.onlyForTenantTypes, section.path).toEqual(
        section.path.includes('pharmacy') ? ['PHARMACY'] : ['DIAGNOSTIC_CENTER'],
      );
    }
  });

  it('la cola del laboratorio la ve su personal con sólo `USER`, y no el paciente ni otra organización', () => {
    const queue = APP_SECTIONS.find((s) => s.path === 'laboratorio/cola')!;
    expect(isVisibleTo(queue, ['USER'], ['t-1'], 'DIAGNOSTIC_CENTER')).toBe(true);
    expect(isVisibleTo(queue, ['PATIENT'], ['t-1'], 'DIAGNOSTIC_CENTER')).toBe(false);
    expect(isVisibleTo(queue, ['PRACTITIONER'], ['t-1'], 'PROVIDER')).toBe(false);
  });
});

/**
 * El registro de procesos del cliente (módulo «Aseguradora de salud») pide
 * tres pantallas: datos legales, qué aprueba/no aprueba, y siniestralidad —
 * «Tu organización», «Aseguradora» y «Siniestralidad y analítica», que ya
 * existen y no llevan `hiddenForTenantTypes`. Todo lo demás que una sesión
 * `USER` con tenant `PAYER` veía es ajeno, y esta prueba fija la lista
 * cerrada de lo que se le cierra: agregar una decimoséptima fila acá es una
 * decisión, no un olvido.
 */
describe('lo que `hiddenForTenantTypes` le cierra a la aseguradora', () => {
  it('son exactamente estas doce rutas, todas PAYER', () => {
    // Las cuatro del mostrador de farmacia también se le cierran, pero desde el
    // 29/09/2026 por el otro lado: sólo existen para `PHARMACY`
    // (`onlyForTenantTypes`), y el test de arriba demuestra que una sesión PAYER
    // no las ve.
    const conMarca = APP_SECTIONS.filter((s) => s.hiddenForTenantTypes?.includes('PAYER') === true);

    expect(conMarca.map((s) => s.path)).toEqual([
      'directories',
      'directory',
      'laboratory-directory',
      'clinics-directory',
      'pharmacies-directory',
      'insurers-directory',
      'my-account/dependents',
      'my-account/appointments',
      'my-account/medical-record',
      'my-account/diagnostic-results',
      'my-account/diagnostic-orders',
      'my-account/cotizaciones',
      'my-account/questionnaires',
    ]);
    for (const seccion of conMarca) {
      // `PAYER` solo, o junto con `PHARMACY` y `DIAGNOSTIC_CENTER` (los menús
      // planos de farmacia y laboratorio): ningún otro tipo se cuela en esta
      // lista sin que alguien lo decida.
      expect(['PAYER'], seccion.path).toEqual(
        seccion.hiddenForTenantTypes!.filter((tipo) => tipo === 'PAYER'),
      );
      expect(
        seccion.hiddenForTenantTypes!.filter(
          (tipo) => tipo !== 'PAYER' && tipo !== 'PHARMACY' && tipo !== 'DIAGNOSTIC_CENTER',
        ),
        seccion.path,
      ).toEqual([]);
    }
  });

  it('lo que el registro de procesos SÍ le pide a la aseguradora sigue visible', () => {
    const siguenVisibles = [
      'dashboard',
      'tutorials',
      'messaging',
      'settings',
      'my-account',
      'notification-center',
      'my-account/identity',
      'administration/insurance',
      'administration/insurance-analytics',
      'administration/my-organization',
    ];
    for (const ruta of siguenVisibles) {
      const seccion = APP_SECTIONS.find((s) => s.path === ruta);
      expect(seccion, ruta).toBeDefined();
      expect(isVisibleTo(seccion!, ['USER'], ['t-1'], 'PAYER'), ruta).toBe(true);
    }
  });
});

/**
 * `fueraDelMenuPara` con el comodín es lo que apaga una sección de momento sin
 * cerrarle la puerta: la verificación de identidad lo usa mientras el producto
 * no la ofrezca (`VERIFICACION_DE_IDENTIDAD_OFRECIDA`).
 */
describe('apareceEnElMenu', () => {
  const seccion = {
    path: 'x',
    label: 'X',
    group: 'Mi cuenta',
    icon: 'shield',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 's',
    module: 'M00',
  } as const;

  it('sin `fueraDelMenuPara`, la sección ocupa su renglón', () => {
    expect(apareceEnElMenu(seccion, ['PATIENT'])).toBe(true);
  });

  it('con un rol concreto, sale del menú sólo para ese rol', () => {
    const fuera = { ...seccion, fueraDelMenuPara: ['PRACTITIONER'] } as const;

    expect(apareceEnElMenu(fuera, ['PRACTITIONER'])).toBe(false);
    expect(apareceEnElMenu(fuera, ['PATIENT'])).toBe(true);
  });

  it('con el comodín, sale del menú para todos —y para el que se agregue mañana', () => {
    const apagada = { ...seccion, fueraDelMenuPara: [ANY_ROLE] } as const;

    expect(apareceEnElMenu(apagada, ['PATIENT'])).toBe(false);
    expect(apareceEnElMenu(apagada, [])).toBe(false);
    expect(apareceEnElMenu(apagada, ['UN_ROL_NUEVO'])).toBe(false);
  });

  it('pero sigue pudiendo entrar: esconder un renglón no es cerrar la puerta', () => {
    const apagada = { ...seccion, fueraDelMenuPara: [ANY_ROLE] } as const;

    // Es la diferencia entera de `fueraDelMenuPara` frente a `roles`, y lo que
    // hace que la salida del 403 `IDENTITY_VERIFICATION_REQUIRED` siga viva.
    expect(isVisibleTo(apagada, ['PATIENT'])).toBe(true);
  });
});
