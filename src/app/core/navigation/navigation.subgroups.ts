import type { NavGroup, NavIconName } from './navigation.types';

/* ============================================================================
    El reparto del menú en desplegables.

    El registro de secciones (`navigation.map.ts`) ya dice a qué **dominio**
    pertenece cada una —los cinco `NAV_GROUPS` que declara el vault en
    `SALUD/Vistas/👥 Actores y navegación.md`—, y con eso alcanzaba mientras el
    menú tuvo doce renglones. Con cincuenta y cinco secciones dejó de alcanzar:
    quien administra abre «Administración» y se encuentra veintidós entradas
    seguidas, y ahí un rótulo de dominio no ordena nada — sólo separa listas
    largas de listas largas.

    Este archivo agrega el **segundo escalón**: dentro de cada dominio, los
    destinos se reparten en bloques de cosas parecidas, y cada bloque se dibuja
    como un desplegable con su propio ícono. Las tres reglas del vault siguen
    intactas —el reparto no mueve ninguna sección de dominio ni le toca los
    roles—; lo único que decide es **con quién se dibuja al lado**.

    ## Por qué acá y no como un campo de `AppSection`

    Porque son dos preguntas distintas con dos ritmos distintos. «De qué dominio
    es esta sección» es del modelo y lo fija el vault; «con cuáles otras se
    agrupa en la barra» es de la interfaz y se reacomoda cuando el menú crece.
    Mezclarlas obligaría a tocar el registro —la fuente de las rutas, los
    títulos y el breadcrumb— cada vez que alguien reordena un desplegable.

    Que las dos listas no se separen no queda librado a la memoria: una prueba
    de `navigation.subgroups.spec.ts` exige que **cada** sección del registro
    esté en exactamente un bloque, y que ningún bloque nombre una ruta que no
    existe. Agregar una sección sin repartirla rompe la prueba, que es
    exactamente cuándo hay que enterarse.

    ## Un bloque de uno no es un desplegable

    El reparto es el mismo para todo el mundo, pero lo que cada sesión ve no:
    de los cuatro directorios, quien ejerce ve uno solo. Un desplegable con un
    único renglón adentro es un clic de más para llegar a lo mismo, así que el
    armazón lo dibuja suelto —con su ícono, en el mismo lugar del orden—. Eso lo
    resuelve el armazón al pintar, no este archivo: acá el reparto se declara
    entero y una sola vez.
    ========================================================================== */

/** Un bloque desplegable del menú: cómo se llama, qué dibuja y qué contiene. */
export interface NavSubgroup {
  /** Rótulo del desplegable. Lenguaje del dominio, como el de las secciones. */
  readonly label: string;

  /** El dominio dentro del cual vive. Sus secciones tienen que ser de ese grupo. */
  readonly group: NavGroup;

  /**
   * El ícono del bloque cerrado, que es el único momento en que el bloque tiene
   * que decir de qué es sin mostrar nada de lo que tiene adentro.
   */
  readonly icon: NavIconName;

  /**
   * Las rutas de las secciones que agrupa, tal como las declara `path` en el
   * registro: **sin** barra inicial.
   */
  readonly paths: readonly string[];
}

/**
 * El reparto completo, en el orden en que se declara.
 *
 * El orden de dibujo NO sale de acá sino del registro: un bloque se pinta donde
 * aparece su primera sección visible, así que el menú conserva la secuencia que
 * ya tenía y una sesión que no ve la primera sección de un bloque no lo ve
 * saltar de lugar. Este orden es el de lectura, y coincide con aquél.
 */
