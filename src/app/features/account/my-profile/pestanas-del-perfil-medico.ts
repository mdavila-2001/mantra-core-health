/**
 * Las pestañas de la ficha del **médico**, espejo de las del paciente.
 *
 * ## Por qué existe
 *
 * Pedido del cliente del 2026-09-10: «la información del perfil del médico debe
 * mostrar de la misma manera que la información del paciente, claro tomando en
 * cuenta todos los campos del registro de creación del médico».
 *
 * O sea: la MISMA tarjeta —un solo `app-card` con pestañas, retrato y lápiz a
 * la derecha— que {@link PESTANAS_DEL_PERFIL}, pero con los datos de un médico.
 * La ficha del médico era otra cosa: cinco tarjetas apiladas, chips de vitrina y
 * dos pestañas al fondo.
 *
 * ## El orden es el del alta, no el de la ficha vieja
 *
 * `auth/register-practitioner` pregunta en doce pasos, y ese orden es el que la
 * persona ya recorrió una vez. Las cinco pestañas los agrupan sin reordenarlos:
 *
 * | Pasos del alta | Pestaña |
 * |---|---|
 * | nombre · documento · sexo y nacimiento · título profesional · tus especialidades | Datos personales |
 * | contacto privado · contacto del trabajo · dónde vivís | Contacto |
 * | — (a nombre de quién factura) | Facturación |
 * | tu consultorio propio | Dónde atiendo |
 * | — (los cargos: dónde ejerció y dónde ejerce) | Trayectoria |
 * | dónde estudió el título · habilitación · respaldos · tus títulos | Credenciales |
 * | — (lo que registró con la cuenta) | Actividad |
 *
 * Las dos últimas filas no salen del alta y tampoco se podían tirar: la
 * trayectoria laboral (UC-05-16) y los contadores de la plataforma ya se
 * mostraban en la ficha vieja, y quitarlos para «parecerse más al paciente»
 * habría sido perder información con la excusa de un rediseño.
 *
 * ## «Facturación» tampoco sale del alta, y es la que faltaba
 *
 * El alta de médico no pregunta el NIT, así que la ficha no lo mostraba y el
 * editor no lo pedía: un profesional que emite comprobantes no tenía dónde
 * declarar a nombre de quién salen. El paciente sí lo tenía desde el 09/09/2026
 * ({@link PESTANAS_DEL_PERFIL}), y esta es la misma pestaña en el mismo lugar
 * —tercera, después de Contacto— para que las dos fichas se lean igual. Pedido
 * del propietario del 19/09/2026.
 *
 * ## Por qué una constante y no cinco literales en la plantilla
 *
 * Igual que en el paciente: el índice se comparte con quien edite, y una lista
 * escrita dos veces se desordena en el primer retoque que se haga en una sola.
 */
export const PESTANAS_DEL_PERFIL_MEDICO = [
  'Datos personales',
  'Contacto',
  'Facturación',
  'Dónde atiendo',
  'Trayectoria',
  'Credenciales',
  'Actividad',
] as const;

/** Los índices con nombre, para no escribir `4` donde se quiere decir «Credenciales». */
export const PESTANA_MEDICO = {
  personales: 0,
  contacto: 1,
  facturacion: 2,
  dondeAtiendo: 3,
  trayectoria: 4,
  credenciales: 5,
  actividad: 6,
} as const;

