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
    'Qué es cada parte de la pantalla y cómo moverte. Cinco minutos para no tener que adivinar nada.',
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
      body: 'Te voy a mostrar las cuatro cosas que necesitás para empezar a usar la plataforma. Podés dejarlo cuando quieras y retomarlo después desde el centro de tutoriales.',
    },
    {
      id: 'panel',
      title: 'El panel',
      body: 'Es tu punto de partida: qué secciones tenés habilitadas, en qué organización estás trabajando y cómo va tu verificación de identidad.',
      target: 'panel-accesos',
      placement: 'top',
    },
    {
      id: 'organizacion',
      title: 'La organización activa',
      body: 'Casi todo lo que ves depende de la organización en la que estás. Si trabajás en más de una, se cambia acá.',
      target: 'shell-selector-organizacion',
      placement: 'bottom',
    },
    {
      id: 'buscador',
      title: 'Buscar en toda la organización',
      body: 'Desde acá llegás a personas y registros sin pasar por el menú.',
      target: 'shell-busqueda',
      placement: 'bottom',
    },
    {
      id: 'ayuda',
      title: 'Dónde volver',
      body: 'Todos los tutoriales viven en el centro de tutoriales. Podés repetir cualquiera las veces que quieras.',
      target: 'nav-tutorials',
      placement: 'right',
    },
  ],
};

/** Cómo está organizado el menú y por qué se ve lo que se ve. */
const NAVEGACION: TutorialDefinition = {
  id: 'navegacion',
  version: '1.0',
  title: 'Moverte por la aplicación',
  description:
    'Cómo está organizado el menú, por qué ves unas secciones y no otras, y cómo volver sobre tus pasos.',
  category: 'General',
  route: '/dashboard',
  estimatedMinutes: 2,
  level: 'inicial',
  prerequisites: ['bienvenida'],
  steps: [
    {
      id: 'grupos',
      title: 'El menú, por dominios',
      body: 'Las secciones están agrupadas por lo que hacés con ellas: atención, facturación, administración y tu cuenta.',
      target: 'shell-nav',
      placement: 'right',
    },
    {
      id: 'roles',
      title: 'Por qué ves estas secciones',
      body: 'El menú se arma con los roles de tu sesión. Si una sección no aparece, es porque tu rol no la puede abrir, no porque no exista.',
      target: 'panel-accesos',
      placement: 'top',
    },
    {
      id: 'migas',
      title: 'Volver sobre tus pasos',
      body: 'La ruta de navegación de cada pantalla te dice dónde estás y te deja subir un nivel sin usar el botón de atrás del navegador.',
      target: 'panel-titulo',
      placement: 'bottom',
    },
  ],
};

/** El recorrido diario de quien atiende. */
const AGENDA_DEL_DIA: TutorialDefinition = {
  id: 'agenda-del-dia',
  version: '1.0',
  title: 'Tu agenda del día',
  description:
    'Ver tus turnos, cambiar la ventana de consulta y entrar al expediente de quien llega.',
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
      body: 'Acá están tus citas comprometidas y los cupos que todavía podés ofrecer. Son dos pestañas de la misma agenda.',
    },
    {
      id: 'ambito',
      title: 'De quién es esta agenda',
      body: 'Si atendés, ves la tuya y sólo la tuya. Las agendas de otros profesionales las maneja quien reparte turnos.',
      target: 'agenda-ambito',
      placement: 'bottom',
    },
    {
      id: 'ventana',
      title: 'Cambiá la ventana',
      body: 'Elegí «Hoy» para ver sólo lo de hoy. Probalo: el listado se recarga solo.',
      target: 'agenda-ventana',
      placement: 'bottom',
      advanceOn: 'input',
      hint: 'Si no pasa nada, abrí el desplegable y elegí una opción distinta a la actual.',
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
      body: 'Cada cita enlaza al expediente de la persona, con el motivo de consulta ya cargado. Es por donde sigue tu día.',
      target: 'agenda-tabla-citas',
      placement: 'top',
      roles: ['PRACTITIONER', 'CLINICIAN'],
    },
  ],
};

