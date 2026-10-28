import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { executivesPages } from '../shared-registration/executives';
import { MESSAGE_SHORT_PASSWORD, MIN_CHARACTERS_PASSWORD } from '../shared-registration/password-policy';
import { MAX_LEGAL_NAME } from './medical-center-form';

/** Prefijo de los `data-testid` de toda la pantalla (los de antes de la ampliación lo conservan). */
export const TEST_ID = 'medical-center-signup';

/** Lo que las páginas necesitan saber del momento: catálogos y papeles según el tipo societario. */
export interface PaginasDeAlta {
  readonly tiposDeOrganizacion: readonly SelectOption<string>[];
  readonly tiposSocietarios: readonly SelectOption<string>[];
  /** Los cinco papeles de la empresa, con los que el tipo societario omite marcados «(opcional)». */
  readonly camposDeDocumentos: readonly CampoDeFormulario[];
  /** El poder del representante, opcional sólo para una unipersonal. */
  readonly campoDePoder: CampoDeFormulario;
}

/**
 * Las páginas del alta de una organización médica, en el orden en que se
 * contestan: la empresa → el establecimiento → su director médico → los papeles
 * → la casa central → las sucursales → el representante y su poder → las tres
 * gerencias → la clave.
 *
 * Es la misma ruta del alta del centro de imagenología, sin los estudios por
 * modalidad y con dos páginas propias de un establecimiento de salud: el número
 * de registro ante la autoridad sanitaria y el director médico.
 */
