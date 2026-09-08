import { ANY_ROLE } from './navigation.types';
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
/**
 * Todo rol que **no** es el paciente: quien ejerce, quien coordina y quien
 * administra.
 *
 * Nació dos veces escrito igual —el glosario clínico y «Grupos y foros»— y las
 * dos por el mismo motivo: son herramientas de trabajo, y ofrecérselas al
 * paciente rompe la regla de I-A («cero jerga, cero herramientas ajenas» en su
 * menú). Tenerlo una sola vez es lo que evita que la tercera sección de este
 * tipo nazca con la lista a medias.
 */
/**
 * Los dos roles de quien atiende.
 *
 * Vivía en `app.routes.ts`, que lo usa para cerrar las hijas de «Mi perfil» que
 * son sólo de quien atiende. Se mudó acá cuando la sección «Formularios» del
 * generador necesitó la misma pareja: dos listas iguales en dos archivos es
 * cómo una de las dos se queda corta.
 */
export const ROLES_DE_QUIEN_ATIENDE: readonly string[] = [
  'CLINICIAN',
  'PRACTITIONER',
];

const ROLES_QUE_EJERCEN_O_ADMINISTRAN = [
  'PRACTITIONER',
  'CLINICIAN',
  'SCHEDULING_ADMIN',
  'SCHEDULING_AGENT',
  'SURGEON',
  'ANESTHESIOLOGIST',
  'PERIOP_NURSE',
  'SURGERY_SCHEDULER',
  'PERIOP_ADMIN',
  'MEDICAL_VISITOR',
  'SECURITY_ADMIN',
] as const;