/** Leer una historia clínica y dejar constancia de la atención. */
const EXPEDIENTE: TutorialDefinition = {
  id: 'expediente-clinico',
  version: '1.0',
  title: 'Leer y registrar en el expediente',
  description:
    'Cómo está organizada la historia clínica, dónde miran las alergias y cómo dejar constancia de una atención.',
  category: 'Atención',
  roles: ['PRACTITIONER', 'CLINICIAN'],
  estimatedMinutes: 5,
  level: 'intermedio',
  prerequisites: ['agenda-del-dia'],
  steps: [
    {
      id: 'alergias',
      title: 'Las alergias, primero',
      body: 'Están arriba y fuera de las pestañas a propósito: son lo único que tenés que ver antes de recetar.',
      target: 'expediente-alergias',
      placement: 'bottom',
    },
    {
      id: 'contexto',
      title: 'Cuánto expediente hay',
      body: 'Las cifras te dicen el tamaño de la historia sin abrir pestaña por pestaña, y cuándo fue la última atención.',
      target: 'expediente-contexto',
      placement: 'bottom',
    },
    {
      id: 'bloques',
      title: 'La historia, por bloques',
      body: 'Diagnósticos, medicación, observaciones, encuentros, notas y documentos. Cada pestaña dice cuántos registros trae.',
      target: 'expediente-pestanas',
      placement: 'bottom',
    },
    {
      id: 'encuentro',
      title: 'Dejar constancia',
      body: 'El encuentro es el registro de que atendiste a esta persona. Se abre al empezar y se cierra al terminar.',
      target: 'expediente-encuentro',
      placement: 'left',
    },
    {
      id: 'receta',
      title: 'Recetar desde acá',
      body: 'Con un encuentro abierto podés prescribir, firmar y emitir sin salir del expediente.',
      target: 'expediente-receta',
      placement: 'top',
    },
  ],
};

/** El perfil profesional y qué se hace con él. */
const PERFIL_PROFESIONAL: TutorialDefinition = {
  id: 'perfil-profesional',
  version: '1.0',
  title: 'Tu perfil profesional',
  description:
    'Tu trayectoria, tus especialidades, tu formación y las matrículas que te habilitan a ejercer.',
  category: 'Mi cuenta',
  route: '/my-account',
  roles: ['PRACTITIONER', 'CLINICIAN'],
  estimatedMinutes: 3,
  level: 'inicial',
  steps: [
    {
      id: 'portada',
      title: 'Cómo te ven',
      body: 'Tu nombre, tu título y la especialidad con la que te presentás. También si estás tomando pacientes nuevos.',
      target: 'perfil-portada',
      placement: 'bottom',
    },
    {
      id: 'actividad',
      title: 'Lo que llevás registrado',
      body: 'Encuentros, recetas, notas y documentos que dejaste asentados con esta cuenta. No es un ranking: es tu historial.',
      target: 'perfil-actividad',
      placement: 'top',
    },
    {
      id: 'formacion',
      title: 'Tu formación',
      body: 'Títulos y certificaciones, con la institución y la fecha. Lo vencido sigue apareciendo: es parte de tu trayectoria.',
      target: 'perfil-formacion',
      placement: 'top',
    },
    {
      id: 'matriculas',
      title: 'Dónde podés ejercer',
      body: 'Tus matrículas y su vigencia. Es lo que te habilita, así que conviene revisarlo cuando venza alguna.',
      target: 'perfil-matriculas',
      placement: 'top',
    },
  ],
};

