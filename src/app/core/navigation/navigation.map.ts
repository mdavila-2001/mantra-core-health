import { VERIFICACION_DE_IDENTIDAD_OFRECIDA } from '../identity-assurance/verificacion-ofrecida';
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
export const ROLES_DE_QUIEN_ATIENDE: readonly string[] = ['CLINICIAN', 'PRACTITIONER'];

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
    // FT-18-R01/R02 (05/09/2026) · la portada de los cuatro directorios.
    //
    // El pedido es concreto: «Directorios debe tener una vista de nodos que
    // muestre cada directorio con el detalle de que se encuentra en cada
    // directorio». Los cuatro ya existían como hermanos sueltos —el
    // desplegable «Directorios» de `navigation.subgroups.ts` los agrupa desde
    // ese archivo—, pero ninguno abría antes en una portada común: quien
    // quería «buscar algo» tenía que adivinar cuál de los cuatro abrir.
    //
    // Esta sección es esa portada, no un quinto directorio: no reemplaza a
    // ninguno de los cuatro —siguen con su propia ruta, su propio rol y su
    // propia pantalla— y no inventa descripciones nuevas: cada nodo muestra
    // el `summary` que la sección correspondiente ya declara más abajo, así
    // que un texto no puede desincronizarse del otro.
    //
    // `roles: [ANY_ROLE]` porque la portada en sí no oculta nada: quien entra
    // ve los nodos que sus propios roles ya le abren — p. ej. quien ejerce no
    // ve el nodo de la guía de médicos, que sigue siendo exclusiva del
    // paciente (corrección #2). El filtro real vive en cada sección, no acá.
    //
    // Va **antes** que los cuatro en este registro a propósito: el orden de
    // dibujo del menú sale de acá (`navigation.subgroups.ts` sólo agrupa).
    //
    // **Y es la única del bloque que ocupa un renglón** (08/09/2026). Hasta
    // hoy la barra dibujaba un desplegable «Directorios» y, adentro, esta
    // portada más los cuatro directorios: dos formas de lo mismo, una encima
    // de la otra. Quien abría el desplegable ya tenía los cuatro destinos a la
    // vista, así que la portada era un rodeo — un clic para llegar a una
    // pantalla que ofrece lo que el menú acababa de ofrecer.
    //
    // De las dos, la que se queda es la pantalla: dice qué hay en cada
    // directorio antes de entrar, que es lo que el renglón del menú no puede
    // hacer. Los cuatro salen del menú con `fueraDelMenuPara: [ANY_ROLE]` —no
    // se borran, no pierden su ruta ni su lugar en el bloque—, el bloque se
    // queda con esta sola sección y el armazón lo dibuja **suelto**, porque un
    // bloque de uno no es un desplegable (`shell-layout.html`). Resultado: se
    // aprieta «Directorios» y se llega derecho a la pantalla que deja elegir.
    path: 'directories',
    // Los cuatro se entran por acá y ya no tienen renglón, así que este
    // renglón se marca también mientras se los recorre: sin esto, abrir un
    // directorio dejaba la barra entera apagada y sin decir dónde estabas.
    representaEnElMenu: [
      'directory',
      'laboratory-directory',
      'clinics-directory',
      'pharmacies-directory',
    ],
    label: 'Directorios',
    group: 'General',
    icon: 'directory',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Un mapa de a quién o a dónde buscar: médicos, laboratorios, clínicas y farmacias.',
    module: 'M04 directory',
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
    // Fuera del menú para todos (08/09/2026): se entra por la portada
    // «Directorios», que es la que ahora ocupa el renglón. Ver el motivo
    // entero en la sección `directories`. Esto **no** toca la corrección #2:
    // `roles` + `exclusiveRoles` siguen siendo quienes cierran la puerta, y
    // esta línea sólo decide dónde se ofrece — al médico se le sigue negando
    // la pantalla, no se le esconde un renglón que igual podría abrir.
    fueraDelMenuPara: [ANY_ROLE],
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
    // FT-19 (05/09/2026) · farmacias, imagenología y centros médicos cerca
    // del paciente, a partir de su receta y de su ubicación.
    //
    // Sólo `PATIENT`: la pestaña de farmacias lee `medicationRequests` del
    // propio resumen clínico y enlaza a `WhereToBuy`
    // (`/my-account/medical-record/where-to-buy/:id`), que ya es sólo del
    // paciente. Un profesional no tiene "mi receta" que buscar acá.
    //
    // Sin `exclusiveRoles`, a diferencia de la Guía de médicos: ahí lo exigió
    // un pedido explícito del cliente ("no debe aparecer ni ser accesible
    // para doctor u otros roles"); acá no hay un pedido equivalente, así que
    // alcanza con `roles` — el comodín de `SUPERADMIN` sigue entrando, como
    // en el resto del registro.
    path: 'nearby-places',
    label: 'Lugares cercanos',
    group: 'General',
    icon: 'pin',
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Farmacias, centros de imagenología y centros médicos cerca tuyo, según tu receta.',
    module: 'M22 pharmacy',
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
    // Fuera del menú para todos (08/09/2026): se entra por la portada
    // «Directorios». El motivo entero está en la sección `directories`.
    fueraDelMenuPara: [ANY_ROLE],
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
    // ALOVIDA. Lo que faltaba era la sección dentro del armazón, que es lo que
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
    // Fuera del menú para todos (08/09/2026): se entra por la portada
    // «Directorios». El motivo entero está en la sección `directories`.
    //
    // **No deshace FT-09-R01 (04/09/2026).** Aquel pedido devolvió al médico
    // el acceso a este directorio después de que la lista cerrada de ocho
    // (§4.H, 22/08) se lo quitara, y lo sigue teniendo: la sección es suya
    // —`roles: [ANY_ROLE]`, sin `hiddenFor`—, aparece en su portada de
    // directorios y en «Tus accesos». Lo único que cambia es por dónde entra.
    // «Directorio de médicos» (`directory`) sigue siendo exclusivo del
    // paciente por la corrección #2, que esta decisión tampoco toca.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Directorio de clínicas',
    group: 'General',
    icon: 'hospital',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Clínicas, hospitales y centros de salud verificados, con su tipo y su ciudad.',
    module: 'M04 directory',
  },
  {
    // A6 del plan de UX · el cuarto hermano, sobre
    // `GET /public/search/pharmacies`. Mismo razonamiento que el de clínicas:
    // la fuente de datos ya estaba y lo que faltaba era la puerta.
    path: 'pharmacies-directory',
    // Fuera del menú para todos (08/09/2026), por lo mismo que el de clínicas:
    // se entra por la portada «Directorios». Sigue siendo del médico —saber
    // dónde se consigue lo que uno receta es parte de atender, que es lo que
    // pedía FT-09-R01—; lo que cambia es por dónde entra, no si entra.
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Directorio de farmacias',
    group: 'General',
    icon: 'pill',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Farmacias de la red, con su ciudad y su verificación.',
    module: 'M22 pharmacy',
  },

  /* -- Atención · fase 1 del orden de trabajo ------------------------------ */

  {
    // **«Consultas»** (ALV-016). Antes decía «Turnos», que era el nombre exacto
    // de la lista cerrada del cliente (§4.H del plan de UX); el mismo cliente
    // pidió la nomenclatura clínica, que además es la que usa el resto del
    // producto —la receta, el expediente y el ciclo hablan de consultas, no de
    // turnos—. «Cupos» NO se renombra: es disponibilidad, no consulta.
    // La ruta sigue siendo `schedule`.
    path: 'schedule',
    label: 'Consultas médicas',
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
    // paciente**, que es donde se los pidió, y para eso está el Archivo
    // clínico. Sigue siendo sección de primer nivel para
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
    roles: ['SURGEON', 'ANESTHESIOLOGIST', 'PERIOP_NURSE', 'SURGERY_SCHEDULER', 'PERIOP_ADMIN'],
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
    // La vista de quien atiende sobre lo facturable de su práctica.
    //
    // Los roles son los de quien atiende y no `SECURITY_ADMIN`: la lectura
    // `GET /billing/service-catalog` **no exige rol** —cualquier profesional que
    // cotice necesita la lista— mientras que el alta (`POST`) sí lo exige y
    // sigue viviendo en `administration/services-catalog`. Son la misma tabla
    // vista desde dos permisos distintos, y por eso son dos pantallas.
    //
    // **Con renglón en el menú del médico desde el 04/09/2026** (FT-22, aval
    // explícito del propietario). Nació fuera por §4.H del plan de UX —la lista
    // cerrada de opciones del panel—, cuando la pantalla era sólo lectura y
    // llegar por «Tus accesos» alcanzaba. Dejó de alcanzar: acá es donde quien
    // atiende pone el precio de lo que ofrece, y un lugar donde se escribe no
    // puede depender de que alguien recuerde la ruta. La lista cerrada pasa de
    // once a doce con esa decisión, no por descuido.
    path: 'my-services',
    label: 'Mis servicios',
    group: 'Atención',
    icon: 'tag',
    roles: ROLES_DE_QUIEN_ATIENDE,
    availability: 'disponible',
    summary: 'Mirá los servicios de tu práctica y poné el precio de cada uno.',
    module: 'M17 billing',
  },

  {
    // FT-24. La cotización que sigue a «Mis servicios»: ahí se fija el precio
    // de referencia, acá se arma la oferta concreta para una persona —con su
    // plan de pagos— antes de la atención.
    //
    // **Sí corresponde agregarla al menú del médico** (a diferencia de
    // «Encuestas», que la nota de más abajo saca por
    // `fueraDelMenuPara`): cotizar es un paso del flujo de atención que se iba
    // a repetir —no una tarea que se hace una vez y se olvida—, y a diferencia
    // de la ficha de un paciente (que cuelga como hija sin entrada propia,
    // ver `PANTALLAS_HIJAS` en `app.routes.ts`) el listado de cotizaciones sí
    // es un destino al que se vuelve por su cuenta: revisar lo ya ofrecido a
    // alguien, no sólo el momento de crearlo. Mismo criterio que le dio
    // renglón a «Mis servicios» (FT-22): un lugar donde se arma una oferta con
    // dinero de por medio no puede depender de que alguien recuerde la ruta.
    //
    // Los roles son los de quien atiende, igual que «Mis servicios»: cotizar
    // es tarea de quien ofrece el servicio, no de quien administra el
    // catálogo fijo.
    //
    // La lista cerrada pasa de doce a trece con esta decisión, no por
    // descuido — ver el comentario de `navigation.service.spec.ts` que fija
    // la lista completa.
    path: 'my-quotations',
    label: 'Cotizaciones',
    group: 'Atención',
    icon: 'billing',
    roles: ROLES_DE_QUIEN_ATIENDE,
    availability: 'disponible',
    summary: 'Armá el presupuesto de un servicio con su plan de pagos y compartilo.',
    module: 'M17 billing',
  },

  {
    // Carril 10. **La ruta NO es `surveys` y eso no es decoración**: `/surveys`
    // es el prefijo del módulo en la API, y el proxy compara por inicio de ruta
    // sin límite de segmento — una sección llamada `surveys` se iría entera al
    // backend. Mismo caso que M13 en `administration/geolocation`. Lo hace
    // cumplir `scripts/check-route-prefixes.mjs`.
    path: 'questionnaires',
    // §4.H · fuera del menú del médico: se arma una encuesta desde la consulta
    // del paciente al que se le va a asignar, no como tarea suelta.
    fueraDelMenuPara: ['PRACTITIONER'],
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
    // El rol **dejó de ser** el de «Organizaciones» con la consola de planes y
    // coberturas: quien administra una aseguradora es owner o admin de su
    // tenant, y eso es una fila de `tenant_memberships` que el token no
    // transporta como rol. Exigir `SECURITY_ADMIN` le cerraba la puerta justo a
    // esa persona, así que la sección pasó a `ANY_ROLE` + `requiresTenant` y la
    // capacidad real la resuelve la API (`carrier.canAdminister`).
    //
    // `hiddenFor` es el complemento que `requiresTenant` necesita, y no es
    // opcional: el alta de paciente lo afilia al tenant por defecto, así que
    // *todos* cumplen la condición de membresía. Sin esta línea, un paciente y
    // un médico veían «Aseguradora» en su menú de administración — que es
    // exactamente lo que destaparon `access-tree.spec.ts` y
    // `navigation.service.spec.ts`. Mismo par que «Tu organización».
    path: 'administration/insurance',
    label: 'Aseguradora',
    group: 'Administración',
    icon: 'umbrella',
    roles: [ANY_ROLE],
    requiresTenant: true,
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
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
    // TAREA-16 (M26): las solicitudes que **esta organización presentó** y lo
    // que cada aseguradora aprobó. Va en el mismo grupo que «Aseguradora» y
    // «Brokers» porque es la tercera cara del mismo módulo.
    //
    // `BILLING_OPERATOR` es quien factura y cobra del lado del prestador, y es
    // el rol que decidió el propietario (TAREA-16 · D1.b, 2026-09-04) para ver
    // el listado y para reclamar; `SECURITY_ADMIN` conserva el acceso
    // administrativo de siempre y `SUPERADMIN` entra por el comodín del
    // registro. Los `BILLING`/`FINANCE` que declaran las **escrituras** del
    // ciclo del reclamo no se ofrecen acá: adjudicar o revertir son actos de
    // quien paga, y ésta es la pantalla de quien reclama.
    path: 'administration/insurance-claims',
    label: 'Solicitudes de seguro',
    group: 'Administración',
    icon: 'clipboard',
    roles: ['BILLING_OPERATOR', 'SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Lo que presentaste a cada aseguradora, con lo que aprobó.',
    module: 'M26 insurance',
  },
  {
    // Subtarea 3.1 (M26, v4.2.14): el tablero de siniestralidad, gasto per
    // cápita y epidemiología — cara de LA ASEGURADORA, no del prestador.
    //
    // Mismo patrón que «Aseguradora» (`administration/insurance`, arriba): la
    // dueña de una aseguradora sólo tiene el rol global `USER` — su autoridad
    // es la membresía OWNER/ADMIN del tenant, que el token no transporta como
    // rol. `BILLING_OPERATOR`/`FINANCIAL_AUDITOR` del pedido original NO
    // aplican: el primero es el rol del PRESTADOR («Solicitudes de seguro»,
    // arriba) y el segundo no existe en ningún catálogo de roles del proyecto.
    // La capacidad real la resuelve la API (membresía o `INSURANCE_OPERATOR`).
    path: 'administration/insurance-analytics',
    label: 'Siniestralidad y analítica',
    group: 'Administración',
    icon: 'chart',
    roles: [ANY_ROLE],
    requiresTenant: true,
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Tablero actuarial de siniestralidad, gasto per cápita y morbilidad.',
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
    // Portal administrativo · catálogo de datos (API módulo 67). Los roles son
    // los mismos que exige `GET /admin/catalog/*`: la guarda evita llegar a
    // una pantalla que sólo devolvería 403; la autoridad sigue siendo la API.
    path: 'administration/data-catalog',
    label: 'Catálogo de datos',
    group: 'Administración',
    icon: 'book',
    roles: ['SECURITY_ADMIN', 'PLATFORM_ADMIN', 'GOVERNANCE_ADMIN', 'DATA_PLATFORM_ADMIN', 'DPO'],
    availability: 'disponible',
    summary: 'Qué tablas existen, por qué existen, quién responde por ellas y con qué evidencia.',
    module: 'M67 data_catalog',
  },
  {
    // Analítica de producto y RUM sobre `telemetry` (`/admin/analytics`).
    path: 'administration/web-analytics',
    label: 'Analítica web',
    group: 'Administración',
    icon: 'chart',
    roles: ['PLATFORM_ADMIN', 'SECURITY_ADMIN', 'DATA_PLATFORM_ADMIN', 'MARKETING_MANAGER', 'DPO'],
    availability: 'disponible',
    summary: 'Tráfico, embudos, Core Web Vitals y salud del pipeline de eventos.',
    module: 'M28 telemetry',
  },
  {
    // QA Lab: lectura del laboratorio (M36) y runner en el servidor (M68).
    path: 'administration/qa-lab',
    label: 'QA Lab',
    group: 'Administración',
    icon: 'flask',
    roles: ['QA_ADMIN', 'QA_ENGINEER', 'RELEASE_MANAGER', 'PLATFORM_ADMIN'],
    availability: 'disponible',
    summary: 'Suites, planes de ejecución con aprobación y resultados con evidencia.',
    module: 'M36 qa_lab · M68 qa_execution',
  },
  {
    // Consola de operación y preparación para producción (`/admin/ops`).
    path: 'administration/operations',
    label: 'Operación',
    group: 'Administración',
    icon: 'monitor',
    roles: ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'],
    availability: 'disponible',
    summary: 'Preparación para producción con evidencia, incidentes, SLO y backups.',
    module: 'M11 system_ops · M46 platform_ops',
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
    summary:
      'Administrá sedes, áreas, quirófanos, consultorios, plantilla, legajo y tus vinculaciones.',
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
    // FT-26 (05/09/2026) — activos fijos y pasivos de la práctica, en
    // auto-servicio del doctor. Va junto a Contabilidad por el mismo motivo
    // que ese registro: los dos leen y escriben el mismo `practiceId`, y son
    // la misma persona —quien ejerce— la que entra a los dos.
    //
    // Sólo `PRACTITIONER`: a diferencia de Contabilidad, no hay todavía un
    // motor admin equivalente para dar de alta activos/pasivos (el que existe,
    // `AccountingAssetController`/`AccountingLiabilityController`, es
    // `SECURITY_ADMIN` puro y no comparte pantalla con éste — ver el reporte
    // del carril). Cuando eso cambie, se suma el rol acá.
    path: 'assets-liabilities',
    label: 'Activos y pasivos',
    group: 'Facturación',
    icon: 'chart',
    roles: ['PRACTITIONER'],
    availability: 'disponible',
    summary: 'Tus activos fijos y tus deudas: alta, avance y automatización.',
    module: 'M16 accounting',
  },

  /* -- Mi cuenta · autoservicio, con navegación propia --------------------
     El vault lo pide separado: son datos de la persona sobre sí misma, no
     registros que administra. Sin roles, porque nadie necesita permiso para
     mirar lo suyo. */

  {
    // B.1 · las personas a cargo del titular. Sin `roles` por lo mismo que «Mis
    // citas»: el filtro real es tener perfil de paciente, que no es un rol sino
    // un dato de la cuenta, y la pantalla lo dice cuando falta en vez de
    // esconderse del menú.
    path: 'my-account/dependents',
    // Es del paciente: a quien atiende no se le ofrece.
    hiddenFor: ['PRACTITIONER'],
    label: 'Dependientes',
    group: 'Mi cuenta',
    icon: 'patients',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary:
      'Registrá a quienes están a tu cargo y pedí turnos o consultá su historia en su nombre.',
    module: 'M05 profiles',
  },
  {
    path: 'my-account',
    label: 'Mi perfil',
    group: 'Mi cuenta',
    icon: 'patients',
    // Suelta y arriba, fuera del desplegable. Ver `AppSection.pinnedTop`.
    pinnedTop: true,
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
    // Sin `roles` a propósito: el filtro real es tener perfil de paciente, que
    // no es un rol sino un dato de la cuenta —el claim `pid` del token—, y la
    // pantalla lo dice cuando falta en vez de esconderse del menú.
    path: 'my-account/appointments',
    // Es del paciente: al médico no se le ofrece. Mismo mecanismo que
    // «Tu organización» para el paciente (`hiddenFor`, B-14).
    hiddenFor: ['PRACTITIONER'],
    label: 'Mis citas',
    group: 'Mi cuenta',
    icon: 'calendar',
    roles: [ANY_ROLE],
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
    // Es del paciente: al médico no se le ofrece. Mismo mecanismo que
    // «Tu organización» para el paciente (`hiddenFor`, B-14).
    hiddenFor: ['PRACTITIONER'],
    label: 'Mi historia clínica',
    group: 'Mi cuenta',
    // `results` y no `patients`: lo que esta sección muestra son resultados de
    // atenciones, y el ícono de pacientes es el de «gente», que acá sería la
    // persona mirándose a sí misma.
    icon: 'heart',
    roles: [ANY_ROLE],
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
    // Es del paciente: al médico no se le ofrece. Mismo mecanismo que
    // «Tu organización» para el paciente (`hiddenFor`, B-14).
    hiddenFor: ['PRACTITIONER'],
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
    // Sin `roles` por lo mismo que su hermana: el filtro real es tener perfil
    // de paciente, y la pantalla lo dice cuando falta.
    path: 'my-account/diagnostic-orders',
    // Es del paciente: al médico no se le ofrece. Mismo mecanismo que
    // «Tu organización» para el paciente (`hiddenFor`, B-14).
    hiddenFor: ['PRACTITIONER'],
    label: 'Mis órdenes',
    group: 'Mi cuenta',
    icon: 'orders',
    roles: [ANY_ROLE],
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
    // Es del paciente: al médico no se le ofrece. Mismo mecanismo que
    // «Tu organización» para el paciente (`hiddenFor`, B-14).
    hiddenFor: ['PRACTITIONER'],
    label: 'Mis cuestionarios',
    group: 'Mi cuenta',
    icon: 'survey',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Respondé los cuestionarios de las consultas que ya tuviste.',
    module: 'M-surveys',
  },
  {
    // Ajustes — lo que la persona configura sobre su propia cuenta, junto.
    //
    // Reemplaza a «Preferencias de avisos», que ocupaba este renglón: configurar
    // los avisos dejó de ser una sección para pasar a ser un panel de acá. La
    // dirección vieja sigue viva como redirección (`RUTAS_HEREDADAS`), porque
    // estaba en el menú y por lo tanto en los favoritos de alguien.
    //
    // **No ocupa renglón** (`fueraDelMenuPara: [ANY_ROLE]`): los ajustes no son
    // un destino de trabajo, y por eso se entra por el ícono del encabezado, que
    // es donde vivían el tema y la campana. La sección sigue entera —ruta,
    // título, breadcrumb y guard—; lo único que pierde es la fila del menú.
    //
    // Sin `roles` restringidos: cualquiera con sesión tiene avisos, tema y
    // permisos del navegador que configurar. Lo que dentro es de un rol —la
    // administración de permisos delegados— lo decide la propia pantalla.
    path: 'settings',
    label: 'Ajustes',
    group: 'Mi cuenta',
    icon: 'settings',
    roles: [ANY_ROLE],
    fueraDelMenuPara: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Configurá tus avisos, la apariencia y los permisos de tu cuenta.',
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
    // Suelta y arriba, fuera del desplegable: es de las dos que se abren sin
    // pensar a qué dominio pertenecen. Ver `AppSection.pinnedTop`.
    pinnedTop: true,
    icon: 'bell',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Revisá todos tus avisos: recetas, consultas, turnos y mensajes.',
    module: 'M35 messaging',
  },
  {
    // **Una sola sección desde el 2026-09-10.** Eran dos —«Verificar identidad»
    // y «Mis verificaciones»— que mostraban los mismos trámites: la primera los
    // repetía debajo del formulario y la segunda era la tabla. El propietario
    // pidió unirlas, y el resultado es una pantalla con dos pestañas
    // (`features/identity-verification/identity-hub/`).
    //
    // `my-account/identity/verify` **no desaparece**: sigue siendo el destino
    // que `IDENTITY_VERIFICATION_ROUTE` publica para el 403
    // `IDENTITY_VERIFICATION_REQUIRED`, y ahora redirige acá. Romper esa puerta
    // dejaría el error sin salida.
    path: 'my-account/identity',
    // «Mi identidad» y no «Verificación de identidad»: ese rótulo ya es de
    // `administration/identity-assurance`, la cola de quien revisa. Dos
    // secciones con el mismo nombre en el mismo producto son dos secciones que
    // nadie sabe distinguir — y una prueba del registro las confunde también.
    label: 'Mi identidad',
    group: 'Mi cuenta',
    icon: 'shield',
    roles: [ANY_ROLE],
    // Fuera del menú mientras el producto no ofrezca la verificación: ver
    // `VERIFICACION_DE_IDENTIDAD_OFRECIDA`. La sección sigue entera —la ruta,
    // la pantalla y la salida del 403—, lo único que pierde es el renglón.
    ...(VERIFICACION_DE_IDENTIDAD_OFRECIDA ? {} : { fueraDelMenuPara: [ANY_ROLE] }),
    availability: 'disponible',
    summary: 'Validá tu identidad o tu matrícula, y seguí el estado de tus trámites.',
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
    // Las promociones que las farmacias le mandaron al paciente (T-E7). Mismo
    // criterio que «Mis puntos»: rol de paciente, sin `exclusiveRoles`. Icono
    // `tag`: ningún otro de «Mi cuenta» lo usa.
    path: 'my-account/promotions',
    label: 'Promociones',
    group: 'Mi cuenta',
    icon: 'tag',
    roles: ['PATIENT'],
    availability: 'disponible',
    summary: 'Las promociones que te mandaron las farmacias.',
    module: 'M51 promotions',
  },
  {
    // **«Mi consultorio propio»** (propietario, 2026-09-10), en el lugar que
    // ocupaba «Tu organización». Aquélla mostraba la organización del tenant
    // activo —la clínica donde el médico está afiliado—, que no es suya: junto
    // a «Mis organizaciones» y «Organización médica» eran tres tarjetas
    // parecidas y ninguna contestaba «¿dónde atiendo yo?».
    //
    // `my-practice` y no `my-office`: es el término del modelo (`M14 practice`)
    // y el que ya usa `NewOwnSite` en el contrato. La ruta no puede empezar por
    // `practices`, que el proxy reserva entero para la API.
    path: 'administration/my-practice',
    label: 'Mi consultorio propio',
    group: 'Administración',
    icon: 'hospital',
    // Sólo de quien ejerce: un consultorio propio es de un profesional.
    roles: ['PRACTITIONER'],
    // **Fuera del menú lateral, igual que la sección que reemplaza.** El menú
    // del médico es una lista cerrada de nueve que el propio propietario fijó,
    // con un spec que falla si alguien agrega la décima; «Tu organización»
    // tampoco estaba ahí. Ocupa su mismo lugar: la zona «Administración» de
    // «Tus accesos», que es donde el propietario señaló las tres tarjetas
    // parecidas. Y se llega también desde «Mi perfil», que es donde alguien va
    // a buscar «¿dónde atiendo?».
    fueraDelMenuPara: ['PRACTITIONER'],
    availability: 'disponible',
    summary: 'Los lugares donde atendés por tu cuenta: dirección, mapa y horario.',
    module: 'M14 practice',
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
    // **Invisible para el médico desde el 2026-09-10**, no sólo fuera de su
    // menú. El propietario pidió sacar «Tu organización» «de todos lados» y
    // poner en su lugar «Mi consultorio propio»: con `fueraDelMenuPara` la
    // tarjeta seguía apareciendo en «Tus accesos», que es justo donde la
    // señaló, al lado de otras dos parecidas.
    //
    // La pantalla **no se borra**: muestra la organización del tenant activo y
    // la sigue viendo quien la administra, que es de quien es. Efecto
    // conocido y aceptado: un médico que además administra su clínica la pierde
    // de la navegación —tiene el rol `PRACTITIONER`—; le queda la ruta.
    //
    // `requiresTenant` no alcanzaba para esconderla del paciente: el alta de
    // paciente lo afilia al tenant por defecto, así que todos cumplen la
    // condición. Medido contra la API viva.
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
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
    // El mostrador no es del paciente. Ver `hiddenFor` en «Tu organización».
    hiddenFor: ['PATIENT'],
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
    // Quien las publica, no quien las recibe: el paciente ve las promociones en
    // la ficha pública de la farmacia, no en el panel que las administra.
    hiddenFor: ['PATIENT'],
    label: 'Promociones',
    group: 'Administración',
    icon: 'megaphone',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Las campañas de tu farmacia: qué productos, con qué descuento y hasta cuándo.',
    module: 'M51 promotions',
  },
  {
    // La ficha legal de la farmacia: lo que la empresa es en los papeles —sus
    // datos de registro, su carpeta de documentos y quién responde por ella—.
    // No es la bandeja ni las promociones: es la farmacia mirándose a sí misma.
    //
    // Mismo criterio de acceso que sus dos hermanas: la membresía manda (claim
    // `tenants`), no un rol del token — no existe un rol de farmacia minorista,
    // y owner/admin/staff son filas de `tenant_memberships` que el front no
    // decodifica.
    path: 'administration/pharmacy-profile',
    // §4.H · fuera del menú del médico: la ficha legal la lleva quien
    // administra la farmacia, no el consultorio.
    fueraDelMenuPara: ['PRACTITIONER'],
    roles: [ANY_ROLE],
    // Y no existe para el paciente. `requiresTenant` no alcanza: el alta de
    // paciente lo afilia al tenant por defecto, así que cumple la condición y
    // sin esto la ficha legal de una farmacia le aparecía en el menú.
    hiddenFor: ['PATIENT'],
    label: 'Ficha de la farmacia',
    group: 'Administración',
    // `building` y no `bag`: la bolsa es el mostrador, esto es la empresa.
    icon: 'building',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Los datos legales de tu farmacia, su carpeta de documentos y sus responsables.',
    module: 'M24 pharmacy',
  },
];
