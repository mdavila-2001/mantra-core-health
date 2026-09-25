import { FileInput } from '../../../shared/components/molecules/file-input/file-input';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registro-ayuda/registro-ayuda';
import {
  MAX_ATTACHMENT_BYTES,
  SUPPORT_FILE_FORMATS,
} from '../registro-compartido/credenciales-del-medico';
import {
  MENSAJE_CONTRASENA_CORTA,
  validadoresDeContrasena,
} from '../registro-compartido/politica-de-contrasena';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../registro-compartido/ubicacion-picker/ubicacion-picker';

/* ============================================================================
    Alta del laboratorio de sangre — proceso 4.1 del registro del stakeholder.

    Lo que se pregunta acá, y en este orden, es la lista de dieciocho puntos de
    «MODULO LABORATORIO DE SANGRE · Registro en la App Datos Legales de la
    empresa», transcripta en `SALUD/📋 Registro de procesos por módulo.md`. No
    se agregó ninguna pregunta que la fuente no haga —salvo la contraseña, ver
    el JSDoc de la clase— ni se sacó ninguna que sí haga.

    Es la MAQUETA: nada sale a la red. Ver `submit()`.
    ========================================================================== */

/**
 * Los ocho tipos societarios del punto 4.1.1.1, tal como los enumera la fuente.
 *
 * **Se elige, no se escribe.** El proceso lo pide con todas las letras —«SOLO
 * SELECCIONAR AL REGISTRAR»— y dice para qué: poder contar cuántos proveedores
 * hay de cada tipo. Un campo libre haría imposible ese conteo el primer día que
 * alguien escriba «S.R.L.», «SRL» y «Srl.».
 *
 * **`SRL` y `LTDA` son, en Bolivia, la misma figura** (Sociedad de
 * Responsabilidad Limitada, que se abrevia «Ltda.»). Van las dos porque la
 * fuente las enumera por separado y acá la fuente manda; la contradicción se
 * anota para escalarla, no se resuelve en silencio fusionándolas — si la
 * plataforma decide que son una sola, esa decisión cambia el conteo que el
 * propio punto 4.1.1.1 pide, y no es de esta pantalla.
 */
export const TIPOS_DE_SOCIEDAD: readonly SelectOption<string>[] = [
  { value: 'UNIPERSONAL', label: 'Unipersonal' },
  { value: 'SRL', label: 'S.R.L.' },
  { value: 'LTDA', label: 'Ltda.' },
  { value: 'SA', label: 'S.A.' },
  { value: 'SOCIEDAD_COLECTIVA', label: 'Sociedad colectiva' },
  { value: 'COMANDITA_SIMPLE', label: 'Sociedad en comandita simple' },
  // Corregido a `COMANDITA_ACCIONES` (subtarea 1.1): es el código real del
  // diccionario compartido (`legal-entity-types.dictionary.ts`); esta pantalla
  // es una maqueta que no sale a la red, pero el código debe coincidir para
  // el día que se conecte.
  { value: 'COMANDITA_ACCIONES', label: 'Sociedad en comandita por acciones' },
  { value: 'SUCURSAL_EXTRANJERA', label: 'Sucursal de sociedad extranjera' },
];

/** Un papel adjunto: con qué nombre llegó y cuánto pesa. */
export interface AdjuntoDeclarado {
  readonly archivo: string;
  readonly pesoBytes: number;
}

/** Una sucursal declarada en el alta (punto 4.1.18). */
export interface SucursalDeclarada {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly gps: Coordenadas | null;
}

/**
 * Los seis papeles del proceso, por la clave del control que los guarda.
 *
 * Que vivan en el formulario es lo que hace que los tres obligatorios los haga
 * cumplir el motor —una página con un control inválido no avanza, y eso ya está
 * escrito y probado— en vez de una comprobación aparte que hay que acordarse de
 * llamar.
 */
export type ClaveDeAdjunto =
  | 'constitucionFile'
  | 'nitFile'
  | 'seprecFile'
  | 'licenciaFile'
  | 'sedesFile'
  | 'poderFile';

/** Formatos que se aceptan. El proceso pide PDF; se acepta la foto del papel. */
const FORMATOS_DE_RESPALDO = SUPPORT_FILE_FORMATS;

/** Cinco megas, el mismo tope que el alta de profesional: la misma constante. */
const MAX_BYTES_ADJUNTO = MAX_ATTACHMENT_BYTES;