export const NAV_SUBGROUPS: readonly NavSubgroup[] = [
  /* -- General ------------------------------------------------------------ */
  {
    label: 'Inicio',
    group: 'General',
    icon: 'home',
    // El panel y la guía de cómo usarlo: las dos puertas de entrada, no una
    // pantalla de trabajo. Quien ejerce no ve ninguna de las dos (§4.H), así
    // que para el médico este bloque no existe.
    paths: ['dashboard', 'tutorials'],
  },
  {
    label: 'Comunidad',
    group: 'General',
    icon: 'people',
    // Hablar con alguien: uno a uno o en foro. Es la misma actividad con
    // distinta cantidad de gente.
    paths: ['messaging', 'groups'],
  },
  {
    label: 'Directorios',
    group: 'General',
    icon: 'directory',
    // Buscar a quién o a dónde ir. Ya venía agrupado a mano en el armazón: era
    // el primer bloque del producto, y este archivo lo generaliza en vez de
    // dejarlo como caso especial.
    //
    // `directories` (FT-18) va primero: es la portada del bloque, y el orden
    // de dibujo lo decide `navigation.map.ts`, no este array — acá sólo se
    // declara que las cinco rutas son del mismo bloque.
    //
    // **Desde el 08/09/2026 este bloque ya no se dibuja como desplegable**, y
    // el reparto sigue igual de necesario. Los cuatro directorios salieron del
    // menú (`fueraDelMenuPara: [ANY_ROLE]` en su fila del registro) para que se
    // entre por la portada, así que en la barra el bloque queda con una sola
    // sección y el armazón la dibuja suelta. Pero la lista de las cinco no era
    // sólo para agrupar renglones: es lo que lee `DirectoriesOverview` para
    // saber cuáles son los directorios que tiene que ofrecer. Vaciar el bloque
    // «porque ya no hay desplegable» dejaría esa pantalla sin nodos, que es
    // justo la que ahora hace todo el trabajo.
    //
    // `nearby-places` (FT-19) NO entra acá aunque sea "a dónde ir": esta
    // lista la lee tal cual `DirectoriesOverview` para dibujar los nodos de
    // «los cuatro directorios» (ver el comentario de esa pantalla), y
    // `nearby-places` no es un directorio —sale de tu receta y tu ubicación,
    // no de un catálogo—. Metida acá rompía esa pantalla: mostraba 5 nodos
    // en vez de 4 (`directories-overview.spec.ts`). Tiene su propio bloque,
    // más abajo.
    paths: [
      'directories',
      'directory',
      'laboratory-directory',
      'clinics-directory',
      'pharmacies-directory',
    ],
  },
  {
    label: 'Lugares cercanos',
    group: 'General',
    icon: 'pin',
    // Un solo destino: el armazón lo dibuja suelto (ver la nota de arriba,
    // «un bloque de uno no es un desplegable»). Va en su propio bloque y no
    // en «Directorios» para no ensuciar la lista que lee `DirectoriesOverview`.
    paths: ['nearby-places'],
  },

  /* -- Atención -----------------------------------------------------------
     «Consultorio» ya no existe (pedido del propietario, 04/09/2026). Agrupaba
     `consultation` y `schedule`; la primera salió del menú y la segunda es
     **Consultas médicas**, así que el subgrupo quedaba con un solo hijo: un
     escalón que había que abrir para encontrar una única cosa.

     Ahora «Consultas médicas» cuelga directo de Atención. Un subgrupo se
     justifica cuando ordena varias secciones, no cuando envuelve una. */
  {
    label: 'Historia clínica',
    group: 'Atención',
    icon: 'folder',
    // Lo que queda escrito del paciente: el archivo y lo que se le agrega hoy.
    paths: ['medical-records', 'progress-notes'],
  },
  {
    label: 'Estudios y procedimientos',
    group: 'Atención',
    icon: 'scan',
    // Lo que se le pide o se le hace al paciente fuera de la consulta.
    paths: ['diagnostics', 'interventions'],
  },
  {
    label: 'Visitas',
    group: 'Atención',
    icon: 'route',
    // Atención que sale del consultorio, de los dos lados: la bandeja de quien
    // recibe la visita y la agenda de quien la hace.
    paths: ['lab-visits', 'my-visits'],
  },
  {
    label: 'Formularios y referencia',
    group: 'Atención',
    icon: 'clipboard',
    // Las herramientas de quien atiende que no son un paciente: lo que se
    // consulta —el vocabulario y el catálogo de servicios de la práctica—, lo
    // que se diseña, lo que se manda a responder y lo que se cotiza sobre ese
    // mismo catálogo (FT-24, junto a «Mis servicios» por ser la misma tabla
    // vista desde el paso siguiente).
    paths: ['glossary', 'form-builder', 'my-services', 'my-quotations', 'questionnaires'],
  },

  /* -- Administración ----------------------------------------------------- */
  {
    label: 'Personas',
    group: 'Administración',
    icon: 'people',
    // Las dos caras del padrón: quien se atiende y quien tiene cuenta.
    paths: ['administration/patients', 'administration/users'],
  },
  {
    label: 'Organizaciones',
    group: 'Administración',
    icon: 'building',
    // El padrón de organizaciones y las que son de uno. Van juntas porque son
    // la misma entidad vista desde arriba y desde adentro.
    paths: ['administration/organizations', 'administration/my-organization', 'my-organizations'],
  },
  {
    label: 'Seguros',
    group: 'Administración',
    icon: 'umbrella',
    // Quién paga, quién intermedia y qué se le presentó.
    paths: [
      'administration/insurance',
      'administration/brokers',
      'administration/insurance-claims',
    ],
  },
  {
    label: 'Identidad y accesos',
    group: 'Administración',
    icon: 'shield',
    // Quién es quién y quién entra en nombre de quién.
    paths: [
      'administration/delegated-access',
      'administration/identity-providers',
      'administration/identity-assurance',
    ],
  },
  {
    label: 'Catálogos y contenido',
    group: 'Administración',
    icon: 'labels',
    // Lo que la plataforma dice antes de que nadie la use: vocabulario,
    // paquetes, formularios, servicios ofrecidos — y la revisión de lo que
    // publica la gente, que es contenido igual.
    paths: [
      'administration/terminology',
      'administration/content-packs',
      'administration/moderation',
      'administration/services-catalog',
      'administration/clinical-forms',
    ],
  },
  {
    label: 'Territorio',
    group: 'Administración',
    icon: 'globe',
    // Dónde opera la plataforma: el país y el mapa.
    paths: ['administration/health-context', 'administration/geolocation'],
  },
  {
    label: 'Red de salud',
    group: 'Administración',
    icon: 'hospital',
    // Las consolas de cada tipo de establecimiento. No es «mi organización»:
    // es configurar la clínica, el laboratorio o la planta como institución.
    paths: [
      'administration/medical-organization',
      'administration/medical-laboratory',
      'administration/pharma-lab',
    ],
  },
  {
    label: 'Farmacia',
    group: 'Administración',
    icon: 'bag',
    // El mostrador: lo que se despacha y lo que se promociona.
    paths: ['administration/pharmacy-orders', 'administration/pharmacy-campaigns'],
  },

  /* -- Facturación -------------------------------------------------------- */
  {
    label: 'Cobros y cuentas',
    group: 'Facturación',
    icon: 'billing',
    // Lo que se cobra y cómo se asienta.
    paths: ['billing', 'administration/accounting', 'assets-liabilities'],
  },

  /* -- Mi cuenta ---------------------------------------------------------- */
  {
    label: 'Mi perfil',
    group: 'Mi cuenta',
    icon: 'patients',
    // Quién soy para la plataforma, y cómo lo demuestro.
    paths: ['my-account', 'my-account/identity'],
  },
  {
    label: 'Mis gestiones',
    group: 'Mi cuenta',
    icon: 'calendar',
    // Lo que tengo en curso: un turno, un pedido, mis puntos.
    paths: ['my-account/appointments', 'my-account/pharmacy-orders', 'my-account/loyalty'],
  },
  {
    label: 'Mi salud',
    group: 'Mi cuenta',
    icon: 'heart',
    // Mis datos clínicos. Es el bloque que la regla del vault manda tener
    // separado de la gestión: «mis datos» y «los datos que administro» no
    // comparten navegación, y acá tampoco comparten desplegable.
    paths: [
      'my-account/medical-record',
      'my-account/diagnostic-results',
      'my-account/diagnostic-orders',
      'my-account/questionnaires',
    ],
  },
  {
    label: 'Avisos',
    group: 'Mi cuenta',
    icon: 'bell',
    // La bandeja y la perilla que decide qué llega a ella. «Ajustes» se reparte
    // acá aunque hoy no ocupe renglón —se entra por el ícono del encabezado, no
    // por la barra—: el reparto cubre el registro entero, y una sección que
    // mañana vuelva al menú tiene que aparecer en el bloque que le corresponde
    // y no suelta al final.
    paths: ['notification-center', 'settings'],
  },
];

