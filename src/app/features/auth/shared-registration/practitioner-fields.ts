import { Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';

import type { BirthSexCode } from '../../../core/data-access/iam/iam.types';
import { optionsRegulatoryAuthority } from '../../../core/profession/regulatory-authorities';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
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

  const remainingPages = paginateFields([
    {
      titulo: 'Cuéntenos un poco sobre usted',
      clave: 'profile',
      icon: 'stethoscope',
      hint: 'Los dos hacen falta. Se guardan en su perfil profesional.',
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
      ],
    },
    {
      titulo: 'Cómo le contactamos en privado',
      clave: 'personal-contact',
      icon: 'phone',
      hint: 'Los dos hacen falta, y con el correo entra. Nada de esto se publica en su ficha.',
      campos: [
        {
          key: 'mobilePhone',
          label: 'Su celular personal',
          required: true,
          hint: 'Elija el país si su número no es de Bolivia.',
          description:
            'Es el número por el que le contactamos a usted. El que ve un paciente es el de su consultorio, que se pide en la página siguiente.',
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
      ],
    },
    {
      titulo: 'El contacto de su trabajo',
      clave: 'access',
      icon: 'phone',
      hint: 'Los datos del consultorio. Todo opcional: su acceso ya quedó definido.',
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
      ],
    },
    {
      titulo: '¿Dónde vive?',
      clave: 'residence',
      icon: 'home',
      // La **zona** sigue sin preguntarse, y eso no cambió: `common.addresses`
      // no tiene columna de zona para ninguno de los dos registros.
      hint: 'Marque su lugar en el mapa y la dirección se completa sola.',
      campos: [
        {
          key: 'municipio',
          label: '',
          control: 'custom',
        },
      ],
    },
    {
      titulo: '¿Dónde trabaja?',
      clave: 'workplace-location',
      icon: 'building',
      hint: 'La dirección de su trabajo queda separada de su casa y de su consultorio propio.',
      campos: [
        {
          key: 'workAddressLines',
          label: 'Dirección del trabajo (opcional)',
          hint: 'Calle, número y referencia del lugar donde trabaja.',
          description: 'Se guarda como dirección laboral, separada de su domicilio.',
          control: 'text',
          autocomplete: 'street-address',
          placeholder: 'Av. Principal 200, Hospital Central',
          testId: 'registration-practitioner-work-address',
          icono: 'route',
        },
        {
          key: 'gpsTrabajo',
          label: 'Ubicación GPS del trabajo (opcional)',
          hint: 'Confirme el punto para guardar la ubicación laboral.',
          description: 'Marque el lugar donde trabaja y confírmelo en el mapa.',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Su consultorio propio',
      clave: 'own-office-contact',
      icon: 'building',
      // **Opcional, y aun así el que más importa** (punto 12/13/22 del módulo
      // médico del registro de procesos). Quien ejerce puede atender en
      // varios lugares, pero los demás son de otro: para figurar en una
      // clínica hace falta que esa clínica acepte la vinculación, y hasta que
      // eso pase su agenda no tiene dónde publicarse. El consultorio propio
      // es el único lugar que no depende de que nadie confirme nada.
      //
      // Por eso se pregunta acá y no sólo en el perfil: quien se registra
      // para empezar a atender lo necesita el primer día.
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
      ],
    },
    {
      titulo: 'Dónde queda su consultorio',
      clave: 'own-office',
      icon: 'pin',
      hint: 'Opcional. Puede completar la dirección ahora o más adelante desde su perfil.',
      campos: [
        {
          key: 'municipioConsultorio',
          label: '',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Su título profesional y foto',
      clave: 'practice',
      icon: 'teach',
      // Página propia y no pegada a las especialidades: es la que DECIDE qué
      // especialidades se ofrecen, y verlas cambiar en la misma pantalla en
      // la que se elige el título hace pensar que algo se perdió.
      //
      // La universidad y el lugar de estudio SÍ se preguntan acá desde el
      // 09/09: el propietario los pidió en el alta, no en el perfil. Desde el
      // 02/10 país y universidad son desplegables en árbol (ver
      // `CampoDeEstudio`). Viajan dentro de cada título de `credentials`
      // (`issuingInstitutionText`, `issuingCityText`, `issuingCountryText`),
      // no como campos del perfil.
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
      hint: 'Sin matrícula y número de colegio no podemos darle de alta.',
      campos: [
        {
          key: 'licenseNumber',
          label: rotuloMatricula,
          hint: hintMatricula,
          description:
            'Es la que comprobamos antes de que aparezca en el directorio: es lo que le da certeza a quien le elige sin conocerle.',
          control: 'text',
          required: true,
          autocomplete: 'off',
          placeholder: placeholderMatricula,
          testId: 'registro-pro-matricula',
          icono: 'shield',
          // Los dos números de la habilitación, en el mismo renglón: se
          // copian de la misma credencial y se contestan de una sentada.
          ancho: 'mitad',
          mensajeDeError: 'Ingrese su matrícula profesional.',
        },
        {
          key: 'sedesLicenseNumber',
          label: 'Registro del SEDES',
          hint: 'El de su habilitación departamental, como figura en su título del SEDES.',
          control: 'text',
          required: true,
          autocomplete: 'off',
          placeholder: 'T.I. 538/14',
          testId: 'registro-pro-credencial',
          icono: 'briefcase',
          ancho: 'mitad',
          mensajeDeError: 'Ingrese su número de registro del SEDES.',
        },
        {
          key: 'regulatoryAuthority',
          label: 'Autoridad que la emitió (opcional)',
          hint: 'El Ministerio de Salud, el SEDES de su gobernación o el colegio de su profesión.',
          control: 'select',
          options: optionsRegulatoryAuthority(titulo),
          placeholder: 'Sin especificar',
          testId: 'registro-pro-autoridad',
          icono: 'building',
        },
        {
          key: 'licenseIssueDate',
          label: 'Fecha de inscripción (opcional)',
          hint: 'Cuándo se registró, no cuándo vence.',
          control: 'date',
        },
      ],
    },
    // Página propia y no dos campos más en la anterior: `MAX_CAMPOS_POR_PAGINA`
    // ya está lleno ahí (cuatro), y un adjunto ocupa mucho más alto que un
    // input. Va inmediatamente después para que cada archivo se vea al lado
    // del número que respalda.
    {
      titulo: 'Los respaldos de su habilitación',
      clave: 'credential-files',
      icon: 'folder',
      hint: 'Opcional al registrarse. Un administrativo los verifica después.',
      campos: [
        {
          key: 'credentialAttachments',
          label: 'Respaldos',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Sus títulos',
      clave: 'academic-titles',
      icon: 'teach',
      hint: 'Todos opcionales, y puede cargar más de uno de cada tipo.',
      campos: [
        {
          key: 'academicTitles',
          label: 'Títulos',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Sus especialidades',
      clave: 'specialties',
      icon: 'directory',
      hint: 'Hasta cuatro. La lista completa está disponible para cualquier profesión.',
      campos: [
        // Sin control propio: es una ranura que la plantilla llena con las
        // casillas agregadas y su botón. Mismo mecanismo que `municipio`.
        {
          key: 'especialidadesExtra',
          label: '',
          control: 'custom',
          // Vacío a propósito: sin mensaje propio el motor escribe «Revise .»
          // cuando el control de respaldo (estudio sin número) está inválido.
          // Lo que falta lo dicen el error de la casilla y el aviso del paso.
          mensajeDeError: '',
        },
      ],
    },
    // La firma y el sello: **imágenes** escaneadas, no una firma electrónica.
    // Opcional y saltable, como la foto: se cargan después desde el perfil.
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
    // La contraseña cierra el alta, sola. Estaba en el paso del correo de
    // trabajo, mezclada con los teléfonos del consultorio: el mismo paso
    // pedía datos de contacto —que son del trabajo y opcionales— y la clave
    // de la cuenta, que no es ninguna de las dos cosas. Separarla también
    // deja el gesto de «elegir contraseña» pegado al de terminar.
    {
      titulo: 'Su contraseña',
      clave: 'password',
      icon: 'lock',
      hint: 'Lo último. Con ella y su correo personal va a iniciar sesión.',
      campos: [
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
  ]);

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
