import type { TutorialDefinition } from '../tutorial.types';

/* ============================================================================
    Los tutoriales de la aplicación.

    ## Regla de oro

    **Ningún tutorial enseña algo que no exista.** Cada paso apunta a un
    `data-tutorial-id` que está puesto en una plantilla real, y cada ruta es una
    sección declarada en `core/navigation/navigation.map.ts`. Un tutorial que
    describe una pantalla imaginaria es peor que no tener tutoriales: entrena a
    la gente a desconfiar de la ayuda.

    ## Cómo agregar uno

    Se agrega un objeto a este archivo (o un archivo propio que se exporte desde
    acá) y se ponen los `appTutorialTarget` que sus pasos referencian. No se toca
    el motor. El registro valida al arrancar y el centro de tutoriales muestra
    los problemas que encuentre — id duplicado, requisito inexistente, ruta que
    no corresponde a ninguna sección, ciclos.

    El detalle está en `docs/tutoriales.md`.
    ========================================================================== */

/** El primero que ve alguien. Es el único con `autoStart`. */
const BIENVENIDA: TutorialDefinition = {
  id: 'bienvenida',
  version: '1.0',
  title: 'Primeros pasos en AloVida',
  description:
    'Qué es cada parte de la pantalla y cómo moverse. Cinco minutos para no tener que adivinar nada.',
  category: 'General',
  route: '/dashboard',
  estimatedMinutes: 3,
  level: 'inicial',
  autoStart: true,
  next: 'navegacion',
  steps: [
    {
      id: 'saludo',
      title: 'Bienvenida',
      body: 'Le voy a mostrar las cuatro cosas que necesita para empezar a usar la plataforma. Puede dejarlo cuando quiera y retomarlo después desde el centro de tutoriales.',
    },
    {
      id: 'panel',
      title: 'El panel',
      body: 'Es su punto de partida: qué secciones tiene habilitadas, en qué organización está trabajando y cómo va su verificación de identidad.',
      target: 'panel-accesos',
      placement: 'top',
    },
    {
      id: 'organizacion',
      title: 'La organización activa',
      body: 'Casi todo lo que ve depende de la organización en la que está. Si trabaja en más de una, se cambia acá.',
      target: 'shell-selector-organizacion',
      placement: 'bottom',
    },
    // Acá iba el paso «Buscar en toda la organización», que apuntaba a un campo
    // del encabezado sin ningún manejador: prometía «desde acá llegás a
    // personas y registros sin pasar por el menú» sobre un control que no
    // buscaba nada. Se retiran los dos juntos en el carril 19 — el paso no
    // sobrevive al control que señalaba.
    {
      id: 'ayuda',
      title: 'Dónde volver',
      body: 'Todos los tutoriales viven en el centro de tutoriales. Puede repetir cualquiera las veces que quiera.',
      target: 'nav-tutorials',
      placement: 'right',
    },
  ],
};

/** Cómo está organizado el menú y por qué se ve lo que se ve. */
const NAVEGACION: TutorialDefinition = {
  id: 'navegacion',
  version: '1.0',
  title: 'Moverse por la aplicación',
  description:
    'Cómo está organizado el menú, por qué ve unas secciones y no otras, y cómo volver sobre sus pasos.',
  category: 'General',
  route: '/dashboard',
  estimatedMinutes: 2,
  level: 'inicial',
  prerequisites: ['bienvenida'],
  steps: [
    {
      id: 'grupos',
      title: 'El menú, por dominios',
      body: 'Las secciones están agrupadas por lo que hace con ellas: atención, facturación, administración y su cuenta.',
      target: 'shell-nav',
      placement: 'right',
    },
    {
      id: 'roles',
      title: 'Por qué ve estas secciones',
      body: 'El menú se arma con los roles de su sesión. Si una sección no aparece, es porque su rol no la puede abrir, no porque no exista.',
      target: 'panel-accesos',
      placement: 'top',
    },
    {
      id: 'migas',
      title: 'Volver sobre sus pasos',
      body: 'La ruta de navegación de cada pantalla le dice dónde está y le deja subir un nivel sin usar el botón de atrás del navegador.',
      target: 'panel-titulo',
      placement: 'bottom',
    },
  ],
};