/** Cómo usar el propio centro de tutoriales. */
const CENTRO_DE_AYUDA: TutorialDefinition = {
  id: 'centro-de-ayuda',
  version: '1.0',
  title: 'Usar el centro de tutoriales',
  description: 'Buscar, filtrar, continuar lo empezado y repetir lo que ya hiciste.',
  category: 'General',
  route: '/tutorials',
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'avance',
      title: 'Cuánto llevás',
      body: 'El avance general cuenta los tutoriales que completaste sobre los que tenés disponibles según tu rol.',
      target: 'tutoriales-avance',
      placement: 'bottom',
    },
    {
      id: 'buscador',
      title: 'Buscar',
      body: 'Escribí lo que querés aprender. Busca en el título y en la descripción.',
      target: 'tutoriales-busqueda',
      placement: 'bottom',
      advanceOn: 'input',
    },
    {
      id: 'filtros',
      title: 'Filtrar',
      body: 'Por categoría y por estado, para encontrar lo que dejaste a medias.',
      target: 'tutoriales-filtros',
      placement: 'bottom',
    },
    {
      id: 'tarjeta',
      title: 'Empezar, continuar o repetir',
      body: 'Cada tutorial te ofrece lo que corresponde según cómo lo dejaste. Repetir uno completado no borra que lo hiciste.',
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
  title: 'Registrar tus movimientos contables',
  description:
    'El balance de sumas y saldos y el libro diario de tu práctica, y cómo registrar un ingreso o un gasto.',
  category: 'Facturación',
  route: '/administration/accounting',
  roles: ['BILLING_ADMIN', 'ACCOUNTANT', 'PRACTITIONER'],
  estimatedMinutes: 3,
  level: 'intermedio',
  steps: [
    {
      id: 'que-es',
      title: 'Contabilidad',
      body: 'Acá revisás lo que tu práctica facturó y cobró, y registrás vos mismo tus movimientos.',
    },
    {
      id: 'registrar-ingreso',
      title: 'Ingreso de una consulta pagada',
      body: 'Elegí la factura ya pagada, elegí las cuentas de debe y haber, y confirmá. Queda en borrador, anclado a esa factura.',
    },
    {
      id: 'aprobacion',
      title: 'Quién lo aprueba',
      body: 'Un borrador no es un hecho contable todavía: el posteo final lo hace quien tiene autoridad contable en tu práctica.',
    },
  ],
};

/** Carril 18 — pedir vincularse a una organización. */
const ORGANIZACIONES: TutorialDefinition = {
  id: 'mis-organizaciones',
  version: '1.0',
  title: 'Vincularte a una organización',
  description: 'Pedir una vinculación y entender qué implica (y qué no).',
  category: 'Administración',
  route: '/my-organizations',
  roles: ['PRACTITIONER'],
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'que-es',
      title: 'Mis organizaciones',
      body: 'Podés ejercer en más de una organización a la vez. Acá pedís vincularte a una y ves el estado de tus vinculaciones.',
    },
    {
      id: 'pendiente',
      title: 'Queda pendiente',
      body: 'Pedir una vinculación no te agrega de inmediato: la organización tiene que aprobarla, igual que en la vida real.',
    },
    {
      id: 'no-da-acceso',
      title: 'No da acceso a pacientes',
      body: 'Estar vinculado a una organización nunca te da acceso a sus pacientes. Eso depende siempre de una cita, derivación, intervención o autorización concreta con ese paciente.',
    },
  ],
};

/** Carril 18 — bandeja y preferencias de notificación. */
const NOTIFICACIONES: TutorialDefinition = {
  id: 'notificaciones',
  version: '1.0',
  title: 'Configurar tus notificaciones',
  description: 'Tu bandeja y tus preferencias de canal y categoría.',
  category: 'General',
  route: '/my-notifications',
  estimatedMinutes: 2,
  level: 'inicial',
  steps: [
    {
      id: 'que-es',
      title: 'Notificaciones',
      body: 'Acá ves los avisos que el sistema te generó y configurás por qué canal y categoría querés recibir cada tipo.',
    },
    {
      id: 'criticas',
      title: 'Las críticas siempre llegan',
      body: 'Las alertas de seguridad y las de citas confirmadas no se pueden desactivar: no dependen de tu preferencia.',
    },
    {
      id: 'canales',
      title: 'Qué canal funciona hoy',
      body: 'La notificación interna es real. WhatsApp, SMS y push se pueden configurar como preferencia, pero en este entorno todavía no tienen un proveedor externo conectado.',
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
  PERFIL_PROFESIONAL,
  CENTRO_DE_AYUDA,
  CONTABILIDAD,
  ORGANIZACIONES,
  NOTIFICACIONES,
];
