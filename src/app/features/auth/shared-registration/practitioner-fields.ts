import { Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';

import type { BirthSexCode } from '../../../core/data-access/iam/iam.types';
import { PROFESSION_COLLEGE, titleCollege } from '../../../core/profession/regulatory-authorities';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { INVALID_IDENTITY_DOCUMENT_MESSAGE } from './national-id';
import { MESSAGE_SHORT_PASSWORD } from './password-policy';

/**
 * Las páginas y los campos del alta de médico, en un solo lugar.
 *
 * Los lee el alta (`register-practitioner`) para armar su formulario paginado y
 * el editor del perfil (`practitioner-profile-edit`) para reutilizar rótulos,
 * obligatoriedad y validadores de los campos que comparten (CORR-08, MT-38-01).
 * Dos copias de la misma pregunta terminaban diciendo cosas distintas.
 */

const OPCIONES_SEXO: readonly SelectOption<BirthSexCode>[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];

const TITULO_ODONTOLOGO = 'Odontólogo / Odontóloga';
/** Títulos cuya autoridad natural es el Colegio Médico. */
const TITULOS_MEDICOS: ReadonlySet<string> = new Set([
  'Médico / Médica',
  'Médico especialista / Médica especialista',
]);

/** Lo que las páginas necesitan del formulario que las monta. */
export interface PractitionerFieldsContext {
  /** El título profesional elegido: cambia el rótulo de la matrícula y su autoridad. */
  readonly professionalTitle: string;
  /** El departamento de emisión depende del estado de su catálogo en cada pantalla. */
  readonly departmentIssuerField: (testId: string) => CampoDeFormulario;
}

/** El teléfono personal del alta es obligatorio y debe estar completo. */
export function validatePractitionerPhone(control: AbstractControl): ValidationErrors | null {
  return Validators.required(control) ?? telefonoCompleto(control);
}

/** Un teléfono opcional: vacío vale, a medias no. */
export function validateOptionalPractitionerPhone(
  control: AbstractControl,
): ValidationErrors | null {
  return control.value === '' ? null : telefonoCompleto(control);
}

/** El correo personal —el de acceso— es obligatorio y tiene que tener forma de correo. */
export function validatePractitionerPersonalEmail(
  control: AbstractControl,
): ValidationErrors | null {
  return Validators.required(control) ?? Validators.email(control);
}

/**
 * Las páginas del alta de médico.
 *
 * Las opciones que dependen de catálogos y del título llegan por `context`,
 * así cada pantalla conserva su propia carga y su estado de error.
 */
export function practitionerFields(
  context: PractitionerFieldsContext,
): readonly PaginaDeFormulario[] {
  const titulo = context.professionalTitle;
  const esOdontologo = titulo === TITULO_ODONTOLOGO;
  const esMedico = TITULOS_MEDICOS.has(titulo);

  const rotuloMatricula = esOdontologo
    ? 'Matrícula de Odontólogo'
    : esMedico
      ? 'Matrícula Profesional (Médico)'
      : 'Matrícula profesional';

  const hintMatricula = esOdontologo
    ? 'La de su habilitación profesional como odontólogo.'
    : 'La que le habilita a ejercer, la del registro del Ministerio.';

  const placeholderMatricula = esOdontologo ? 'ODO-12345' : 'MP-12345';

  // El segundo número es el registro del SEDES, y no cambia con el título:
  // el Servicio Departamental de Salud habilita a ejercer en su departamento
  // sea odontólogo o médico. Antes acá se pedía «Registro del Colegio», pero
  // lo que el padrón real trae en esa casilla —y lo que la gente cargaba— es
  // el número del SEDES, que además es una habilitación y no un título.

  // El tercero es el registro en el colegio de ESA profesión: el Colegio Médico
  // para un médico, el de Odontólogos para un odontólogo. Sale del título
  // elegido dos pasos antes, así que no se vuelve a preguntar cuál es. Sólo es
  // obligatorio cuando el título tiene un colegio conocido.
  const colegio = titleCollege(titulo);
  const tieneColegio = colegio !== PROFESSION_COLLEGE;

  // Nombre y cédula van en UNA página, como en el alta de paciente (propietario,
  // 22/10/2026): son el mismo documento —el nombre se escribe «como figura» en
  // la cédula— y partirlos obligaba a dos pasos para lo que se contesta con el
  // carnet en la mano. Son cinco campos, uno más que el tope del motor, así que
  // esta página **no** pasa por `paginateFields` (que la partiría otra vez); el
  // resto sí, y el tope de cuatro sigue valiendo para todas las demás.
  const identityPage: PaginaDeFormulario = {
    titulo: 'Su nombre y su cédula',
    clave: 'name',
    icon: 'people',
    hint: 'Como figuran en su documento. Si no tiene algún apellido, déjelo vacío. La cédula se revisa antes de pasar al paso siguiente.',
    // Los tres nombres entran en UN campo proyectado —bajo la `key` de
    // `name`, para que el motor siga validando el obligatorio y sepa a qué
    // página volver al enviar— porque son tres casillas de texto y se leen
    // como una sola pregunta.
    campos: [
      {
        key: 'name',
        label: '',
        control: 'custom',
        // Obligatorio como en el alta, que lo exige en su `FormControl` y lo
        // marca en la plantilla («Primer nombre *»). Con rótulo vacío el motor
        // no dibuja asterisco acá; lo declara para quien lee la definición: el
        // editor del perfil marca y exige el nombre con este dato (CORR-08).
        required: true,
        mensajeDeError: 'Ingrese su nombre.',
      },
      {
        key: 'lastName',
        label: 'Apellido paterno',
        control: 'text',
        required: true,
        autocomplete: 'family-name',
        placeholder: 'Rojas',
        testId: 'registro-pro-apellido-paterno',
        ancho: 'mitad',
        mensajeDeError: 'Ingrese su apellido paterno.',
      },
      {
        key: 'motherLastName',
        label: 'Apellido materno',
        hint: 'Si no lleva, déjelo vacío.',
        control: 'text',
        autocomplete: 'family-name',
        placeholder: 'Paz',
        testId: 'registro-pro-apellido-materno',
        ancho: 'mitad',
      },
      {
        key: 'nationalId',
        label: 'Cédula de identidad',
        required: true,
        hint: 'Se guarda como su documento oficial.',
        description:
          'Sólo el número, sin el complemento: el departamento que la emitió va en la casilla de al lado. No es con lo que inicia sesión —eso es su correo—, pero es lo que ata su matrícula a una persona.',
        control: 'text',
        autocomplete: 'off',
        placeholder: '1234567',
        testId: 'registro-pro-documento',
        icono: 'patients',
        // Media línea, con su departamento de emisión al lado: la misma
        // pareja que en el alta de paciente, y por lo mismo — el número y
        // su expedición son un solo documento.
        ancho: 'mitad',
        mensajeDeError: INVALID_IDENTITY_DOCUMENT_MESSAGE,
      },
      context.departmentIssuerField('registro-pro-departamento-ci'),
    ],
  };

  // Las páginas se juntaron por pedido del propietario (26/10/2026): eran
  // quince y el alta se hacía eterna. Ahora son nueve, agrupadas por tema, y
  // el correo de acceso va en la MISMA página que la contraseña: son las dos
  // mitades del inicio de sesión. Ya no pasan por `paginateFields`, que las
  // volvería a partir de a cuatro.
  const remainingPages: readonly PaginaDeFormulario[] = [
    {
      titulo: 'Sus datos y su acceso',
      clave: 'access',
      icon: 'lock',
      hint: 'Todo obligatorio. Con su correo personal y esta contraseña va a iniciar sesión. Nada de esto se publica en su ficha.',
      campos: [
        {
          key: 'sexAtBirth',
          label: 'Sexo',
          hint: 'Es el que registra su documento de identidad.',
          control: 'select',
          required: true,
          options: OPCIONES_SEXO,
          placeholder: 'Elija una opción',
          testId: 'registration-practitioner-sex',
          icono: 'heart',
          mensajeDeError: 'Elija una opción.',
        },
        {
          key: 'birthDate',
          label: 'Fecha de nacimiento',
          control: 'date',
          required: true,
          maxDate: 'today',
          minDate: new Date(1900, 0, 1),
          mensajeDeError: 'Indique su fecha de nacimiento.',
        },
        {
          key: 'mobilePhone',
          label: 'Su celular personal',
          required: true,
          hint: 'Elija el país si su número no es de Bolivia.',
          description:
            'Es el número por el que le contactamos a usted. El que ve un paciente es el de su consultorio, que se pide más adelante.',
          control: 'tel',
          autocomplete: 'tel',
          testId: 'registro-pro-celular-personal',
          icono: 'phone',
          mensajeDeError: 'El número está incompleto para el país elegido.',
        },
        {
          key: 'personalEmail',
          label: 'Su correo personal — con éste entra',
          hint: 'Es su identidad de acceso, no sólo un dato de contacto.',
          description:
            'Use uno que siga teniendo si cambia de trabajo: es por donde se recupera la cuenta si pierde la clave.',
          control: 'email',
          required: true,
          // `username`: acá el correo SÍ es el identificador de acceso. Sin
          // esto el navegador guarda otra cosa como usuario.
          autocomplete: 'username',
          placeholder: 'ana.rojas@gmail.com',
          testId: 'registro-pro-correo-personal',
          icono: 'mail',
          mensajeDeError: 'Ingrese un correo válido.',
        },
        {
          key: 'password',
          label: 'Contraseña',
          hint: 'Al menos 8 caracteres.',
          description:
            'Se guarda cifrada: ni el equipo de AloVida puede verla, y nunca se la vamos a pedir por teléfono ni por correo.',
          control: 'password',
          required: true,
          autocomplete: 'new-password',
          placeholder: 'Su contraseña',
          testId: 'registro-pro-password',
          icono: 'lock',
          mensajeDeError: MESSAGE_SHORT_PASSWORD,
        },
      ],
    },
    {
      titulo: '¿Dónde vive?',
      clave: 'residence',
      icon: 'home',
      // Pedido del cliente del 26/10/2026: lo único que se marca es el punto, y
      // es obligatorio. Calle, zona, municipio y departamento salen de él (los
      // muestra el selector, en sólo lectura) y los vuelca a sus controles
      // `aplicarLocalidadDomicilio`: siguen en el formulario, pero ya no son
      // campos de la página.
      hint: 'Marque su casa en el mapa: con el punto sabemos la calle, la zona y la localidad.',
      campos: [
        {
          key: 'gpsDomicilio',
          label: 'Ubicación GPS',
          hint: 'Toque el mapa en la puerta de su casa, o use su ubicación actual, y confírmelo.',
          description: 'Lo demás —calle, zona, municipio y departamento— sale del punto.',
          control: 'custom',
          required: true,
          mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
        },
      ],
    },
    {
      titulo: 'Su trabajo',
      clave: 'workplace-location',
      icon: 'building',
      hint: 'Todo opcional: los datos del lugar donde trabaja, separados de su casa y de su consultorio propio.',
      campos: [
        {
          key: 'workMobilePhone',
          label: 'Celular del trabajo (opcional)',
          hint: 'Elija el país si su número no es de Bolivia.',
          control: 'tel',
          autocomplete: 'tel',
          testId: 'registro-pro-celular-trabajo',
          icono: 'phone',
          ancho: 'mitad',
          mensajeDeError: 'El número está incompleto para el país elegido.',
        },
        {
          key: 'workLandline',
          label: 'Fijo del trabajo (opcional)',
          hint: 'El de la línea del consultorio.',
          control: 'tel',
          autocomplete: 'tel',
          testId: 'registro-pro-fijo-trabajo',
          icono: 'phone',
          ancho: 'mitad',
          mensajeDeError: 'El número está incompleto para el país elegido.',
        },
        {
          key: 'email',
          label: 'Correo de trabajo (opcional)',
          hint: 'El institucional, si tiene. No es con el que entra.',
          description:
            'Es un dato de contacto del consultorio: lo ve quien necesita escribirle por trabajo.',
          control: 'email',
          // `email` y no `username`: el identificador de acceso es el correo
          // personal del paso anterior. Marcar los dos como `username` haría
          // que el navegador guardara el equivocado.
          autocomplete: 'email',
          placeholder: 'matricula@hospital.bo',
          testId: 'registro-pro-correo',
          icono: 'mail',
          mensajeDeError: 'Ingrese un correo válido.',
        },
        {
          key: 'gpsTrabajo',
          label: 'Ubicación GPS del trabajo (opcional)',
          hint: 'Confirme el punto para guardar la ubicación laboral.',
          // La dirección del trabajo sale del punto (26/10/2026).
          description: 'Se guarda como dirección laboral, separada de su domicilio.',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Su consultorio propio',
      clave: 'own-office',
      icon: 'pin',
      // **Opcional, y aun así el que más importa** (punto 12/13/22 del módulo
      // médico): es el único lugar donde atiende que no depende de que otro
      // acepte la vinculación, y desde donde publica su agenda el primer día.
      hint: 'Opcional. Es el lugar que no depende de que otro le acepte, y desde donde va a poder publicar su agenda.',
      campos: [
        {
          key: 'officeName',
          label: 'Cómo se llama (opcional)',
          hint: 'El nombre con el que sus pacientes lo van a ver.',
          description:
            'Si no le pone uno, no pasa nada: se puede completar después desde su perfil.',
          control: 'text',
          placeholder: 'Consultorio Dr. Suárez',
          testId: 'registration-practitioner-office-name',
          icono: 'building',
        },
        {
          key: 'officeContactPhone',
          label: 'Teléfono de este consultorio (opcional)',
          hint: 'Puede ser distinto del contacto general de su trabajo.',
          control: 'tel',
          autocomplete: 'tel',
          testId: 'registration-practitioner-office-phone',
          icono: 'phone',
          mensajeDeError: 'El número está incompleto para el país elegido.',
        },
        {
          key: 'gpsConsultorio',
          label: 'Ubicación GPS (opcional)',
          hint: 'Con el punto, un paciente llega sin preguntar.',
          description:
            'Marque el punto exacto del consultorio y confírmelo. Se confirma aparte del de su casa.',
          control: 'custom',
        },
      ],
    },
    // Dónde trabaja y con qué seguros (propietario, 28/10/2026). Una sola
    // página para las dos preguntas: son la misma —«con quién trabaja»— y el
    // alta ya se había juntado de quince páginas a nueve. Va después del
    // consultorio propio: primero lo que no depende de nadie, después lo que
    // otro tiene que confirmar.
    {
      titulo: 'Dónde trabaja y con qué seguros',
      clave: 'workplaces',
      icon: 'building',
      hint: 'Opcional. Cada institución y cada aseguradora que elija recibe un pedido y lo confirma: ése es su sello oficial.',
      campos: [
        {
          key: 'lugaresDeTrabajo',
          label: '',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Su título profesional y foto',
      clave: 'practice',
      icon: 'teach',
      // Va antes de la habilitación y las especialidades: decide el colegio y
      // la lista de especialidades que se ofrecen. País, universidad y ciudad
      // viajan dentro de cada título de `credentials`
      // (`issuingInstitutionText`, `issuingCityText`, `issuingCountryText`).
      hint: 'Lo que van a ver sus pacientes. Puede cambiarlo cuando quiera.',
      campos: [
        {
          key: 'profilePhotoBase64',
          label: '',
          control: 'custom',
        },
        {
          key: 'professionalTitle',
          label: 'Título profesional',
          required: true,
          mensajeDeError: 'Elija su título profesional en la lista.',
          hint: 'Al elegirlo, la lista de especialidades y el colegio se acomodan solos.',
          description:
            'Es como aparece en su ficha pública. Sale de una lista cerrada para que la misma profesión no figure escrita de cuatro maneras distintas.',
          // `custom` y no `select`: la pantalla proyecta acá una lupa. La
          // lista sigue siendo cerrada —son doce— pero se busca escribiendo.
          control: 'custom',
          icono: 'teach',
        },
        {
          // Universidad, país y ciudad en UN campo proyectado, como los
          // nombres: son tres casillas y la página ya llegó al tope de
          // cuatro con la foto, el título y su diploma. Van pegadas al
          // título y no en una página propia porque las cuatro contestan la
          // misma pregunta —qué estudiaste y dónde—, y partirlas obligaría a
          // volver atrás para recordar de qué título se está hablando.
          key: 'professionalTitleEducation',
          label: 'Dónde lo estudió',
          control: 'custom',
        },
        {
          key: 'professionalTitleFile',
          label: 'Diploma del título (opcional)',
          hint: 'Puede adjuntarlo ahora o cargarlo después desde su perfil.',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Su habilitación para ejercer',
      clave: 'credentials',
      icon: 'shield',
      // La autoridad emisora ya no se pregunta (propietario, 26/10/2026): el
      // colegio se completa solo con el título profesional
      // (`syncCollegeWithProfession`) y se puede corregir desde el perfil.
      hint: 'Sin matrícula, registro del SEDES y registro del colegio no podemos darle de alta. Las fechas y los respaldos son opcionales.',
      campos: [
        // Cada registro es UN renglón con su número, su fecha de inscripción y
        // su respaldo (propietario, 27/10/2026): una fecha y un archivo sueltos
        // no dicen de cuál de las tres habilitaciones son. El renglón lo
        // proyecta la pantalla bajo la `key` del número, así el motor sigue
        // validando el obligatorio y sabe a qué página volver.
        {
          key: 'licenseNumber',
          label: rotuloMatricula,
          hint: hintMatricula,
          description:
            'Es la que comprobamos antes de que aparezca en el directorio: es lo que le da certeza a quien le elige sin conocerle.',
          control: 'custom',
          required: true,
          placeholder: placeholderMatricula,
          testId: 'registro-pro-matricula',
          icono: 'shield',
          mensajeDeError: 'Ingrese su matrícula profesional.',
        },
        {
          key: 'sedesLicenseNumber',
          label: 'Registro del SEDES',
          hint: 'El de su habilitación departamental, como figura en su título del SEDES.',
          control: 'custom',
          required: true,
          placeholder: 'T.I. 538/14',
          testId: 'registro-pro-credencial',
          icono: 'briefcase',
          mensajeDeError: 'Ingrese su número de registro del SEDES.',
        },
        {
          key: 'collegeLicenseNumber',
          label: tieneColegio
            ? `Registro en el ${colegio}`
            : 'Registro en el colegio de su profesión',
          hint: tieneColegio
            ? `El colegio que corresponde a su título profesional. Si no es el suyo, cambie el título en el paso anterior.`
            : 'Su título no tiene un colegio conocido: complételo si está colegiado.',
          control: 'custom',
          required: tieneColegio,
          placeholder: esOdontologo ? 'COB-12345' : 'CMB-12345',
          testId: 'registro-pro-colegio',
          icono: 'building',
          mensajeDeError: 'Ingrese su número de registro en el colegio.',
        },
      ],
    },
    {
      titulo: 'Sus especialidades y otros títulos',
      clave: 'specialties',
      icon: 'directory',
      hint: 'Todo opcional. Hasta cuatro especialidades, y puede cargar más de un título de cada tipo.',
      campos: [
        {
          key: 'especialidadesExtra',
          label: '',
          control: 'custom',
          // Vacío a propósito: sin mensaje propio el motor escribe «Revise .»
          // cuando el control de respaldo (estudio sin número) está inválido.
          // Lo que falta lo dicen el error de la casilla y el aviso del paso.
          mensajeDeError: '',
        },
        {
          key: 'academicTitles',
          label: 'Títulos',
          control: 'custom',
        },
      ],
    },
    // La firma y el sello: **imágenes** escaneadas, no una firma electrónica.
    // Opcional y saltable; es el último paso y desde acá se crea la cuenta.
    {
      titulo: 'Su firma y su sello',
      clave: 'signature-seal',
      icon: 'shield',
      hint: 'Opcional. Salen al pie de sus recetas y documentos; puede cargarlos después desde su perfil.',
      campos: [
        {
          key: 'signatureImageBase64',
          label: '',
          control: 'custom',
        },
        {
          key: 'sealImageBase64',
          label: '',
          control: 'custom',
        },
      ],
    },
  ];

  return [identityPage, ...remainingPages];
}

/** La definición de un campo del alta, para reutilizar su rótulo y sus reglas. */
export function practitionerField(
  key: string,
  context: PractitionerFieldsContext,
): CampoDeFormulario | undefined {
  return practitionerFields(context)
    .flatMap((page) => page.campos)
    .find((field) => field.key === key);
}