/** El recorrido diario de quien atiende. */
const AGENDA_DEL_DIA: TutorialDefinition = {
  id: 'agenda-del-dia',
  version: '1.0',
  title: 'Su agenda del día',
  description:
    'Ver sus turnos, cambiar la ventana de consulta y entrar al expediente de quien llega.',
  category: 'Atención',
  route: '/schedule',
  roles: ['PRACTITIONER', 'CLINICIAN', 'SCHEDULING_ADMIN', 'SCHEDULING_AGENT'],
  estimatedMinutes: 4,
  level: 'inicial',
  next: 'expediente-clinico',
  steps: [
    {
      id: 'que-es',
      title: 'La agenda',
      body: 'Acá están sus citas comprometidas y los cupos que todavía puede ofrecer. Son dos pestañas de la misma agenda.',
    },
    {
      id: 'ventana',
      title: 'Cambie la ventana',
      body: 'Elija «Hoy» para ver sólo lo de hoy. Pruébelo: el listado se recarga solo.',
      target: 'agenda-ventana',
      placement: 'bottom',
      advanceOn: 'input',
      hint: 'Si no pasa nada, abra el desplegable y elija una opción distinta a la actual.',
    },
    {
      id: 'pestanas',
      title: 'Citas y cupos',
      body: 'Las citas son turnos ya tomados. Los cupos son huecos libres: desde ahí se reserva.',
      target: 'agenda-pestanas',
      placement: 'bottom',
    },
    {
      id: 'expediente',
      title: 'Del turno al expediente',
      body: 'Cada cita enlaza al expediente de la persona, con el motivo de consulta ya cargado. Es por donde sigue su día.',
      target: 'agenda-tabla-citas',
      placement: 'top',
      roles: ['PRACTITIONER', 'CLINICIAN'],
    },
  ],
};

/**
 * Leer una historia clínica.
 *
 * Versión 3.0: sube la **mayor** cada vez que el recorrido cambia de verdad.
 * En la 2.0 lo que se escribe se mudó a su propia pantalla (`atencion-clinica`).
 * En la 3.0 la banda de contexto se fue: las alergias y la consulta abierta se
 * dicen en un modal al entrar —no hay nada fijo en la página que señalar— y las
 * cifras se sacaron. Quien completó una versión anterior lo vuelve a ver, y
 * corresponde: lo que aprendió ya no es lo que la pantalla hace.
 */
const EXPEDIENTE: TutorialDefinition = {
  id: 'expediente-clinico',
  version: '3.1',
  title: 'Leer el expediente',
  description: 'Cómo está organizada la historia clínica, bloque por bloque.',
  category: 'Atención',
  roles: ['PRACTITIONER', 'CLINICIAN'],
  estimatedMinutes: 1,
  level: 'intermedio',
  prerequisites: ['agenda-del-dia'],
  next: 'atencion-clinica',
  steps: [
    {
      id: 'bloques',
      title: 'La historia, por bloques',
      body: 'Diagnósticos (también las alergias), medicación, observaciones, encuentros, internaciones, notas, planes y documentos. El detalle de un encuentro muestra todo lo que se registró en esa consulta.',
      target: 'expediente-pestanas',
      placement: 'bottom',
    },
  ],
};

/**
 * Dejar constancia de una atención — la pantalla hermana del expediente.
 *
 * Sin `route`, y no por olvido: la atención es siempre la de **alguien**, y la
 * ruta lleva su identificador. Se empieza desde la pantalla, a la que se llega
 * con el botón «Atender» del expediente o abriendo una consulta de la agenda.
 */
const ATENCION_CLINICA: TutorialDefinition = {
  id: 'atencion-clinica',
  version: '1.1',
  title: 'Registrar una atención',
  description:
    'Abrir el encuentro, elegir en la rejilla qué le va a registrar a la persona y cerrar cuando termina.',
  category: 'Atención',
  roles: ['PRACTITIONER', 'CLINICIAN'],
  estimatedMinutes: 3,
  level: 'intermedio',
  prerequisites: ['expediente-clinico'],
  steps: [
    {
      id: 'encuentro',
      title: 'Dejar constancia',
      body: 'El encuentro es el registro de que atendió a esta persona. Se abre al empezar y se cierra al terminar; todo lo demás cuelga de él.',
      target: 'consulta-encuentro',
      placement: 'bottom',
    },
    {
      id: 'receta',
      title: 'Qué le va a registrar',
      body: 'Cada casilla de la rejilla es algo que se puede registrar en esta consulta: formulario médico, orden de análisis, diagnóstico (también alergias), receta, plan de cuidados o reconsulta. Toque una y se abre su formulario.',
      target: 'consulta-rejilla',
      placement: 'top',
    },
  ],
};

