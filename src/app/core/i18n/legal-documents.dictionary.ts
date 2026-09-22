import type { UiLanguage } from './ui-language';

/* ============================================================================
    Diccionario trilingüe de documentos legales de afiliación (subtarea 1.2).

    El registro de procesos del stakeholder (módulo ASEGURADORA, y repetido
    igual en farmacia/laboratorio/imagenología) pide adjuntar en PDF la
    Constitución (1.1.2), el NIT (1.2.1), el SEPREC (1.3), la licencia de
    funcionamiento (1.4) y el certificado del SEDES (1.5). El catálogo real
    —los códigos de `vs_affiliation_document_type`/`vs_issuing_authority` y a
    qué rol canónico corresponden— vive en la API
    (`directory/affiliation-documents.ts`); ese lado nunca ve un nombre de
    institución, sólo códigos.

    Este archivo es la mitad que la API no tiene: el rótulo y la ayuda que ve
    la persona, por **rol canónico**, en los tres idiomas de la subtarea 1.1.
    Mismo patrón que `legal-entity-types.dictionary.ts`: el código es la
    identidad semántica estable, la etiqueta es metadato de presentación.

    Los VALORES que viajan al backend son los cinco `fileId` del bloque
    `legalDocuments` — este diccionario no inventa ningún identificador
    propio, sólo rotula.
    ========================================================================== */

/** Los seis roles canónicos que `tenant_affiliation_documents` puede representar. */
export const LEGAL_DOCUMENT_ROLES = [
  'CONSTITUTION_DOC',
  'TAX_IDENTIFIER_DOC',
  'COMMERCE_REGISTRY_DOC',
  'OPERATING_LICENSE_DOC',
  'HEALTH_AUTHORITY_CERT_DOC',
  // Reservado para el hito 1.4 (representante legal); el autorregistro de
  // organización de la subtarea 1.2 no lo pide.
  'POWER_OF_ATTORNEY_DOC',
] as const;

export type LegalDocumentRole = (typeof LEGAL_DOCUMENT_ROLES)[number];

/** Los cinco que el autorregistro de organización exige (1.1.2 · 1.2.1 · 1.3 · 1.4 · 1.5). */
export const REGISTRATION_LEGAL_DOCUMENT_ROLES: readonly Exclude<
  LegalDocumentRole,
  'POWER_OF_ATTORNEY_DOC'
>[] = [
  'CONSTITUTION_DOC',
  'TAX_IDENTIFIER_DOC',
  'COMMERCE_REGISTRY_DOC',
  'OPERATING_LICENSE_DOC',
  'HEALTH_AUTHORITY_CERT_DOC',
];

/** Los tres países con instituciones reales declaradas; el resto cae al rótulo genérico. */
export type LegalDocumentCountryIso = 'BO' | 'BR' | 'US';

/** Rótulo y ayuda de un documento, en un idioma. */
export interface LegalDocumentText {
  /** Nombre del documento tal como se ve sobre la zona de carga. */
  readonly label: string;
  /** Una línea de qué es o quién lo emite, para el texto de ayuda. */
  readonly hint: string;
}

/**
 * Una entrada del diccionario: el rótulo genérico (sin comprometerse a una
 * institución) y, cuando existe, el rótulo con el nombre real de la
 * institución de ese país.
 */
export interface LegalDocumentEntry {
  readonly generic: Readonly<Record<UiLanguage, LegalDocumentText>>;
  readonly byCountry: Readonly<Partial<Record<LegalDocumentCountryIso, Readonly<Record<UiLanguage, LegalDocumentText>>>>>;
}

