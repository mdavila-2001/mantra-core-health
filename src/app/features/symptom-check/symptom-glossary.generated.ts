// GENERADO por scripts/export-symptom-glossary.mjs (AlovidaAIService). No editar a mano.
/**
 * Síntoma del motor → su término del glosario médico oficial (CIE-10-ES, MedlinePlus, Wikidata), para
 * mostrarlo como «lo que entendimos». 99 de 153 síntomas tienen término; el resto
 * muestra el nombre del catálogo. Fuente: tabla de equivalencias revisada a mano.
 */
export interface TerminoDeSintoma {
  readonly slug: string;
  readonly name: string;
  readonly code?: string;
  readonly system?: string;
}

export const GLOSARIO_DE_SINTOMAS: Readonly<Record<string, TerminoDeSintoma>> = {
  "dolor-de-pecho": {
    "slug": "medlineplus-es-4745",
    "name": "Dolor de pecho",
    "code": "4745",
    "system": "medlineplus-es"
  },
  "falta-de-aire": {
    "slug": "cie10es-dx-r06-0",
    "name": "Disnea",
    "code": "R06.0",
    "system": "cie10es"
  },
  "perdida-de-conciencia": {
    "slug": "cie10es-dx-r40-2",
    "name": "Coma",
    "code": "R40.2",
    "system": "cie10es"
  },
  "debilidad-de-un-lado": {
    "slug": "wikidata-sintoma-q2291130",
    "name": "Hemiparesia",
    "code": "Q2291130",
    "system": "wikidata-sintoma"
  },
  "derrame-cerebral": {
    "slug": "medlineplus-es-2176",
    "name": "Accidente cerebrovascular",
    "code": "2176",
    "system": "medlineplus-es"
  },
  "infarto": {
    "slug": "medlineplus-es-1940",
    "name": "Ataque al corazón",
    "code": "1940",
    "system": "medlineplus-es"
  },
  "sangrado-abundante": {
    "slug": "medlineplus-es-6040",
    "name": "Hemorragia",
    "code": "6040",
    "system": "medlineplus-es"
  },
  "convulsion": {
    "slug": "cie10es-dx-r56-0",
    "name": "Convulsiones febriles",
    "code": "R56.0",
    "system": "cie10es"
  },
  "intoxicacion": {
    "slug": "medlineplus-es-2095",
    "name": "Envenenamiento",
    "code": "2095",
    "system": "medlineplus-es"
  },
  "fiebre": {
    "slug": "cie10es-dx-r56-0",
    "name": "Convulsiones febriles",
    "code": "R56.0",
    "system": "cie10es"
  },
  "resfrio": {
    "slug": "cie10es-dx-j00",
    "name": "Nasofaringitis aguda [resfriado común]",
    "code": "J00",
    "system": "cie10es"
  },
  "covid": {
    "slug": "cie10es-dx-u07-1",
    "name": "COVID-19",
    "code": "U07.1",
    "system": "cie10es"
  },
  "dengue": {
    "slug": "medlineplus-es-3105",
    "name": "Dengue",
    "code": "3105",
    "system": "medlineplus-es"
  },
  "cansancio": {
    "slug": "cie10es-dx-r53-1",
    "name": "Astenia",
    "code": "R53.1",
    "system": "cie10es"
  },
  "perdida-de-peso": {
    "slug": "cie10es-dx-r63-4",
    "name": "Pérdida anormal de peso",
    "code": "R63.4",
    "system": "cie10es"
  },
  "ganglios": {
    "slug": "cie10es-dx-i88",
    "name": "Linfadenitis inespecífica",
    "code": "I88",
    "system": "cie10es"
  },
  "sudoracion-nocturna": {
    "slug": "wikidata-sintoma-q474718",
    "name": "Sudoración nocturna",
    "code": "Q474718",
    "system": "wikidata-sintoma"
  },
  "anemia": {
    "slug": "cie10es-dx-d64-9",
    "name": "Anemia, no especificada",
    "code": "D64.9",
    "system": "cie10es"
  },
  "moretones": {
    "slug": "cie10es-dx-r23-3",
    "name": "Equimosis espontánea",
    "code": "R23.3",
    "system": "cie10es"
  },
  "dolor-de-cabeza": {
    "slug": "cie10es-dx-r51",
    "name": "Cefalea",
    "code": "R51",
    "system": "cie10es"
  },
  "mareo": {
    "slug": "cie10es-dx-r42",
    "name": "Mareo y desvanecimiento",
    "code": "R42",
    "system": "cie10es"
  },
  "hormigueo": {
    "slug": "cie10es-dx-r20-2",
    "name": "Parestesias",
    "code": "R20.2",
    "system": "cie10es"
  },
  "temblor": {
    "slug": "cie10es-dx-r25-1",
    "name": "Temblor no especificado",
    "code": "R25.1",
    "system": "cie10es"
  },
  "olvidos": {
    "slug": "wikidata-sintoma-q989365",
    "name": "Pérdida de memoria",
    "code": "Q989365",
    "system": "wikidata-sintoma"
  },
  "vision-borrosa": {
    "slug": "wikidata-sintoma-q4930803",
    "name": "Visión borrosa",
    "code": "Q4930803",
    "system": "wikidata-sintoma"
  },
  "ojo-irritado": {
    "slug": "cie10es-dx-h10",
    "name": "Conjuntivitis",
    "code": "H10",
    "system": "cie10es"
  },
  "dolor-de-garganta": {
    "slug": "cie10es-dx-r07-0",
    "name": "Dolor de garganta",
    "code": "R07.0",
    "system": "cie10es"
  },
  "dolor-de-oido": {
    "slug": "cie10es-dx-h92",
    "name": "Otalgia y secreción del oído",
    "code": "H92",
    "system": "cie10es"
  },
  "congestion-nasal": {
    "slug": "wikidata-sintoma-q3245488",
    "name": "Congestion nasal",
    "code": "Q3245488",
    "system": "wikidata-sintoma"
  },
  "sangrado-de-nariz": {
    "slug": "cie10es-dx-r04-0",
    "name": "Epistaxis",
    "code": "R04.0",
    "system": "cie10es"
  },
  "ronquera": {
    "slug": "cie10es-dx-r49-1",
    "name": "Afonía",
    "code": "R49.1",
    "system": "cie10es"
  },
  "ronquidos": {
    "slug": "cie10es-dx-g47-3",
    "name": "Apnea del sueño",
    "code": "G47.3",
    "system": "cie10es"
  },
  "dolor-de-mandibula": {
    "slug": "wikidata-sintoma-q12680516",
    "name": "Dolor de mandíbula",
    "code": "Q12680516",
    "system": "wikidata-sintoma"
  },
  "llagas-en-la-boca": {
    "slug": "cie10es-dx-k12-0",
    "name": "Aftas orales recidivantes",
    "code": "K12.0",
    "system": "cie10es"
  },
  "tos": {
    "slug": "medlineplus-es-1839",
    "name": "Tos",
    "code": "1839",
    "system": "medlineplus-es"
  },
  "asma": {
    "slug": "wikidata-sintoma-q517104",
    "name": "Sibilancia",
    "code": "Q517104",
    "system": "wikidata-sintoma"
  },
  "palpitaciones": {
    "slug": "cie10es-dx-r00-2",
    "name": "Palpitaciones",
    "code": "R00.2",
    "system": "cie10es"
  },
  "presion-alta": {
    "slug": "hipertension-arterial",
    "name": "Hipertensión arterial",
    "code": "I10",
    "system": "icd10cm"
  },
  "varices": {
    "slug": "cie10es-dx-i83-9",
    "name": "Venas varicosas asintomáticas de extremidades inferiores",
    "code": "I83.9",
    "system": "cie10es"
  },
  "dolor-de-panza": {
    "slug": "cie10es-dx-r10",
    "name": "Dolor abdominal y pélvico",
    "code": "R10",
    "system": "cie10es"
  },
  "diarrea": {
    "slug": "wikidata-sintoma-q21513416",
    "name": "Diarrea hemorrágica",
    "code": "Q21513416",
    "system": "wikidata-sintoma"
  },
  "estrenimiento": {
    "slug": "cie10es-dx-k59-0",
    "name": "Estreñimiento",
    "code": "K59.0",
    "system": "cie10es"
  },
  "nauseas": {
    "slug": "cie10es-dx-r11",
    "name": "Náusea y vómito",
    "code": "R11",
    "system": "cie10es"
  },
  "acidez": {
    "slug": "cie10es-dx-r12",
    "name": "Acidez",
    "code": "R12",
    "system": "cie10es"
  },
  "gases": {
    "slug": "cie10es-dx-r14-0",
    "name": "Distensión abdominal (por gases)",
    "code": "R14.0",
    "system": "cie10es"
  },
  "hemorroides": {
    "slug": "medlineplus-es-1948",
    "name": "Hemorroides",
    "code": "1948",
    "system": "medlineplus-es"
  },
  "sangre-en-las-heces": {
    "slug": "wikidata-sintoma-q1214063",
    "name": "Sangre en las heces",
    "code": "Q1214063",
    "system": "wikidata-sintoma"
  },
  "sangre-en-el-semen": {
    "slug": "cie10es-dx-r36-1",
    "name": "Hematospermia",
    "code": "R36.1",
    "system": "cie10es"
  },
  "dolor-muscular": {
    "slug": "cie10es-dx-m79-1",
    "name": "Mialgia",
    "code": "M79.1",
    "system": "cie10es"
  },
  "dolor-de-espalda": {
    "slug": "cie10es-dx-m54-3",
    "name": "Ciática",
    "code": "M54.3",
    "system": "cie10es"
  },
  "dolor-de-cuello": {
    "slug": "cie10es-dx-m54-2",
    "name": "Cervicalgia",
    "code": "M54.2",
    "system": "cie10es"
  },
  "dolor-de-rodilla": {
    "slug": "wikidata-sintoma-q6421876",
    "name": "Dolor de rodilla",
    "code": "Q6421876",
    "system": "wikidata-sintoma"
  },
  "dolor-articular": {
    "slug": "cie10es-dx-m25-5",
    "name": "Dolor en articulación",
    "code": "M25.5",
    "system": "cie10es"
  },
  "erupcion": {
    "slug": "cie10es-dx-r21",
    "name": "Exantema y otras erupciones cutáneas inespecíficas",
    "code": "R21",
    "system": "cie10es"
  },
  "acne": {
    "slug": "cie10es-dx-l70",
    "name": "Acné",
    "code": "L70",
    "system": "cie10es"
  },
  "hongos": {
    "slug": "cie10es-dx-b35",
    "name": "Dermatofitosis",
    "code": "B35",
    "system": "cie10es"
  },
  "caida-de-pelo": {
    "slug": "medlineplus-es-5283",
    "name": "Pérdida de cabello",
    "code": "5283",
    "system": "medlineplus-es"
  },
  "lunar-que-cambio": {
    "slug": "medlineplus-es-4492",
    "name": "Lunares",
    "code": "4492",
    "system": "medlineplus-es"
  },
  "ansiedad": {
    "slug": "cie10es-dx-f40",
    "name": "Trastornos de ansiedad fóbica",
    "code": "F40",
    "system": "cie10es"
  },
  "tristeza": {
    "slug": "cie10es-dx-f32",
    "name": "Episodio depresivo",
    "code": "F32",
    "system": "cie10es"
  },
  "insomnio": {
    "slug": "cie10es-dx-f51-0",
    "name": "Insomnio no debido a sustancia ni afección fisiológica conocida",
    "code": "F51.0",
    "system": "cie10es"
  },
  "duelo": {
    "slug": "medlineplus-es-1770",
    "name": "Pérdida de un ser querido",
    "code": "1770",
    "system": "medlineplus-es"
  },
  "trastorno-alimentario": {
    "slug": "medlineplus-es-1877",
    "name": "Trastornos de la alimentación",
    "code": "1877",
    "system": "medlineplus-es"
  },
  "azucar-alta": {
    "slug": "diabetes-mellitus-tipo-2",
    "name": "Diabetes mellitus tipo 2",
    "code": "E11.9",
    "system": "icd10cm"
  },
  "tiroides": {
    "slug": "medlineplus-es-2196",
    "name": "Enfermedades de la tiroides",
    "code": "2196",
    "system": "medlineplus-es"
  },
  "colesterol": {
    "slug": "medlineplus-es-1819",
    "name": "Colesterol",
    "code": "1819",
    "system": "medlineplus-es"
  },
  "ardor-al-orinar": {
    "slug": "cie10es-dx-r30-0",
    "name": "Disuria",
    "code": "R30.0",
    "system": "cie10es"
  },
  "sangre-en-la-orina": {
    "slug": "cie10es-dx-n02",
    "name": "Hematuria recurrente y persistente",
    "code": "N02",
    "system": "cie10es"
  },
  "colico-renal": {
    "slug": "cie10es-dx-n23",
    "name": "Cólico renal no especificado",
    "code": "N23",
    "system": "cie10es"
  },
  "prostata": {
    "slug": "cie10es-dx-n41",
    "name": "Enfermedades inflamatorias de próstata",
    "code": "N41",
    "system": "cie10es"
  },
  "problemas-de-ereccion": {
    "slug": "medlineplus-es-1972",
    "name": "Disfunción eréctil",
    "code": "1972",
    "system": "medlineplus-es"
  },
  "dolor-menstrual": {
    "slug": "medlineplus-es-6416",
    "name": "Dolor menstrual",
    "code": "6416",
    "system": "medlineplus-es"
  },
  "atraso-menstrual": {
    "slug": "cie10es-dx-n91-2",
    "name": "Amenorrea, no especificada",
    "code": "N91.2",
    "system": "cie10es"
  },
  "flujo-vaginal": {
    "slug": "medlineplus-es-6418",
    "name": "Vaginitis",
    "code": "6418",
    "system": "medlineplus-es"
  },
  "menopausia": {
    "slug": "medlineplus-es-2032",
    "name": "Menopausia",
    "code": "2032",
    "system": "medlineplus-es"
  },
  "dolor-al-tener-relaciones": {
    "slug": "cie10es-dx-n94-1",
    "name": "Dispareunia",
    "code": "N94.1",
    "system": "cie10es"
  },
  "infeccion-de-transmision-sexual": {
    "slug": "medlineplus-es-2144",
    "name": "Infecciones de transmisión sexual",
    "code": "2144",
    "system": "medlineplus-es"
  },
  "vesicula": {
    "slug": "medlineplus-es-4644",
    "name": "Cálculos biliares",
    "code": "4644",
    "system": "medlineplus-es"
  },
  "apendicitis": {
    "slug": "cie10es-dx-k37",
    "name": "Apendicitis no especificada",
    "code": "K37",
    "system": "cie10es"
  },
  "hernia": {
    "slug": "medlineplus-es-1952",
    "name": "Hernia",
    "code": "1952",
    "system": "medlineplus-es"
  },
  "hipo": {
    "slug": "cie10es-dx-r06-6",
    "name": "Hipo",
    "code": "R06.6",
    "system": "cie10es"
  },
  "mal-aliento": {
    "slug": "cie10es-dx-r19-6",
    "name": "Halitosis",
    "code": "R19.6",
    "system": "cie10es"
  },
  "boca-seca": {
    "slug": "medlineplus-es-5799",
    "name": "Boca seca",
    "code": "5799",
    "system": "medlineplus-es"
  },
  "falta-de-apetito": {
    "slug": "cie10es-dx-r63-0",
    "name": "Anorexia",
    "code": "R63.0",
    "system": "cie10es"
  },
  "quemadura": {
    "slug": "medlineplus-es-1791",
    "name": "Quemaduras",
    "code": "1791",
    "system": "medlineplus-es"
  },
  "herida-o-corte": {
    "slug": "medlineplus-es-3859",
    "name": "Heridas y lesiones",
    "code": "3859",
    "system": "medlineplus-es"
  },
  "ictericia": {
    "slug": "ictericia",
    "name": "Ictericia",
    "code": "GLOSSARY_ICTERICIA",
    "system": "glossary-curated-es"
  },
  "presion-baja": {
    "slug": "cie10es-dx-i95",
    "name": "Hipotensión",
    "code": "I95",
    "system": "cie10es"
  },
  "azucar-baja": {
    "slug": "cie10es-dx-e16-2",
    "name": "Hipoglucemia, no especificada",
    "code": "E16.2",
    "system": "cie10es"
  },
  "somnolencia": {
    "slug": "cie10es-dx-r40-0",
    "name": "Somnolencia",
    "code": "R40.0",
    "system": "cie10es"
  },
  "malaria": {
    "slug": "medlineplus-es-2019",
    "name": "Malaria",
    "code": "2019",
    "system": "medlineplus-es"
  },
  "chagas": {
    "slug": "cie10es-dx-b57",
    "name": "Enfermedad de Chagas",
    "code": "B57",
    "system": "cie10es"
  },
  "leishmaniasis": {
    "slug": "cie10es-dx-b55",
    "name": "Leishmaniasis",
    "code": "B55",
    "system": "cie10es"
  },
  "tuberculosis": {
    "slug": "medlineplus-es-2206",
    "name": "Tuberculosis",
    "code": "2206",
    "system": "medlineplus-es"
  },
  "tifoidea": {
    "slug": "cie10es-dx-a01-0",
    "name": "Fiebre tifoidea",
    "code": "A01.0",
    "system": "cie10es"
  },
  "cancer": {
    "slug": "medlineplus-es-1794",
    "name": "Cáncer",
    "code": "1794",
    "system": "medlineplus-es"
  },
  "enfermedad-renal": {
    "slug": "enfermedad-renal-cronica",
    "name": "Enfermedad renal crónica",
    "code": "N18.9",
    "system": "icd10cm"
  },
  "fimosis": {
    "slug": "cie10es-dx-n47-1",
    "name": "Fimosis",
    "code": "N47.1",
    "system": "cie10es"
  },
  "alergia": {
    "slug": "medlineplus-es-1734",
    "name": "Alergia",
    "code": "1734",
    "system": "medlineplus-es"
  }
};
