import { FormControl, Validators } from '@angular/forms';

import type { OrganizationExecutives } from '../../../core/data-access/iam/iam.types';
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

/** Los controles de las tres gerencias, listos para sumar a un `FormGroup`. */
export function executivesControls() {
  const celular = () =>
    new FormControl('', { nonNullable: true, validators: [telefonoCompleto] });
  const correo = () =>
    new FormControl('', { nonNullable: true, validators: [Validators.email] });
  return {
    generalManagerName: nameGroup(false),
    generalManagerPhone: celular(),
    generalManagerEmail: correo(),
    salesManagerName: nameGroup(false),
    salesManagerPhone: celular(),
    salesManagerEmail: correo(),
    marketingManagerName: nameGroup(false),
    marketingManagerPhone: celular(),
    marketingManagerEmail: correo(),
  };
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
  const algo =
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
    ].some((v) => v.trim() !== '');
  return algo && executivesFrom(raw) === null;
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
    hint: 'Todo este paso es opcional: puede completarlo después.',
    prefijo: 'generalManager',
    testId: 'gerente-general',
  },
  {
    clave: 'gerencia-comercial',
    titulo: 'Gerencia comercial',
    icon: 'chart',
    hint: 'Opcional. Es a quien le llega el detalle semanal de ventas y comisiones.',
    prefijo: 'salesManager',
    testId: 'gerente-comercial',
  },
  {
    clave: 'gerencia-marketing',
    titulo: 'Gerencia de marketing',
    icon: 'megaphone',
    hint: 'Opcional. Es con quien se coordinan las campañas.',
    prefijo: 'marketingManager',
    testId: 'gerente-marketing',
  },
];

/**
 * Las tres páginas de gerencias para el motor de formularios.
 *
 * @param prefijoTestId - Prefijo de los `data-testid` de la pantalla, p. ej.
 *   `registro-medico` → `registro-medico-gerente-general-celular`.
 */
export function executivesPages(prefijoTestId: string): readonly SeccionDeFormulario[] {
  return GERENCIAS.map((g) => ({
    titulo: g.titulo,
    clave: g.clave,
    icon: g.icon,
    hint: g.hint,
    campos: [
      {
        key: `${g.prefijo}Name`,
        label: '',
        control: 'custom' as const,
        mensajeDeError: '',
        testId: `${prefijoTestId}-${g.testId}`,
      },
      {
        key: `${g.prefijo}Phone`,
        label: 'Celular',
        control: 'tel' as const,
        testId: `${prefijoTestId}-${g.testId}-celular`,
        mensajeDeError: 'El número está incompleto.',
      },
      {
        key: `${g.prefijo}Email`,
        label: 'Correo',
        control: 'email' as const,
        icono: 'mail' as const,
        testId: `${prefijoTestId}-${g.testId}-correo`,
        mensajeDeError: 'Escriba un correo válido o déjelo vacío.',
      },
    ],
  }));
}