/** El diccionario completo, indexado por rol canónico. */
export const LEGAL_DOCUMENTS_DICTIONARY: Readonly<Record<LegalDocumentRole, LegalDocumentEntry>> =
  {
    CONSTITUTION_DOC: {
      generic: {
        es: { label: 'Documento de constitución', hint: 'El acta con la que se constituyó la empresa.' },
        en: { label: 'Formation document', hint: 'The document that formally created the company.' },
        pt: { label: 'Documento de constituição', hint: 'O documento com o qual a empresa foi constituída.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Escritura de constitución', hint: 'La escritura pública, inscrita en SEPREC.' },
          en: { label: 'Deed of incorporation', hint: 'The notarized deed, registered with SEPREC.' },
          pt: { label: 'Escritura de constituição', hint: 'A escritura pública, registrada no SEPREC.' },
        },
        BR: {
          es: { label: 'Contrato social / Estatuto', hint: 'Registrado en la Junta Comercial.' },
          en: { label: 'Articles of association', hint: 'Registered with the Board of Trade (Junta Comercial).' },
          pt: { label: 'Contrato social / Estatuto', hint: 'Registrado na Junta Comercial.' },
        },
        US: {
          es: { label: 'Articles of Incorporation', hint: 'Presentados ante el estado de constitución.' },
          en: { label: 'Articles of Incorporation', hint: 'Filed with the state of incorporation.' },
          pt: { label: 'Articles of Incorporation', hint: 'Registrado no estado de constituição (EUA).' },
        },
      },
    },
    TAX_IDENTIFIER_DOC: {
      generic: {
        es: { label: 'Identificación tributaria', hint: 'El número con el que la empresa tributa.' },
        en: { label: 'Tax identification', hint: 'The number the company uses to pay taxes.' },
        pt: { label: 'Identificação tributária', hint: 'O número com o qual a empresa recolhe impostos.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Certificado de NIT', hint: 'El que emite el SIN (Servicio de Impuestos Nacionales).' },
          en: { label: 'Tax ID certificate (NIT)', hint: 'Issued by Bolivia’s national tax authority (SIN).' },
          pt: { label: 'Certificado de NIT', hint: 'Emitido pelo órgão tributário nacional da Bolívia (SIN).' },
        },
        BR: {
          es: { label: 'Cartão CNPJ', hint: 'El comprobante de inscripción en la Receita Federal.' },
          en: { label: 'CNPJ card', hint: 'The registration record with Receita Federal.' },
          pt: { label: 'Cartão CNPJ', hint: 'O comprovante de inscrição na Receita Federal.' },
        },
        US: {
          es: { label: 'EIN Confirmation Letter', hint: 'La carta que emite el IRS (formulario CP-575 o 147C).' },
          en: { label: 'EIN Confirmation Letter', hint: 'Issued by the IRS (CP-575 or 147C).' },
          pt: { label: 'EIN Confirmation Letter', hint: 'Emitida pelo IRS (formulário CP-575 ou 147C).' },
        },
      },
    },
    COMMERCE_REGISTRY_DOC: {
      generic: {
        es: { label: 'Registro mercantil', hint: 'La inscripción de la empresa en el registro de comercio.' },
        en: { label: 'Commercial registration', hint: 'The company’s registration with the commercial registry.' },
        pt: { label: 'Registro comercial', hint: 'A inscrição da empresa no registro de comércio.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Matrícula de comercio (SEPREC)', hint: 'La matrícula vigente ante el registro de comercio.' },
          en: { label: 'Commercial registry (SEPREC)', hint: 'Valid registration with Bolivia’s commercial registry.' },
          pt: { label: 'Matrícula comercial (SEPREC)', hint: 'A matrícula vigente no registro de comércio.' },
        },
        BR: {
          es: { label: 'Registro en la Junta Comercial (NIRE)', hint: 'La certidão simplificada estadual.' },
          en: { label: 'Board of Trade registration (NIRE)', hint: 'The state’s simplified certificate.' },
          pt: { label: 'Registro na Junta Comercial (NIRE)', hint: 'A certidão simplificada estadual.' },
        },
        US: {
          es: { label: 'Certificate of Good Standing', hint: 'Emitido por la Secretaría de Estado.' },
          en: { label: 'Certificate of Good Standing', hint: 'Issued by the Secretary of State.' },
          pt: { label: 'Certificate of Good Standing', hint: 'Emitido pela Secretaria de Estado (EUA).' },
        },
      },
    },
    OPERATING_LICENSE_DOC: {
      generic: {
        es: { label: 'Licencia de funcionamiento', hint: 'La autorización para operar en ese domicilio.' },
        en: { label: 'Operating license', hint: 'The authorization to operate at that address.' },
        pt: { label: 'Licença de funcionamento', hint: 'A autorização para operar naquele endereço.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Licencia de funcionamiento municipal', hint: 'La que emite tu gobierno municipal.' },
          en: { label: 'Municipal operating license', hint: 'Issued by the local municipal government.' },
          pt: { label: 'Licença municipal de funcionamento', hint: 'Emitida pelo governo municipal.' },
        },
        BR: {
          es: { label: 'Alvará de funcionamiento', hint: 'El de la prefectura municipal.' },
          en: { label: 'Alvará de Funcionamento', hint: 'Issued by the municipal prefecture.' },
          pt: { label: 'Alvará de Funcionamento', hint: 'Emitido pela prefeitura municipal.' },
        },
        US: {
          es: { label: 'Municipal Business License', hint: 'El permiso de la ciudad donde opera.' },
          en: { label: 'Municipal Business License', hint: 'The permit from the city where it operates.' },
          pt: { label: 'Municipal Business License', hint: 'A licença da cidade onde opera.' },
        },
      },
    },
    HEALTH_AUTHORITY_CERT_DOC: {
      generic: {
        es: { label: 'Certificado de la autoridad sanitaria', hint: 'El que habilita a operar en salud.' },
        en: { label: 'Health authority certificate', hint: 'The certificate that authorizes operating in health.' },
        pt: { label: 'Certificado da autoridade sanitária', hint: 'O que habilita a operar na área de saúde.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Certificado del SEDES', hint: 'El que emite el Servicio Departamental de Salud.' },
          en: { label: 'SEDES health certificate', hint: 'Issued by the regional health department (SEDES).' },
          pt: { label: 'Certificado do SEDES', hint: 'Emitido pelo departamento regional de saúde (SEDES).' },
        },
        BR: {
          es: { label: 'Licença Sanitária (Vigilância Sanitária)', hint: 'De la vigilancia sanitaria estadual o municipal.' },
          en: { label: 'Sanitary License (Vigilância Sanitária)', hint: 'From the state or municipal health surveillance office.' },
          pt: { label: 'Licença Sanitária (Vigilância Sanitária)', hint: 'Da vigilância sanitária estadual ou municipal.' },
        },
        US: {
          es: { label: 'State Health Authority Certificate', hint: 'El permiso del departamento de salud del estado.' },
          en: { label: 'State Health Authority Certificate', hint: 'The permit from the state health department.' },
          pt: { label: 'State Health Authority Certificate', hint: 'A licença do departamento estadual de saúde.' },
        },
      },
    },
    POWER_OF_ATTORNEY_DOC: {
      generic: {
        es: { label: 'Poder del representante legal', hint: 'El instrumento que acredita a quien representa a la empresa.' },
        en: { label: 'Power of attorney', hint: 'The instrument that accredits the company’s representative.' },
        pt: { label: 'Procuração do representante legal', hint: 'O instrumento que credencia quem representa a empresa.' },
      },
      byCountry: {
        BO: {
          es: { label: 'Poder del representante legal', hint: 'Otorgado ante notaría e inscrito en SEPREC.' },
          en: { label: 'Power of attorney', hint: 'Notarized and registered with SEPREC.' },
          pt: { label: 'Procuração do representante legal', hint: 'Lavrada em cartório e registrada no SEPREC.' },
        },
      },
    },
  };

/**
 * Rótulo y ayuda de un documento, para el país y el idioma dados.
 *
 * Un país sin instituciones declaradas —Argentina, México, o cualquiera
 * fuera de {@link LegalDocumentCountryIso}— cae al rótulo genérico: nombrar
 * una institución que nadie confirmó sería alucinar un dato que el value
 * set de la API tampoco declara (fuera de Bolivia, la autoridad emisora se
 * persiste como `OTRO`).
 *
 * @param role - Rol canónico del documento.
 * @param countryIso - País de constitución elegido en el formulario.
 * @param lang - Idioma activo de la interfaz.
 * @returns El rótulo y la ayuda a mostrar sobre la zona de carga.
 */
export function legalDocumentText(
  role: LegalDocumentRole,
  countryIso: string,
  lang: UiLanguage,
): LegalDocumentText {
  const entry = LEGAL_DOCUMENTS_DICTIONARY[role];
  const porPais = entry.byCountry[countryIso as LegalDocumentCountryIso];
  return (porPais ?? entry.generic)[lang];
}
