import type { UiLanguage } from './ui-language';

/* ============================================================================
    Diccionario trilingüe de tipos societarios (subtarea 1.1).

    El catálogo real —los 21 códigos, sus `conceptId` y a qué país
    pertenecen— vive en la API (`legal-entity-type`, enumeración dinámica de
    `directory.tenants.legal_entity_type_concept_id`) y se lee por
    `LegalEntityTypesCatalog`. Lo que ese catálogo devuelve es el `display`
    del sistema de codificación, que está **en inglés técnico** a propósito
    —es terminología, no copy de producto— («Limited Liability Company (US)»,
    «Sole proprietorship»...).

    Este archivo es la mitad que la API no tiene: la etiqueta y la
    descripción que ve la persona, por **código**, en los tres idiomas que
    pide la subtarea. Mismo patrón que `ETIQUETAS_PARENTESCO`
    (`related-person-relationships.service.ts`): el código es la identidad
    semántica estable, la etiqueta es metadato de presentación.

    Los VALORES que viajan al backend siguen siendo los códigos de la API
    (`SRL`, `US_LLC`...) — este diccionario nunca inventa uno propio.
    ========================================================================== */

/** Los cinco países que el diccionario cubre hoy, en el orden en que se ofrecen. */
export const LEGAL_ENTITY_COUNTRIES = ['BO', 'BR', 'US', 'AR', 'MX'] as const;

export type LegalEntityCountryIso = (typeof LEGAL_ENTITY_COUNTRIES)[number];

/** El nombre del país, en los tres idiomas. */
export const COUNTRY_NAMES: Readonly<Record<LegalEntityCountryIso, Record<UiLanguage, string>>> =
  {
    BO: { es: 'Bolivia', en: 'Bolivia', pt: 'Bolívia' },
    BR: { es: 'Brasil', en: 'Brazil', pt: 'Brasil' },
    US: { es: 'Estados Unidos', en: 'United States', pt: 'Estados Unidos' },
    AR: { es: 'Argentina', en: 'Argentina', pt: 'Argentina' },
    MX: { es: 'México', en: 'Mexico', pt: 'México' },
  };

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

/**
 * El diccionario completo, indexado por el código de la API
 * (`legalEntityType` del contrato, `SelectOption.value` del selector).
 */
