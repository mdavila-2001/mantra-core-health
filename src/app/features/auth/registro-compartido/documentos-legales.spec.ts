import { REGISTRATION_LEGAL_DOCUMENT_ROLES } from '../../../core/i18n/legal-documents.dictionary';
import {
  camposDeDocumentosLegales,
  DOCUMENTOS_LEGALES_DEL_REGISTRO,
  MENSAJE_DOCUMENTO_OBLIGATORIO,
} from './documentos-legales';

describe('DOCUMENTOS_LEGALES_DEL_REGISTRO', () => {
  it('declara exactamente los 5 roles del autorregistro, en el mismo orden', () => {
    expect(DOCUMENTOS_LEGALES_DEL_REGISTRO.map((d) => d.role)).toEqual([
      ...REGISTRATION_LEGAL_DOCUMENT_ROLES,
    ]);
  });

  it('cada entrada tiene una clave de contrato y un testId únicos', () => {
    const claves = DOCUMENTOS_LEGALES_DEL_REGISTRO.map((d) => d.key);
    const testIds = DOCUMENTOS_LEGALES_DEL_REGISTRO.map((d) => d.testId);
    expect(new Set(claves).size).toBe(claves.length);
    expect(new Set(testIds).size).toBe(testIds.length);
  });
});

describe('camposDeDocumentosLegales', () => {
  it('produce 5 campos custom, obligatorios, con el mensaje de error acordado', () => {
    const campos = camposDeDocumentosLegales('BO', 'es');

    expect(campos).toHaveLength(5);
    for (const campo of campos) {
      expect(campo.control).toBe('custom');
      expect(campo.required).toBe(true);
      expect(campo.mensajeDeError).toBe(MENSAJE_DOCUMENTO_OBLIGATORIO);
    }
  });

  it('el último campo va a ancho completo; el resto, a media fila', () => {
    const campos = camposDeDocumentosLegales('BO', 'es');

    expect(campos.slice(0, 4).every((c) => c.ancho === 'mitad')).toBe(true);
    expect(campos.at(-1)?.ancho).toBe('completo');
  });

  it('las claves coinciden con los nombres canónicos del contrato', () => {
    const claves = camposDeDocumentosLegales('BO', 'es').map((c) => c.key);
    expect(claves).toEqual([
      'constitutionFileId',
      'taxIdentifierFileId',
      'commerceRegistryFileId',
      'operatingLicenseFileId',
      'healthAuthorityCertificateFileId',
    ]);
  });

  it('el rótulo boliviano nombra la institución real', () => {
    const campos = camposDeDocumentosLegales('BO', 'es');
    const sedes = campos.find((c) => c.key === 'healthAuthorityCertificateFileId');
    expect(sedes?.label).toContain('SEDES');
  });

  it('cambiar de país cambia el rótulo sin cambiar la forma de los campos', () => {
    const enBolivia = camposDeDocumentosLegales('BO', 'es');
    const enBrasil = camposDeDocumentosLegales('BR', 'es');

    expect(enBolivia.map((c) => c.key)).toEqual(enBrasil.map((c) => c.key));
    expect(enBolivia[2]?.label).not.toBe(enBrasil[2]?.label);
    expect(enBrasil[2]?.label).toContain('Junta Comercial');
  });
});