const MAX_NOMBRE = 300;
const MAX_DIRECCION = 300;
const MAX_NIT = 100;

/** Dígitos, con o sin guiones: el NIT boliviano es numérico. */
const NIT_VALIDO = /^[0-9][0-9-]{3,19}$/;

/**
 * Por qué se pide cada cosa, por sección.
 *
 * Mismo mecanismo que el alta de profesional: la columna cambia con el paso,
 * porque «¿por qué me piden ESTO?» es una pregunta distinta en cada página.
 */
const AYUDA: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  empresa: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social tal como figura en tu matrícula de comercio. Los locales donde atendés se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'No es un capricho del formulario: la plataforma necesita poder contar cuántos proveedores tiene de cada tipo, y eso sólo funciona si todos eligen de la misma lista.',
    },
  ],
  documentos: [
    {
      icono: 'folder',
      titulo: 'Tres papeles frenan, tres no',
      texto:
        'Sin SEPREC, licencia de funcionamiento y certificado del SEDES no podemos publicar un laboratorio: son los que prueban que está registrado y habilitado para operar. Los otros tres los podés traer después.',
    },
    {
      icono: 'shield',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en tu ficha ni los ve un paciente.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que te hace aparecer',
      texto:
        'Cuando un paciente busca dónde hacerse un estudio, la app ordena por cercanía. Sin el punto en el mapa tu laboratorio queda fuera de esa lista, aunque la dirección esté escrita.',
    },
  ],
  sucursales: [
    {
      icono: 'hospital',
      titulo: 'Una fila por local',
      texto:
        'Cada sucursal se ubica sola en el mapa: un paciente del sur no tiene por qué cruzar la ciudad porque la central esté en el norte.',
    },
  ],
  representante: [
    {
      icono: 'mail',
      titulo: 'Con este correo se entra',
      texto:
        'El correo del representante legal es el usuario de la cuenta. Después se suman los usuarios que hagan falta, cada uno con el suyo.',
    },
  ],
  'gerencia-general': [
    {
      icono: 'briefcase',
      titulo: 'Los cargos son opcionales',
      texto:
        'Ninguno de los tres frena el alta. Se piden para saber a quién escribirle: el detalle semanal de comisiones y las campañas van a quien corresponda, y no todo al mismo correo.',
    },
  ],
  'gerencia-comercial': [
    {
      icono: 'chart',
      titulo: 'A quién le llega la liquidación',
      texto:
        'El resumen semanal de ventas y comisiones se manda a este correo cuando está cargado. Si lo dejás vacío, va al del representante legal.',
    },
  ],
  'gerencia-marketing': [
    {
      icono: 'megaphone',
      titulo: 'Campañas y promociones',
      texto:
        'Las campañas de estudios dirigidas se coordinan con esta persona. Se puede cargar más adelante desde el perfil.',
    },
  ],
  acceso: [
    {
      icono: 'lock',
      titulo: 'Una clave nueva, no la del correo',
      texto: 'Al menos ocho caracteres. Se puede cambiar después desde el perfil.',
    },
  ],
};