export const LEGAL_ENTITY_TYPES_DICTIONARY: Readonly<Record<string, LegalEntityTypeEntry>> = {
  // --- Bolivia ---
  UNIPERSONAL: {
    countryIso: 'BO',
    acronym: 'P.N.',
    translations: {
      es: {
        label: 'Empresa Unipersonal',
        description: 'Una sola persona natural es la titular del negocio y responde con su patrimonio.',
      },
      en: {
        label: 'Sole Proprietorship',
        description: 'A single individual owns the business and is personally liable for it.',
      },
      pt: {
        label: 'Empresário Individual',
        description: 'Uma única pessoa física é titular do negócio e responde com seu patrimônio.',
      },
    },
  },
  SRL: {
    countryIso: 'BO',
    acronym: 'S.R.L.',
    translations: {
      es: {
        label: 'S.R.L. · Sociedad de Responsabilidad Limitada',
        description: 'De 2 a 25 socios con capital dividido en cuotas, no en acciones.',
      },
      en: {
        label: 'S.R.L. · Limited Liability Company (Bolivia)',
        description: '2 to 25 partners with capital divided into non-tradable quotas.',
      },
      pt: {
        label: 'S.R.L. · Sociedade de Responsabilidade Limitada',
        description: 'De 2 a 25 sócios com capital dividido em quotas.',
      },
    },
  },
  LTDA: {
    countryIso: 'BO',
    acronym: 'Ltda.',
    translations: {
      es: {
        label: 'Ltda. · Limitada',
        description: 'Forma abreviada de sociedad de responsabilidad limitada.',
      },
      en: {
        label: 'Ltda. · Limited Company',
        description: 'Abbreviated form of a limited liability company.',
      },
      pt: {
        label: 'Ltda. · Sociedade Limitada',
        description: 'Forma abreviada de sociedade de responsabilidade limitada.',
      },
    },
  },
  SA: {
    countryIso: 'BO',
    acronym: 'S.A.',
    translations: {
      es: {
        label: 'S.A. · Sociedad Anónima',
        description: 'El capital se divide en acciones y los accionistas responden hasta el valor de las suyas.',
      },
      en: {
        label: 'S.A. · Corporation (Bolivia)',
        description: 'Capital is divided into shares; shareholders are liable up to the value of theirs.',
      },
      pt: {
        label: 'S.A. · Sociedade Anônima',
        description: 'Capital dividido em ações; acionistas respondem até o valor das suas.',
      },
    },
  },
  SOCIEDAD_COLECTIVA: {
    countryIso: 'BO',
    acronym: 'S.C.',
    translations: {
      es: {
        label: 'S.C. · Sociedad Colectiva',
        description: 'Todos los socios responden de forma solidaria e ilimitada por las obligaciones sociales.',
      },
      en: {
        label: 'S.C. · General Partnership',
        description: 'All partners have unlimited, joint and several liability.',
      },
      pt: {
        label: 'S.C. · Sociedade Coletiva',
        description: 'Todos os sócios respondem de forma solidária e ilimitada pelas obrigações sociais.',
      },
    },
  },
  COMANDITA_SIMPLE: {
    countryIso: 'BO',
    acronym: 'S.C.S.',
    translations: {
      es: {
        label: 'S.C.S. · Sociedad en Comandita Simple',
        description: 'Convive un socio gestor, con responsabilidad ilimitada, con socios comanditarios que responden sólo por su aporte.',
      },
      en: {
        label: 'S.C.S. · Limited Partnership',
        description: 'General partners with unlimited liability alongside limited partners liable only for their contribution.',
      },
      pt: {
        label: 'S.C.S. · Sociedade em Comandita Simples',
        description: 'Convivem sócios comanditados, com responsabilidade ilimitada, e comanditários que respondem só pelo seu aporte.',
      },
    },
  },
  COMANDITA_ACCIONES: {
    countryIso: 'BO',
    acronym: 'S.C.A.',
    translations: {
      es: {
        label: 'S.C.A. · Sociedad en Comandita por Acciones',
        description: 'Como la comandita simple, pero el aporte de los socios comanditarios está representado en acciones.',
      },
      en: {
        label: 'S.C.A. · Partnership Limited by Shares',
        description: 'Like a limited partnership, but the limited partners’ contribution is represented by shares.',
      },
      pt: {
        label: 'S.C.A. · Sociedade em Comandita por Ações',
        description: 'Como a comandita simples, mas o aporte dos comanditários está representado em ações.',
      },
    },
  },
  SUCURSAL_EXTRANJERA: {
    countryIso: 'BO',
    acronym: 'Suc.',
    translations: {
      es: {
        label: 'Sucursal de Sociedad Extranjera',
        description: 'Establecimiento en Bolivia de una sociedad constituida en otro país, inscrito en el registro de comercio.',
      },
      en: {
        label: 'Foreign Company Branch (Bolivia)',
        description: 'Local establishment in Bolivia of a company incorporated abroad.',
      },
      pt: {
        label: 'Filial de Sociedade Estrangeira (Bolívia)',
        description: 'Estabelecimento na Bolívia de uma sociedade constituída em outro país.',
      },
    },
  },
  // --- Brasil ---
  BR_LTDA: {
    countryIso: 'BR',
    acronym: 'LTDA',
    translations: {
      es: {
        label: 'LTDA · Sociedad Limitada (Brasil)',
        description: 'Sociedad de responsabilidad limitada brasileña, regida por el Código Civil.',
      },
      en: {
        label: 'LTDA · Limited Liability Company (Brazil)',
        description: 'Standard Brazilian limited liability company, governed by the Civil Code.',
      },
      pt: {
        label: 'LTDA · Sociedade Limitada',
        description: 'Sociedade de responsabilidade limitada regida pelo Código Civil.',
      },
    },
  },
  BR_SA: {
    countryIso: 'BR',
    acronym: 'S.A.',
    translations: {
      es: {
        label: 'S.A. · Sociedad Anónima (Brasil)',
        description: 'Capital dividido en acciones, abierta o cerrada, regida por la Lei das S.A.',
      },
      en: {
        label: 'S.A. · Corporation (Brazil)',
        description: 'Joint-stock corporation, public or private, governed by Lei das S.A. (6.404/1976).',
      },
      pt: {
        label: 'S.A. · Sociedade Anônima',
        description: 'Sociedade por ações, aberta ou fechada, regida pela Lei 6.404/1976.',
      },
    },
  },
  BR_MEI: {
    countryIso: 'BR',
    acronym: 'MEI',
    translations: {
      es: {
        label: 'MEI · Microemprendedor Individual',
        description: 'Régimen simplificado brasileño para quien factura poco y trabaja por cuenta propia.',
      },
      en: {
        label: 'MEI · Individual Micro-Entrepreneur',
        description: 'Simplified Brazilian tax regime for low-revenue independent workers.',
      },
      pt: {
        label: 'MEI · Microempreendedor Individual',
        description: 'Regime simplificado para quem fatura pouco e trabalha por conta própria.',
      },
    },
  },
  BR_EI: {
    countryIso: 'BR',
    acronym: 'EI',
    translations: {
      es: {
        label: 'EI · Empresario Individual (Brasil)',
        description: 'Persona física brasileña que ejerce una actividad empresarial sin constituir sociedad.',
      },
      en: {
        label: 'EI · Sole Trader (Brazil)',
        description: 'A Brazilian individual carrying out a business activity without forming a company.',
      },
      pt: {
        label: 'EI · Empresário Individual',
        description: 'Pessoa física que exerce atividade empresarial sem constituir sociedade.',
      },
    },
  },
  BR_SLU: {
    countryIso: 'BR',
    acronym: 'SLU',
    translations: {
      es: {
        label: 'SLU · Sociedad Limitada Unipersonal',
        description: 'Limitada brasileña de un solo socio, sin exigir un capital mínimo.',
      },
      en: {
        label: 'SLU · Single-Member Limited Liability (Brazil)',
        description: 'Brazilian limited liability company with a single member, no minimum capital required.',
      },
      pt: {
        label: 'SLU · Sociedade Limitada Unipessoal',
        description: 'Sociedade unipessoal com separação patrimonial total, sem capital mínimo exigido.',
      },
    },
  },
  BR_FILIAL_EST: {
    countryIso: 'BR',
    acronym: 'Filial',
    translations: {
      es: {
        label: 'Filial de Sociedad Extranjera (Brasil)',
        description: 'Establecimiento en Brasil de una sociedad constituida en otro país.',
      },
      en: {
        label: 'Foreign Company Branch (Brazil)',
        description: 'Local establishment in Brazil of a company incorporated abroad.',
      },
      pt: {
        label: 'Filial de Sociedade Estrangeira',
        description: 'Estabelecimento no Brasil de uma sociedade constituída em outro país.',
      },
    },
  },
  // --- Estados Unidos ---
  US_LLC: {
    countryIso: 'US',
    acronym: 'LLC',
    translations: {
      es: {
        label: 'LLC · Compañía de Responsabilidad Limitada',
        description: 'Estructura estadounidense que combina la protección patrimonial de una corporación con la flexibilidad de una sociedad de personas.',
      },
      en: {
        label: 'LLC · Limited Liability Company',
        description: 'A US structure combining a corporation’s liability protection with a partnership’s flexibility.',
      },
      pt: {
        label: 'LLC · Sociedade de Responsabilidade Limitada (EUA)',
        description: 'Estrutura americana com proteção patrimonial de uma corporação e flexibilidade de sociedade de pessoas.',
      },
    },
  },
  US_CORP: {
    countryIso: 'US',
    acronym: 'Inc. / Corp.',
    translations: {
      es: {
        label: 'Inc. / Corp. · Corporación',
        description: 'Entidad legal separada de sus accionistas, con capital dividido en acciones.',
      },
      en: {
        label: 'Inc. / Corp. · Corporation',
        description: 'A legal entity separate from its shareholders, with capital divided into shares.',
      },
      pt: {
        label: 'Inc. / Corp. · Corporação',
        description: 'Entidade legal separada de seus acionistas, com capital dividido em ações.',
      },
    },
  },
  US_SOLE_PROP: {
    countryIso: 'US',
    acronym: 'Sole Prop',
    translations: {
      es: {
        label: 'Sole Prop · Propietario Único',
        description: 'Negocio no incorporado, operado y respondido por una sola persona.',
      },
      en: {
        label: 'Sole Prop · Sole Proprietorship',
        description: 'An unincorporated business owned and run by one individual.',
      },
      pt: {
        label: 'Sole Prop · Proprietário Único',
        description: 'Negócio não incorporado, operado e respondido por uma única pessoa.',
      },
    },
  },
  US_LLP: {
    countryIso: 'US',
    acronym: 'LLP',
    translations: {
      es: {
        label: 'LLP · Sociedad de Profesionales de Responsabilidad Limitada',
        description: 'Sociedad de personas donde cada socio responde por sus propios actos y no por los de los demás.',
      },
      en: {
        label: 'LLP · Limited Liability Partnership',
        description: 'A partnership where each partner is liable only for their own acts, not those of the others.',
      },
      pt: {
        label: 'LLP · Sociedade Limitada de Profissionais',
        description: 'Sociedade de pessoas em que cada sócio responde só por seus próprios atos.',
      },
    },
  },
  US_BRANCH: {
    countryIso: 'US',
    acronym: 'Branch',
    translations: {
      es: {
        label: 'Sucursal Extranjera (Estados Unidos)',
        description: 'Establecimiento en Estados Unidos de una empresa constituida en otro país.',
      },
      en: {
        label: 'Foreign Branch Office (US)',
        description: 'Local establishment in the US of a company incorporated abroad.',
      },
      pt: {
        label: 'Filial de Empresa Estrangeira (EUA)',
        description: 'Estabelecimento nos EUA de uma empresa constituída em outro país.',
      },
    },
  },
  // --- Argentina ---
  AR_SAS: {
    countryIso: 'AR',
    acronym: 'S.A.S.',
    translations: {
      es: {
        label: 'S.A.S. · Sociedad por Acciones Simplificada',
        description: 'Figura societaria argentina de trámite ágil, con capital dividido en acciones y responsabilidad limitada al aporte.',
      },
      en: {
        label: 'S.A.S. · Simplified Shares Company (Argentina)',
        description: 'A fast-registration Argentine entity with capital in shares and liability limited to the contribution.',
      },
      pt: {
        label: 'S.A.S. · Sociedade por Ações Simplificada (Argentina)',
        description: 'Figura societária argentina de trâmite ágil, com capital em ações e responsabilidade limitada ao aporte.',
      },
    },
  },
  // --- México ---
  MX_S_RL: {
    countryIso: 'MX',
    acronym: 'S. de R.L.',
    translations: {
      es: {
        label: 'S. de R.L. · Sociedad de Responsabilidad Limitada (México)',
        description: 'Los socios responden hasta el monto de sus aportaciones, sin partes representadas en títulos negociables.',
      },
      en: {
        label: 'S. de R.L. · Limited Liability Company (Mexico)',
        description: 'Partners are liable up to their contribution; interests are not represented by negotiable securities.',
      },
      pt: {
        label: 'S. de R.L. · Sociedade de Responsabilidade Limitada (México)',
        description: 'Os sócios respondem até o valor de suas contribuições, sem partes representadas em títulos negociáveis.',
      },
    },
  },
};

/**
 * El rótulo de una forma societaria, en el idioma pedido.
 *
 * @param code - Código de la API (`SRL`, `US_LLC`...).
 * @param lang - Idioma de la interfaz.
 * @param fallbackLabel - Lo que mostrar si el código no está en el diccionario
 *   (p. ej. el `display` del catálogo, en inglés técnico): un código nuevo en
 *   la API que todavía no llegó a este archivo se ve así, no en blanco.
 * @returns El texto en el idioma pedido.
 */
export function legalEntityTypeLabel(
  code: string,
  lang: UiLanguage,
  fallbackLabel: string,
): string {
  const entry = LEGAL_ENTITY_TYPES_DICTIONARY[code];
  return entry ? entry.translations[lang].label : fallbackLabel;
}