/**
 * El bloque de cada ruta, indexado por `path`.
 *
 * Se arma una vez al cargar el módulo: el menú se recalcula con cada cambio de
 * token y de ruta, y recorrer veintiún bloques por sección en cada recálculo es
 * trabajo que no cambia nunca de respuesta.
 */
export const SUBGROUP_BY_PATH: ReadonlyMap<string, NavSubgroup> = new Map(
  NAV_SUBGROUPS.flatMap((subgroup) => subgroup.paths.map((path) => [path, subgroup] as const)),
);

/**
 * El ícono de cada dominio del menú, para el desplegable de primer nivel.
 *
 * Vive acá y no en `navigation.types.ts` por la misma razón que el reparto: es
 * una decisión de cómo se dibuja la barra, no del modelo de secciones. Está
 * completo por construcción —`Record<NavGroup, …>` no compila si falta uno—, y
 * eso es lo que evita el grupo sin ícono cuando el vault agregue el sexto.
 */
export const NAV_GROUP_ICONS: Record<NavGroup, NavIconName> = {
  General: 'home',
  // Lo que se hace con un paciente delante.
  Atención: 'stethoscope',
  // La perilla: configurar la plataforma, no usarla.
  Administración: 'settings',
  Facturación: 'billing',
  // Una persona: mis propios datos, no los que administro.
  'Mi cuenta': 'patients',
};