/**
 * El perfil profesional y qué se hace con él.
 *
 * Versión 2.0 (carril 05): el recorrido cambió de verdad — la formación y las
 * matrículas pasaron a vivir dentro de las pestañas Trayectoria/Credenciales,
 * y se agregó la vista previa — así que sube la versión **mayor** en vez de la
 * menor: quien ya completó el tour de 4 pasos anterior lo vuelve a ver, porque
 * lo que aprendió ya no es lo que la pantalla hace (ver `tutorial-progress.store.ts`).
 */
const PERFIL_PROFESIONAL: TutorialDefinition = {
  id: 'perfil-profesional',
  version: '2.0',
  title: 'Su perfil profesional',
  description:
    'Su trayectoria, sus credenciales y cómo se ve su perfil público para un paciente.',
  category: 'Mi cuenta',
  route: '/my-account',
  roles: ['PRACTITIONER', 'CLINICIAN'],
  estimatedMinutes: 3,
  level: 'inicial',
  steps: [
    {
      id: 'portada',
      title: 'Cómo le ven',
      body: 'Su nombre, su título y la especialidad con la que se presenta. También si está tomando pacientes nuevos.',
      target: 'perfil-portada',
      placement: 'bottom',
    },
    {
      id: 'actividad',
      title: 'Lo que lleva registrado',
      body: 'Encuentros, recetas, notas y documentos que dejó asentados con esta cuenta. No es un ranking: es su historial.',
      target: 'perfil-actividad',
      placement: 'top',
    },
    {
      id: 'trayectoria',
      title: 'Su trayectoria',
      body: 'Formación, dónde ejerció antes y dónde ejerce hoy, en una línea de tiempo. Acá también agrega vínculos laborales nuevos.',
      target: 'perfil-trayectoria',
      placement: 'top',
    },
    {
      id: 'credenciales',
      title: 'Declarado y verificado',
      body: 'Especialidades y matrículas, separadas entre lo que ya se comprobó contra una fuente y lo que todavía está pendiente.',
      target: 'perfil-credenciales',
      placement: 'top',
    },
  ],
};

/** Cómo usar el propio centro de tutoriales. */
const CENTRO_DE_AYUDA: TutorialDefinition = {
  id: 'centro-de-ayuda',
  version: '1.0',
  title: 'Usar el centro de tutoriales',
  description: 'Buscar, filtrar, continuar lo empezado y repetir lo que ya hizo.',
  category: 'General',
  route: '/tutorials',
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'avance',
      title: 'Cuánto lleva',
      body: 'El avance general cuenta los tutoriales que completó sobre los que tiene disponibles según su rol.',
      target: 'tutoriales-avance',
      placement: 'bottom',
    },
    {
      id: 'buscador',
      title: 'Buscar',
      body: 'Escriba lo que quiere aprender. Busca en el título y en la descripción.',
      target: 'tutoriales-busqueda',
      placement: 'bottom',
      advanceOn: 'input',
    },
    {
      id: 'filtros',
      title: 'Filtrar',
      body: 'Por categoría y por estado, para encontrar lo que dejó a medias.',
      target: 'tutoriales-filtros',
      placement: 'bottom',
    },
    {
      id: 'tarjeta',
      title: 'Empezar, continuar o repetir',
      body: 'Cada tutorial le ofrece lo que corresponde según cómo lo dejó. Repetir uno completado no borra que lo hizo.',
      target: 'tutoriales-lista',
      placement: 'top',
    },
  ],
};

/**
 * Facturación, para quien la usa. Carril 18 sumó `PRACTITIONER` (antes solo
 * `BILLING_ADMIN`/`ACCOUNTANT`): un doctor ahora puede registrar el ingreso de
 * sus propias consultas pagadas y sus gastos, no solo consultar.
 */
