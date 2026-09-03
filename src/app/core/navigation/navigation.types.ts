/* ============================================================================
    Contratos del armazón interior — la navegación del área con sesión.

    La forma de la navegación NO se inventó acá: la declara el vault en
    `SALUD/Vistas/👥 Actores y navegación.md`, y de ahí salen las tres reglas
    que este archivo codifica:

    1. «Primer nivel = dominio funcional, segundo nivel = vista.»
    2. «El menú se construye a partir de los roles del token; nunca se muestra
        una entrada que el rol no puede ejecutar.»
    3. «Autoservicio aparte»: lo que la persona hace sobre sus propios datos no
        comparte navegación con las pantallas de gestión.
    ========================================================================== */

/**
 * Nombres de ícono que el registro puede usar.
 *
 * **Está declarado acá y no importado del nav a propósito.** `core/` no importa
 * de `shared/` —la dirección de las capas es `features → shared → core`, y
 * `scripts/check-architecture.mjs` la hace cumplir—, así que el registro declara
 * lo que necesita y el componente declara lo que dibuja. Que las dos listas
 * coincidan lo fija una prueba en el punto donde se encuentran
 * (`features/shell-layout`), que es la única capa que puede ver a las dos.
 *
 * Es un set cerrado por la misma razón que del otro lado: un nombre libre
 * terminaría en un ícono mudo. Y son cuarenta y siete, no siete, porque con
 * cincuenta y cinco secciones siete dejan de distinguir: el porqué del reparto
 * está escrito en `atoms/nav-icon/nav-icon.types.ts`, que es donde se dibujan.
 */
export const NAV_ICON_NAMES = [
  // Los siete originales.
  'home',
  'patients',
  'calendar',
  'orders',
  'results',
  'billing',
  'settings',

  // Gente y conversación.
  'people',
  'chat',
  'directory',

  // Atención clínica.
  'stethoscope',
  'hospital',
  'flask',
  'scan',
  'scalpel',
  'pill',
  'heart',
  'folder',
  'note',

  // Papeles: los tres que `orders` hacía a la vez.
  'clipboard',
  'survey',
  'book',
  'labels',

  // Cosas y lugares.
  'building',
  'factory',
  'package',
  'bag',
  'tag',
  'megaphone',
  'pin',
  'route',
  'globe',

  // Dinero.
  'chart',
  'star',

  // Confianza y llaves.
  'shield',
  'key',
  // Candado: lo que uno guarda, no lo que presta. Ver la nota del set.
  'lock',
  'link',
  'flag',
  'umbrella',
  'briefcase',

  // Contacto: correo y teléfono, los dos datos que pide todo formulario de alta.
  'mail',
  'phone',

  // Avisos y ajustes.
  'bell',
  'sliders',
  'history',
  'teach',

  // Dirección: los dos únicos que NO nombran una sección. Los pide el motor de
  // formularios por partes para sus botones «Atrás» y «Siguiente» sin texto.
  // El porqué está donde se dibujan: `atoms/nav-icon/nav-icon.types.ts`.
  'arrow-left',
  'arrow-right',
  'remove',
] as const;
export type NavIconName = (typeof NAV_ICON_NAMES)[number];

/**
 * Un destino del menú, tal como el registro lo declara.
 *
 * Coincide **estructuralmente** con lo que el nav lateral consume, así que no
 * hace falta ningún adaptador: el tipado estructural de TypeScript se encarga.
 * Son dos contratos distintos con la misma forma, y eso es correcto — uno dice
 * *qué secciones tiene la aplicación* y el otro *qué sabe dibujar el componente*.
 */
export interface NavMenuItem {
  readonly label: string;
  readonly route: string;
  readonly icon: NavIconName;
}

/**
 * Un desplegable del menú: un puñado de destinos parecidos bajo un rótulo.
 *
 * Es el segundo escalón de la barra, y quién va con quién lo declara
 * `navigation.subgroups.ts` — acá sólo está la forma. Un bloque con **un solo**
 * destino visible no se dibuja como desplegable: lo decide el armazón al
 * pintar, porque depende de lo que esta sesión ve y no del reparto.
 */