/**
 * **Registro del laboratorio de sangre** — los datos legales de la empresa
 * (proceso 4.1).
 *
 * ## Qué es y qué no es
 *
 * Es la maqueta visual del alta: **no hay endpoint detrás y no se llama a
 * ninguno**. La API tiene tres altas públicas —paciente, profesional y
 * aseguradora— y el laboratorio no es una de ellas todavía. Mandar esto a
 * `register-organization` daría de alta una aseguradora, que es otra cosa;
 * apuntar a una ruta inventada dejaría un 404 esperando al primero que lo
 * pruebe contra la API de verdad. Así que el envío se resuelve acá y la
 * pantalla lo dice: queda una solicitud.
 *
 * ## De dónde sale cada pregunta
 *
 * De los dieciocho puntos de 4.1, en su orden. La única que la fuente **no**
 * hace es la **contraseña**: sin ella no hay cuenta con la que volver a entrar,
 * y las otras tres altas de la plataforma la piden igual. El usuario es el
 * correo del representante legal, que sí está en la fuente (4.1.8.2), así que
 * no se inventó ninguna identidad nueva.
 *
 * Lo que la fuente **no** pide y por eso no está, anotado para que no pase por
 * olvido: 4.1 no menciona departamento ni municipio. El directorio los va a
 * necesitar para ordenar por cercanía, pero eso es una pregunta al propietario,
 * no algo que esta pantalla deba inventar.
 *
 * ## Qué es obligatorio, y por qué
 *
 * Frena el alta lo que sin ello no hay laboratorio publicable:
 *
 * - **Razón social, tipo de sociedad y NIT**: la identidad tributaria de quien
 *   va a facturar. El tipo, además, es el conteo que pide 4.1.1.1.
 * - **SEPREC, licencia de funcionamiento y certificado del SEDES**: los tres
 *   que prueban que la empresa está registrada y **habilitada para operar**. Un
 *   laboratorio de sangre sin certificado del SEDES no puede atender.
 * - **Dirección legal de la central**: sin dirección no hay a dónde ir.
 * - **Representante legal y su correo**: es quien firma, y el correo es el
 *   usuario de la cuenta.
 *
 * No frena, y cada uno por su motivo:
 *
 * - **Constitución de la empresa y poder del representante**: una
 *   **unipersonal** no tiene ninguno de los dos —no constituye sociedad y el
 *   titular se representa a sí mismo—. Exigirlos dejaría afuera a un tipo
 *   societario que la propia lista ofrece.
 * - **NIT en PDF**: el número ya se pide escrito; el papel es respaldo.
 * - **Punto en el mapa y sucursales**: el GPS depende de un permiso del
 *   navegador que se puede negar, y hay laboratorios de un solo local. Se
 *   explica lo que se pierde sin ellos en vez de frenar el alta.
 * - **Los tres cargos** (general, comercial y marketing): nueve campos de
 *   contacto que no cambian nada de lo que la plataforma puede hacer hoy.
 */
