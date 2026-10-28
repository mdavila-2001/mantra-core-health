import { FormControl, FormGroup, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';

import type { OrganizationExecutives } from '../../../core/data-access/iam/iam.types';
import { CORREO_CON_DOMINIO } from '../../../core/data-access/iam/strict-email';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import type { SeccionDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { completeName, nameGroup, type NameGroup, type NameValue } from './name-fields/person-name';

/* ============================================================================
    Las tres gerencias del alta de una organización (general, comercial y
    marketing): nombre en partes, celular y correo, todo opcional.

    Es el mismo bloque que declaran, cada una por su cuenta, las altas de
    laboratorio, imagenología y farmacia; acá está una vez para las que lo
    sumen de ahora en adelante (organización médica). Las tres existentes no se
    tocaron: sus specs llaman a sus propios métodos.

    La API recibe las gerencias como un bloque **todo o nada** (`executives`
    exige las tres, cada una con nombre, celular y correo): con menos, lo
    rechaza entero. Por eso `executivesFrom` devuelve `null` salvo que estén las
    tres completas, y el formulario las deja opcionales.
    ========================================================================== */

/** El nombre completo de una gerencia: la API lo acepta de 3 a 200 caracteres (`RegisterOrganizationExecutiveContactDto.fullName`). */
const MIN_FULL_NAME = 3;

/**
 * Los controles de las tres gerencias, listos para sumar a un `FormGroup`.
 *
 * ## Todo o nada, dicho donde se contesta
 *
 * Las tres son opcionales **juntas**: en cuanto hay algo escrito en cualquiera
 * de ellas, a las otras les falta lo que no tienen (el nombre, el celular y el
 * correo de cada una). Eso no lo puede decir un solo control, así que cada
 * celular, correo, primer nombre y apellido paterno vacío es `required` mientras haya algo escrito
 * en el bloque, y se revalida cuando cambia cualquier otro. Con esto el motor
 * del formulario frena en la página de la gerencia que falta —con su mensaje
 * junto al campo— en vez de dejar a la persona llegar al final para enterarse.
 * Vacías las tres, el bloque entero es válido y no viaja.
 */
export function executivesControls() {
  const faltaSiHayGerencias = (control: AbstractControl): ValidationErrors | null => {
    if (String(control.value ?? '').trim() !== '') return null;
    return bloqueConAlgo(control) ? { required: true } : null;
  };
  const celular = () =>
    new FormControl('', { nonNullable: true, validators: [telefonoCompleto, faltaSiHayGerencias] });
  const correo = () =>
    new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.pattern(CORREO_CON_DOMINIO), faltaSiHayGerencias],
    });
  const nombre = () => {
    const grupo = nameGroup(false);
    // En uso el bloque, a cada gerencia le hacen falta el primer nombre y el
    // apellido paterno (la API exige un nombre completo de 3 a 200 caracteres).
    grupo.controls.name.addValidators(faltaSiHayGerencias);
    grupo.controls.lastName.addValidators(faltaSiHayGerencias);
    grupo.addValidators((g) => {
      const completo = completeName(g.getRawValue() as NameValue);
      return completo !== '' && completo.length < MIN_FULL_NAME
        ? { nombreCompletoCorto: { min: MIN_FULL_NAME, actual: completo.length } }
        : null;
    });
    return grupo;
  };
  const controles = {
    generalManagerName: nombre(),
    generalManagerPhone: celular(),
    generalManagerEmail: correo(),
    salesManagerName: nombre(),
    salesManagerPhone: celular(),
    salesManagerEmail: correo(),
    marketingManagerName: nombre(),
    marketingManagerPhone: celular(),
    marketingManagerEmail: correo(),
  };

  // Cambiar cualquiera revalida a todas: la regla de cada una depende de las otras.
  const revalidar = (): void => {
    for (const grupo of [controles.generalManagerName, controles.salesManagerName, controles.marketingManagerName]) {
      grupo.controls.name.updateValueAndValidity({ emitEvent: false });
      grupo.controls.lastName.updateValueAndValidity({ emitEvent: false });
    }
    for (const control of [
      controles.generalManagerPhone,
      controles.generalManagerEmail,
      controles.salesManagerPhone,
      controles.salesManagerEmail,
      controles.marketingManagerPhone,
      controles.marketingManagerEmail,
    ]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  };
  for (const control of Object.values(controles) as AbstractControl[]) {
    control.valueChanges.subscribe(revalidar);
  }
  return controles;
}

/** Si en el formulario que contiene `control` ya hay algo escrito en las gerencias. */
function bloqueConAlgo(control: AbstractControl): boolean {
  const raiz = control.root;
  return raiz instanceof FormGroup && executivesTouched(raiz.getRawValue() as ExecutivesRaw);
}

/** Lo que `getRawValue()` devuelve de {@link executivesControls}. */
export interface ExecutivesRaw {
  readonly generalManagerName: NameValue;
  readonly generalManagerPhone: string;
  readonly generalManagerEmail: string;
  readonly salesManagerName: NameValue;
  readonly salesManagerPhone: string;
  readonly salesManagerEmail: string;
  readonly marketingManagerName: NameValue;
  readonly marketingManagerPhone: string;
  readonly marketingManagerEmail: string;
}