export function medicalCenterPages(ctx: PaginasDeAlta): readonly PaginaDeFormulario[] {
  return paginateFields([
    {
      titulo: 'La organización',
      clave: 'organizacion',
      icon: 'building' as const,
      hint: 'Qué tipo de institución es, cómo se llama y con qué NIT factura.',
      disposicion: 'dos-columnas' as const,
      campos: [
        {
          key: 'tenantType',
          label: 'Tipo de institución',
          control: 'select' as const,
          options: ctx.tiposDeOrganizacion,
          required: true,
          testId: `${TEST_ID}-tenant-type`,
          mensajeDeError: 'Elija el tipo de institución.',
        },
        {
          key: 'legalName',
          label: 'Razón social',
          control: 'text' as const,
          required: true,
          hint: `Hasta ${MAX_LEGAL_NAME} caracteres.`,
          testId: `${TEST_ID}-legal-name`,
          // Sólo el vacío lleva mensaje propio: el tope de 300 lo dice el
          // motor con su número, que es lo que la persona necesita leer.
          mensajeSiFalta: 'Escriba la razón social de la organización.',
        },
        {
          key: 'legalEntityType',
          label: 'Tipo societario',
          hint: 'La figura jurídica con la que está constituida la organización.',
          control: 'select' as const,
          options: ctx.tiposSocietarios,
          required: true,
          testId: `${TEST_ID}-legal-entity-type`,
          valorEnDosRenglones: true,
          mensajeDeError: 'Elija el tipo societario.',
        },
        {
          key: 'taxId',
          label: 'Número de NIT',
          hint: 'Sólo números, con o sin guiones. Es el que sale en las facturas.',
          control: 'text' as const,
          required: true,
          icono: 'billing' as const,
          placeholder: '1023456789',
          testId: `${TEST_ID}-tax-id`,
          mensajeDeError: 'Escriba el NIT: sólo números, de 4 a 20 caracteres.',
        },
      ],
    },
    {
      titulo: 'Datos del establecimiento',
      clave: 'establecimiento',
      icon: 'hospital' as const,
      hint: 'El número con el que la autoridad sanitaria lo tiene registrado.',
      campos: [
        {
          key: 'healthFacilityRegistrationNumber',
          label: 'Número de registro ante el SEDES',
          hint: 'Figura en el certificado de habilitación del establecimiento. Letras, números, punto, barra o guion.',
          control: 'text' as const,
          required: true,
          icono: 'shield' as const,
          placeholder: 'SEDES-SC-2020-0412',
          testId: `${TEST_ID}-health-registration`,
          mensajeDeError:
            'Escriba el número de registro del SEDES: de 3 a 50 caracteres, con letras, números, punto, barra o guion.',
        },
      ],
    },
    {
      titulo: 'Director médico',
      clave: 'director',
      icon: 'people' as const,
      hint: 'El responsable técnico del establecimiento. No es una cuenta de la plataforma: es la persona que responde clínicamente por la institución.',
      campos: [
        {
          // Sin rótulo ni error propios: `app-inline-name-fields` pinta cada casilla
          // con el suyo, y un `<label for>` externo apuntaría a un control que no existe.
          key: 'medicalDirectorName',
          label: '',
          control: 'custom' as const,
          mensajeDeError: '',
        },
        {
          key: 'medicalDirectorLicense',
          label: 'Matrícula profesional',
          hint: 'La que figura en su registro profesional (3 a 50 caracteres).',
          control: 'text' as const,
          required: true,
          icono: 'labels' as const,
          placeholder: 'MAT-12345',
          testId: `${TEST_ID}-director-license`,
          mensajeDeError: 'Escriba la matrícula profesional del director: de 3 a 50 caracteres.',
        },
        {
          key: 'medicalDirectorEmail',
          label: 'Correo del director médico',
          control: 'email' as const,
          required: true,
          icono: 'mail' as const,
          testId: `${TEST_ID}-director-email`,
          mensajeDeError: 'Escriba un correo válido para el director médico.',
        },
        {
          key: 'medicalDirectorPhone',
          label: 'Teléfono del director médico',
          hint: 'Opcional.',
          control: 'tel' as const,
          testId: `${TEST_ID}-director-phone`,
          mensajeDeError: 'El número está incompleto.',
        },
      ],
    },
    {
      titulo: 'Documentación legal obligatoria (PDF)',
      clave: 'documentos-legales',
      icon: 'folder' as const,
      hint: 'Solo PDF, hasta 10 MB por archivo. Se suben al instante y quedan pendientes de verificación.',
      // Los cinco papeles se leen como un solo bloque y se ven de una vez
      // (pedido del cliente del 28/10/2026): nadie los contesta campo por campo.
      sinPartir: true,
      campos: ctx.camposDeDocumentos,
    },
    {
      titulo: 'Dónde está la casa central',
      clave: 'ubicacion',
      icon: 'pin' as const,
      // Sólo el punto: la calle, el municipio y la zona salen de él y el
      // selector los muestra sin dejarlos editar.
      campos: [
        {
          key: 'gpsCentral',
          label: 'Ubicación de la casa central en el mapa',
          hint: 'Marque el punto exacto de la casa central. De ahí sacamos la calle, el municipio y la zona.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
        },
      ],
    },
    {
      titulo: 'Sus sucursales',
      clave: 'sucursales',
      icon: 'hospital' as const,
      hint: 'Opcional. Cada sucursal lleva su nombre y su punto en el mapa, hasta 50.',
      campos: [
        {
          key: 'sucursales',
          label: 'Sucursales (opcional)',
          control: 'custom' as const,
          mensajeDeError: 'Complete el nombre y el punto de cada sucursal, o quite las que no use.',
        },
      ],
    },
    {
      titulo: 'Representante legal',
      clave: 'representante',
      icon: 'shield' as const,
      hint: 'Quien firma por la organización. Es también quien administra la cuenta.',
      campos: [
        {
          key: 'legalRepName',
          label: '',
          control: 'custom' as const,
          mensajeDeError: '',
        },
        {
          key: 'legalRepIdNumber',
          label: 'Documento de identidad del representante',
          hint: 'Cédula de identidad o documento equivalente.',
          control: 'text' as const,
          required: true,
          icono: 'people' as const,
          testId: `${TEST_ID}-legal-rep-id`,
          mensajeDeError: 'Escriba el documento del representante (al menos cuatro caracteres).',
        },
        {
          key: 'legalRepEmail',
          label: 'Correo del representante legal',
          hint: 'Con este correo va a entrar a la plataforma.',
          control: 'email' as const,
          required: true,
          icono: 'mail' as const,
          autocomplete: 'username',
          testId: `${TEST_ID}-legal-rep-email`,
          mensajeDeError: 'Escriba un correo válido: es el usuario de la cuenta.',
        },
        {
          key: 'legalRepPhone',
          label: 'Teléfono del representante',
          hint: 'Opcional.',
          control: 'tel' as const,
          testId: `${TEST_ID}-legal-rep-phone`,
          mensajeDeError: 'El número está incompleto.',
        },
      ],
    },
    {
      // El poder va con quien lo firma, en su propio paso: el motor sirve
      // cuatro campos por página y el representante ya los usa.
      titulo: 'Poder del representante legal',
      clave: 'poder',
      icon: 'folder' as const,
      hint: 'Solo PDF. Una empresa unipersonal no lo necesita: el titular se representa a sí mismo.',
      campos: [ctx.campoDePoder],
    },
    ...executivesPages(TEST_ID),
    {
      titulo: 'Su acceso',
      clave: 'acceso',
      icon: 'lock' as const,
      hint: 'Entra con el correo del representante legal y esta contraseña.',
      campos: [
        {
          key: 'password',
          label: 'Contraseña',
          control: 'password' as const,
          required: true,
          icono: 'lock' as const,
          autocomplete: 'new-password',
          hint: `Mínimo ${MIN_CHARACTERS_PASSWORD} caracteres.`,
          testId: `${TEST_ID}-password`,
          mensajeDeError: MESSAGE_SHORT_PASSWORD,
        },
      ],
    },
  ]);
}
