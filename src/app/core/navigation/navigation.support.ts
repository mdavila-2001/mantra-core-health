import type { AppSection } from './navigation.types';

/* ============================================================================
    Las secciones del **personal de apoyo** (secretaria y otros roles), del
    diseño de 2026-10: las de la organización, la del doctor y las de la persona
    de apoyo.

    Viven en su propio archivo y no en `navigation.map.ts` porque ese registro
    está congelado por `scripts/check-max-lines.mjs` (un ratchet: no puede
    crecer) y estas son una unidad: se mudan juntas. Mismo patrón que
    `navigation.platform.ts`.

    `navigation.map.ts` las esparce en `APP_SECTIONS` en el mismo lugar donde
    estaban —entre «Delegar acceso» y «Proveedores de identidad»—, así que el
    orden del registro, que es el del menú, no cambia.

    Rutas **propuestas** (no están en el contrato compartido): `session-controls`,
    `support-review`, `support-activity`, `my-support/activity` y
    `my-team/activity`. Ver `docs/support-access/`.
    ========================================================================== */

export const SECCIONES_DE_APOYO: readonly AppSection[] = [
  /* ------------------------------------------------------------------------
      Personal de apoyo (secretaria y otros roles) — diseño de 2026-10.

      El hospital es UNA cuenta de organización (`accountKind: 'ORGANIZATION'`).
      Quien le ayuda recibe un **vínculo de apoyo** con permisos por objetivo;
      nadie comparte contraseña. Tres lados, tres juegos de secciones:

      - la organización (siete): solicitudes, equipo, quién tiene acceso,
        invitaciones, revisión periódica, actividad y controles de sesión. Solo
        la cuenta de organización (`onlyForAccountKind`) **y** con el rol que la API
        exige en `/org/*` (`SECURITY_ADMIN`): ninguna persona las ve;
      - el doctor (una): «Mi equipo»;
      - la persona de apoyo (dos): «Mis accesos» y la agenda combinada.

      Nada de esto autoriza: la API decide con `SupportAccessPolicy` en cada
      petición. Esconder la sección es no ofrecer una puerta cerrada.
     ------------------------------------------------------------------------ */
  {
    path: 'administration/support-requests',
    label: 'Solicitudes de apoyo',
    group: 'Administración',
    icon: 'mail',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Apruebe, ajuste o rechace lo que pide el personal de apoyo, ítem por ítem.',
    module: 'M29 delegated_access',
  },
  {
    path: 'administration/support-team',
    label: 'Equipo de apoyo',
    group: 'Administración',
    icon: 'people',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Quién le ayuda a administrar, con qué rol y qué puede hacer cada persona.',
    module: 'M29 delegated_access',
  },
  {
    path: 'administration/support-access-lookup',
    label: 'Quién tiene acceso',
    group: 'Administración',
    icon: 'key',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Elija un doctor, un servicio o una ubicación y vea quién puede actuar sobre ella.',
    module: 'M29 delegated_access',
  },
  {
    path: 'administration/support-invitations',
    label: 'Invitaciones y QR',
    group: 'Administración',
    icon: 'qr',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Emita un código o un QR para sumar a un doctor o a personal de apoyo.',
    module: 'M29 delegated_access',
  },
  {
    // Propuesta: la ruta no está en el contrato. La API ya sirve `/org/session-policies`.
    path: 'administration/session-controls',
    label: 'Controles de sesión',
    group: 'Administración',
    icon: 'lock',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    // Cualquier cuenta de organización —el hospital, la farmacia, el laboratorio—:
    // los controles de sesión no son del personal de apoyo sino de la cuenta.
    onlyForAccountKind: 'ORGANIZATION',
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Cuándo se cierra la sesión, desde dónde y en qué horario se puede entrar, y si se pide verificación en dos pasos.',
    module: 'M01 iam',
  },
  {
    // Propuesta: la ruta no está en el contrato.
    path: 'administration/support-review',
    label: 'Revisión periódica',
    group: 'Administración',
    icon: 'check-circle',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Vínculos por vencer, vencidos o suspendidos: confirmarlos, quitar permisos en lote y ver el historial.',
    module: 'M29 delegated_access',
  },
  {
    // Propuesta: la ruta no está en el contrato. Lee `GET /org/support-activity`.
    path: 'administration/support-activity',
    label: 'Actividad del equipo de apoyo',
    group: 'Administración',
    icon: 'history',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Qué hizo cada persona de apoyo, con filtros por persona, doctor, acción y fecha, y exportación a CSV.',
    module: 'M29 delegated_access',
  },
  {
    path: 'my-team',
    label: 'Mi equipo',
    group: 'Atención',
    icon: 'people',
    roles: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    availability: 'disponible',
    summary: 'Quién le ayuda con su agenda y sus mensajes, y qué puede hacer en su nombre.',
    module: 'M29 delegated_access',
  },
  {
    path: 'my-support',
    label: 'Mis accesos',
    group: 'Atención',
    icon: 'key',
    // `SUPPORT_STAFF` (el personal de apoyo / secretarias) y `PRACTITIONER` (médicos): es la pantalla donde la persona ve sus
    // accesos y canjea un código o el QR multiuso de doctores. Las cuentas de organización quedan fuera por
    // `onlyForAccountKind`, y los pacientes quedan fuera por `hiddenFor: ['PATIENT']`.
    roles: ['SUPPORT_STAFF', 'PRACTITIONER'],
    onlyForAccountKind: 'PERSON',
    hiddenFor: ['PATIENT'],
    // Solo donde hay personal de apoyo: la persona de una farmacia, de un
    // laboratorio o de una aseguradora no ve esto, y su menú no cambia.
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER', 'MEDICAL_OFFICE'],
    availability: 'disponible',
    summary: 'En qué organizaciones ayuda, qué puede hacer en cada una y cómo pedir más permisos.',
    module: 'M29 delegated_access',
  },
  {
    path: 'support-inbox',
    label: 'Bandeja de mensajes',
    group: 'Atención',
    icon: 'chat',
    // Solo para secretarias / personal de apoyo (`SUPPORT_STAFF`).
    roles: ['SUPPORT_STAFF'],
    onlyForAccountKind: 'PERSON',
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    // Como la agenda combinada: solo donde hay personal de apoyo.
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER', 'MEDICAL_OFFICE'],
    availability: 'disponible',
    summary: 'Los mensajes de pacientes a los doctores que cubre: tomarlos, responder en su nombre o derivarlos.',
    module: 'M19 community',
  },
  {
    path: 'combined-agenda',
    label: 'Agenda combinada',
    group: 'Atención',
    icon: 'calendar',
    // Solo para secretarias / personal de apoyo (`SUPPORT_STAFF`). Médicos usan su propia agenda (`/agenda`) y pacientes no tienen agenda combinada.
    roles: ['SUPPORT_STAFF'],
    onlyForAccountKind: 'PERSON',
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    // Solo donde hay personal de apoyo: la persona de una farmacia, de un
    // laboratorio o de una aseguradora no ve esto, y su menú no cambia.
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER', 'MEDICAL_OFFICE'],
    availability: 'disponible',
    summary: 'La agenda de los doctores que cubre, junta, con lo que puede hacer en cada horario.',
    module: 'M41 scheduling',
  },
  /* ------------------------------------------------------------------------
      Gobierno de accesos (fase 5, CONTRATO-GOBIERNO §9.3 y §9.7): el tablero y sus pantallas hijas, la administración
      delegada del jefe de servicio o de piso, y la bandeja del revisor. Las hijas (matriz, anomalías, campañas, SoD,
      barandillas, aprobaciones, ciclo de vida, simulador) cuelgan de «Gobierno de accesos» y heredan su regla por
      prefijo: no tienen renglón de menú propio.

      Los guards **no autorizan**: ocultan menú. La API decide en cada petición.
     ------------------------------------------------------------------------ */
  {
    path: 'administration/access-governance',
    label: 'Gobierno de accesos',
    group: 'Administración',
    icon: 'shield',
    roles: ['SECURITY_ADMIN'],
    requiresTenant: true,
    onlyForAccountKind: 'ORGANIZATION',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Quién tiene acceso, qué riesgo hay, qué necesita su atención hoy y todo lo que decide quién puede qué.',
    module: 'M29 delegated_access',
  },
  {
    // Visible para quien administra por alcance (jefe de servicio o de piso). Que **tenga** capacidades lo dice
    // `GET /org/team/capabilities`; sin ellas, la pantalla muestra S5 con la explicación.
    path: 'administration/team-management',
    label: 'Mi equipo (administración)',
    group: 'Atención',
    icon: 'people',
    roles: ['SUPPORT_STAFF'],
    onlyForAccountKind: 'PERSON',
    onlyForTenantTypes: ['HOSPITAL', 'CLINIC', 'PROVIDER'],
    hiddenFor: ['PATIENT', 'PRACTITIONER'],
    availability: 'disponible',
    summary: 'Administre a su gente dentro de su servicio o piso: permisos, invitaciones, bajas y reactivaciones.',
    module: 'M29 delegated_access',
  },
  {
    // Quien revisa sin ser doctor: el administrador de seguridad y el jefe de servicio o de piso. Que **haya** ítems lo dice
    // `GET /me/access-reviews/items`; sin ellos, S3 «No tiene accesos por revisar».
    //
    // El **doctor** no la ve en el menú a propósito: su panel tiene una lista cerrada (§4.H del plan de UX del 22/08/2026)
    // y esta no entra. Llega por «Mi equipo»: `my-team/reviews` abre la misma pantalla.
    path: 'my-reviews',
    label: 'Mis revisiones',
    group: 'Atención',
    icon: 'check-circle',
    roles: ['SECURITY_ADMIN', 'SUPPORT_STAFF'],
    hiddenFor: ['PATIENT'],
    availability: 'disponible',
    summary: 'Los accesos que le toca revisar en las campañas de certificación: mantener, quitar o ajustar.',
    module: 'M29 delegated_access',
  },
];
