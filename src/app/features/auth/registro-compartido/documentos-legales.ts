import {
  legalDocumentText,
  type LegalDocumentRole,
} from '../../../core/i18n/legal-documents.dictionary';
import { uiLanguage, type UiLanguage } from '../../../core/i18n/ui-language';
import type { CampoDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';

/* ============================================================================
    Los cinco documentos legales del autorregistro de organización
    (subtarea 1.2): «Adjuntar … en PDF», registro de procesos
    1.1.2 · 1.2.1 · 1.3 · 1.4 · 1.5.

    Vive en `registro-compartido/` porque el mismo bloque ya está declarado
    dos veces, como maqueta, en `register-laboratory` y
    `register-imaging-center`: el día que esas dos altas se conecten a la API
    real, este archivo es el punto de convergencia.
    ========================================================================== */

/** Los nombres canónicos con los que viaja cada documento en el contrato (`legalDocuments`). */
export type ClaveDeDocumentoLegal =
  | 'constitutionFileId'
  | 'taxIdentifierFileId'
  | 'commerceRegistryFileId'
  | 'operatingLicenseFileId'
  | 'healthAuthorityCertificateFileId';

/** El mensaje que ve la persona cuando intenta avanzar sin un documento obligatorio. */
export const MENSAJE_DOCUMENTO_OBLIGATORIO = 'Este documento es obligatorio para continuar';

/** Rol canónico ↔ clave del contrato ↔ el sufijo de su `data-testid`, en el orden del registro de procesos. */
export const DOCUMENTOS_LEGALES_DEL_REGISTRO: readonly {
  readonly role: LegalDocumentRole;
  readonly key: ClaveDeDocumentoLegal;
  readonly testId: string;
}[] = [
  { role: 'CONSTITUTION_DOC', key: 'constitutionFileId', testId: 'constitution' },
  { role: 'TAX_IDENTIFIER_DOC', key: 'taxIdentifierFileId', testId: 'tax-identifier' },
  { role: 'COMMERCE_REGISTRY_DOC', key: 'commerceRegistryFileId', testId: 'commerce-registry' },
  { role: 'OPERATING_LICENSE_DOC', key: 'operatingLicenseFileId', testId: 'operating-license' },
  {
    role: 'HEALTH_AUTHORITY_CERT_DOC',
    key: 'healthAuthorityCertificateFileId',
    testId: 'health-authority-cert',
  },
];

/**
 * Los cinco campos `custom` del paso «Documentación legal obligatoria (PDF)».
 *
 * `control: 'custom'` es la vía de escape del motor de formularios para lo
 * que no es un control de texto (ver `TipoDeControl`): quien pinta la
 * pantalla proyecta un `<app-dropzone-pdf>` con `appCampoPersonalizado`, y
 * el motor sólo le reserva su sitio, con el rótulo, la ayuda y el mensaje de
 * error que este helper ya resolvió por país e idioma.
 *
 * @param countryIso - País de constitución elegido en el formulario.
 * @param lang - Idioma activo de la interfaz.
 * @returns Los cinco campos, en el orden del registro de procesos.
 */
export function camposDeDocumentosLegales(
  countryIso: string,
  lang: UiLanguage = uiLanguage(),
): readonly CampoDeFormulario[] {
  return DOCUMENTOS_LEGALES_DEL_REGISTRO.map(({ role, key }, indice) => {
    const texto = legalDocumentText(role, countryIso, lang);
    return {
      key,
      label: texto.label,
      hint: texto.hint,
      control: 'custom' as const,
      required: true,
      // El último va a ancho completo: con 5 campos en grilla de a 2, uno
      // solo a media fila quedaría sin par.
      ancho: indice === DOCUMENTOS_LEGALES_DEL_REGISTRO.length - 1 ? 'completo' : 'mitad',
      mensajeDeError: MENSAJE_DOCUMENTO_OBLIGATORIO,
    };
  });
}