/** Los grupos de nombre de las gerencias, para proyectar `app-inline-name-fields`. */
export type ExecutivesNameGroups = Readonly<
  Record<'generalManagerName' | 'salesManagerName' | 'marketingManagerName', NameGroup>
>;

/**
 * Las tres gerencias, o `null` si alguna no está completa (nombre, celular y
 * correo). Un bloque a medias no se manda: la API lo rechazaría entero.
 */
export function executivesFrom(raw: ExecutivesRaw): OrganizationExecutives | null {
  const contacto = (nombre: NameValue, phone: string, email: string) => {
    const fullName = completeName(nombre);
    return fullName === '' || phone.trim() === '' || email.trim() === ''
      ? null
      : { fullName, phone: phone.trim(), email: email.trim() };
  };
  const general = contacto(raw.generalManagerName, raw.generalManagerPhone, raw.generalManagerEmail);
  const comercial = contacto(raw.salesManagerName, raw.salesManagerPhone, raw.salesManagerEmail);
  const marketing = contacto(
    raw.marketingManagerName,
    raw.marketingManagerPhone,
    raw.marketingManagerEmail,
  );
  return general === null || comercial === null || marketing === null
    ? null
    : { generalManager: general, commercialManager: comercial, marketingManager: marketing };
}

/**
 * Si las gerencias quedaron a medias: alguna tiene algo escrito pero el bloque
 * no está completo. Sirve para avisar en vez de descartar en silencio lo que la
 * persona escribió.
 */
export function executivesIncomplete(raw: ExecutivesRaw): boolean {
  return executivesTouched(raw) && executivesFrom(raw) === null;
}

/** Si alguna de las tres gerencias tiene algo escrito (nombre, celular o correo). */
export function executivesTouched(raw: ExecutivesRaw): boolean {
  return (
    [raw.generalManagerName, raw.salesManagerName, raw.marketingManagerName].some(
      (n) => completeName(n) !== '',
    ) ||
    [
      raw.generalManagerPhone,
      raw.generalManagerEmail,
      raw.salesManagerPhone,
      raw.salesManagerEmail,
      raw.marketingManagerPhone,
      raw.marketingManagerEmail,
    ].some((v) => v.trim() !== '')
  );
}

/** Los textos de ayuda de cada gerencia, por si la pantalla los quiere propios. */
interface GerenciaPagina {
  readonly clave: string;
  readonly titulo: string;
  readonly icon: 'briefcase' | 'chart' | 'megaphone';
  readonly hint: string;
  readonly prefijo: 'generalManager' | 'salesManager' | 'marketingManager';
  readonly testId: string;
}

const GERENCIAS: readonly GerenciaPagina[] = [
  {
    clave: 'gerencia-general',
    titulo: 'Gerencia general',
    icon: 'briefcase',
    hint: 'Opcional como bloque: complete las tres gerencias (nombre, celular y correo de cada una) o deje las tres vacías.',
    prefijo: 'generalManager',
    testId: 'gerente-general',
  },
  {
    clave: 'gerencia-comercial',
    titulo: 'Gerencia comercial',
    icon: 'chart',
    hint: 'Opcional, pero va junto con las otras dos gerencias. Es a quien le llega el detalle semanal de ventas y comisiones.',
    prefijo: 'salesManager',
    testId: 'gerente-comercial',
  },
  {
    clave: 'gerencia-marketing',
    titulo: 'Gerencia de marketing',
    icon: 'megaphone',
    hint: 'Opcional, pero va junto con las otras dos gerencias. Es con quien se coordinan las campañas.',
    prefijo: 'marketingManager',
    testId: 'gerente-marketing',
  },
];

/**
 * Las tres páginas de gerencias para el motor de formularios.
 *
 * @param prefijoTestId - Prefijo de los `data-testid` de la pantalla, p. ej.
 *   `registro-medico` → `registro-medico-gerente-general-celular`.
 * @param enUso - Si ya hay algo escrito en el bloque: celular y correo pasan a
 *   ser obligatorios (llevan asterisco), porque las tres van completas o ninguna.
 */
export function executivesPages(
  prefijoTestId: string,
  enUso = false,
): readonly SeccionDeFormulario[] {
  return GERENCIAS.map((g) => ({
    titulo: g.titulo,
    clave: g.clave,
    icon: g.icon,
    hint: g.hint,
    // El nombre en su renglón; celular y correo, uno al lado del otro desde 672 px.
    disposicion: 'dos-columnas' as const,
    campos: [
      {
        key: `${g.prefijo}Name`,
        label: '',
        control: 'custom' as const,
        ancho: 'completo' as const,
        mensajeDeError: '',
        testId: `${prefijoTestId}-${g.testId}`,
      },
      {
        key: `${g.prefijo}Phone`,
        label: 'Celular',
        control: 'tel' as const,
        ...(enUso ? { required: true } : {}),
        testId: `${prefijoTestId}-${g.testId}-celular`,
        mensajeDeError: 'Escriba el celular completo, o deje las tres gerencias vacías.',
      },
      {
        key: `${g.prefijo}Email`,
        label: 'Correo',
        control: 'email' as const,
        ...(enUso ? { required: true } : {}),
        icono: 'mail' as const,
        testId: `${prefijoTestId}-${g.testId}-correo`,
        mensajeDeError: 'Escriba un correo válido, o deje las tres gerencias vacías.',
      },
    ],
  }));
}
