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
    path: 'panel',
    label: 'Panel',
    group: 'General',
    icon: 'home',
    availability: 'disponible',
    summary: 'Tu punto de partida: la sesión activa y el estado del sistema.',
    module: 'M30 read_models',
  },

  /* -- Atención · fase 1 del orden de trabajo ------------------------------ */

  {
    path: 'agenda',
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
    path: 'clinico',
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

  /* -- Administración · fase 0, la fundación ------------------------------- */

  {
    path: 'administracion/pacientes',
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
    path: 'administracion/usuarios',
    label: 'Usuarios',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN'],
    availability: 'disponible',
    summary: 'Dá de alta cuentas y revisá quién tiene acceso a la organización.',
    module: 'M01 iam',
  },
  {
    path: 'administracion/organizaciones',
    label: 'Organizaciones',
    group: 'Administración',
    icon: 'settings',
    roles: ['SECURITY_ADMIN'],
    availability: 'planificada',
    summary: 'Administrá sedes, membresías y datos de la organización.',
    module: 'M04 directory',
  },
  {
    path: 'administracion/terminologia',
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

  /* -- Facturación · fase 2 ------------------------------------------------ */

  {
    path: 'facturacion',
    label: 'Facturación',
    group: 'Facturación',
    icon: 'billing',
    roles: ['BILLING', 'FINANCE', 'CASHIER', 'PAYMENTS_ADMIN'],
    availability: 'planificada',
    summary: 'Emití comprobantes y seguí los cobros de la organización.',
    module: 'M26 billing · M42 payments',
  },

  /* -- Mi cuenta · autoservicio, con navegación propia --------------------
     El vault lo pide separado: son datos de la persona sobre sí misma, no
     registros que administra. Sin roles, porque nadie necesita permiso para
     mirar lo suyo. */

  {
    path: 'mi-cuenta',
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
    // La ruta es la que `IDENTITY_VERIFICATION_ROUTE` ya publica como destino
    // del 403 `IDENTITY_VERIFICATION_REQUIRED`: **no se renombra**. Cambiarla
    // rompería la puerta que traduce ese error en una salida.
    path: 'identidad/verificar',
    label: 'Verificar identidad',
    group: 'Mi cuenta',
    icon: 'patients',
    availability: 'disponible',
    summary: 'Validá tu identidad para acceder a los datos clínicos.',
    module: 'M27 identity_assurance',
  },
];
