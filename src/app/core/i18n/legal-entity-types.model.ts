import type { UiLanguage } from './ui-language';

/* ============================================================================
    La forma de una entrada del diccionario de tipos societarios. Vive aparte
    para que `legal-entity-types-bo.dictionary.ts` no importe de
    `legal-entity-types.dictionary.ts`, que a su vez lo importa a él (eso era
    un ciclo que `check-architecture` rechaza). El diccionario reexporta todo
    lo de acá, así que sus consumidores no cambian de import.
    ========================================================================== */

/** Los cinco países que el diccionario cubre hoy, en el orden en que se ofrecen. */
export const LEGAL_ENTITY_COUNTRIES = ['BO', 'BR', 'US', 'AR', 'MX'] as const;

export type LegalEntityCountryIso = (typeof LEGAL_ENTITY_COUNTRIES)[number];

/** Rótulo y explicación de una forma societaria, en un idioma. */
export interface LegalEntityTypeText {
  /** «ACRÓNIMO · Nombre», tal como se ve en el selector. */
  readonly label: string;
  /** Una línea de qué es, para el texto de ayuda del campo. */
  readonly description: string;
}

/** Una entrada del diccionario: sus tres idiomas más lo que no cambia entre ellos. */
export interface LegalEntityTypeEntry {
  readonly countryIso: LegalEntityCountryIso;
  readonly acronym: string;
  readonly translations: Readonly<Record<UiLanguage, LegalEntityTypeText>>;
}
