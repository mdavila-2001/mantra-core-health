import { REGISTRATION_LEGAL_DOCUMENT_ROLES } from '../../../core/i18n/legal-documents.dictionary';
import {
  KEY_NOTARIZED_POWER,
  legalDocumentsFields,
  notarizedPowerField,
  RECORD_LEGAL_DOCUMENTS,
  MESSAGE_REQUIRED_DOCUMENT,
} from './legal-documents';

describe('DOCUMENTOS_LEGALES_DEL_REGISTRO', () => {
  it('declara exactamente los 5 roles del autorregistro, en el mismo orden', () => {
    expect(RECORD_LEGAL_DOCUMENTS.map((d) => d.role)).toEqual([
      ...REGISTRATION_LEGAL_DOCUMENT_ROLES,
    ]);
  });

  it('cada entrada tiene una clave de contrato y un testId únicos', () => {
    const claves = RECORD_LEGAL_DOCUMENTS.map((d) => d.key);
    const testIds = RECORD_LEGAL_DOCUMENTS.map((d) => d.testId);
    expect(new Set(claves).size).toBe(claves.length);
    expect(new Set(testIds).size).toBe(testIds.length);
  });
});

describe('camposDeDocumentosLegales', () => {
  it('produce 5 campos custom, obligatorios, con el mensaje de error acordado', () => {
    const campos = legalDocumentsFields('BO', 'es');

    expect(campos).toHaveLength(5);
    for (const campo of campos) {
      expect(campo.control).toBe('custom');
      expect(campo.required).toBe(true);
      expect(campo.mensajeDeError).toBe(MESSAGE_REQUIRED_DOCUMENT);
    }
  });

  it('el último campo va a ancho completo; el resto, a media fila', () => {
    const campos = legalDocumentsFields('BO', 'es');

    expect(campos.slice(0, 4).every((c) => c.ancho === 'mitad')).toBe(true);
    expect(campos.at(-1)?.ancho).toBe('completo');
  });

  it('las claves coinciden con los nombres canónicos del contrato', () => {
    const claves = legalDocumentsFields('BO', 'es').map((c) => c.key);
    expect(claves).toEqual([
      'constitutionFileId',
      'taxIdentifierFileId',
      'commerceRegistryFileId',
      'operatingLicenseFileId',
      'healthAuthorityCertificateFileId',
    ]);
  });

  it('el rótulo boliviano nombra la institución real', () => {
    const campos = legalDocumentsFields('BO', 'es');
    const sedes = campos.find((c) => c.key === 'healthAuthorityCertificateFileId');
    expect(sedes?.label).toContain('SEDES');
  });

  it('cambiar de país cambia el rótulo sin cambiar la forma de los campos', () => {
    const enBolivia = legalDocumentsFields('BO', 'es');
    const enBrasil = legalDocumentsFields('BR', 'es');

    expect(enBolivia.map((c) => c.key)).toEqual(enBrasil.map((c) => c.key));
    expect(enBolivia[2]?.label).not.toBe(enBrasil[2]?.label);
    expect(enBrasil[2]?.label).toContain('Junta Comercial');
  });
});

describe('notarizedPowerField', () => {
  // Decisión del propietario (05/11/2026): el poder del representante es
  // obligatorio para toda organización y nunca se rotula «(opcional)».
  it('es un campo custom obligatorio, a ancho completo, con el mensaje acordado', () => {
    const campo = notarizedPowerField('BO', 'es');

    expect(campo.key).toBe(KEY_NOTARIZED_POWER);
    expect(campo.control).toBe('custom');
    expect(campo.ancho).toBe('completo');
    expect(campo.required).toBe(true);
    expect(campo.mensajeDeError).toBe(MESSAGE_REQUIRED_DOCUMENT);
  });

  it('su rótulo nunca dice «(opcional)», en ningún país ni idioma', () => {
    for (const pais of ['BO', 'BR', 'US', 'AR']) {
      for (const lang of ['es', 'en', 'pt'] as const) {
        expect(notarizedPowerField(pais, lang).label).not.toMatch(/opcional|optional/i);
      }
    }
    expect(notarizedPowerField('BO', 'es').label).toBe('Poder del representante legal');
  });
});