const CONTABILIDAD: TutorialDefinition = {
  id: 'contabilidad',
  version: '1.1',
  title: 'Registrar sus movimientos contables',
  description:
    'El balance de sumas y saldos y el libro diario de su práctica, y cómo registrar un ingreso o un gasto.',
  category: 'Facturación',
  // Los pasos explican el balance, el diario y cómo registrar un movimiento:
  // eso vive en los libros, que desde el 2026-09-12 están un clic adentro de
  // Contabilidad —la dirección de la sección abre el cockpit—.
  route: '/administration/accounting/libros',
  roles: ['BILLING_ADMIN', 'ACCOUNTANT', 'PRACTITIONER'],
  estimatedMinutes: 3,
  level: 'intermedio',
  steps: [
    {
      id: 'que-es',
      title: 'Contabilidad',
      body: 'Acá revisa lo que su práctica facturó y cobró, y registra usted mismo sus movimientos.',
    },
    {
      id: 'registrar-ingreso',
      title: 'Ingreso de una consulta pagada',
      body: 'Elija la factura ya pagada, elija las cuentas de debe y haber, y confirme. Queda en borrador, anclado a esa factura.',
    },
    {
      id: 'aprobacion',
      title: 'Quién lo aprueba',
      body: 'Un borrador no es un hecho contable todavía: el posteo final lo hace quien tiene autoridad contable en su práctica.',
    },
  ],
};

/** Carril 18 — pedir vincularse a una organización. */
const ORGANIZACIONES: TutorialDefinition = {
  id: 'mis-organizaciones',
  version: '1.0',
  title: 'Vincularse a una organización',
  description: 'Pedir una vinculación y entender qué implica (y qué no).',
  category: 'Administración',
  route: '/administration/medical-organization',
  roles: ['PRACTITIONER'],
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'que-es',
      title: 'Mis vinculaciones',
      body: 'Puede ejercer en más de una organización a la vez. En la pestaña «Mis vinculaciones» de este panel pide vincularse a una y ve el estado de todas.',
    },
    {
      id: 'pendiente',
      title: 'Queda pendiente',
      body: 'Pedir una vinculación no le agrega de inmediato: la organización tiene que aprobarla, igual que en la vida real.',
    },
    {
      id: 'no-da-acceso',
      title: 'No da acceso a pacientes',
      body: 'Estar vinculado a una organización nunca le da acceso a sus pacientes. Eso depende siempre de una cita, derivación, intervención o autorización concreta con ese paciente.',
    },
  ],
};

/** Carriles P1/P9 — la bandeja (`notification-center`) y las preferencias de «Mi cuenta». */
const NOTIFICACIONES: TutorialDefinition = {
  id: 'notificaciones',
  version: '1.1',
  title: 'Sus notificaciones',
  description: 'La bandeja de avisos y sus preferencias por categoría.',
  category: 'General',
  route: '/notification-center',
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'que-es',
      title: 'Notificaciones',
      body: 'Acá ve sus avisos: recetas, consultas, turnos y mensajes. Toque uno para abrir lo que anuncia, y márquelos leídos de a uno o todos juntos.',
    },
    {
      id: 'preferencias',
      title: 'Elija de qué le avisamos',
      body: 'Desde el ícono de Ajustes, arriba a la derecha, en «Avisos» activa o silencia cada familia: recetas y consultas, turnos, mensajes y actividad social.',
    },
    {
      id: 'silencio',
      title: 'Ventana de silencio',
      body: 'También puede fijar un horario de silencio, que se escribe en su hora local: en esa ventana no le avisamos, y lo pendiente le espera en la bandeja.',
    },
  ],
};

/**
 * El catálogo. El orden es el que ve quien entra al centro sin filtrar, así que
 * va de lo que sirve el primer día a lo que sirve el primer mes.
 */
export const TUTORIALS: readonly TutorialDefinition[] = [
  BIENVENIDA,
  NAVEGACION,
  AGENDA_DEL_DIA,
  EXPEDIENTE,
  ATENCION_CLINICA,
  PERFIL_PROFESIONAL,
  CENTRO_DE_AYUDA,
  CONTABILIDAD,
  ORGANIZACIONES,
  NOTIFICACIONES,
];