/**
 * Las pestañas del **editor** del perfil médico: **las de la ficha menos
 * «Actividad»**.
 *
 * Pedido del cliente, repetido el 2026-09-11: editar el perfil tiene que ser
 * «en varias pestañas». Hasta hoy el editor eran cuatro tarjetas apiladas con
 * cuatro botones de guardar, que es justo lo que prohíbe
 * `docs/components/composition-rules.md` §5.
 *
 * Son las de {@link PESTANAS_DEL_PERFIL_MEDICO} en el mismo orden, salvo la
 * última.
 *
 * ## «Actividad» no está, y en la ficha no tiene lápiz
 *
 * Son cuatro contadores de lo que la persona ya hizo —encuentros, recetas,
 * notas, documentos—, y un contador que se escribe a mano deja de contar.
 *
 * Entre el 20/09/2026 y el 24/09/2026 el editor la tuvo, sin un solo campo y
 * explicando por qué, porque el doctor había pedido que «TODAS las pestañas
 * sean editables» (C-05). El cliente pidió el 24/09/2026 sacarla: «en el
 * perfil del doctor no debe poder editarse actividad, porque es solo
 * estadísticas». Una pestaña de edición donde no se edita nada seguía
 * prometiendo que ahí algo se cambia. Ahora la ficha no ofrece el lápiz en
 * «Actividad» (`pestanaDeEdicion` da `null`) y el editor no la tiene.
 *
 * ## «Dónde atiendo» volvió, y por qué
 *
 * Estuvo fuera hasta el 13/09/2026, con este argumento: el consultorio propio
 * se crea en `/administration/my-practice`, y duplicar acá el formulario daría
 * dos lugares para el mismo dato. El argumento era bueno pero la conclusión
 * estaba mal, porque el formulario **no** estaba sólo allá: también vivía en la
 * pestaña «Trayectoria», que es donde nadie lo busca —la trayectoria es dónde
 * ejerciste antes, no dónde atendés hoy—.
 *
 * El cliente pidió sacarlo de Trayectoria. Y la ficha no podía quedárselo: la
 * ficha **muestra**, y cargar un consultorio es editar. Así que el bloque viene
 * acá, que es donde alguien que quiere cambiar dónde atiende lo va a buscar.
 *
 * **La ficha sí se lo quedó, el 20/09/2026.** El doctor pidió que el
 * consultorio «se vea como pestaña para personalizarle el QR y todo lo que
 * ofrece esa view» (C-02), y con eso el enlace suelto del perfil a
 * `/administration/my-practice` se retiró. El argumento de arriba no era
 * malo —la ficha muestra— pero perdió contra el pedido: sin esa pestaña, para
 * cargar el QR de cobro hay que salir del perfil. El desvío queda anotado acá
 * en vez de borrar el párrafo que lo contradice: el que viene tiene que poder
 * ver que hubo una decisión, no una distracción.
 *
 * **No se duplica nada**: las cuatro superficies montan el MISMO
 * `app-work-history` —esta pestaña, la de la ficha, «Mis organizaciones» y
 * Trayectoria— con distinto valor de su input `secciones`. Un arreglo llega a
 * las cuatro.
 *
 * El orden importa: quien viene de la ficha encuentra las pestañas donde las
 * dejó.
 */
export const PESTANAS_DEL_EDITOR_MEDICO = [
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.personales],
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.contacto],
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.facturacion],
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.dondeAtiendo],
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.trayectoria],
  PESTANAS_DEL_PERFIL_MEDICO[PESTANA_MEDICO.credenciales],
] as const;

/**
 * Los índices con nombre del editor. Desde el 20/09/2026 **son los mismos que
 * los de la ficha** para las seis que tiene: quien pulsa el lápiz en una
 * pestaña llega a esa pestaña, y el índice no hay que traducirlo. Se conservan como constante propia porque
 * eso puede volver a dejar de ser cierto, y entonces el lugar donde arreglarlo
 * es uno solo.
 */
export const PESTANA_EDITOR = {
  personales: 0,
  contacto: 1,
  facturacion: 2,
  dondeAtiendo: 3,
  trayectoria: 4,
  credenciales: 5,
} as const;

/**
 * Dónde se lee cada campo del alta de médico.
 *
 * La clave es la del `FormGroup` de `auth/register-practitioner`; el valor, la
 * pestaña donde ese dato aparece en la ficha. Es el contrato que impide que el
 * alta gane un campo y la ficha se entere seis meses después: el spec de al lado
 * lee los `key:` del alta y falla si alguno no está acá.
 *
 * `password` es la única ausencia deliberada — una contraseña no se muestra;
 * se cambia por su propio trámite, y la ficha ofrece ese camino.
 */
