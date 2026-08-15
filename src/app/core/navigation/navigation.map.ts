import type { AppSection } from './navigation.types';

/* ============================================================================
    El registro de secciones del área autenticada.

    De acá salen —a la vez— las rutas hijas del armazón, el menú lateral, el
    título de cada pestaña y la ruta de navegación. Es deliberadamente **datos
    puros**: no importa ningún componente, para que `core/` no dependa de
    `features/`. Quién pinta cada sección lo decide `app.routes.ts`, que es
    donde los componentes ya viven.

    ## De dónde salen estas secciones (y por qué no hay más)

    Del vault, no de un diseño aparte:

    - los **dominios funcionales** y el «autoservicio aparte», de
      `SALUD/Vistas/👥 Actores y navegación.md`;
    - el **módulo que respalda** cada una y su prioridad, de
      `SALUD/Vistas/🗺️ Orden de trabajo.md` (las 693 vistas, en 6 fases);
    - los **roles**, de los `@Roles(...)` reales del backend que ese mismo
      documento tabula.

    Están las de fase 0 y 1 —fundación y operación clínica diaria—, que son las
    que el producto necesita para ser recorrible. **No se agregan secciones
    "por si acaso"**: una entrada de menú cuyo módulo nadie va a construir esta
    iteración es ruido. Agregar una es agregar acá su fila, con su módulo y sus
    roles justificados en el documento de actores.

    > Nota de alcance (2026-08-04): 674 de las 693 vistas están marcadas
    > «Listado pendiente» en el vault — se pueden diseñar, pero no implementar
    > hasta que el backend exponga el `GET` de colección. Por eso casi todas
    > estas secciones nacen `planificada`: el armazón se recorre entero, y cada
    > pantalla se enciende cuando su listado exista.
    ========================================================================== */

/**
 * Las secciones del área con sesión, en el orden en que se dibujan dentro de
 * su grupo.
 *
 * El ícono sale de un set cerrado de siete, así que **se repite a propósito**
 * en secciones distintas: es una ayuda visual, no un identificador, y va
 * `aria-hidden` con el rótulo al lado.
 */