export interface NavMenuBlock {
  readonly label: string;
  readonly icon: NavIconName;
  readonly items: readonly NavMenuItem[];
}

/**
 * Un grupo rotulado de destinos.
 *
 * Lleva las dos vistas del mismo contenido a propósito: `items` es la lista
 * **plana** —lo que el grupo ofrece, que es lo que preguntan las pruebas, la
 * marca de «acá estás» y cualquiera que necesite recorrer destinos— y `blocks`
 * es cómo se reparte en desplegables para dibujarse. Derivar una de la otra en
 * cada consumidor es cómo empiezan a divergir; se calculan juntas, una sola vez,
 * en `NavigationService`.
 */
export interface NavMenuSection {
  readonly label: string;

  /** Ícono del grupo cerrado. Ver `NAV_GROUP_ICONS`. */
  readonly icon: NavIconName;

  readonly items: readonly NavMenuItem[];

  readonly blocks: readonly NavMenuBlock[];
}

/**
 * Un escalón de la ruta de navegación. Sin `routerLink` es texto, no enlace.
 *
 * Más angosto que el del breadcrumb —que admite además un array de comandos—
 * porque el armazón sólo produce rutas absolutas. Angosto sigue siendo
 * asignable a ancho, que es lo que importa en el punto de encuentro.
 */
export interface NavBreadcrumbItem {
  readonly label: string;
  readonly routerLink?: string;
}

/**
 * Grupos de primer nivel del menú. Son **dominios funcionales**, no pantallas.
 *
 * El orden del array es el orden en que se dibujan: lo que se usa todos los
 * días arriba, lo administrativo después, lo propio al final. `Mi cuenta` va
 * último y separado porque el vault lo exige explícitamente — mezclar «mis
 * datos» con «los datos que administro» es lo que hace que alguien edite el
 * registro equivocado.
 */