export const CAMPO_DEL_ALTA_EN_PESTANA: Readonly<Record<string, number>> = {
  /* 1 · ¿Cómo te llamás? */
  name: PESTANA_MEDICO.personales,
  lastName: PESTANA_MEDICO.personales,
  motherLastName: PESTANA_MEDICO.personales,

  /* 2 · Tu documento de identidad */
  nationalId: PESTANA_MEDICO.personales,
  issuerAdministrativeAreaConceptId: PESTANA_MEDICO.personales,

  /* 3 · Contanos un poco sobre vos.
     `sexAtBirth` estaba acá y era MENTIRA: se movió a
     `CAMPOS_DEL_ALTA_SIN_PESTANA` el 21/09/2026 con su motivo. Este mapa
     existe justamente para que un campo no apunte a una pestaña donde no
     está, y éste apuntaba a una donde nunca estuvo. */
  birthDate: PESTANA_MEDICO.personales,

  /* 4 · Cómo te contactamos en privado */
  mobilePhone: PESTANA_MEDICO.contacto,
  personalEmail: PESTANA_MEDICO.contacto,

  /* 5 · El contacto de tu trabajo.
     El celular y el fijo pasaron a `CAMPOS_DEL_ALTA_SIN_PESTANA` el 23/09/2026
     (D-03). El correo de trabajo se corrige en «Contacto» desde el 24/09/2026. */
  email: PESTANA_MEDICO.contacto,

  /* 6 · ¿Dónde vivís? */
  municipio: PESTANA_MEDICO.contacto,
  homeAddressLines: PESTANA_MEDICO.contacto,
  gpsDomicilio: PESTANA_MEDICO.contacto,

  /* 7 · Tu consultorio propio.
     Los cuatro siguen en «Dónde atiendo», y desde el 20/09/2026 el mapa dice
     más verdad que antes sin haber cambiado una línea: esa pestaña montaba
     sólo el mapa de sedes —que enseña el nombre, la dirección y el pin, pero
     no el municipio suelto— y ahora monta además el bloque del consultorio,
     donde los cuatro se ven y se corrigen con su propio control (C-02). */
  officeName: PESTANA_MEDICO.dondeAtiendo,
  municipioConsultorio: PESTANA_MEDICO.dondeAtiendo,
  officeAddressLines: PESTANA_MEDICO.dondeAtiendo,
  gpsConsultorio: PESTANA_MEDICO.dondeAtiendo,

  /* 8 · Tu título profesional y foto */
  profilePhotoBase64: PESTANA_MEDICO.personales,
  professionalTitle: PESTANA_MEDICO.personales,
  /* Dónde estudió y sus títulos (paso 11) viven en «Credenciales» desde el
     24/09/2026: son estudios, y «Trayectoria» son los cargos. El editor de
     Trayectoria ofrecía el formulario de un título a quien venía a corregir
     un cargo. */
  professionalTitleEducation: PESTANA_MEDICO.credenciales,
  professionalTitleUniversity: PESTANA_MEDICO.credenciales,
  professionalTitleCountry: PESTANA_MEDICO.credenciales,
  professionalTitleCity: PESTANA_MEDICO.credenciales,
  professionalTitleFile: PESTANA_MEDICO.credenciales,

  /* 9 · Tu habilitación para ejercer */
  licenseNumber: PESTANA_MEDICO.credenciales,
  sedesLicenseNumber: PESTANA_MEDICO.credenciales,
  regulatoryAuthority: PESTANA_MEDICO.credenciales,
  licenseIssueDate: PESTANA_MEDICO.credenciales,

  /* 10 · Los respaldos de tu habilitación */
  credentialAttachments: PESTANA_MEDICO.credenciales,

  /* 11 · Tus títulos */
  academicTitles: PESTANA_MEDICO.credenciales,

  /*
   * 12 · Tus especialidades
   *
   * Se mudó de «Credenciales» a «Datos personales» (pedido del propietario,
   * 24/09/2026): contestan «¿de qué es médico?», la misma pregunta que el
   * título profesional, y no «¿con qué habilitación ejerce?», que es lo que
   * queda en Credenciales junto con matrículas y respaldos. La ficha de
   * lectura ya las mostraba junto a la identidad desde el 19/09/2026 (C-09);
   * el editor era el único lugar donde seguían separadas de eso mismo.
   */
  especialidadesExtra: PESTANA_MEDICO.personales,
};

/**
 * Los campos del alta que la ficha NO muestra, y por qué.
 *
 * Se declaran acá para que el spec pueda distinguir «se olvidaron de mapearlo»
 * de «se decidió no mostrarlo», que es la diferencia entre un defecto y una
 * decisión.
 */
export const CAMPOS_DEL_ALTA_SIN_PESTANA: Readonly<Record<string, string>> = {
  password:
    'Una contraseña no se muestra nunca. La ficha ofrece el camino para cambiarla ' +
    '(«Cambiar contraseña»), que es lo único que se puede hacer con ella.',
  sexAtBirth:
    'El alta lo pregunta y la lectura del perfil médico no lo devuelve, así que no hay ' +
    'dato que mostrar: la ficha no lo enseña en ninguna pestaña y el editor no lo puede ' +
    'ofrecer. Estuvo declarado como si viviera en «Datos personales» hasta el 21/09/2026, ' +
    'y ahí no estaba. Que la persona no pueda ver ni corregir lo que declaró en el alta es ' +
    'un hueco del contrato, no una decisión de diseño: queda registrado como Q-I5.',
  workMobilePhone:
    'Celular del trabajo. El médico pidió el 23/09/2026 que «Contacto» no tuviera datos ' +
    'del trabajo (D-03): la ficha no lo muestra y el editor no lo ofrece. El alta lo sigue ' +
    'preguntando y el dato se guarda; guardar el perfil no lo borra.',
  workLandline:
    'Fijo del trabajo. Mismo pedido del médico del 23/09/2026 (D-03): fuera de «Contacto», ' +
    'en la ficha y en el editor. El alta lo sigue preguntando y el dato se guarda; guardar ' +
    'el perfil no lo borra.',
  workAddressLines:
    'El alta la guarda como dirección laboral, separada del domicilio y del consultorio ' +
    'propio, pero la ficha del médico todavía no la lee ni la muestra en ninguna pestaña.',
  gpsTrabajo:
    'El punto de mapa del lugar de trabajo se guarda con el alta; la ficha todavía no ' +
    'lo devuelve ni lo dibuja en ninguna pestaña.',
};
