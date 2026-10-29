import type { LegalEntityTypeEntry } from './legal-entity-types.dictionary';

/* ============================================================================
    Las formas jurídicas bolivianas no societarias y del sector público que la
    API sumó el 26/10/2026 (`LEGAL_ENTITY_TYPES` en
    `mantra-core-health-api/src/common/constants/legal-entity-types.ts`).

    El castellano es, literal, el `display`/`definition` que la API siembra en
    `src/common/seed/terminology-designations.es.ts`; inglés y portugués son
    traducción de interfaz. Se unen al diccionario completo en
    `legal-entity-types.dictionary.ts`, que es lo único que debería importar
    esto.
    ========================================================================== */

/** Las 19 formas, indexadas por el código de la API. */
export const LEGAL_ENTITY_TYPES_BO_NON_CORPORATE: Readonly<Record<string, LegalEntityTypeEntry>> = {
  SAM: {
    countryIso: 'BO',
    acronym: 'S.A.M.',
    translations: {
      es: {
        label: 'S.A.M. · Sociedad Anónima Mixta',
        description: 'Sociedad anónima con capital del Estado y de particulares (Código de Comercio, art. 424 y siguientes).',
      },
      en: {
        label: 'S.A.M. · Mixed Public-Private Corporation',
        description: 'Corporation with both State and private capital.',
      },
      pt: {
        label: 'S.A.M. · Sociedade Anônima Mista',
        description: 'Sociedade anônima com capital do Estado e de particulares.',
      },
    },
  },
  ASOCIACION_ACCIDENTAL: {
    countryIso: 'BO',
    acronym: 'A.A.',
    translations: {
      es: {
        label: 'Asociación accidental o de cuentas en participación',
        description: 'Contrato entre comerciantes para uno o más negocios determinados, sin crear una persona jurídica distinta de la de sus partes.',
      },
      en: {
        label: 'Joint Venture (Accidental Association)',
        description: 'Contract between merchants for specific deals, without creating a separate legal entity.',
      },
      pt: {
        label: 'Associação Acidental (Conta de Participação)',
        description: 'Contrato entre comerciantes para negócios determinados, sem criar uma pessoa jurídica própria.',
      },
    },
  },
  SOCIEDAD_CIVIL: {
    countryIso: 'BO',
    acronym: 'S. Civ.',
    translations: {
      es: {
        label: 'Sociedad civil',
        description: 'Sociedad regida por el Código Civil, típica de profesionales que ejercen juntos sin actividad comercial.',
      },
      en: {
        label: 'Civil Partnership',
        description: 'Partnership under the Civil Code, typical of professionals practicing together without commercial activity.',
      },
      pt: {
        label: 'Sociedade Civil',
        description: 'Sociedade regida pelo Código Civil, típica de profissionais que atuam juntos sem atividade comercial.',
      },
    },
  },
  PROFESIONAL_INDEPENDIENTE: {
    countryIso: 'BO',
    acronym: 'P.I.',
    translations: {
      es: {
        label: 'Profesional independiente (persona natural)',
        description: 'Profesional que ejerce por cuenta propia con su NIT personal, sin matrícula de comercio: el caso típico del consultorio.',
      },
      en: {
        label: 'Independent Professional (individual)',
        description: 'A professional practicing on their own with a personal tax ID, without a commerce registration.',
      },
      pt: {
        label: 'Profissional Autônomo (pessoa física)',
        description: 'Profissional que atua por conta própria com seu NIT pessoal, sem registro comercial.',
      },
    },
  },
  COOPERATIVA: {
    countryIso: 'BO',
    acronym: 'Coop.',
    translations: {
      es: {
        label: 'Cooperativa',
        description: 'Asociación de socios que gestionan en común un servicio sin fines de lucro (Ley 356 General de Cooperativas).',
      },
      en: {
        label: 'Cooperative',
        description: 'Members jointly running a non-profit service (General Cooperatives Law 356).',
      },
      pt: {
        label: 'Cooperativa',
        description: 'Associação de sócios que gerem em comum um serviço sem fins lucrativos (Lei 356).',
      },
    },
  },
  MUTUAL: {
    countryIso: 'BO',
    acronym: 'Mutual',
    translations: {
      es: {
        label: 'Mutual o entidad financiera de vivienda',
        description: 'Entidad de propiedad de sus asociados, sin accionistas externos, que presta servicios a sus miembros.',
      },
      en: {
        label: 'Mutual Society',
        description: 'Entity owned by its members, without outside shareholders, serving its members.',
      },
      pt: {
        label: 'Mútua',
        description: 'Entidade de propriedade de seus associados, sem acionistas externos, que presta serviços aos membros.',
      },
    },
  },
  EMPRESA_SOCIAL: {
    countryIso: 'BO',
    acronym: 'E.S.',
    translations: {
      es: {
        label: 'Empresa social',
        description: 'Empresa constituida por sus trabajadores para continuar la actividad de una empresa cerrada o en quiebra (Ley 1055).',
      },
      en: {
        label: 'Social Enterprise',
        description: 'Company formed by its workers to continue the activity of a closed or bankrupt company (Law 1055).',
      },
      pt: {
        label: 'Empresa Social',
        description: 'Empresa constituída por seus trabalhadores para continuar a atividade de uma empresa fechada ou falida (Lei 1055).',
      },
    },
  },
  ASOCIACION_CIVIL: {
    countryIso: 'BO',
    acronym: 'Asoc.',
    translations: {
      es: {
        label: 'Asociación civil sin fines de lucro',
        description: 'Personas reunidas con un fin común no lucrativo, con personalidad jurídica otorgada por el Estado.',
      },
      en: {
        label: 'Non-profit Civil Association',
        description: 'People joined for a common non-profit purpose, with legal personality granted by the State.',
      },
      pt: {
        label: 'Associação Civil sem Fins Lucrativos',
        description: 'Pessoas reunidas com um fim comum não lucrativo, com personalidade jurídica concedida pelo Estado.',
      },
    },
  },
  FUNDACION: {
    countryIso: 'BO',
    acronym: 'Fund.',
    translations: {
      es: {
        label: 'Fundación',
        description: 'Patrimonio destinado a un fin de interés general, sin fines de lucro, con personalidad jurídica.',
      },
      en: {
        label: 'Foundation',
        description: 'Assets devoted to a non-profit purpose of general interest, with legal personality.',
      },
      pt: {
        label: 'Fundação',
        description: 'Patrimônio destinado a um fim de interesse geral, sem fins lucrativos, com personalidade jurídica.',
      },
    },
  },
  ONG: {
    countryIso: 'BO',
    acronym: 'ONG',
    translations: {
      es: {
        label: 'Organización no gubernamental (ONG)',
        description: 'Entidad privada sin fines de lucro dedicada a la cooperación y el desarrollo, registrada ante el Estado.',
      },
      en: {
        label: 'Non-governmental Organization (NGO)',
        description: 'Private non-profit entity devoted to cooperation and development, registered with the State.',
      },
      pt: {
        label: 'Organização Não Governamental (ONG)',
        description: 'Entidade privada sem fins lucrativos dedicada à cooperação e ao desenvolvimento, registrada perante o Estado.',
      },
    },
  },
  ENTIDAD_RELIGIOSA: {
    countryIso: 'BO',
    acronym: 'E.R.',
    translations: {
      es: {
        label: 'Entidad religiosa o de creencias espirituales',
        description: 'Iglesia u organización religiosa con personalidad jurídica, que puede sostener obras de salud.',
      },
      en: {
        label: 'Religious Organization',
        description: 'Church or religious organization with legal personality, which may run health services.',
      },
      pt: {
        label: 'Entidade Religiosa',
        description: 'Igreja ou organização religiosa com personalidade jurídica, que pode manter obras de saúde.',
      },
    },
  },
  IFD: {
    countryIso: 'BO',
    acronym: 'IFD',
    translations: {
      es: {
        label: 'Institución Financiera de Desarrollo (IFD)',
        description: 'Entidad sin fines de lucro autorizada por la ASFI para prestar servicios financieros de desarrollo.',
      },
      en: {
        label: 'Development Finance Institution (IFD)',
        description: 'Non-profit entity authorized by ASFI to provide development financial services.',
      },
      pt: {
        label: 'Instituição Financeira de Desenvolvimento (IFD)',
        description: 'Entidade sem fins lucrativos autorizada pela ASFI a prestar serviços financeiros de desenvolvimento.',
      },
    },
  },
  ORGANIZACION_SOCIAL: {
    countryIso: 'BO',
    acronym: 'OTB',
    translations: {
      es: {
        label: 'Organización social o comunitaria (OTB, junta vecinal)',
        description: 'Organización territorial de base o comunitaria con personalidad jurídica, que a veces gestiona un puesto de salud.',
      },
      en: {
        label: 'Community Organization (OTB, neighborhood council)',
        description: 'Grassroots or community organization with legal personality, sometimes running a health post.',
      },
      pt: {
        label: 'Organização Social ou Comunitária (OTB)',
        description: 'Organização territorial de base ou comunitária com personalidade jurídica, que às vezes gere um posto de saúde.',
      },
    },
  },
  ENTIDAD_PUBLICA: {
    countryIso: 'BO',
    acronym: 'E.P.',
    translations: {
      es: {
        label: 'Entidad pública',
        description: 'Órgano o institución del Estado: ministerio, gobernación, municipio, universidad pública u hospital público.',
      },
      en: {
        label: 'Public Entity',
        description: 'State body or institution: ministry, department government, municipality, public university or hospital.',
      },
      pt: {
        label: 'Entidade Pública',
        description: 'Órgão ou instituição do Estado: ministério, governo departamental, município, universidade ou hospital público.',
      },
    },
  },
  EMPRESA_ESTATAL: {
    countryIso: 'BO',
    acronym: 'E.E.',
    translations: {
      es: {
        label: 'Empresa estatal',
        description: 'Empresa pública con el total de su patrimonio en manos del Estado (Ley 466 de la Empresa Pública).',
      },
      en: {
        label: 'State-owned Enterprise',
        description: 'Public company wholly owned by the State (Public Enterprise Law 466).',
      },
      pt: {
        label: 'Empresa Estatal',
        description: 'Empresa pública com todo o patrimônio nas mãos do Estado (Lei 466).',
      },
    },
  },
  EMPRESA_ESTATAL_MIXTA: {
    countryIso: 'BO',
    acronym: 'E.E.M.',
    translations: {
      es: {
        label: 'Empresa estatal mixta',
        description: 'Empresa pública con participación estatal de al menos el 70 % y aporte privado (Ley 466).',
      },
      en: {
        label: 'Mixed State-owned Enterprise',
        description: 'Public company with at least 70% State ownership plus private capital (Law 466).',
      },
      pt: {
        label: 'Empresa Estatal Mista',
        description: 'Empresa pública com participação estatal de pelo menos 70 % e aporte privado (Lei 466).',
      },
    },
  },
  EMPRESA_MIXTA: {
    countryIso: 'BO',
    acronym: 'E.M.',
    translations: {
      es: {
        label: 'Empresa mixta',
        description: 'Empresa pública con participación estatal mayoritaria, menor al 70 %, junto a capital privado (Ley 466).',
      },
      en: {
        label: 'Mixed Enterprise',
        description: 'Public company with majority State ownership below 70%, plus private capital (Law 466).',
      },
      pt: {
        label: 'Empresa Mista',
        description: 'Empresa pública com participação estatal majoritária, inferior a 70 %, junto a capital privado (Lei 466).',
      },
    },
  },
  EMPRESA_ESTATAL_INTERGUBERNAMENTAL: {
    countryIso: 'BO',
    acronym: 'E.E.I.',
    translations: {
      es: {
        label: 'Empresa estatal intergubernamental',
        description: 'Empresa pública cuyo patrimonio pertenece a más de un nivel de gobierno (Ley 466).',
      },
      en: {
        label: 'Intergovernmental State Enterprise',
        description: 'Public company owned by more than one level of government (Law 466).',
      },
      pt: {
        label: 'Empresa Estatal Intergovernamental',
        description: 'Empresa pública cujo patrimônio pertence a mais de um nível de governo (Lei 466).',
      },
    },
  },
  ORGANISMO_INTERNACIONAL: {
    countryIso: 'BO',
    acronym: 'O.I.',
    translations: {
      es: {
        label: 'Organismo internacional o de cooperación',
        description: 'Organismo internacional o agencia de cooperación que opera en Bolivia por convenio con el Estado.',
      },
      en: {
        label: 'International or Cooperation Agency',
        description: 'International body or cooperation agency operating in Bolivia under an agreement with the State.',
      },
      pt: {
        label: 'Organismo Internacional ou de Cooperação',
        description: 'Organismo internacional ou agência de cooperação que atua na Bolívia por convênio com o Estado.',
      },
    },
  },
};