export const APP_SECTIONS: readonly AppSection[] = [
  {
    path: 'dashboard',
    label: 'Panel',
    group: 'General',
    icon: 'home',
    availability: 'disponible',
    summary: 'Tu punto de partida: la sesión activa y el estado del sistema.',
    module: 'M30 read_models',
  },
  {
    // El centro de tutoriales. Va en «General» y no en una sección de ayuda
    // aparte por una razón concreta: un desplegable de ayuda es donde van a
    // morir los tutoriales —se abre por accidente, no se comparte por enlace y
    // no tiene dónde decir cuánto llevás hecho—. Como sección tiene URL propia y
    // entra en el menú con las mismas reglas que el resto.
    //
    // Sin `roles` a propósito: cualquiera que pueda entrar tiene algo que
    // aprender, y el catálogo ya se filtra por rol tutorial por tutorial. Poner
    // roles acá escondería el centro entero a quien tiene pocos.
    path: 'tutorials',
    label: 'Tutoriales',
    group: 'General',
    icon: 'results',
    availability: 'disponible',
    summary: 'Aprendé a usar cada sección con recorridos guiados sobre la aplicación real.',
    module: '—  ayuda en producto',
  },

  {
    // Carril R2-1 · punto 1 del reclamo. Acá estaba el **muro profesional**, y
    // el cliente pidió sacarlo del menú del paciente: «o cambiarle su enfoque:
    // debe mostrar una especie de guía telefónica de todos los doctores
    // agrupados por especialidad». Esta es esa guía.
    //
    // El muro NO se borró: `features/feed/` sigue en pie y su ruta también. Lo
    // único que se le sacó es la entrada del menú — borrarlo es una decisión
    // de producto que el cliente no pidió.
    //
    // Sin `roles`, ahora por una razón más simple que antes: una guía de
    // profesionales la usa sobre todo quien busca médico, o sea el paciente.
    path: 'directory',
    label: 'Guía de profesionales',
    group: 'General',
    icon: 'home',
    availability: 'disponible',
    summary: 'Todos los profesionales, agrupados por especialidad.',
    module: 'M05 profiles',
  },
  {
    // Directorio de unidades publicadas del módulo 23. Es una sección distinta
    // de `/diagnostics`, que sigue siendo la cola clínica de órdenes/resultados.
    // La ruta tampoco coincide con `/diagnostic-units`, prefijo exclusivo de API.
    path: 'laboratory-directory',
    label: 'Directorio de laboratorios',
    group: 'General',
    icon: 'results',
    availability: 'disponible',
    summary: 'Laboratorios e imagenología, agrupados por categoría y con su oferta vigente.',
    module: 'M23 diagnostic_units',
  },

  /* -- Atención · fase 1 del orden de trabajo ------------------------------ */

  {
    path: 'schedule',
    label: 'Agenda',
    group: 'Atención',
    icon: 'calendar',
    // El documento de actores ubica estos tres roles en M41; `SCHEDULER` queda
    // afuera a propósito: ahí figura en M32 (flujos), no en agenda.
    roles: ['SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'PRACTITIONER'],
    // Encendida con la slice de lectura de agenda: `GET /scheduling/resources`,
    // `/slots` y `/bookings` existen desde 2026-08-07. El módulo se había
    // construido entero de escritura —se generaban cupos y se confirmaban citas,
    // pero no había forma de verlos— y era eso, y no un `GET` de colección
    // faltante en general, lo que la tenía en espera.
    availability: 'disponible',
    summary: 'Gestioná disponibilidad, reservas y confirmaciones de turno.',
    module: 'M41 scheduling',
  },
  {
    path: 'medical-records',
    label: 'Archivo clínico',
    group: 'Atención',
    icon: 'results',
    roles: ['CLINICIAN', 'PRACTITIONER'],
    // Encendida con `GET /clinical/patients/:id/summary` (UC-39-20) y
    // `GET /charts/patients/:id/chart` (UC-40-14). No hay —ni debe haber— un
    // listado de todas las historias: se entra por persona, y la pantalla de la
    // sección es justamente la que elige a quién se mira.
    availability: 'disponible',
    summary: 'Consultá la historia clínica de los pacientes que atendés.',
    module: 'M08 clinical · M15 chart',
  },
  {
    path: 'diagnostics',
    label: 'Laboratorio e imagen',
    group: 'Atención',
    icon: 'results',
    // Los mismos dos roles que declaran los cuatro controladores de M20 y el de
    // órdenes clínicas de M08: es PHI y la escribe y la lee quien atiende.
    roles: ['CLINICIAN', 'PRACTITIONER'],
    // Encendida con `GET /diagnostics/work-orders` —que ya existía— y con la
    // slice de lectura por paciente `GET /diagnostics/patients/:id/orders`, que
    // no. El módulo repetía exactamente el defecto que había tenido agenda:
    // veinte endpoints construidos, ninguna lectura que dijera qué se le pidió a
    // una persona ni qué volvió. Se pedía un laboratorio y el pedido dejaba de
    // existir para la pantalla apenas se enviaba.
    availability: 'disponible',
    summary: 'Seguí la cola del laboratorio y los estudios que pediste.',
    module: 'M20 diagnostics · M08 clinical',
  },
  {
    // Carril 2 · punto 4 del reclamo. `TerminologyCatalog` ya resolvía el
    // mismo `GET /terminology/concepts?q=` con rol `SECURITY_ADMIN`: es un
    // buscador técnico de `conceptId` para configuración, no un glosario para
    // consulta clínica. Esta es la puerta que el cliente pidió — "cada
    // profesional", no sólo quien administra —, con una pantalla propia que no
    // expone el identificador.
    //
    // Sin `roles` a propósito: el pedido fue explícito, y la lectura del
    // catálogo tampoco los exige (UC-03-13).
    path: 'glossary',
    label: 'Glosario',
    group: 'Atención',
    icon: 'orders',
    availability: 'disponible',
    summary: 'Buscá un término médico y su significado en lenguaje llano.',
    module: 'M03 terminology',
  },

  /* -- Administración · fase 0, la fundación ------------------------------- */

  {
    path: 'administration/patients',
    label: 'Pacientes',
    group: 'Administración',
    icon: 'patients',
    // `assisted-registration` también la admite para CLINICIAN, pero la sección
    // es administrativa: el clínico llega por su propio flujo, no por este menú.
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Registrá y mantené la filiación de las personas atendidas.',
    module: 'M05 profiles',
  },
  {
    path: 'administration/users',
    label: 'Usuarios',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Dá de alta cuentas y revisá quién tiene acceso a la organización.',
    module: 'M01 iam',
  },
  {
    path: 'administration/organizations',
    label: 'Organizaciones',
    group: 'Administración',
    icon: 'settings',
    // El listado admite además SUPERADMIN, pero ese rol es el comodín del
    // menú (`isVisibleTo`) y no hace falta declararlo.
    roles: ['SECURITY_ADMIN'],
    // Encendida con V04-01: `GET /admin/tenants` y el alta con tipo existen
    // desde los PRs #28/#29 del backend. Sucursales y membresías siguen
    // planificadas dentro de la sección: entran con sus propias vistas.
    availability: 'disponible',
    summary: 'Dá de alta clínicas, farmacias y aseguradoras, y seguí su verificación.',
    module: 'M04 directory',
  },
  {
    // W2/F3 (M29): el backend del módulo es solo de comando —sin GET—, así
    // que la sección entra como panel de operaciones; los listados llegan
    // con sus endpoints de consulta.
    path: 'administration/delegated-access',
    label: 'Acceso delegado',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Delegá acceso con alcance y vigencia, y administrá sus permisos.',
    module: 'M29 delegated_access',
  },
  {
    // W2/F4 (M40): primer uso de `IDENTITY_ADMIN` en el mapa — los doce
    // comandos del backend lo exigen (`AUTH_SERVICE` también puede, pero es un
    // rol de servicio, no de una persona que navega). Como el M29, el módulo
    // no tiene GET: entra como panel de operaciones.
    path: 'administration/identity-providers',
    label: 'Proveedores de identidad',
    group: 'Administración',
    icon: 'settings',
    roles: ['IDENTITY_ADMIN'],
    availability: 'disponible',
    summary: 'Configurá el login federado: proveedores, claves y vinculación.',
    module: 'M40 auth_providers',
  },
  {
    // W2/F5 (M27, lado administrativo): como M29 y M40, el backend es solo de
    // comando —sin GET admin—, así que la sección entra como panel de
    // operaciones con identificadores pegados. Distinta de «Verificar
    // identidad» (autoservicio): acá se administra el ciclo, no se inicia el
    // trámite propio.
    path: 'administration/identity-assurance',
    label: 'Verificación de identidad',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Administrá autoridades, políticas y casos de verificación de identidad.',
    module: 'M27 identity_assurance',
  },
  {
    path: 'administration/terminology',
    label: 'Terminología',
    group: 'Administración',
    icon: 'orders',
    // La **lectura** del catálogo no pide rol —es metadato compartido, sin datos
    // de paciente, y el backend lo dice explícitamente en UC-03-13—, pero la
    // sección se deja acotada a quien administra porque es a quien le sirve:
    // resolver un `*ConceptId` es una tarea de configuración, no de atención.
    roles: ['SECURITY_ADMIN'],
    // Encendida con UC-03-13: `GET /terminology/concepts?q=` existe desde
    // siempre. Lo que faltaba no era el listado del backend —el motivo general
    // por el que 674 vistas siguen en espera— sino que el cliente implementaba
    // sólo la mitad del endpoint: resolvía `?ids=` y nunca `?q=`.
    availability: 'disponible',
    summary: 'Consultá los catálogos que alimentan todos los selectores.',
    module: 'M03 terminology',
  },
  {
    // W5/M44. El backend tiene **una** lectura —`GET /health-context/contexts/
    // resolve`— y doce comandos, así que la sección entra como panel de
    // operaciones, igual que M29, M40 y M27: la portada agrupa lo que se puede
    // hacer y el resolver es su acción primaria. Los listados llegan con sus
    // `GET` de colección, que hoy no existen.
    path: 'administration/health-context',
    label: 'Contexto sanitario',
    group: 'Administración',
    // Mismo ícono que Terminología, y por la misma razón: los dos son catálogos
    // de plataforma que alimentan decisiones, no registros de atención.
    icon: 'orders',
    // Los cinco roles humanos de `HealthContextController`. `SYSTEM` queda
    // afuera a propósito: es un rol de servicio para el scheduler, no de alguien
    // que navega — el mismo criterio que dejó a `AUTH_SERVICE` fuera de M40.
    roles: [
      'CONTEXT_CURATOR',
      'CONTEXT_CONSUMER',
      'SOURCE_ADMIN',
      'QUALITY_REVIEWER',
      'PLATFORM_ADMIN',
    ],
    availability: 'disponible',
    summary: 'Recolectá y publicá el contexto sanitario de cada país, con su evidencia.',
    module: 'M44 health_context',
  },
  {
    // W5/M13. Una lectura (`GET /geo/tracked-subjects/:id/last-position`) y diez
    // comandos: mismo patrón de panel de operaciones.
    //
    // **La ruta cuelga de `administration/` y eso no es decoración**: el prefijo
    // de la API es `/geo`, y el proxy compara por inicio de ruta sin límite de
    // segmento. Una sección llamada `geolocation` a nivel raíz se iría entera a
    // la API. Lo verifica `scripts/check-route-prefixes.mjs`.
    path: 'administration/geolocation',
    label: 'Geolocalización',
    group: 'Administración',
    icon: 'settings',
    // Los cuatro controllers del módulo exigen el mismo rol, sin excepción.
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Seguí sujetos rastreados, sus recorridos y las geocercas de la organización.',
    module: 'M13 geo',
  },
  {
    // Carril 1 (punto 3 del reclamo). `GET /billing/service-catalog` no exige
    // rol —cualquier profesional que cotice necesita leerlo—, pero la sección
    // en sí queda en Administración: mantener la lista fija es una tarea de
    // configuración, no de atención. El alta (`POST`) sí exige `SECURITY_ADMIN`,
    // como el resto de `billing`.
    path: 'administration/services-catalog',
    label: 'Catálogo de servicios',
    group: 'Administración',
    icon: 'billing',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Mantené la lista fija de servicios sobre la que se arman los presupuestos.',
    module: 'M17 billing',
  },
  {
    // Carril 2 · punto 1 del reclamo. `chart.specialty_chart_templates` sólo
    // tenía asignación (`POST /charts/templates/:id/assignments`, UC-15-12);
    // con el alta, el listado y la lectura de esquema ya del lado del
    // backend, esta es la puerta de administración que arma la plantilla que
    // `specialty-form-block` completa dentro del encuentro.
    path: 'administration/clinical-forms',
    label: 'Formularios clínicos',
    group: 'Administración',
    icon: 'orders',
    // Mismo rol que exige el backend en `ChartTemplatesController`.
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Armá las plantillas de campos propios de cada especialidad.',
    module: 'M15 chart · M09 forms',
  },

  /* -- Facturación · fase 2 ------------------------------------------------ */

  {
    path: 'billing',
    label: 'Facturación',
    group: 'Facturación',
    icon: 'billing',
    roles: ['BILLING', 'FINANCE', 'CASHIER', 'PAYMENTS_ADMIN'],
    availability: 'planificada',
    summary: 'Emití comprobantes y seguí los cobros de la organización.',
    module: 'M26 billing · M42 payments',
  },

  {
    path: 'administration/accounting',
    label: 'Contabilidad',
    group: 'Facturación',
    icon: 'billing',
    // `PRACTITIONER` a propósito: los libros son de la práctica y quien la
    // ejerce tiene que poder verlos. El control de que la práctica consultada
    // es la suya lo hace la API, que responde 403 ante la de otra organización.
    roles: ['SECURITY_ADMIN', 'ACCOUNTING_APPROVER', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Revisá el balance de sumas y saldos y el libro diario de tu práctica.',
    module: 'M16 accounting',
  },

  /* -- Mi cuenta · autoservicio, con navegación propia --------------------
     El vault lo pide separado: son datos de la persona sobre sí misma, no
     registros que administra. Sin roles, porque nadie necesita permiso para
     mirar lo suyo. */

  {
    path: 'my-account',
    label: 'Mi perfil',
    group: 'Mi cuenta',
    icon: 'patients',
    // Encendida con V05-03: `GET /profiles/patients/me/summary` existe y no
    // pide rol, sólo identidad verificada — y ese 403 ya tiene su puerta.
    availability: 'disponible',
    summary: 'Revisá tus datos personales y el resumen de tu cuenta.',
    module: 'M05 profiles',
  },
  {
    // Las vistas `PATIENT` de M41. Es la contracara de la sección «Agenda»:
    // aquélla mira los turnos de un recurso y exige roles de agenda; ésta mira
    // los de una persona y no exige ninguno, porque el backend ya acota la
    // lectura al perfil que se le pide.
    //
    // Sin `roles` a propósito: el filtro real es tener perfil de paciente, que
    // no es un rol sino un dato de la cuenta —el claim `pid` del token—, y la
    // pantalla lo dice cuando falta en vez de esconderse del menú.
    path: 'my-account/appointments',
    label: 'Mis turnos',
    group: 'Mi cuenta',
    icon: 'calendar',
    availability: 'disponible',
    summary: 'Mirá tus turnos y pedí uno nuevo con los horarios disponibles.',
    module: 'M41 scheduling',
  },
  {
    // El archivo clínico del paciente (carril 09): cierra el recorrido que
    // empieza pidiendo un turno. Sin `roles` por lo mismo que «Mis turnos»: el
    // filtro real es tener perfil de paciente, que es un dato de la cuenta y no
    // un rol, y la pantalla lo dice cuando falta en vez de esconderse del menú.
    //
    // Encendida con el carril 09: `GET /clinical/patients/:id/summary` acepta
    // ahora al titular, con el aislamiento comprobado del lado del servidor.
    path: 'my-account/medical-record',
    label: 'Mi historia clínica',
    group: 'Mi cuenta',
    // `results` y no `patients`: lo que esta sección muestra son resultados de
    // atenciones, y el ícono de pacientes es el de «gente», que acá sería la
    // persona mirándose a sí misma.
    icon: 'results',
    availability: 'disponible',
    summary: 'Tus atenciones y tus recetas, con la descarga en PDF de cada una.',
    module: 'M08 clinical',
  },
  {
    // La ruta es la que `IDENTITY_VERIFICATION_ROUTE` ya publica como destino
    // del 403 `IDENTITY_VERIFICATION_REQUIRED`: **no se renombra**. Cambiarla
    // rompería la puerta que traduce ese error en una salida.
    path: 'my-account/identity/verify',
    label: 'Verificar identidad',
    group: 'Mi cuenta',
    icon: 'patients',
    availability: 'disponible',
    summary: 'Validá tu identidad, tu matrícula o una organización a tu cargo.',
    module: 'M27 identity_assurance',
  },
  {
    // V27-01: los casos que la verificación de arriba abre. Sin roles porque
    // el `GET /identity/me/verification-cases` tampoco los pide: cada quien
    // ve únicamente lo suyo, y eso lo resuelve el backend.
    path: 'my-account/identity/cases',
    label: 'Mis verificaciones',
    group: 'Mi cuenta',
    icon: 'patients',
    availability: 'disponible',
    summary: 'Seguí el estado de tus trámites de verificación de identidad.',
    module: 'M27 identity_assurance',
  },
];