@Component({
  selector: 'app-register-laboratory',
  imports: [
    FileInput,
    NgTemplateOutlet,
    RouterLink,
    Link,
    AppButton,
    AppInput,
    NavIcon,
    Tooltip,
    FormField,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CampoPersonalizado,
    RegistroAyuda,
    UbicacionPicker,
  ],
  templateUrl: './register-laboratory.html',
  styleUrls: ['../registro-compartido/registro.css', './register-laboratory.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterLaboratory {
  private readonly router = inject(Router);

  protected readonly formatosDeRespaldo = FORMATOS_DE_RESPALDO;

  readonly form = new FormGroup({
    // --- 4.1.1 · la empresa ------------------------------------------------
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    companyType: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    // --- 4.1.2 · el NIT ----------------------------------------------------
    taxId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_NIT),
        Validators.pattern(NIT_VALIDO),
      ],
    }),
    // --- 4.1.1.2, 4.1.2.1, 4.1.3, 4.1.4, 4.1.5 · los papeles ---------------
    constitucionFile: new FormControl<AdjuntoDeclarado | null>(null),
    nitFile: new FormControl<AdjuntoDeclarado | null>(null),
    seprecFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    licenciaFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    sedesFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    // --- 4.1.6 · dirección legal de la central -----------------------------
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    // --- 4.1.8 · representante legal ---------------------------------------
    legalRepName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    legalRepEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    poderFile: new FormControl<AdjuntoDeclarado | null>(null),
    // --- 4.1.9 a 4.1.17 · los tres cargos, todos opcionales ----------------
    generalManagerName: new FormControl('', { nonNullable: true }),
    generalManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    generalManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    salesManagerName: new FormControl('', { nonNullable: true }),
    salesManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    salesManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    marketingManagerName: new FormControl('', { nonNullable: true }),
    marketingManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    marketingManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    // --- la cuenta ---------------------------------------------------------
    password: new FormControl('', {
      nonNullable: true,
      validators: [...validadoresDeContrasena],
    }),
  });

  /**
   * Las nueve secciones del alta, en el orden del proceso.
   *
   * Pasan por `paginarCampos` como todo lo que monta el motor. Ninguna supera
   * los cuatro campos, así que cada sección es una página y conserva su rótulo.
   */
  readonly paginas = paginarCampos([
    {
      titulo: 'La empresa',
      clave: 'empresa',
      icon: 'building' as const,
      hint: 'Los datos con los que figura en tu matrícula de comercio.',
      campos: [
        {
          key: 'legalName',
          label: 'Nombre o razón social',
          control: 'text' as const,
          required: true,
          icono: 'building' as const,
          placeholder: 'Laboratorio Clínico del Sur S.R.L.',
          testId: 'registro-lab-razon-social',
          mensajeDeError: 'Escribí el nombre o la razón social de la empresa.',
        },
        {
          key: 'companyType',
          label: 'Tipo de sociedad',
          hint: 'El que figura en tu matrícula de comercio.',
          control: 'select' as const,
          options: TIPOS_DE_SOCIEDAD,
          required: true,
          icono: 'labels' as const,
          placeholder: 'Elegí el tipo de sociedad',
          testId: 'registro-lab-tipo-sociedad',
          mensajeDeError: 'Elegí el tipo de sociedad.',
        },
        {
          key: 'taxId',
          label: 'Número de NIT',
          hint: 'Sólo números. Es el que va a salir en las facturas.',
          control: 'text' as const,
          required: true,
          icono: 'billing' as const,
          placeholder: '1023456789',
          testId: 'registro-lab-nit',
          mensajeDeError: 'Escribí el NIT: sólo números, al menos cuatro dígitos.',
        },
      ],
    },
    {
      titulo: 'Los papeles de la empresa',
      clave: 'documentos',
      icon: 'folder' as const,
      hint: 'PDF, JPG o PNG. Hasta 5 MB por archivo.',
      campos: [
        {
          key: 'seprecFile',
          ancho: 'mitad' as const,
          label: 'SEPREC',
          hint: 'La matrícula de comercio vigente.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Adjuntá el SEPREC: sin la matrícula no podemos publicar el laboratorio.',
        },
        {
          key: 'licenciaFile',
          ancho: 'mitad' as const,
          label: 'Licencia de funcionamiento',
          hint: 'La que emite tu municipio.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Adjuntá la licencia de funcionamiento.',
        },
        {
          key: 'sedesFile',
          ancho: 'mitad' as const,
          label: 'Certificado del SEDES',
          hint: 'El que habilita al laboratorio a operar.',
          control: 'custom' as const,
          required: true,
          mensajeDeError:
            'Adjuntá el certificado del SEDES: es lo que habilita a un laboratorio a atender.',
        },
        {
          key: 'nitFile',
          ancho: 'mitad' as const,
          label: 'NIT en PDF (opcional)',
          hint: 'El respaldo del número que escribiste antes.',
          control: 'custom' as const,
        },
      ],
    },
    {
      titulo: 'Constitución y poder',
      clave: 'documentos',
      icon: 'folder' as const,
      hint: 'Los dos son opcionales: una empresa unipersonal no tiene ninguno de los dos.',
      campos: [
        {
          key: 'constitucionFile',
          ancho: 'mitad' as const,
          label: 'Constitución de la empresa (opcional)',
          hint: 'La escritura con la que se constituyó la sociedad.',
          control: 'custom' as const,
        },
        {
          key: 'poderFile',
          ancho: 'mitad' as const,
          label: 'Poder del representante legal (opcional)',
          hint: 'No hace falta si el titular se representa a sí mismo.',
          control: 'custom' as const,
        },
      ],
    },
    {
      titulo: 'Dónde está la central',
      clave: 'ubicacion',
      icon: 'pin' as const,
      campos: [
        {
          key: 'addressLines',
          label: 'Dirección legal de la central',
          hint: 'Calle, número y zona. Es la que figura en tus papeles.',
          control: 'text' as const,
          required: true,
          icono: 'pin' as const,
          placeholder: 'Av. Cañoto esq. Ballivián 234, Zona Central',
          testId: 'registro-lab-direccion',
          mensajeDeError: 'Escribí la dirección legal de la central.',
        },
        {
          key: 'gpsCentral',
          label: 'Ubicación en el mapa (opcional)',
          hint: 'Sin el punto, tu laboratorio no aparece cuando alguien busca el más cercano.',
          control: 'custom' as const,
        },
      ],
    },
    {
      titulo: 'Tus sucursales',
      clave: 'sucursales',
      icon: 'hospital' as const,
      hint: 'Si sólo atendés en la central, seguí de largo.',
      campos: [
        {
          key: 'sucursales',
          label: 'Sucursales (opcional)',
          control: 'custom' as const,
        },
      ],
    },
    {
      titulo: 'Representante legal',
      clave: 'representante',
      icon: 'shield' as const,
      campos: [
        {
          key: 'legalRepName',
          label: 'Nombre del representante legal',
          control: 'text' as const,
          required: true,
          icono: 'people' as const,
          autocomplete: 'name',
          testId: 'registro-lab-representante',
          mensajeDeError: 'Escribí el nombre del representante legal.',
        },
        {
          key: 'legalRepEmail',
          label: 'Correo del representante legal',
          hint: 'Con este correo vas a entrar a la plataforma.',
          control: 'email' as const,
          required: true,
          icono: 'mail' as const,
          autocomplete: 'username',
          testId: 'registro-lab-representante-correo',
          mensajeDeError: 'Escribí un correo válido: es el usuario de la cuenta.',
        },
      ],
    },
    {
      titulo: 'Gerencia general',
      clave: 'gerencia-general',
      icon: 'briefcase' as const,
      hint: 'Todo este paso es opcional: podés completarlo después.',
      campos: [
        {
          key: 'generalManagerName',
          label: 'Nombre del gerente general',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-lab-gerente-general',
        },
        {
          key: 'generalManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-lab-gerente-general-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'generalManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-lab-gerente-general-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
        },
      ],
    },
    {
      titulo: 'Gerencia comercial',
      clave: 'gerencia-comercial',
      icon: 'chart' as const,
      hint: 'Opcional. Es a quien le llega el detalle semanal de ventas y comisiones.',
      campos: [
        {
          key: 'salesManagerName',
          label: 'Nombre del gerente comercial',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-lab-gerente-comercial',
        },
        {
          key: 'salesManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-lab-gerente-comercial-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'salesManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-lab-gerente-comercial-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
        },
      ],
    },
    {
      titulo: 'Gerencia de marketing',
      clave: 'gerencia-marketing',
      icon: 'megaphone' as const,
      hint: 'Opcional. Es con quien se coordinan las campañas.',
      campos: [
        {
          key: 'marketingManagerName',
          label: 'Nombre del gerente de marketing',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-lab-gerente-marketing',
        },
        {
          key: 'marketingManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-lab-gerente-marketing-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'marketingManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-lab-gerente-marketing-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
        },
      ],
    },
    {
      titulo: 'Tu acceso',
      clave: 'acceso',
      icon: 'lock' as const,
      hint: 'Entrás con el correo del representante legal y esta contraseña.',
      campos: [
        {
          key: 'password',
          label: 'Contraseña',
          hint: 'Al menos 8 caracteres.',
          control: 'password' as const,
          required: true,
          icono: 'lock' as const,
          autocomplete: 'new-password',
          testId: 'registro-lab-password',
          mensajeDeError: MENSAJE_CONTRASENA_CORTA,
        },
      ],
    },
  ]);

  readonly attachmentFiles = signal<Partial<Record<ClaveDeAdjunto, readonly File[]>>>({});
  protected readonly maxAttachmentBytes = MAX_BYTES_ADJUNTO;

  attachmentLabel(key: ClaveDeAdjunto): string {
    return this.paginas.flatMap(page => page.campos).find(field => field.key === key)?.label ?? 'Documento';
  }

  isAttachmentRequired(key: ClaveDeAdjunto): boolean {
    return this.form.controls[key].hasValidator(Validators.required);
  }

  isAttachmentInvalid(key: ClaveDeAdjunto): boolean {
    const control = this.form.controls[key];
    return control.touched && control.invalid;
  }

  filesForAttachment(key: ClaveDeAdjunto): readonly File[] {
    return this.attachmentFiles()[key] ?? [];
  }

  updateAttachment(key: ClaveDeAdjunto, files: readonly File[]): void {
    this.attachmentFiles.update(current => ({ ...current, [key]: files }));
    const file = files[0];
    const control = this.form.controls[key];
    control.setValue(file ? { archivo: file.name, pesoBytes: file.size } : null);
    control.markAsTouched();
    this.errorAdjunto.set(null);
  }

  /* --- adjuntos ---------------------------------------------------------- */

  /** El motivo del último archivo rechazado, si hubo. */
  readonly errorAdjunto = signal<string | null>(null);

  /** El adjunto guardado en un control, para que la plantilla lo muestre. */
  adjuntoDe(clave: ClaveDeAdjunto): AdjuntoDeclarado | null {
    return this.form.controls[clave].value;
  }

  /* --- la ubicación de la central ---------------------------------------- */

  /**
   * El punto de la central, ya confirmado sobre el mapa.
   *
   * Fuera del formulario, como en el alta de profesional: `app-ubicacion-picker`
   * emite **sólo lo confirmado** y se guarda para sí el estado intermedio.
   */
  readonly gpsCentral = signal<Coordenadas | null>(null);

  protected readonly idsUbicacionCentral: IdsDePrueba = {
    mapa: 'registro-lab-central-map',
    confirmada: 'registro-lab-central-location-confirmed',
    avisoGeocodificacion: 'registro-lab-central-geocoding-notice',
    quitar: 'registro-lab-central-location-remove',
    confirmar: 'registro-lab-central-location-confirm',
    usarUbicacion: 'registro-lab-central-location-use',
    marcarEnMapa: 'registro-lab-central-location-pick',
  };

  /* --- sucursales -------------------------------------------------------- */

  /**
   * Las sucursales que se fueron agregando (4.1.18).
   *
   * Una lista que crece, y no un puñado de casillas fijas, por lo mismo que los
   * nombres del alta de profesional: un techo arbitrario deja afuera a quien
   * tiene más, y las casillas de más son ruido para quien tiene una sola.
   */
  readonly sucursales = signal<readonly SucursalDeclarada[]>([]);

  /** Contador propio: `crypto.randomUUID` no está en todos los entornos de render. */
  private proximaSucursal = 1;

  agregarSucursal(): void {
    const id = `sucursal-${this.proximaSucursal}`;
    this.proximaSucursal += 1;
    this.sucursales.update((lista) => [...lista, { id, nombre: '', direccion: '', gps: null }]);
  }

  quitarSucursal(id: string): void {
    this.sucursales.update((lista) => lista.filter((sucursal) => sucursal.id !== id));
  }

  /**
   * Escribe el nombre de una sucursal desde el campo proyectado.
   *
   * `app-input` emite `string | number | null` —es el tipo de su `value`, no
   * una laxitud de esta pantalla—, así que se normaliza acá igual que en el
   * alta de profesional: el `null` de un campo vaciado es la cadena vacía, no
   * un agujero en la lista.
   */
  escribirNombreDeSucursal(id: string, nombre: string | number | null): void {
    this.actualizarSucursal(id, { nombre: nombre === null ? '' : String(nombre) });
  }

  escribirDireccionDeSucursal(id: string, direccion: string | number | null): void {
    this.actualizarSucursal(id, { direccion: direccion === null ? '' : String(direccion) });
  }

  fijarGpsDeSucursal(id: string, gps: Coordenadas | null): void {
    this.actualizarSucursal(id, { gps });
  }

  private actualizarSucursal(id: string, cambio: Partial<SucursalDeclarada>): void {
    this.sucursales.update((lista) =>
      lista.map((sucursal) => (sucursal.id === id ? { ...sucursal, ...cambio } : sucursal)),
    );
  }

  /** Los identificadores de prueba del mapa de una sucursal. */
  idsDeSucursal(id: string): IdsDePrueba {
    return {
      mapa: `registro-lab-${id}-map`,
      confirmada: `registro-lab-${id}-location-confirmed`,
      avisoGeocodificacion: `registro-lab-${id}-geocoding-notice`,
      quitar: `registro-lab-${id}-location-remove`,
      confirmar: `registro-lab-${id}-location-confirm`,
      usarUbicacion: `registro-lab-${id}-location-use`,
      marcarEnMapa: `registro-lab-${id}-location-pick`,
    };
  }

  /* --- la columna de ayuda ----------------------------------------------- */

  private readonly claveVisible = signal('empresa');

  readonly ayudaVisible = computed<readonly TarjetaDeAyuda[]>(
    () => AYUDA[this.claveVisible()] ?? [],
  );

  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
  }

  /* --- envío ------------------------------------------------------------- */

  /** Si la solicitud ya se dio por enviada. */
  readonly enviada = signal(false);

  /**
   * Cierra el alta **sin salir a la red**.
   *
   * No es un atajo de la maqueta que después haya que acordarse de cambiar: hoy
   * **no existe** un endpoint de alta de laboratorio, y las alternativas eran
   * peores. Cuando el backend tenga el alta, lo que cambia es este método — el
   * formulario, sus reglas y sus papeles ya están.
   */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviada.set(true);
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
