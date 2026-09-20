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
 * | nombre · documento · sexo y nacimiento · título profesional | Datos personales |
 * | contacto privado · contacto del trabajo · dónde vivís | Contacto |
 * | — (a nombre de quién factura) | Facturación |
 * | tu consultorio propio | Dónde atiendo |
 * | dónde estudió el título · tus títulos | Trayectoria |
 * | habilitación · respaldos · especialidades | Credenciales |
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
 * Las pestañas del **editor** del perfil médico: las mismas de la ficha, menos
 * dos.
 *
 * Pedido del cliente, repetido el 2026-09-11: editar el perfil tiene que ser
 * «en varias pestañas». Hasta hoy el editor eran cuatro tarjetas apiladas con
 * cuatro botones de guardar, que es justo lo que prohíbe
 * `docs/components/composition-rules.md` §5.
 *
 * Son las de {@link PESTANAS_DEL_PERFIL_MEDICO} en el mismo orden, salteando la
 * única que no tiene nada que editar acá:
 *
 * - **Actividad** — son los contadores de la plataforma. No se editan: se
 *   miran.
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
 * **No se duplica nada**: las tres superficies montan el MISMO
 * `app-work-history` —esta pestaña, «Mis organizaciones» y Trayectoria— con
 * distinto valor de su input `secciones`. Un arreglo llega a las tres.
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

/** Los índices con nombre del editor. No son los de la ficha: son seis. */
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

  /* 3 · Contanos un poco sobre vos */
  sexAtBirth: PESTANA_MEDICO.personales,
  birthDate: PESTANA_MEDICO.personales,

  /* 4 · Cómo te contactamos en privado */
  mobilePhone: PESTANA_MEDICO.contacto,
  personalEmail: PESTANA_MEDICO.contacto,

  /* 5 · El contacto de tu trabajo */
  workMobilePhone: PESTANA_MEDICO.contacto,
  workLandline: PESTANA_MEDICO.contacto,
  email: PESTANA_MEDICO.contacto,

  /* 6 · ¿Dónde vivís? */
  municipio: PESTANA_MEDICO.contacto,
  homeAddressLines: PESTANA_MEDICO.contacto,
  gpsDomicilio: PESTANA_MEDICO.contacto,

  /* 7 · Tu consultorio propio */
  officeName: PESTANA_MEDICO.dondeAtiendo,
  municipioConsultorio: PESTANA_MEDICO.dondeAtiendo,
  officeAddressLines: PESTANA_MEDICO.dondeAtiendo,
  gpsConsultorio: PESTANA_MEDICO.dondeAtiendo,

  /* 8 · Tu título profesional y foto */
  profilePhotoBase64: PESTANA_MEDICO.personales,
  professionalTitle: PESTANA_MEDICO.personales,
  professionalTitleEducation: PESTANA_MEDICO.trayectoria,
  professionalTitleUniversity: PESTANA_MEDICO.trayectoria,
  professionalTitleCountry: PESTANA_MEDICO.trayectoria,
  professionalTitleCity: PESTANA_MEDICO.trayectoria,
  professionalTitleFile: PESTANA_MEDICO.trayectoria,

  /* 9 · Tu habilitación para ejercer */
  licenseNumber: PESTANA_MEDICO.credenciales,
  sedesLicenseNumber: PESTANA_MEDICO.credenciales,
  regulatoryAuthority: PESTANA_MEDICO.credenciales,
  licenseIssueDate: PESTANA_MEDICO.credenciales,

  /* 10 · Los respaldos de tu habilitación */
  credentialAttachments: PESTANA_MEDICO.credenciales,

  /* 11 · Tus títulos */
  academicTitles: PESTANA_MEDICO.trayectoria,

  /* 12 · Tus especialidades */
  specialtyPrimary: PESTANA_MEDICO.credenciales,
  especialidadesExtra: PESTANA_MEDICO.credenciales,
};

/**
 * El campo del alta que la ficha NO muestra, y por qué.
 *
 * Uno solo. Se declara acá para que el spec pueda distinguir «se olvidaron de
 * mapearlo» de «se decidió no mostrarlo», que es la diferencia entre un defecto
 * y una decisión.
 */
export const CAMPOS_DEL_ALTA_SIN_PESTANA: Readonly<Record<string, string>> = {
  password:
    'Una contraseña no se muestra nunca. La ficha ofrece el camino para cambiarla ' +
    '(«Cambiar contraseña»), que es lo único que se puede hacer con ella.',
};