export const NAV_GROUPS = [
  'General',
  'Atención',
  'Administración',
  'Facturación',
  'Mi cuenta',
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/**
 * Si la sección tiene pantalla propia o todavía no.
 *
 * `planificada` no es un adorno: es lo que hace que el armazón se pueda
 * recorrer entero antes de que las 693 vistas existan, y lo que le da a cada
 * quien un lugar declarado donde montar la suya. Pasar una sección a
 * `disponible` es agregar su componente en `app.routes.ts`; nada más.
 */
export type SectionAvailability = 'disponible' | 'planificada';

/**
 * Una sección del área autenticada.
 *
 * Es la **única fuente** de la que salen a la vez la ruta hija del armazón, la
 * entrada del menú, el título de la pestaña y la ruta de navegación
 * (breadcrumb). Tenerlas separadas es lo que produce el defecto clásico —un
 * ítem de menú que apunta a una ruta que nadie declaró—, y por eso el registro
 * es uno solo: si la sección no está acá, no existe en ningún lado.
 */
export interface AppSection {
  /** Ruta hija del armazón, sin barra inicial (`agenda`, `administracion/usuarios`). */
  readonly path: string;

  /** Cómo se llama en el menú y en el breadcrumb. Lenguaje del dominio, no de la base. */
  readonly label: string;

  readonly group: NavGroup;

  /** Del set cerrado del nav: un nombre libre terminaría en un ícono mudo. */
  readonly icon: NavIconName;

  /**
   * Roles del token que pueden verla. **Se declara siempre**: si la ve
   * cualquier sesión, se escribe `roles: [{@link ANY_ROLE}]` — omitir el campo
   * lo hacía indistinguible de un olvido, que es exactamente cómo el paciente
   * terminó con el glosario (F-03) y con «Grupos y foros» (F-20) en su menú. Lo
   * hace cumplir el guardia de `navigation.map.spec`.
   *
   * Esconder un ítem no protege nada —la autoridad es la API, que valida en
   * cada petición—: es no ofrecer una puerta que va a estar cerrada.
   */
  readonly roles?: readonly string[];

  /**
   * Los `roles` de arriba son **excluyentes**: ni siquiera el comodín entra.
   *
   * Existe por la corrección #2 del 15/08/2026, y es la única sección que hoy
   * lo usa. El pedido del cliente no dijo «que la vean los pacientes y quien
   * administra»: dijo que la Guía de profesionales es **solo** del paciente y
   * «no debe aparecer ni ser accesible para doctor u otros roles». `SUPERADMIN`
   * es otro rol.
   *
   * Se declara acá y no como un caso especial en el guard a propósito: el menú,
   * «Tus accesos», el catálogo de tutoriales y `seccionRolesGuard` preguntan
   * todos por {@link isVisibleTo}, así que una sola bandera los mantiene de
   * acuerdo. Un caso especial en el guard produciría lo peor: un ítem visible
   * que rebota.
   */
  readonly exclusiveRoles?: boolean;

  /**
   * La sección sólo tiene sentido si la sesión pertenece a **alguna**
   * organización.
   *
   * Existe para las secciones cuyo permiso real no es un rol del token sino una
   * **membresía** (`tenant_memberships`): «Tu organización» la usan owner,
   * admin y staff, que son filas de esa tabla, no roles globales. Filtrarla por
   * `roles` dejaría fuera a la recepcionista —de quien es la pantalla—, y no
   * filtrarla por nada se la ofrecía a un paciente, que no tiene organización
   * ninguna. La membresía sí viaja en el token, en el claim `tenants`, y es de
   * primera clase: de ella salen el selector de organización y
   * `needsTenantSelection`.
   *
   * **Es ortogonal al rol, comodín incluido**: no habla de permiso sino de que
   * el dato exista. Un `SUPERADMIN` sin membresía tampoco tiene «su»
   * organización que administrar.
   */
  readonly requiresTenant?: boolean;

  /**
   * Roles para los que la sección **no existe**: ni menú, ni «Tus accesos», ni
   * puerta que empujar.
   *
   * Es el complemento que a `requiresTenant` le faltaba, y nació de medirlo:
   * ese campo se escribió para que «Tu organización» no se le ofreciera a un
   * paciente —«que no tiene organización ninguna»—, y esa premisa resultó
   * falsa. El alta de paciente crea a propósito una membresía en el tenant por
   * defecto (`iam-patient-self-registration.service.ts`, paso 5) porque sin
   * ella el `TenantContextInterceptor` le contesta 403 a toda petición
   * posterior y la cuenta queda inservible. Medido contra la API viva: un
   * paciente recién registrado llega con `tenants` de un elemento. Así que
   * `requiresTenant` no excluye a nadie, y el paciente terminaba viendo «Tu
   * organización», «Pedidos de farmacia» y «Promociones».
   *
   * Por qué no se resolvió con `roles` + `exclusiveRoles`: el token sólo
   * transporta seis códigos (`USER`, `SECURITY_ADMIN`, `SUPERADMIN`,
   * `PATIENT`, `PRACTITIONER`, `CLINICIAN`). Quien atiende el mostrador de una
   * farmacia **no tiene rol propio** —owner/admin/staff son filas de
   * `tenant_memberships` que el front no decodifica—, así que enumerar los
   * roles permitidos le habría cerrado la puerta justo a la persona de quien es
   * la pantalla. Decir a quién NO se le ofrece es lo único que hoy se puede
   * afirmar con lo que el token trae.
   *
   * A diferencia de {@link fueraDelMenuPara}, esto sí quita la sección de todas
   * las superficies. No reemplaza al guard del servidor, que sigue siendo la
   * única autoridad.
   */
  readonly hiddenFor?: readonly string[];

  /**
   * Roles para los que la sección **sigue existiendo y funcionando, pero no
   * ocupa una entrada de primer nivel** en el menú.
   *
   * No es `roles` al revés y la diferencia importa: `roles` decide si la
   * sesión *puede entrar* —lo pregunta `seccionRolesGuard`, que rebota—,
   * mientras que esto decide si la sección *se ofrece en el menú*. Una
   * sección escondida acá se sigue alcanzando por su ruta, por un enlace de
   * otra pantalla y por «Tus accesos»: lo único que pierde es el renglón
   * lateral.
   *
   * Nació con la lista cerrada de ocho opciones que pidió el cliente para el
   * panel del médico (22/08/2026, §4.H del plan de UX). Ahí el problema no
   * era de permisos —un médico puede ver sus encuestas y su organización— sino
   * de cantidad: dieciséis entradas de primer nivel para un trabajo que se
   * hace con ocho. Sacarle el rol a la sección le habría cerrado la puerta;
   * esto sólo la saca de la vista.
   */
  readonly fueraDelMenuPara?: readonly string[];

  readonly availability: SectionAvailability;

  /**
   * Qué es la sección, en una línea y en segunda persona. Se muestra en el
   * estado vacío mientras la pantalla no exista: un vacío que no explica de qué
   * era la pantalla no le sirve a nadie.
   */
  readonly summary: string;

  /**
   * Módulo del modelo canónico que la respalda (`M41 scheduling`).
   *
   * Es trazabilidad, no decoración: cuando alguien vaya a construir la
   * pantalla, esto le dice qué ficha de `SALUD/Vistas/` abrir y contra qué
   * endpoints se implementa.
   */
  readonly module: string;
}

/** Prefijo de todos los títulos de pestaña, tal como ya lo usaban las rutas. */
export const APP_TITLE = 'AloVida';

/**
 * Clave con la que cada ruta lleva su sección en `data`.
 *
 * Es una constante y no el literal suelto para que quien la lee y quien la
 * escribe no puedan desincronizarse con un error de tipeo que el compilador no
 * vería.
 */
export const SECTION_ROUTE_DATA = 'seccion';

/**
 * Clave con la que una pantalla hija declara en `data` **sus propios** roles.
 *
 * Es para las hijas que cuelgan de una sección sin roles pero que no son de
 * cualquiera: «Configurar tu perfil», «Tu perfil público» y «Artículos médicos»
 * viven bajo «Mi perfil», que abre todo el mundo, y son sólo de quien atiende.
 * Sin esto la única forma de cerrarlas era inventarles una sección propia, que
 * el menú habría ofrecido. `seccionRolesGuard` mira esta clave **antes** que la
 * sección: la ruta manda sobre el prefijo.
 */
export const ROLES_ROUTE_DATA = 'roles';

/**
 * Si la sección **restringe** por rol, o si la ve cualquier sesión.
 *
 * Desde F-20 toda sección declara `roles`, así que «tiene `roles`» dejó de
 * distinguir a las restringidas: la universal declara `[{@link ANY_ROLE}]`. Lo
 * pregunta `app.routes.spec` para exigir `seccionRolesGuard` sólo donde hay
 * algo que hacer cumplir — ponerlo en una sección universal sería un guard que
 * nunca niega nada.
 */
export function restringePorRol(section: AppSection): boolean {
  return section.roles !== undefined && !section.roles.includes(ANY_ROLE);
}

/** Ruta absoluta de una sección, que es como la consumen el router y el menú. */
export function routeOf(section: AppSection): string {
  return `/${section.path}`;
}

/** Título de pestaña de una sección. Deriva del rótulo para que no se separen. */
export function titleOf(section: AppSection): string {
  return `${APP_TITLE} - ${section.label}`;
}

/**
 * Rol comodín: quien lo tiene ve todas las secciones.
 *
 * No es una licencia que se tome el menú: es **la regla del backend**. Su
 * `RolesGuard` corta con `if (roles.includes('SUPERADMIN')) return true` antes
 * de mirar los `@Roles(...)` del endpoint, así que sin esto el menú escondería
 * secciones que la API sí le responde a esa sesión — y una sección que existe,
 * funciona y no aparece es peor que una que aparece y da 403: no hay forma de
 * descubrir que estaba.
 */
const WILDCARD_ROLE = 'SUPERADMIN';

/**
 * Rol universal declarado: «esta sección la ve cualquier sesión», dicho a
 * propósito y no por olvido.
 *
 * Existe por F-20 (18/08/2026), la tercera vez que una fila nueva del registro
 * llegó sin `roles` y le filtró al paciente una herramienta que no es suya —el
 * glosario (F-03) y ahora «Grupos y foros»—. Omitir el campo y declararlo
 * universal se leían igual en el archivo y distinto en la intención; ahora sólo
 * una de las dos formas pasa el guardia de `navigation.map.spec`, y la
 * universalidad queda escrita donde se revisa el PR.
 */
export const ANY_ROLE = '*';

/**
 * Si los roles de una sesión alcanzan para ver la sección.
 *
 * Una sección sin `roles` la ve cualquier sesión; con `roles`, alcanza con
 * tener **uno** de ellos (son alternativas, no requisitos acumulativos: el
 * backend declara varios `@Roles(...)` sobre el mismo endpoint).
 *
 * **No autoriza nada.** Filtrar el menú es cortesía: quien escriba la ruta a
 * mano llega igual, y quien la autoriza de verdad es el backend.
 */
export function isVisibleTo(
  section: AppSection,
  roles: readonly string[],
  tenants: readonly string[] = [],
): boolean {
  const required = section.roles;

  // Lo primero, porque no admite excepción: una sección oculta para este rol no
  // existe para esta sesión, comodín incluido. Ver {@link AppSection.hiddenFor}.
  if (section.hiddenFor?.some((role) => roles.includes(role)) === true) {
    return false;
  }

  // La membresía se pregunta **antes** que el rol y no la salva el comodín: no
  // es permiso, es que el dato exista. Ver {@link AppSection.requiresTenant}.
  if (section.requiresTenant === true && tenants.length === 0) {
    return false;
  }

  // Una sección con roles **excluyentes** ignora el comodín: es la excepción
  // que la corrección #2 pidió explícitamente, y por eso el `if` del comodín
  // deja de ser lo primero que se evalúa.
  if (section.exclusiveRoles === true) {
    return required !== undefined && required.some((role) => roles.includes(role));
  }

  return rolesAlcanzan(required, roles);
}

/**
 * Si la sección le ofrece una entrada de menú a esta sesión.
 *
 * Es {@link isVisibleTo} más la pregunta de {@link AppSection.fueraDelMenuPara}:
 * poder entrar y aparecer en el menú dejaron de ser lo mismo el día que el
 * panel del médico tuvo que quedar en ocho renglones sin perder pantallas.
 *
 * **Sólo la consume el armado del menú.** El guard sigue preguntando por
 * `isVisibleTo`, que es lo correcto: esconder un renglón no es cerrar una
 * puerta, y hacer que lo fuera convertiría cada limpieza de menú en una
 * pérdida silenciosa de acceso.
 */
export function apareceEnElMenu(
  section: AppSection,
  roles: readonly string[],
  tenants: readonly string[] = [],
): boolean {
  if (!isVisibleTo(section, roles, tenants)) {
    return false;
  }
  const fuera = section.fueraDelMenuPara;
  if (fuera === undefined) {
    return true;
  }
  // `ANY_ROLE` acá significa «para nadie ocupa un renglón», que es lo que pide
  // una sección apagada de momento —la verificación de identidad— y no un rol
  // concreto al que le sobra. Es el mismo comodín que ya lee `rolesAlcanzan` en
  // `roles`, con el mismo sentido de «cualquiera»: sin esto, apagarla obligaría
  // a enumerar todos los roles del producto y a acordarse del que se agregue
  // mañana.
  return !fuera.includes(ANY_ROLE) && !fuera.some((rol) => roles.includes(rol));
}

/**
 * Si los roles de una sesión alcanzan una lista de roles requeridos, con la
 * regla del comodín incluida.
 *
 * Es la misma pregunta que responde `isVisibleTo` para una sección, separada
 * para que una pantalla hija que declara sus propios roles (`ROLES_ROUTE_DATA`)
 * se juzgue con **la misma regla** y no con una copia: sin `required` pasa
 * cualquiera; con `required`, alcanza con uno; `SUPERADMIN` siempre pasa.
 */
export function rolesAlcanzan(
  required: readonly string[] | undefined,
  roles: readonly string[],
): boolean {
  if (roles.includes(WILDCARD_ROLE)) {
    return true;
  }
  if (required?.includes(ANY_ROLE) === true) {
    return true;
  }
  return required === undefined || required.some((role) => roles.includes(role));
}