export const APP_SECTIONS: readonly AppSection[] = [
  {
    path: 'dashboard',
    // §4.H · fuera del menú del médico. La lista cerrada del cliente son ocho
    // y el panel no es una de ellas; se sigue llegando por la marca del
    // armazón, que ahora es un enlace a `/dashboard` justamente por esto, y es
    // el destino del login y del cambio de organización.
    //
    // **No se le tocan los `roles`**: el panel lo tiene que poder abrir
    // cualquiera —lo exige `navigation.map.spec`— y esto no habla de permisos.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Panel',
    group: 'General',
    icon: 'home',
    roles: [ANY_ROLE],
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
    // §4.H · fuera del menú del médico. Los recorridos guiados se disparan
    // **desde la pantalla que explican**, que es donde sirven; un renglón fijo
    // en el menú para «aprender a usar esto» era además la confesión del
    // síntoma 1 del plan.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Tutoriales',
    group: 'General',
    icon: 'teach',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Aprendé a usar cada sección con recorridos guiados sobre la aplicación real.',
    module: '—  ayuda en producto',
  },

  {
    // Carril P2 · la mensajería directa paciente↔doctor.
    //
    // Va en «General» y no en «Mi cuenta» porque no es un dato propio que se
    // consulta: es una forma de comunicarse con otra persona, como la guía de
    // profesionales. «Mi cuenta» es lo que uno mira de sí mismo.
    //
    // Sin `roles`: el filtro real es tener perfil público de `community`, que
    // es un dato de la cuenta y no un rol —la misma razón por la que «Mis
    // turnos» tampoco los declara—. La pantalla lo dice cuando falta, en vez
    // de esconderse del menú.
    path: 'messaging',
    label: 'Chats',
    group: 'General',
    icon: 'chat',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Escribile a tu médico y seguí la conversación, en vivo.',
    module: 'M19 community',
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
    // **Sólo `PATIENT`** (corrección #2 del 15/08/2026, carril 02). Nació sin
    // `roles` con el razonamiento de que «la usa sobre todo quien busca
    // médico», y «sobre todo» no es una regla: en la práctica la doctora la
    // veía en su menú y en «Tus accesos» —está en la captura baseline del
    // carril 01—. Es una guía para elegir a quién consultar; a quien atiende no
    // le corresponde.
    //
    // Esconder el ítem no es la protección: es no ofrecer una puerta. La puerta
    // la cierra `seccionRolesGuard` sobre la ruta, para que el enlace directo
    // tampoco entre.
    //
    // `exclusiveRoles` porque el pedido fue **solo** el paciente: sin esto el
    // comodín `SUPERADMIN` la seguiría viendo, y «otros roles» lo incluye. Es
    // la única sección del registro que lo declara.
    //
    // **«Directorio de médicos» y no «Guía de profesionales»** (F1 del plan de
    // UX, 22/08/2026). Convivían dos convenciones para lo mismo —«Guía de X» y
    // «Directorio de X»— y el cliente pidió una: «Directorio > Directorio de
    // cada cosa». Ahora los cuatro se llaman igual en estructura, así que quien
    // ve uno sabe leer los otros tres. La **ruta no cambia**: `/directory` ya
    // está en enlaces guardados, en el rastro de migas y en las pruebas, y
    // renombrarla no le agrega nada a nadie.
    //
    // «Médicos» y no «doctores» por el mismo pedido (F2): en la superficie que
    // ve un paciente o un profesional se dice «médico».
    path: 'directory',
    label: 'Directorio de médicos',
    group: 'General',
    icon: 'directory',
    roles: ['PATIENT'],
    exclusiveRoles: true,
    availability: 'disponible',
    summary: 'Todos los médicos de la red, agrupados por especialidad.',
    module: 'M05 profiles',
  },
  {
    // Grupos y foros (P7). Es la entrada **mínima** que el carril se permite en
    // este archivo: sin ella la pantalla queda huérfana —el invariante de
    // `app.routes.spec` exige que toda pantalla cuelgue de una sección— y
    // `feed` ya no está declarada desde el carril R2-1.
    //
    // `roles` de quien ejerce y de quien administra (F-20, 18/08/2026). La
    // fila entró sin declararlos y el paciente terminó viendo «Grupos y foros»
    // en su menú: son foros profesionales, no una herramienta suya. Es la misma
    // regla de I-A que ya se había roto con el glosario (F-03), y por eso ahora
    // la hace cumplir el guardia de `navigation.map.spec` y no la memoria de
    // cada carril. Si algún día el producto quiere grupos de pacientes, se
    // reabre con una decisión, no con una omisión.
    path: 'groups',
    // §4.H · fuera del menú del médico: los foros son valiosos y no son trabajo
    // diario. Los ve igual el resto de `ROLES_QUE_EJERCEN_O_ADMINISTRAN`.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Grupos y foros',
    group: 'General',
    icon: 'people',
    roles: ROLES_QUE_EJERCEN_O_ADMINISTRAN,
    availability: 'disponible',
    summary: 'Comunidades por tema y especialidad, con su muro y sus integrantes.',
    module: 'M19 community',
  },
  {
    // Directorio de unidades publicadas del módulo 23. Es una sección distinta
    // de `/diagnostics`, que sigue siendo la cola clínica de órdenes/resultados.
    // La ruta tampoco coincide con `/diagnostic-units`, prefijo exclusivo de API.
    path: 'laboratory-directory',
    label: 'Directorio de laboratorios',
    group: 'General',
    icon: 'flask',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Laboratorios e imagenología, agrupados por categoría y con su oferta vigente.',
    module: 'M23 diagnostic_units',
  },
  {
    // A5 del plan de UX · el tercer hermano. El cliente los pidió juntos —
    // «Directorio de Lab / Directorio de clínica / Guía de profesionales /
    // Guía de farmacias»— y dos de los cuatro no existían como pantalla.
    //
    // **No hizo falta backend**: `GET /public/search/organizations` ya sirve
    // hospitales, clínicas y centros, y ya lo consumía la búsqueda pública de
    // REDSAT. Lo que faltaba era la sección dentro del armazón, que es lo que
    // un paciente con sesión puede recorrer.
    //
    // Absorbe el «Grilla de ORGANIZACIÓN + tipos de organización» que el plan
    // anotaba como frente E: es el mismo pedido dicho dos veces, y los tipos
    // son los chips de esta pantalla. Construirlo dos veces habría dado dos
    // directorios de lo mismo, que es justo el «demasiados paneles» del que
    // salió todo esto.
    //
    // **La ruta es `clinics-directory` y no `organizations-directory`**, que
    // era la primera opción: el proxy compara por INICIO de ruta y `/org` está
    // en su lista, así que la pantalla se iba entera a la API y volvía un
    // «Cannot GET /organizations-directory». Lo denunció
    // `scripts/check-route-prefixes.mjs`, que existe justamente por esto.
    // Además se lee mejor: el rótulo dice «clínicas».
    path: 'clinics-directory',
    label: 'Directorio de clínicas',
    group: 'General',
    icon: 'hospital',
    roles: [ANY_ROLE],
    // Fuera del menú del médico por la lista cerrada de ocho (§4.H). Sigue
    // alcanzable por su ruta y desde el flujo de síntomas.
    fueraDelMenuPara: ['PRACTITIONER'],
    availability: 'disponible',
    summary: 'Clínicas, hospitales y centros de salud verificados, con su tipo y su ciudad.',
    module: 'M04 directory',
  },
  {
    // A6 del plan de UX · el cuarto hermano, sobre
    // `GET /public/search/pharmacies`. Mismo razonamiento que el de clínicas:
    // la fuente de datos ya estaba y lo que faltaba era la puerta.
    path: 'pharmacies-directory',
    label: 'Directorio de farmacias',
    group: 'General',
    icon: 'pill',
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    availability: 'disponible',
    summary: 'Farmacias de la red, con su ciudad y su verificación.',
    module: 'M22 pharmacy',
  },

  /* -- Atención · fase 1 del orden de trabajo ------------------------------ */

  {
    // §4.H del plan de UX · **la primera de las ocho opciones del médico**, y
    // la única que no existía con ese nombre.
    //
    // El encuentro clínico ya se podía hacer: vive en `clinical-record` y en
    // el chart del paciente. Lo que no había era **la puerta**. Para atender a
    // alguien había que acordarse de que se entra por «Archivo clínico», que
    // suena a lo que se consulta después, no a lo que se hace ahora. Es
    // exactamente el síntoma 1 del plan: la aplicación no se explica sola.
    //
    // Así que es una pantalla corta y deliberadamente tonta —elegí paciente,
    // entrá a su consulta— y no un módulo nuevo: la atención sigue ocurriendo
    // donde ya ocurría. Duplicarla habría dado dos historias clínicas.
    path: 'consultation',
    label: 'Consulta médica',
    group: 'Atención',
    icon: 'stethoscope',
    roles: ['CLINICIAN', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Empezá la atención de hoy: elegí al paciente y entrá a su consulta.',
    module: 'M08 clinical',
  },
  {
    // **«Turnos» y no «Agenda»** (§4.H del plan de UX): es el nombre exacto de
    // la lista cerrada del cliente, y además el más honesto — la sección son
    // los turnos (los que pediste, los que te pidieron, el horario que
    // publicás), y «Agenda» no decía si era para pedir uno o para publicarlo.
    // La ruta sigue siendo `schedule`.
    path: 'schedule',
    label: 'Turnos',
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
    icon: 'folder',
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
    // §4.H del plan de UX · la sexta de las ocho. **Sección propia y no una
    // pestaña dentro del Archivo clínico**, que era la otra lectura posible.
    //
    // El motivo es que la pregunta que responde es transversal: «¿qué escribí
    // últimamente?», «¿qué quedó a medio firmar?». Dentro del archivo clínico
    // esa pregunta no se puede hacer — ahí se entra **por persona**, y para
    // ver las últimas cinco evoluciones habría que acordarse de las cinco
    // personas. Es la misma razón por la que «Mis turnos» no vive dentro de
    // cada paciente.
    path: 'progress-notes',
    label: 'Evoluciones',
    group: 'Atención',
    icon: 'note',
    roles: ['CLINICIAN', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Lo último que escribiste, de todos tus pacientes y en un solo lugar.',
    module: 'M15 chart',
  },
  {
    path: 'diagnostics',
    // §4.H · fuera del menú del médico: no está en la lista de ocho. La cola
    // del laboratorio y los estudios de un paciente se miran **desde el
    // paciente**, que es donde se los pidió, y para eso están el Archivo
    // clínico y la Consulta médica. Sigue siendo sección de primer nivel para
    // `CLINICIAN`, que es quien la usa como bandeja.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Laboratorio e imagen',
    group: 'Atención',
    icon: 'scan',
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
    // Carril 12. Los cinco roles perioperatorios que declara `PeriopController`
    // en sus lecturas; `BILLING` queda afuera a propósito: figura sólo en el
    // endpoint de cargos, que es contabilidad del caso y no atención.
    //
    // Encendida con las lecturas del módulo (`GET /procedure-cases`, su detalle
    // y el equipo) y con la respuesta del integrante a su participación. El
    // módulo llevaba veinte endpoints de escritura y ninguna pantalla, y sin la
    // aceptación **ninguna intervención podía confirmarse**: `confirm` exige que
    // cada integrante haya aceptado y no había dónde hacerlo.
    path: 'interventions',
    label: 'Intervenciones',
    group: 'Atención',
    icon: 'scalpel',
    roles: [
      'SURGEON',
      'ANESTHESIOLOGIST',
      'PERIOP_NURSE',
      'SURGERY_SCHEDULER',
      'PERIOP_ADMIN',
    ],
    availability: 'disponible',
    summary: 'Mirá las intervenciones programadas y confirmá tu participación.',
    module: 'M53 procedures_perioperative',
  },
  {
    // Carril 17. La bandeja de visitas de laboratorio del doctor.
    //
    // Va en «Atención» y **separada de `schedule`** porque la especificación lo
    // exige (línea 5399): una visita comercial no es una consulta, y mezclarlas
    // en la misma agenda haría que la solicitud de un visitador compita por
    // atención con la de un paciente.
    //
    // `PRACTITIONER` y `CLINICIAN` son los mismos roles con los que
    // `VisitRequestsController` responde la bandeja.
    path: 'lab-visits',
    // §4.H · fuera del menú del médico. **Ojo con la especificación**: la
    // línea 5399 exige que una visita comercial NO se mezcle con la agenda
    // clínica, y eso se sigue cumpliendo — la sección existe, tiene su ruta y
    // su bandeja propia, y no se fusionó con Turnos. Lo único que perdió es el
    // renglón lateral, y se llega por el enlace que Turnos ofrece.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Visitas de laboratorio',
    group: 'Atención',
    icon: 'route',
    roles: ['PRACTITIONER', 'CLINICIAN'],
    availability: 'disponible',
    summary: 'Aceptá o rechazá visitas de visitadores médicos y mirá tu agenda de visitas.',
    module: 'M62 pharma_lab',
  },
  {
    // Carril 17. La pantalla del visitador médico.
    //
    // Sólo la ve `MEDICAL_VISITOR`, que es un rol de sistema sembrado por este
    // mismo carril. No aparece ninguna entrada clínica para ese rol —ni acá ni
    // en el resto del registro— porque la especificación le prohíbe el acceso a
    // pacientes, recetas y diagnósticos (5316-5318).
    path: 'my-visits',
    label: 'Mis visitas médicas',
    group: 'Atención',
    icon: 'route',
    roles: ['MEDICAL_VISITOR'],
    availability: 'disponible',
    summary: 'Consultá el estado de las visitas que solicitaste a los médicos.',
    module: 'M62 pharma_lab',
  },
  {
    // Carril 2 · punto 4 del reclamo. `TerminologyCatalog` ya resolvía el
    // mismo `GET /terminology/concepts?q=` con rol `SECURITY_ADMIN`: es un
    // buscador técnico de `conceptId` para configuración, no un glosario para
    // consulta clínica. Esta es la puerta que el cliente pidió — "cada
    // profesional", no sólo quien administra —, con una pantalla propia que no
    // expone el identificador.
    //
    // Los roles son los de quien atiende: la unión de las filas de este mismo
    // grupo, más quien administra. Nació sin `roles` («cada profesional», y la
    // lectura del catálogo tampoco los exige — UC-03-13), y por efecto
    // colateral lo veía también el paciente: es una herramienta de trabajo, no
    // una pantalla suya (feedback de la analista F-03, decidido el 18/08/2026).
    // La ruta lo hace cumplir por `seccionRolesGuard`, hija incluida.
    path: 'glossary',
    label: 'Glosario',
    group: 'Atención',
    icon: 'book',
    roles: ROLES_QUE_EJERCEN_O_ADMINISTRAN,
    availability: 'disponible',
    summary: 'Buscá un término médico y su significado en lenguaje llano.',
    module: 'M03 terminology',
  },

  {
    // **La ruta no puede empezar por `forms`**: es prefijo del proxy hacia la
    // API y `check-route-prefixes.mjs` lo verifica. De ahí `form-builder`.
    //
    // Es la pantalla del doctor, no la del administrador. `administration/
    // clinical-forms` **arma** la plantilla estándar de una especialidad y es de
    // `SECURITY_ADMIN`; ésta **extiende** una plantilla ya armada con los campos
    // propios de un consultorio, dentro del presupuesto que la política de
    // extensión declara. Son dos permisos distintos del backend y por eso son
    // dos pantallas.
    //
    // `exclusiveRoles` porque el pedido fue **sólo** el doctor: sin esto el
    // comodín `SUPERADMIN` la vería, y quien administra ya tiene la suya. Es la
    // segunda sección del registro que lo declara, después de la Guía.
    path: 'form-builder',
    label: 'Formularios',
    group: 'Atención',
    icon: 'clipboard',
    roles: ROLES_DE_QUIEN_ATIENDE,
    exclusiveRoles: true,
    availability: 'disponible',
    summary: 'Agregá tus propios campos a los formularios estándar de tu especialidad.',
    module: 'M09 forms · M15 chart',
  },

  {
    // Carril 10. **La ruta NO es `surveys` y eso no es decoración**: `/surveys`
    // es el prefijo del módulo en la API, y el proxy compara por inicio de ruta
    // sin límite de segmento — una sección llamada `surveys` se iría entera al
    // backend. Mismo caso que M13 en `administration/geolocation`. Lo hace
    // cumplir `scripts/check-route-prefixes.mjs`.
    path: 'questionnaires',
    // §4.H la sacaba del menú del médico (`fueraDelMenuPara: ['PRACTITIONER']`):
    // la encuesta se armaba desde la consulta del paciente, no como tarea
    // suelta. **Vuelve al menú por decisión del operador del 28/08/2026**: es
    // el motor de formularios que el médico personaliza para su atención y sin
    // renglón propio nadie lo encontraba. Con esto el panel del médico pasa el
    // techo blando de ocho entradas a propósito; lo fija
    // `navigation.service.spec.ts`.
    label: 'Encuestas',
    group: 'Atención',
    icon: 'survey',
    // Los dos roles que exigen `SurveysTemplatesController` y
    // `SurveysAssignmentsController`.
    roles: ['PRACTITIONER', 'CLINICIAN'],
    availability: 'disponible',
    summary: 'Creá encuestas para tus pacientes y revisá lo que respondieron.',
    module: 'M-surveys',
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
    icon: 'people',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Dá de alta cuentas y revisá quién tiene acceso a la organización.',
    module: 'M01 iam',
  },
  {
    path: 'administration/organizations',
    label: 'Organizaciones',
    group: 'Administración',
    icon: 'building',
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
    // Carril 14 (M26). El módulo tenía **sólo escrituras**: el catálogo se daba
    // de alta y no había forma de volver a leerlo, así que la sección no podía
    // existir sin inventarse los datos. Entra ahora con
    // `GET /insurance-carriers` y su ficha.
    //
    // El rol es el mismo que «Organizaciones» porque hoy es el único que
    // significa «administra esta organización»: la plataforma no tiene todavía
    // un rol de aseguradora. **La autoridad no es esta línea** — la API acota
    // por pertenencia al tenant, no por rol global —, así que el día que exista
    // un `INSURANCE_ADMIN` este es el único lugar que cambia.
    path: 'administration/insurance',
    label: 'Aseguradora',
    group: 'Administración',
    icon: 'umbrella',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Revisá tus productos, planes, coberturas y la red de prestadores.',
    module: 'M26 insurance',
  },
  {
    // Carril 14 (M26), cara de brokers. Separada de «Aseguradora» porque son
    // dos gestiones distintas —el catálogo y la fuerza comercial— y mezclarlas
    // obligaría a una sola pantalla a pedir permisos de las dos.
    path: 'administration/brokers',
    label: 'Brokers',
    group: 'Administración',
    icon: 'briefcase',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Consultá tus corredores, sus vinculaciones vigentes y su cartera.',
    module: 'M26 insurance',
  },
  {
    // W2/F3 (M29): el backend del módulo es solo de comando —sin GET—, así
    // que la sección entra como panel de operaciones; los listados llegan
    // con sus endpoints de consulta.
    path: 'administration/delegated-access',
    label: 'Acceso delegado',
    group: 'Administración',
    icon: 'key',
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
    icon: 'link',
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
    icon: 'shield',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Administrá autoridades, políticas y casos de verificación de identidad.',
    module: 'M27 identity_assurance',
  },
  {
    path: 'administration/terminology',
    label: 'Terminología',
    group: 'Administración',
    icon: 'labels',
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
    path: 'administration/content-packs',
    label: 'Paquetes de contenido',
    group: 'Administración',
    icon: 'package',
    // `SUPERADMIN` y sólo él: aplicar un paquete cambia el catálogo que ve
    // **toda** la instalación, no el de una organización. Es la misma superficie
    // de plataforma que el aprovisionamiento de organizaciones.
    roles: ['SUPERADMIN'],
    availability: 'disponible',
    summary: 'Cargá los catálogos que el arranque ya no trae solo.',
    module: 'M03 terminology',
  },
  {
    path: 'administration/moderation',
    label: 'Moderación',
    group: 'Administración',
    icon: 'flag',
    // `SECURITY_ADMIN` y sólo él: las tres lecturas exponen contenido
    // reportado, el texto que escribió quien reportó y quién decidió qué. El
    // servidor lo comprueba en cada una; esta guarda evita llegar a una
    // pantalla que sólo devolvería 403.
    roles: ['SECURITY_ADMIN'],
    // Encendida con las lecturas de moderación (carril P6): antes se podía
    // decidir sobre una entrada cuyo uuid ya se conociera, pero no había forma
    // de saber qué entradas había. Una cola que no se puede leer no es una cola.
    availability: 'disponible',
    summary: 'Trabajá la cola de contenido reportado y las apelaciones.',
    module: 'M19 community',
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
    icon: 'globe',
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
    icon: 'pin',
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
    icon: 'tag',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Mantené la lista fija de servicios sobre la que se arman los presupuestos.',
    module: 'M17 billing',
  },
  {
    // Carril 13. El módulo 14 (`practice`) tenía once escrituras y tres
    // lecturas: se daban de alta sedes, áreas, quirófanos, consultorios,
    // servicios, personal, acreditaciones e inventario, y **ninguna pantalla
    // los volvía a mostrar**. La sección se enciende con
    // `GET /practices/:id/organization`, que es la lectura que faltaba.
    //
    // Cuelga de `administration/` como el resto de la configuración, y no de
    // una raíz propia: `/practices` es prefijo del proxy y una sección llamada
    // así a nivel raíz se iría entera a la API — el mismo motivo por el que M13
    // vive en `administration/geolocation`.
    path: 'administration/medical-organization',
    // §4.H · fuera del menú del médico por la misma razón que «Mis
    // organizaciones». La sigue viendo `SECURITY_ADMIN` y `PERIOP_ADMIN`, que
    // son de quienes es la consola.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Organización médica',
    group: 'Administración',
    icon: 'hospital',
    // Los mismos roles que ya admite `GET /practices`: quien puede enumerar las
    // prácticas del tenant puede ver la estructura de la suya. El aislamiento
    // real lo hace la API, que responde 404 ante la de otra organización.
    roles: ['SECURITY_ADMIN', 'PERIOP_ADMIN', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Administrá sedes, áreas, quirófanos, consultorios, plantilla y legajo de tu organización.',
    module: 'M14 practice',
  },
  {
    // Carril 16. Distinta de «Directorio de laboratorios», que es la vitrina
    // del paciente: aquélla sólo muestra unidades publicadas y verificadas,
    // ofertas activas y precios públicos. Ésta lee el mismo dominio **sin** esos
    // filtros —para poder terminar de configurar lo que todavía no se publicó—
    // y agrega el personal con sus permisos de validación y firma, que a la
    // vitrina no le corresponde conocer.
    path: 'administration/medical-laboratory',
    label: 'Laboratorio médico',
    group: 'Administración',
    icon: 'flask',
    // El mismo rol que exigen las dos lecturas administrativas del módulo.
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Configurá sucursales, equipos, estudios, precios y personal de tu laboratorio.',
    module: 'M23 diagnostic_units',
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
    icon: 'clipboard',
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
    // Carril 17. El panel del administrador de laboratorio farmacéutico.
    //
    // Una sola entrada para visitadores, catálogo, material informativo,
    // farmacovigilancia y documentación: son cinco vistas de **la misma
    // organización**, y cinco filas de menú obligarían a elegir el laboratorio
    // cinco veces.
    //
    // `PHARMA_LAB_ADMIN` es un rol de sistema que siembra este carril; los otros
    // dos son los que ya administran organizaciones en el resto del producto.
    path: 'administration/pharma-lab',
    label: 'Laboratorio farmacéutico',
    group: 'Administración',
    icon: 'factory',
    roles: ['PHARMA_LAB_ADMIN', 'BUSINESS_ADMIN', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary:
      'Administrá visitadores, medicamentos, material aprobado, farmacovigilancia y documentación regulatoria.',
    module: 'M62 pharma_lab',
  },

  {
    path: 'administration/accounting',
    label: 'Contabilidad',
    group: 'Facturación',
    icon: 'chart',
    // `PRACTITIONER` a propósito: los libros son de la práctica y quien la
    // ejerce tiene que poder verlos. El control de que la práctica consultada
    // es la suya lo hace la API, que responde 403 ante la de otra organización.
    roles: ['SECURITY_ADMIN', 'ACCOUNTING_APPROVER', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Revisá el balance de sumas y saldos y el libro diario de tu práctica.',
    module: 'M16 accounting',
  },

  {
    // Carril 18. Autoservicio: el profesional pide vincularse a una
    // organización y ve el estado de sus vinculaciones. No cuelga de
    // `/organizaciones` porque el proxy desvía todo lo que empieza con `/org`
    // a la API (ver `docs/design-system/port-redsat.md`); tampoco de
    // `/practices` ni `/practitioners`, reservados igual en `proxy.conf.json`.
    path: 'my-organizations',
    // §4.H · fuera del menú del médico: es un trámite, no trabajo diario. Se
    // llega desde «Mi perfil», que es donde alguien va a buscar «¿dónde
    // trabajo?».
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Mis organizaciones',
    group: 'Administración',
    icon: 'building',
    roles: ['PRACTITIONER'],
    availability: 'disponible',
    summary:
      'Vinculate a una organización y seguí el estado de tus vinculaciones.',
    module: 'M14 practice',
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
    roles: [ANY_ROLE],
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
    // Además del rol, la pantalla pide perfil de paciente —el claim `pid` del
    // token, que es un dato de la cuenta— y lo dice cuando falta.
    path: 'my-account/appointments',
    label: 'Mis turnos',
    group: 'Mi cuenta',
    icon: 'calendar',
    // Sólo del paciente (pedido del cliente, 29/08/2026): al médico no se le
    // ofrece ni se le deja entrar por la dirección —`seccionRolesGuard` rebota
    // a `/dashboard`—. No es `exclusiveRoles`: el comodín de quien administra
    // sigue entrando, igual que en «Mis pedidos».
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Mirá tus turnos y pedí uno nuevo con los horarios disponibles.',
    module: 'M41 scheduling',
  },
  {
    // El archivo clínico del paciente (carril 09): cierra el recorrido que
    // empieza pidiendo un turno. Como «Mis turnos», además del rol pide perfil
    // de paciente y lo dice cuando falta.
    //
    // Encendida con el carril 09: `GET /clinical/patients/:id/summary` acepta
    // ahora al titular, con el aislamiento comprobado del lado del servidor.
    path: 'my-account/medical-record',
    label: 'Mi historia clínica',
    group: 'Mi cuenta',
    // `results` y no `patients`: lo que esta sección muestra son resultados de
    // atenciones, y el ícono de pacientes es el de «gente», que acá sería la
    // persona mirándose a sí misma.
    icon: 'heart',
    // Sólo del paciente (pedido del cliente, 29/08/2026): al médico no se le
    // ofrece ni se le deja entrar por la dirección —`seccionRolesGuard` rebota
    // a `/dashboard`—. No es `exclusiveRoles`: el comodín de quien administra
    // sigue entrando, igual que en «Mis pedidos».
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Tus atenciones y tus recetas, con la descarga en PDF de cada una.',
    module: 'M08 clinical',
  },
  {
    // Carril 11, lado paciente. Es la contracara de «Laboratorio e imagen»:
    // aquélla es la cola del laboratorio y exige rol clínico; ésta mira los
    // mismos estudios desde el otro lado, sólo los propios y sólo los que un
    // profesional ya validó. Sin `roles` por lo mismo que las dos de arriba.
    path: 'my-account/diagnostic-results',
    label: 'Mis resultados',
    group: 'Mi cuenta',
    icon: 'results',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Mirá y descargá tus resultados, y compartilos por un tiempo con un profesional.',
    module: 'M20 diagnostics',
  },
  {
    // Carril J1, lado paciente. Va pegada a «Mis resultados» porque son las dos
    // mitades del mismo circuito, pero es una entrada aparte y no una pestaña
    // adentro: contestan preguntas de momentos distintos —«qué me pidieron» y
    // «qué me volvió»— y la primera es la que tiene algo pendiente que hacer.
    // A diferencia de su hermana, es sólo del paciente (ver `roles`).
    path: 'my-account/diagnostic-orders',
    label: 'Mis órdenes',
    group: 'Mi cuenta',
    icon: 'orders',
    // Sólo del paciente (pedido del cliente, 29/08/2026): al médico no se le
    // ofrece ni se le deja entrar por la dirección —`seccionRolesGuard` rebota
    // a `/dashboard`—. No es `exclusiveRoles`: el comodín de quien administra
    // sigue entrando, igual que en «Mis pedidos».
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Los estudios que te pidió un médico, con las indicaciones para hacértelos.',
    module: 'M20 diagnostics',
  },
  {
    // Carril 10, lado paciente. Sin `roles` a propósito, por el mismo motivo
    // que «Mis turnos»: el filtro real es tener perfil de paciente, que no es
    // un rol sino un dato de la cuenta —el claim `pid` del token—, y la
    // pantalla lo dice cuando falta en vez de esconderse del menú.
    //
    // La ruta tampoco puede llamarse `surveys`: ver la nota de «Encuestas».
    path: 'my-account/questionnaires',
    label: 'Mis cuestionarios',
    group: 'Mi cuenta',
    icon: 'survey',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Respondé los cuestionarios de las consultas que ya tuviste.',
    module: 'M-surveys',
  },
  {
    // Carril P9 · qué avisos querés recibir.
    //
    // Va pegada al centro de notificaciones y en «Mi cuenta» por lo mismo: la
    // bandeja y sus preferencias son de la persona. Sin `roles`, porque
    // cualquiera con sesión tiene avisos que configurar y el backend sólo
    // devuelve los propios.
    path: 'my-account/notification-preferences',
    label: 'Preferencias de avisos',
    group: 'Mi cuenta',
    icon: 'sliders',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Elegí de qué te avisamos y en qué horario no.',
    module: 'M35 messaging',
  },
  {
    // Carril P1 · el centro de notificaciones, el otro extremo de la campana.
    //
    // Va en «Mi cuenta» y no en «General» porque la bandeja es de la persona,
    // no del producto: es la misma regla que pone «Mis turnos» y «Mi historia
    // clínica» acá y no junto al panel.
    //
    // **La ruta no puede llamarse `notifications`.** El proxy enruta ese
    // prefijo hacia la API (es donde vive `GET /notifications/me`), así que una
    // ruta de Angular con ese nombre devolvería JSON en producción en lugar de
    // la pantalla. Es el defecto #137 al revés, y por eso el nombre es
    // `notification-center`.
    //
    // Sin `roles`: cualquiera con sesión tiene bandeja. El backend sólo
    // devuelve la propia, así que no hay nada que filtrar por rol.
    path: 'notification-center',
    label: 'Notificaciones',
    group: 'Mi cuenta',
    icon: 'bell',
    roles: [ANY_ROLE],
    // Fuera del menú lateral, para todos: la campana de la barra superior ya
    // está siempre a la vista y lleva acá. Dos puertas al mismo cuarto, una de
    // ellas a tres clics de distancia, no es descubribilidad sino ruido. La
    // sección sigue entera —ruta, breadcrumb, «Tus accesos» y el enlace de la
    // campana salen de este registro—: lo único que pierde es el renglón.
    fueraDelMenu: true,
    availability: 'disponible',
    summary: 'Revisá todos tus avisos: recetas, consultas, turnos y mensajes.',
    module: 'M35 messaging',
  },
  {
    // La ruta es la que `IDENTITY_VERIFICATION_ROUTE` ya publica como destino
    // del 403 `IDENTITY_VERIFICATION_REQUIRED`: **no se renombra**. Cambiarla
    // rompería la puerta que traduce ese error en una salida.
    path: 'my-account/identity/verify',
    label: 'Verificar identidad',
    group: 'Mi cuenta',
    icon: 'shield',
    roles: [ANY_ROLE],
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
    icon: 'history',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Seguí el estado de tus trámites de verificación de identidad.',
    module: 'M27 identity_assurance',
  },
  {
    // Carril FAR-I2 · los pedidos de farmacia de la persona: del envío al
    // retiro, con la decisión de sustitución en el medio.
    //
    // **Con `roles: ['PATIENT']`, a diferencia del resto de «Mi cuenta».** El
    // pedido nace de una receta propia y la guardia del carril lo exige
    // declarado en la sección, no sólo resuelto por la pantalla. Sin
    // `exclusiveRoles`: el comodín de administración puede verla, y la
    // pantalla igual se guarda por perfil de paciente, como «Mis órdenes».
    path: 'my-account/pharmacy-orders',
    label: 'Mis pedidos',
    group: 'Mi cuenta',
    icon: 'bag',
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Seguí tus pedidos de farmacia: del envío al retiro.',
    module: 'M24 pharmacy',
  },
  {
    // La billetera de fidelidad (FAR-I6). Mismo criterio que «Mis pedidos»:
    // rol de paciente declarado en la sección, sin `exclusiveRoles`, y la
    // pantalla igual se guarda por perfil de paciente.
    //
    // Aparece siempre, incluso sin programa activo: el cliente pidió que el
    // módulo esté disponible, y una sección que desaparece según el entorno
    // enseña una navegación que cambia sola. Sin programa, la pantalla lo dice.
    // El catálogo de iconos tiene siete y ninguno es «puntos». `orders` ya lo
    // usa «Mis pedidos» en este mismo grupo y repetirlo rompería el escaneo,
    // así que va `billing`, el de valor acumulado. Un icono propio es del
    // dueño del sistema de iconos, no de este carril.
    path: 'my-account/loyalty',
    label: 'Mis puntos',
    group: 'Mi cuenta',
    icon: 'star',
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Tus puntos: lo que sumaste con tus compras y cómo canjearlo.',
    module: 'M51 promotions',
  },
  {
    // TP-1: la organización como actor, no como dato.
    //
    // Distinta de «Organizaciones», que es el listado de la **plataforma**, y
    // de «Organización médica», que administra la estructura clínica (sedes,
    // quirófanos, consultorios). Ésta es la organización mirándose a sí misma:
    // sus datos, su gente y quién pide trabajar con ella.
    //
    // **Sin `roles`, y no es un olvido.** El rol que importa acá —owner, admin
    // o staff de la organización— es una membresía en `tenant_memberships`, no
    // un rol global del token, así que el guard de roles no puede verlo.
    // Filtrar por un rol global dejaría fuera justamente a la recepcionista,
    // que es de quien es esta pantalla.
    //
    // Lo que sí se filtra es la **membresía**, con `requiresTenant`: sin
    // `roles` la sección se le ofrecía también a un paciente, que no pertenece
    // a organización ninguna, y le pintaba un rótulo «Administración» en el
    // menú. La membresía viaja en el claim `tenants` del token, así que la
    // pregunta se puede hacer de este lado. Ficha F-31.
    path: 'administration/my-organization',
    // §4.H · fuera del menú del médico: la administra el mostrador. El médico
    // que además administra su clínica llega desde «Mi perfil».
    fueraDelMenuPara: ['PRACTITIONER'],
    // `[ANY_ROLE]` y no la ausencia del campo: F-20 exige que toda sección
    // declare sus roles, justamente para que un olvido no se lea como «la ve
    // cualquiera». Acá la ve cualquiera **a propósito**, y así queda dicho.
    roles: [ANY_ROLE],
    label: 'Tu organización',
    group: 'Administración',
    icon: 'building',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Los datos de tu organización, su gente y las solicitudes de médicos.',
    module: 'M04 directory',
  },
  {
    // La bandeja del mostrador de farmacia (carril FAR-I3). Mismo criterio de
    // acceso que «Tu organización»: la membresía manda (claim `tenants`), no
    // un rol del token — no existe un rol de farmacia minorista, y
    // owner/admin/staff son filas de `tenant_memberships` que el front no
    // decodifica. El corte por TIPO de tenant (farmacia vs clínica) es del
    // backend de FAR-E2: al leer, el front sólo tiene `tenantTypeConceptId`.
    path: 'administration/pharmacy-orders',
    // §4.H · fuera del menú del médico: es la bandeja del mostrador de una
    // farmacia, no del consultorio.
    fueraDelMenuPara: ['PRACTITIONER'],
    roles: [ANY_ROLE],
    label: 'Pedidos de farmacia',
    group: 'Administración',
    icon: 'bag',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'La bandeja del mostrador: pedidos que llegan, confirmaciones y retiros.',
    module: 'M24 pharmacy',
  },
  {
    // Las promociones de la farmacia (carril FAR-I7). Mismo criterio de acceso
    // que la bandeja de al lado: la membresía manda (claim `tenants`), no un
    // rol del token — no existe un rol de farmacia minorista.
    path: 'administration/pharmacy-campaigns',
    roles: [ANY_ROLE],
    // §4.H · fuera del menú del médico, como la bandeja de al lado. El corte
    // por membresía es `requiresTenant`, y un tenant es un tenant: el médico
    // que pertenece a su clínica cumple la condición y terminaba con las
    // promociones de una farmacia en su menú de ocho. No se le tocan los
    // `roles` —quien sí atiende el mostrador la sigue viendo, y quien llega
    // por la ruta entra igual—: esto habla de renglones, no de permisos.
    fueraDelMenuPara: ['PRACTITIONER'],
    label: 'Promociones',
    group: 'Administración',
    icon: 'megaphone',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Las campañas de tu farmacia: qué productos, con qué descuento y hasta cuándo.',
    module: 'M51 promotions',
  },
];
