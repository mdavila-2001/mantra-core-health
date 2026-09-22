import { UI_LANGUAGES } from './ui-language';
import {
  COUNTRY_NAMES,
  LEGAL_ENTITY_COUNTRIES,
  LEGAL_ENTITY_TYPES_DICTIONARY,
  legalEntityTypeLabel,
} from './legal-entity-types.dictionary';

/**
 * Este diccionario es la mitad del contrato que la API no puede validar por
 * su cuenta: los 21 códigos y sus tres idiomas tienen que coincidir
 * literalmente con lo que el backend sembró
 * (`mantra-core-health-api/src/modules/directory/legal-entity-types.ts`).
 * Si algún día cambia allá, esta prueba es la que avisa acá.
 */
const CODIGOS_ESPERADOS = [
  'UNIPERSONAL',
  'SRL',
  'LTDA',
  'SA',
  'SOCIEDAD_COLECTIVA',
  'COMANDITA_SIMPLE',
  'COMANDITA_ACCIONES',
  'SUCURSAL_EXTRANJERA',
  'BR_LTDA',
  'BR_SA',
  'BR_MEI',
  'BR_EI',
  'BR_SLU',
  'BR_FILIAL_EST',
  'US_LLC',
  'US_CORP',
  'US_SOLE_PROP',
  'US_LLP',
  'US_BRANCH',
  'AR_SAS',
  'MX_S_RL',
];

const CODIGOS_BOLIVIANOS = [
  'UNIPERSONAL',
  'SRL',
  'LTDA',
  'SA',
  'SOCIEDAD_COLECTIVA',
  'COMANDITA_SIMPLE',
  'COMANDITA_ACCIONES',
  'SUCURSAL_EXTRANJERA',
];

describe('LEGAL_ENTITY_TYPES_DICTIONARY', () => {
  it('declara exactamente los 21 códigos del catálogo de la API', () => {
    expect(Object.keys(LEGAL_ENTITY_TYPES_DICTIONARY).sort()).toEqual(
      [...CODIGOS_ESPERADOS].sort(),
    );
  });

  it('los 8 códigos bolivianos coinciden literalmente con los de la API (sin prefijo BO_)', () => {
    const bolivianos = Object.entries(LEGAL_ENTITY_TYPES_DICTIONARY)
      .filter(([, entry]) => entry.countryIso === 'BO')
      .map(([code]) => code);
    expect(bolivianos.sort()).toEqual([...CODIGOS_BOLIVIANOS].sort());
  });

  it('cada entrada tiene los tres idiomas completos, con rótulo y descripción', () => {
    for (const [code, entry] of Object.entries(LEGAL_ENTITY_TYPES_DICTIONARY)) {
      for (const lang of UI_LANGUAGES) {
        const texto = entry.translations[lang];
        expect(texto, `${code} · ${lang}`).toBeDefined();
        expect(texto.label.trim(), `${code} · ${lang} · label`).not.toBe('');
        expect(texto.description.trim(), `${code} · ${lang} · description`).not.toBe('');
      }
    }
  });

  it('el país de cada entrada es uno de los cinco declarados', () => {
    for (const entry of Object.values(LEGAL_ENTITY_TYPES_DICTIONARY)) {
      expect(LEGAL_ENTITY_COUNTRIES).toContain(entry.countryIso);
    }
  });

  it('el acrónimo no está vacío', () => {
    for (const entry of Object.values(LEGAL_ENTITY_TYPES_DICTIONARY)) {
      expect(entry.acronym.trim()).not.toBe('');
    }
  });
});

describe('COUNTRY_NAMES', () => {
  it('nombra los cinco países en los tres idiomas', () => {
    for (const country of LEGAL_ENTITY_COUNTRIES) {
      for (const lang of UI_LANGUAGES) {
        expect(COUNTRY_NAMES[country][lang].trim()).not.toBe('');
      }
    }
  });
});

describe('legalEntityTypeLabel', () => {
  it('devuelve el rótulo en el idioma pedido para un código conocido', () => {
    expect(legalEntityTypeLabel('SRL', 'es', 'fallback')).toBe(
      'S.R.L. · Sociedad de Responsabilidad Limitada',
    );
    expect(legalEntityTypeLabel('US_LLC', 'en', 'fallback')).toBe(
      'LLC · Limited Liability Company',
    );
    expect(legalEntityTypeLabel('BR_MEI', 'pt', 'fallback')).toBe(
      'MEI · Microempreendedor Individual',
    );
  });

  it('cae al fallback para un código que el diccionario no conoce', () => {
    expect(legalEntityTypeLabel('NO_EXISTE', 'es', 'Display original')).toBe(
      'Display original',
    );
  });
});
