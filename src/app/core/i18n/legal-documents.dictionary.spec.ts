import { UI_LANGUAGES } from './ui-language';
import {
  LEGAL_DOCUMENT_ROLES,
  LEGAL_DOCUMENTS_DICTIONARY,
  REGISTRATION_LEGAL_DOCUMENT_ROLES,
  legalDocumentText,
} from './legal-documents.dictionary';

describe('LEGAL_DOCUMENTS_DICTIONARY', () => {
  it('declara exactamente los 6 roles canónicos', () => {
    expect(Object.keys(LEGAL_DOCUMENTS_DICTIONARY).sort()).toEqual(
      [...LEGAL_DOCUMENT_ROLES].sort(),
    );
  });

  it('los 5 del autorregistro son un subconjunto de los 6 roles, sin el poder', () => {
    for (const role of REGISTRATION_LEGAL_DOCUMENT_ROLES) {
      expect(LEGAL_DOCUMENT_ROLES).toContain(role);
    }
    expect(REGISTRATION_LEGAL_DOCUMENT_ROLES).not.toContain('POWER_OF_ATTORNEY_DOC');
    expect(REGISTRATION_LEGAL_DOCUMENT_ROLES).toHaveLength(5);
  });

  it('cada entrada tiene los tres idiomas completos en el rótulo genérico', () => {
    for (const entry of Object.values(LEGAL_DOCUMENTS_DICTIONARY)) {
      for (const lang of UI_LANGUAGES) {
        expect(entry.generic[lang].label.length).toBeGreaterThan(0);
        expect(entry.generic[lang].hint.length).toBeGreaterThan(0);
      }
    }
  });

  it('BO, BR y US tienen los tres idiomas completos para cada documento que declaran', () => {
    for (const entry of Object.values(LEGAL_DOCUMENTS_DICTIONARY)) {
      for (const [, traducciones] of Object.entries(entry.byCountry)) {
        for (const lang of UI_LANGUAGES) {
          expect(traducciones[lang].label.length).toBeGreaterThan(0);
          expect(traducciones[lang].hint.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('el rótulo boliviano nombra la institución real (SEPREC, SEDES, NIT)', () => {
    const es = (role: keyof typeof LEGAL_DOCUMENTS_DICTIONARY) =>
      legalDocumentText(role, 'BO', 'es');
    expect(es('COMMERCE_REGISTRY_DOC').label).toContain('SEPREC');
    expect(es('HEALTH_AUTHORITY_CERT_DOC').label).toContain('SEDES');
    expect(es('TAX_IDENTIFIER_DOC').label).toContain('NIT');
  });

  it('Brasil y Estados Unidos usan sus propias instituciones, no las bolivianas', () => {
    expect(legalDocumentText('COMMERCE_REGISTRY_DOC', 'BR', 'es').label).toContain(
      'Junta Comercial',
    );
    expect(legalDocumentText('COMMERCE_REGISTRY_DOC', 'US', 'en').label).toBe(
      'Certificate of Good Standing',
    );
  });

  it('un país sin instituciones declaradas cae al rótulo genérico, sin inventar una institución', () => {
    const generico = legalDocumentText('HEALTH_AUTHORITY_CERT_DOC', 'AR', 'es');
    expect(generico).toEqual(
      LEGAL_DOCUMENTS_DICTIONARY.HEALTH_AUTHORITY_CERT_DOC.generic.es,
    );
    expect(generico.label).not.toMatch(/SEDES|Vigilância|State Health/);
  });

  it('legalDocumentText resuelve los 5 roles del autorregistro en los 3 idiomas sin lanzar', () => {
    for (const role of REGISTRATION_LEGAL_DOCUMENT_ROLES) {
      for (const country of ['BO', 'BR', 'US'] as const) {
        for (const lang of UI_LANGUAGES) {
          expect(() => legalDocumentText(role, country, lang)).not.toThrow();
        }
      }
    }
  });
});
