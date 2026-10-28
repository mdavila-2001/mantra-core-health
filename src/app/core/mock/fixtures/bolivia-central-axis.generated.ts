/* ============================================================================
    El corpus «Bolivia Salud · Eje Central», portado al simulador.

    **GENERADO por `scripts/gen-bolivia-corpus-fixture.mjs`. No editar a mano.**
    La fuente son los 45 JSON de
    `data/bolivia-salud-eje-central/`, con su procedencia —fuente, URL y fecha
    de verificación— tal como la declara cada registro.

    Corte del corpus: 2026-09-13. Alcance: La Paz, El Alto,
    Cochabamba y Santa Cruz de la Sierra.

    10 laboratorios y centros · 5 cadenas de farmacia ·
    71 sucursales · 1035 pruebas en 27 categorías ·
    9 paneles · 252 relaciones establecimiento↔prueba ·
    28 fuentes citadas.

    ## Lo que este archivo NO trae, y por qué

    · **Códigos LOINC y SNOMED.** El corpus los declara `null` en las 1035
      pruebas porque no los verificó una por una, y fabricarlos está prohibido.
      El campo se descarta entero: uno siempre nulo no informa.

    · **Precios.** El corpus no publica ninguno. Los que muestra la maqueta los
      calcula el manejador, y son maqueta declarada — no salen de acá.

    · **Qué prueba hace cada laboratorio, salvo uno.** Sólo `lab_plexus`
      publicó su catálogo (252 relaciones verificadas). Para el resto, el
      corpus declara `services`, y de ahí sale la oferta — derivada y marcada
      como tal, nunca presentada como catálogo verificado.

    ## Las coordenadas son una capa derivada

    El corpus declara «coordenadas» entre sus `criterios_no_inventar` y no
    publica ninguna. `lat`/`lng` salen de Nominatim (OpenStreetMap) y cada
    sucursal dice con qué precisión se resolvió:

      · `via` — 28
      · `ciudad` — 20
      · `direccion` — 17
      · `zona` — 6

    `ciudad` significa que Nominatim no reconoció la dirección y el punto es
    el centro de la ciudad. Las pantallas lo dicen en vez de fingir precisión.

    Regenerar con `yarn mock:bolivia`.
    ========================================================================== */

/** Cómo se resolvió el punto de una sucursal. Ver la cabecera. */
export type PrecisionDeUbicacion = 'direccion' | 'via' | 'zona' | 'ciudad';

/** Una fuente citada por el corpus. */
export interface FuenteDelCorpus {
  readonly id: string;
  readonly organization: string;
  readonly kind: string;
  readonly url: string;
  readonly use: string;
  readonly verifiedAt: string;
}

/** Un laboratorio o centro de diagnóstico. */
export interface EstablecimientoDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly cities: readonly string[];
  readonly services: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Una cadena de farmacias. No tiene `services`: el corpus no los declara. */
export interface CadenaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly cities: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Una sucursal, de laboratorio o de farmacia. */
export interface SucursalDelCorpus {
  readonly id: string;
  readonly parentId: string;
  readonly name: string;
  /** Sólo lo declaran las sucursales de laboratorio. */
  readonly kind: string | null;
  readonly addressText: string | null;
  readonly zone: string | null;
  readonly city: string;
  readonly department: string;
  readonly phone: string | null;
  readonly openingHours: string | null;
  readonly verificationState: string;
  readonly sourceIds: readonly string[];
  readonly lat: number;
  readonly lng: number;
  readonly locationPrecision: PrecisionDeUbicacion;
}

/** Una prueba médica normalizada, o un panel. */
export interface PruebaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly synonyms: readonly string[];
  readonly kind: 'TEST' | 'PANEL';
  readonly categoryId: string;
  readonly target: string | null;
  readonly specimens: readonly string[];
  readonly methods: readonly string[];
  readonly units: string | null;
  readonly patientPreparation: string | null;
  /** `true` sólo si una fuente boliviana lo acredita. Ver `availabilityEvidenceIds`. */
  readonly availableInBolivia: boolean;
  readonly availabilityEvidenceIds: readonly string[];
  readonly reviewedAt: string;
}

/** Una de las 27 categorías del catálogo. */
export interface CategoriaDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/** Un panel o perfil, con las pruebas que lo componen. */
export interface PanelDelCorpus {
  readonly id: string;
  readonly name: string;
  readonly componentIds: readonly string[];
  readonly componentNames: readonly string[];
  readonly sourceIds: readonly string[];
}

/** Que un establecimiento ofrece una prueba, con el estado de la evidencia. */
export interface RelacionDelCorpus {
  readonly establishmentId: string;
  readonly testId: string;
  readonly state: string;
  readonly sourceId: string;
}

/**
 * Lo que el corpus declara igual para las 1035 pruebas.
 *
 * No es relleno: es lo que el corpus decidió **no** particularizar, porque
 * depende del laboratorio ejecutor y afirmarlo por prueba sería inventar.
 */
export const TEXTO_COMUN_DE_PRUEBA = {
  clinicalUse: "Diagnóstico, tamizaje, seguimiento o estratificación según contexto clínico; consultar guía específica y laboratorio ejecutor.",
  resultType: "cualitativo_cuantitativo_o_semicuantitativo_segun_metodo",
  preanalytical: "Depende de muestra y método. Confirmar instrucciones del laboratorio ejecutor; no extrapolar condiciones entre plataformas.",
} as const;

/** La procedencia del paquete, para mostrarla al pie de las pantallas. */
export const CORPUS_META = {
  package: "bolivia_salud_eje_central",
  schemaVersion: "1.0.0",
  cutoffDate: "2026-09-13",
  sourceHierarchy: ["reguladores/SEDES","instituciones públicas/universitarias","sitios oficiales de cadenas/centros","directorios/mapas como evidencia complementaria"],
  neverInvented: ["coordenadas","habilitación legal","códigos terminológicos","horarios/teléfonos no publicados","rangos de referencia universales"],
} as const;

export const FUENTES_DEL_CORPUS: readonly FuenteDelCorpus[] = [
  {
    "id": "src_agemed",
    "organization": "AGEMED Bolivia",
    "kind": "regulador",
    "url": "https://apiwww.agemed.gob.bo/api/listautcom/empresas",
    "use": "Registro/listados de farmacias legalmente establecidas y establecimientos farmacéuticos",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_sedes_lp",
    "organization": "SEDES La Paz",
    "kind": "regulador_departamental",
    "url": "https://www.sedeslapaz.gob.bo/wp-content/uploads/2022/11/sistema-SIHACOES-28092022.pdf",
    "use": "Establecimientos autorizados/habilitados; documento histórico consultado",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_sedes_cbba_lab",
    "organization": "SEDES Cochabamba",
    "kind": "regulador_departamental",
    "url": "https://www.sedescochabamba.gob.bo/laboratorio.php",
    "use": "Requisitos y regulación de laboratorios",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_sedes_cbba_farm",
    "organization": "SEDES Cochabamba",
    "kind": "regulador_departamental",
    "url": "https://www.sedescochabamba.gob.bo/farmacia.php",
    "use": "Requisitos y regulación de farmacias",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_plexus_tests",
    "organization": "Plexus Laboratorio Clínico y Molecular",
    "kind": "sitio_oficial",
    "url": "https://plexuslaboratorio.com/pruebas-de-laboratorio/",
    "use": "Catálogo de pruebas, preparación y biología molecular",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_plexus_lp",
    "organization": "Plexus Laboratorio Clínico y Molecular",
    "kind": "sitio_oficial",
    "url": "https://plexuslaboratorio.com/laboratorios-en-la-paz/",
    "use": "Sucursales La Paz/El Alto",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_plexus_sc",
    "organization": "Plexus Laboratorio Clínico y Molecular",
    "kind": "sitio_oficial",
    "url": "https://plexuslaboratorio.com/laboratorios-santa-cruz/",
    "use": "Sucursales Santa Cruz",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_zuna_tests",
    "organization": "DR+ZUNA",
    "kind": "sitio_oficial",
    "url": "https://www.labzuna.com.bo/catalogo-de-pruebas/",
    "use": "Catálogo de pruebas",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_zuna_red",
    "organization": "DR+ZUNA",
    "kind": "sitio_oficial",
    "url": "https://www.labzuna.com.bo/red-de-laboratorios/",
    "use": "Red de laboratorios y direcciones",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_zuna_calidad",
    "organization": "DR+ZUNA",
    "kind": "sitio_oficial",
    "url": "https://www.labzuna.com.bo/gestion-de-calidad/",
    "use": "Gestión y control externo de calidad",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_seladis",
    "organization": "SELADIS - UMSA",
    "kind": "institucional",
    "url": "https://seladis.umsa.bo/",
    "use": "Áreas de diagnóstico especializado y contacto",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_inlasa",
    "organization": "INLASA",
    "kind": "institucional",
    "url": "https://inlasa.gob.bo/",
    "use": "Centro nacional de referencia y servicios",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_cenetrop",
    "organization": "CENETROP",
    "kind": "institucional",
    "url": "https://www.cenetrop.org.bo/",
    "use": "Medicina tropical y laboratorio de referencia",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_magnus",
    "organization": "Laboratorio Magnus",
    "kind": "sitio_oficial",
    "url": "https://laboratoriomagnus.com/sucursales.php",
    "use": "Sucursales Cochabamba",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_universo",
    "organization": "Laboratorio Universo",
    "kind": "sitio_oficial",
    "url": "https://www.labuniverso.com/",
    "use": "Servicios y sede Cochabamba",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_praxis",
    "organization": "Laboratorio Praxis",
    "kind": "sitio_oficial",
    "url": "https://laboratoriopraxis.com/",
    "use": "Servicios y sede Cochabamba",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_labclinics",
    "organization": "LabClinics SRL",
    "kind": "sitio_oficial",
    "url": "https://lab-clinics.com/",
    "use": "Sede La Paz",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_farmacorp",
    "organization": "Farmacorp",
    "kind": "sitio_oficial",
    "url": "https://farmacorp.com/pages/sucursales-farmacorp",
    "use": "Directorio actual de sucursales (interfaz dinámica)",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_farmacorp_hist",
    "organization": "Farmacorp",
    "kind": "sitio_oficial_historico",
    "url": "https://farmacorp.com/pages/bases-de-la-promocion-momentos-dorados",
    "use": "Direcciones publicadas en bases promocionales; usar como línea base histórica, no como prueba de vigencia 2026",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_hipermaxi",
    "organization": "Hipermaxi",
    "kind": "sitio_oficial",
    "url": "https://informacion.hipermaxi.com/",
    "use": "Presencia nacional y número de farmacias",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_hipermaxi_hist",
    "organization": "Hipermaxi",
    "kind": "documento_corporativo_historico",
    "url": "https://informacion.hipermaxi.com/wp-content/uploads/2023/01/2%C2%B0-PROYECTO-DE-PROMOCION-SET-PARILLERO-AJ-.1.pdf",
    "use": "Ejemplos de farmacias/sucursales y direcciones históricas",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_farmacias_bolivia",
    "organization": "Farmacias Bolivia",
    "kind": "sitio_oficial",
    "url": "https://www.farmaciasbolivia.com.bo/",
    "use": "Cadena; sitio observado en mantenimiento durante investigación",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_chavez",
    "organization": "Farmacias Chávez",
    "kind": "sitio_oficial",
    "url": "https://www.farmaciaschavez.com.bo/",
    "use": "Cadena y comercio electrónico",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_loinc",
    "organization": "Regenstrief Institute - LOINC",
    "kind": "terminologia",
    "url": "https://loinc.org/",
    "use": "Estándar de identificación de observaciones/pruebas. No se asignan códigos sin verificación puntual.",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_snomed",
    "organization": "SNOMED International",
    "kind": "terminologia",
    "url": "https://www.snomed.org/",
    "use": "Terminología clínica. No se asignan códigos sin verificación puntual.",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_clsi",
    "organization": "Clinical and Laboratory Standards Institute",
    "kind": "estandar",
    "url": "https://clsi.org/",
    "use": "Buenas prácticas y estándares de laboratorio",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_cdc",
    "organization": "CDC",
    "kind": "referencia_clinica",
    "url": "https://www.cdc.gov/laboratory/",
    "use": "Referencia para pruebas de laboratorio e infecciosas",
    "verifiedAt": "2026-09-13"
  },
  {
    "id": "src_who",
    "organization": "World Health Organization",
    "kind": "referencia_clinica",
    "url": "https://www.who.int/health-topics/laboratory-quality-management",
    "use": "Gestión de calidad y diagnóstico",
    "verifiedAt": "2026-09-13"
  }
];

export const ESTABLECIMIENTOS_DEL_CORPUS: readonly EstablecimientoDelCorpus[] = [
  {
    "id": "lab_plexus",
    "name": "Plexus Laboratorio Clínico y Molecular",
    "kind": "laboratorio_clinico_molecular",
    "description": "Red privada boliviana de laboratorio clínico y molecular con pruebas rutinarias y especializadas, biología molecular, inmunología, alergología, microbiología y servicio a domicilio.",
    "cities": [
      "La Paz",
      "El Alto",
      "Santa Cruz de la Sierra"
    ],
    "services": [
      "laboratorio clínico",
      "biología molecular",
      "microbiología",
      "inmunología",
      "alergología",
      "toma a domicilio",
      "resultados en línea"
    ],
    "sourceIds": [
      "src_plexus_tests",
      "src_plexus_lp",
      "src_plexus_sc"
    ]
  },
  {
    "id": "lab_zuna",
    "name": "DR+ZUNA",
    "kind": "laboratorio_clinico",
    "description": "Red privada de laboratorios en Santa Cruz con toma de muestras, catálogo amplio de pruebas, automatización y participación en esquemas externos de control de calidad.",
    "cities": [
      "Santa Cruz de la Sierra"
    ],
    "services": [
      "laboratorio clínico",
      "toma pediátrica",
      "toma ginecológica",
      "pruebas especializadas"
    ],
    "sourceIds": [
      "src_zuna_tests",
      "src_zuna_red",
      "src_zuna_calidad"
    ]
  },
  {
    "id": "lab_seladis",
    "name": "SELADIS - UMSA",
    "kind": "laboratorio_universitario_referencia",
    "description": "Servicio universitario especializado con áreas de genética molecular, endocrinología y biomarcadores, histocompatibilidad e inmunogenética, hematología, citología, bioquímica clínica, inmunología, bacteriología, micología, virología y parasitología.",
    "cities": [
      "La Paz"
    ],
    "services": [
      "genética molecular",
      "inmunogenética",
      "hematología",
      "bioquímica clínica",
      "microbiología",
      "virología",
      "parasitología",
      "citología"
    ],
    "sourceIds": [
      "src_seladis"
    ]
  },
  {
    "id": "lab_inlasa",
    "name": "INLASA",
    "kind": "laboratorio_nacional_referencia",
    "description": "Instituto Nacional de Laboratorios de Salud con funciones de referencia, vigilancia y servicios especializados.",
    "cities": [
      "La Paz"
    ],
    "services": [
      "referencia nacional",
      "salud pública",
      "diagnóstico especializado"
    ],
    "sourceIds": [
      "src_inlasa"
    ]
  },
  {
    "id": "lab_cenetrop",
    "name": "CENETROP",
    "kind": "centro_referencia_medicina_tropical",
    "description": "Centro nacional de medicina tropical con actividades clínicas, de laboratorio, epidemiológicas, investigación, enseñanza y evaluación externa de calidad.",
    "cities": [
      "Santa Cruz de la Sierra"
    ],
    "services": [
      "medicina tropical",
      "diagnóstico",
      "referencia",
      "investigación"
    ],
    "sourceIds": [
      "src_cenetrop"
    ]
  },
  {
    "id": "lab_magnus",
    "name": "Laboratorio Magnus",
    "kind": "laboratorio_clinico",
    "description": "Laboratorio clínico privado de Cochabamba con sedes publicadas y toma de muestra a domicilio.",
    "cities": [
      "Cochabamba"
    ],
    "services": [
      "laboratorio clínico",
      "toma a domicilio"
    ],
    "sourceIds": [
      "src_magnus"
    ]
  },
  {
    "id": "lab_universo",
    "name": "Laboratorio Universo",
    "kind": "laboratorio_clinico",
    "description": "Laboratorio clínico privado con química sanguínea, marcadores tumorales, micología, extracción a domicilio y atención de emergencias.",
    "cities": [
      "Cochabamba"
    ],
    "services": [
      "química clínica",
      "marcadores tumorales",
      "micología",
      "toma a domicilio"
    ],
    "sourceIds": [
      "src_universo"
    ]
  },
  {
    "id": "lab_praxis",
    "name": "Laboratorio Praxis",
    "kind": "laboratorio_clinico_especializado",
    "description": "Laboratorio privado con servicios de citometría de flujo, biología molecular y plataformas sindrómicas, además de laboratorio clínico.",
    "cities": [
      "Cochabamba",
      "La Paz"
    ],
    "services": [
      "laboratorio clínico",
      "citometría de flujo",
      "biología molecular",
      "paneles sindrómicos"
    ],
    "sourceIds": [
      "src_praxis"
    ]
  },
  {
    "id": "lab_labclinics",
    "name": "LabClinics SRL",
    "kind": "laboratorio_clinico",
    "description": "Laboratorio clínico privado con sede central publicada en La Paz.",
    "cities": [
      "La Paz"
    ],
    "services": [
      "laboratorio clínico"
    ],
    "sourceIds": [
      "src_labclinics"
    ]
  },
  {
    "id": "lab_hsjdd",
    "name": "Hospital San Juan de Dios - Laboratorio",
    "kind": "laboratorio_hospitalario_publico",
    "description": "Laboratorio de diagnóstico de establecimiento hospitalario público de Santa Cruz de la Sierra.",
    "cities": [
      "Santa Cruz de la Sierra"
    ],
    "services": [
      "laboratorio hospitalario"
    ],
    "sourceIds": []
  }
];

export const CADENAS_DEL_CORPUS: readonly CadenaDelCorpus[] = [
  {
    "id": "farm_farmacorp",
    "name": "Farmacorp",
    "kind": "cadena_farmacias",
    "description": "Cadena nacional de farmacias y retail de salud con presencia en el eje central.",
    "cities": [
      "La Paz",
      "El Alto",
      "Cochabamba",
      "Santa Cruz de la Sierra"
    ],
    "sourceIds": [
      "src_farmacorp",
      "src_farmacorp_hist",
      "src_agemed"
    ]
  },
  {
    "id": "farm_hipermaxi",
    "name": "Hipermaxi Farmacias",
    "kind": "cadena_farmacias",
    "description": "Red de farmacias vinculada a Hipermaxi; la empresa declara 37 farmacias en Bolivia.",
    "cities": [
      "La Paz",
      "El Alto",
      "Cochabamba",
      "Santa Cruz de la Sierra"
    ],
    "sourceIds": [
      "src_hipermaxi",
      "src_hipermaxi_hist",
      "src_agemed"
    ]
  },
  {
    "id": "farm_bolivia",
    "name": "Farmacias Bolivia",
    "kind": "cadena_farmacias",
    "description": "Cadena boliviana de farmacias con presencia en La Paz y otras ciudades; durante la investigación el sitio corporativo estuvo en mantenimiento.",
    "cities": [
      "La Paz"
    ],
    "sourceIds": [
      "src_farmacias_bolivia",
      "src_agemed"
    ]
  },
  {
    "id": "farm_chavez",
    "name": "Farmacias Chávez",
    "kind": "cadena_farmacias",
    "description": "Cadena boliviana con plataforma de comercio electrónico y selector de sucursales.",
    "cities": [
      "La Paz",
      "Santa Cruz de la Sierra"
    ],
    "sourceIds": [
      "src_chavez",
      "src_agemed"
    ]
  },
  {
    "id": "farm_economica",
    "name": "Farmacias Económica / registros homónimos",
    "kind": "farmacia_cadena_o_nombre_comercial_pendiente_reconciliacion",
    "description": "Registros encontrados en directorios públicos; requiere reconciliar razón social y habilitación individual con AGEMED/SEDES antes de tratarlo como una única cadena.",
    "cities": [
      "Santa Cruz de la Sierra",
      "Cochabamba"
    ],
    "sourceIds": [
      "src_agemed"
    ]
  }
];

export const SUCURSALES_DEL_CORPUS: readonly SucursalDelCorpus[] = [
  {
    "id": "suc_plexus_sc_equipetrol",
    "parentId": "lab_plexus",
    "name": "Equipetrol",
    "kind": "laboratorio",
    "addressText": "Av. Marcelo Terceros Bánzer #24, 3er anillo externo, barrio Sirari",
    "zone": "Equipetrol/Sirari",
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": "Todos los días 07:00-23:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_sc"
    ],
    "lat": -17.760262,
    "lng": -63.199583,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_plexus_sc_centro",
    "parentId": "lab_plexus",
    "name": "Centro",
    "kind": "laboratorio",
    "addressText": "Calle Buenos Aires esquina España",
    "zone": "Centro",
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_sc"
    ],
    "lat": -17.782922,
    "lng": -63.18197,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_plexus_sc_area_medica",
    "parentId": "lab_plexus",
    "name": "Área Médica",
    "kind": "laboratorio",
    "addressText": "Calle Franz Tamayo #11",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_sc"
    ],
    "lat": -17.766834,
    "lng": -63.189257,
    "locationPrecision": "direccion"
  },
  {
    "id": "suc_zuna_central",
    "parentId": "lab_zuna",
    "name": "Central",
    "kind": "laboratorio",
    "addressText": "Av. Alemana Nº 2065",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": "3 441838",
    "openingHours": "24 horas, todos los días",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_zuna_red"
    ],
    "lat": -17.744357,
    "lng": -63.161087,
    "locationPrecision": "via"
  },
  {
    "id": "suc_zuna_obrero",
    "parentId": "lab_zuna",
    "name": "Hospital Obrero",
    "kind": "laboratorio",
    "addressText": "Av. Japón Nº 3809",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": "3 436089",
    "openingHours": "06:30-19:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_zuna_red"
    ],
    "lat": -17.77199,
    "lng": -63.154568,
    "locationPrecision": "direccion"
  },
  {
    "id": "suc_zuna_frances",
    "parentId": "lab_zuna",
    "name": "Hospital Francés",
    "kind": "laboratorio",
    "addressText": "Calle Tiluchi Nº 10",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": "3 599361",
    "openingHours": "06:30-18:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_zuna_red"
    ],
    "lat": -17.749196,
    "lng": -63.192041,
    "locationPrecision": "direccion"
  },
  {
    "id": "suc_zuna_centro",
    "parentId": "lab_zuna",
    "name": "Centro",
    "kind": "laboratorio",
    "addressText": "Calle 21 de Mayo Nº 464",
    "zone": "Centro",
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": "67706115",
    "openingHours": "Lun-Vie 07:00-18:00; Sáb 07:00-12:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_zuna_red"
    ],
    "lat": -17.775015,
    "lng": -63.184645,
    "locationPrecision": "direccion"
  },
  {
    "id": "suc_cenetrop_sc",
    "parentId": "lab_cenetrop",
    "name": "CENETROP",
    "kind": "centro_referencia",
    "addressText": null,
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "presencia_institucional_verificada; direccion_no_confirmada_en_fuente_recuperada",
    "sourceIds": [
      "src_cenetrop"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "suc_hsjdd_sc",
    "parentId": "lab_hsjdd",
    "name": "Hospital San Juan de Dios - Laboratorio",
    "kind": "laboratorio_hospitalario",
    "addressText": "Calle Cuéllar #474",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "ubicacion_institucional_referencia; verificar_operacion_especifica",
    "sourceIds": [],
    "lat": -17.778996,
    "lng": -63.184154,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_026",
    "parentId": "farm_farmacorp",
    "name": "21 de Mayo",
    "kind": null,
    "addressText": "Calle Junín esq. 21 de Mayo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_027",
    "parentId": "farm_farmacorp",
    "name": "Piraí",
    "kind": null,
    "addressText": "Av. Piraí esq. 2do Anillo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.796539,
    "lng": -63.211951,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_028",
    "parentId": "farm_farmacorp",
    "name": "Cañoto FSM",
    "kind": null,
    "addressText": "Av. Cañoto esq. México",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_029",
    "parentId": "farm_farmacorp",
    "name": "Irala",
    "kind": null,
    "addressText": "Av. Irala #564",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.793143,
    "lng": -63.186325,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_030",
    "parentId": "farm_farmacorp",
    "name": "Cañoto FG",
    "kind": null,
    "addressText": "Av. Cañoto esq. Alameda Junín",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_031",
    "parentId": "farm_farmacorp",
    "name": "Argomosa",
    "kind": null,
    "addressText": "Av. Argomosa #100 esq. Charcas",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_032",
    "parentId": "farm_farmacorp",
    "name": "Trinidad",
    "kind": null,
    "addressText": "Av. Trinidad #710 esq. 2do Anillo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.770485,
    "lng": -63.171517,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_033",
    "parentId": "farm_farmacorp",
    "name": "Villa 1º de Mayo",
    "kind": null,
    "addressText": "Av. Principal esq. Calle 8 Este, Villa 1º de Mayo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.803877,
    "lng": -63.112848,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_034",
    "parentId": "farm_farmacorp",
    "name": "Torres Gemelas",
    "kind": null,
    "addressText": "Av. Cristo Redentor entre 2do y 3er Anillo, Edificio Torres Gemelas",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.743403,
    "lng": -63.172776,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_035",
    "parentId": "farm_farmacorp",
    "name": "Grigotá",
    "kind": null,
    "addressText": "Av. Grigotá #500 esq. Av. B. Barrientos",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_hipermaxi_004",
    "parentId": "farm_hipermaxi",
    "name": "Norte",
    "kind": null,
    "addressText": "Av. Cristo Redentor y 3er Anillo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.783422,
    "lng": -63.182085,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_hipermaxi_005",
    "parentId": "farm_hipermaxi",
    "name": "Florida",
    "kind": null,
    "addressText": "Calle Florida N°187",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.791453,
    "lng": -63.118934,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_hipermaxi_006",
    "parentId": "farm_hipermaxi",
    "name": "Cañoto",
    "kind": null,
    "addressText": "Av. Cañoto esq. Rafael Peña, Casco Viejo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.782657,
    "lng": -63.183681,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_hipermaxi_007",
    "parentId": "farm_hipermaxi",
    "name": "Equipetrol",
    "kind": null,
    "addressText": "Av. San Martín, 4to Anillo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.753463,
    "lng": -63.196479,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_hipermaxi_008",
    "parentId": "farm_hipermaxi",
    "name": "Beni",
    "kind": null,
    "addressText": "Av. Beni, 4to Anillo",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.770212,
    "lng": -63.178891,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_hipermaxi_009",
    "parentId": "farm_hipermaxi",
    "name": "Plan 3000",
    "kind": null,
    "addressText": "Av. Paurito, Barrio Los Álamos",
    "zone": null,
    "city": "Santa Cruz de la Sierra",
    "department": "Santa Cruz",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.822803,
    "lng": -63.144695,
    "locationPrecision": "via"
  },
  {
    "id": "suc_plexus_lp_centro",
    "parentId": "lab_plexus",
    "name": "Centro 24 horas",
    "kind": "laboratorio",
    "addressText": "Av. 6 de Agosto #2882, Edificio Cosmopolitan, planta baja",
    "zone": "Centro/Sopocachi",
    "city": "La Paz",
    "department": "La Paz",
    "phone": "61007763",
    "openingHours": "24 horas, todos los días",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_lp"
    ],
    "lat": -16.507659,
    "lng": -68.127319,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_plexus_lp_calacoto",
    "parentId": "lab_plexus",
    "name": "Calacoto",
    "kind": "laboratorio",
    "addressText": "Calle 15 #8054, Edificio Plaza 15, piso 2, oficina G",
    "zone": "Calacoto",
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": "Lun-Vie 07:30-19:00; Sáb 07:30-12:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_lp"
    ],
    "lat": -16.515086,
    "lng": -68.091578,
    "locationPrecision": "via"
  },
  {
    "id": "suc_plexus_lp_obrajes",
    "parentId": "lab_plexus",
    "name": "Obrajes",
    "kind": "laboratorio",
    "addressText": "Calle 9 con Av. Hernando Siles #5411",
    "zone": "Obrajes",
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": "Lun-Vie 07:30-19:00; Sáb 07:30-12:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_lp"
    ],
    "lat": -16.52719,
    "lng": -68.10837,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_plexus_el_alto",
    "parentId": "lab_plexus",
    "name": "El Alto",
    "kind": "laboratorio",
    "addressText": "Ciudad Satélite, Av. del Policía #25, frente a Cinebol",
    "zone": "Ciudad Satélite",
    "city": "El Alto",
    "department": "La Paz",
    "phone": null,
    "openingHours": "Lun-Vie 07:30-15:00; Sáb 07:30-12:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_lp"
    ],
    "lat": -16.524777,
    "lng": -68.151411,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_plexus_lp_miraflores",
    "parentId": "lab_plexus",
    "name": "Miraflores",
    "kind": "laboratorio",
    "addressText": "Calle Claudio Sanjinés #1587 esq. Francisco de Miranda",
    "zone": "Miraflores",
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": "Lun-Vie 07:30-19:00; Sáb 07:30-12:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_plexus_lp"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "suc_seladis_lp",
    "parentId": "lab_seladis",
    "name": "SELADIS",
    "kind": "laboratorio_referencia",
    "addressText": "Av. Villazón Nº 1995, Plaza del Bicentenario",
    "zone": "Centro",
    "city": "La Paz",
    "department": "La Paz",
    "phone": "2222435",
    "openingHours": null,
    "verificationState": "verificado_sitio_institucional_2026",
    "sourceIds": [
      "src_seladis"
    ],
    "lat": -16.502422,
    "lng": -68.129784,
    "locationPrecision": "zona"
  },
  {
    "id": "suc_inlasa_lp",
    "parentId": "lab_inlasa",
    "name": "INLASA",
    "kind": "laboratorio_referencia",
    "addressText": "Rafael Zubieta Nº 1889",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": "2226048 / 2225196",
    "openingHours": null,
    "verificationState": "direccion_fuente_secundaria_institucional; contacto_oficial",
    "sourceIds": [
      "src_inlasa",
      "src_zuna_calidad"
    ],
    "lat": -16.50861,
    "lng": -68.118744,
    "locationPrecision": "via"
  },
  {
    "id": "suc_labclinics_lp",
    "parentId": "lab_labclinics",
    "name": "Laboratorio Central",
    "kind": "laboratorio",
    "addressText": "Calle Campos Nº 334 esquina Av. 6 de Agosto",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": "2 2430846",
    "openingHours": null,
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_labclinics"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_001",
    "parentId": "farm_farmacorp",
    "name": "San Miguel",
    "kind": null,
    "addressText": "21 de Mayo esq. Patiño No. 1488, San Miguel",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_002",
    "parentId": "farm_farmacorp",
    "name": "Prado",
    "kind": null,
    "addressText": "Av. 16 de Julio No. 1804, El Prado",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.501936,
    "lng": -68.132378,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_003",
    "parentId": "farm_farmacorp",
    "name": "Avaroa",
    "kind": null,
    "addressText": "Calle Pedro Salazar No. 497",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.508777,
    "lng": -68.123825,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_004",
    "parentId": "farm_farmacorp",
    "name": "Achumani I",
    "kind": null,
    "addressText": "Av. García Lanza, Achumani",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.533758,
    "lng": -68.074588,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_005",
    "parentId": "farm_farmacorp",
    "name": "Los Pinos",
    "kind": null,
    "addressText": "Calle 21, Calacoto, Los Pinos",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.539276,
    "lng": -68.077956,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_006",
    "parentId": "farm_farmacorp",
    "name": "Satélite",
    "kind": null,
    "addressText": "Ciudad Satélite",
    "zone": null,
    "city": "El Alto",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.524777,
    "lng": -68.151411,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_007",
    "parentId": "farm_farmacorp",
    "name": "Arce",
    "kind": null,
    "addressText": "Av. Arce No. 2809",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.51458,
    "lng": -68.119876,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_008",
    "parentId": "farm_farmacorp",
    "name": "Obrajes",
    "kind": null,
    "addressText": "Av. Hernando Siles No. 5204, Obrajes",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.527076,
    "lng": -68.106528,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_009",
    "parentId": "farm_farmacorp",
    "name": "Cota Cota I",
    "kind": null,
    "addressText": "Av. Juan Muñoz Reyes No. 500 esq. calle 28, Zona Cota Cota",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.540289,
    "lng": -68.06979,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_010",
    "parentId": "farm_farmacorp",
    "name": "Saavedra",
    "kind": null,
    "addressText": "Av. Saavedra Nº 625 esq. Villalobos, Miraflores",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_011",
    "parentId": "farm_farmacorp",
    "name": "Achumani II",
    "kind": null,
    "addressText": "Av. The Strongest Nº 197, Urb. PB, Edif. La Pequeña Villa",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.524235,
    "lng": -68.067253,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_012",
    "parentId": "farm_farmacorp",
    "name": "Río Seco Teleférico",
    "kind": null,
    "addressText": "Zona Río Seco Ex Tranca, Estación Mi Teleférico Río Seco",
    "zone": null,
    "city": "El Alto",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.504823,
    "lng": -68.162434,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_013",
    "parentId": "farm_farmacorp",
    "name": "Shopping Norte",
    "kind": null,
    "addressText": "Calle Potosí esq. Socabaya, Edificio Shopping Norte",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_014",
    "parentId": "farm_farmacorp",
    "name": "Torres del Poeta",
    "kind": null,
    "addressText": "Av. Arce, Plaza Isabel La Católica, Edificio Torres del Poeta",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.505827,
    "lng": -68.129103,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_015",
    "parentId": "farm_farmacorp",
    "name": "Flor de Loto",
    "kind": null,
    "addressText": "Av. Ballivián Nº 514, Calacoto",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.58218,
    "lng": -68.23889,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_016",
    "parentId": "farm_farmacorp",
    "name": "Cielo Mall",
    "kind": null,
    "addressText": "Av. Satélite N° 200, Ed. Cielo Mall",
    "zone": null,
    "city": "El Alto",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.522388,
    "lng": -68.154992,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_017",
    "parentId": "farm_farmacorp",
    "name": "Achumani III",
    "kind": null,
    "addressText": "Calle 16 N° 416, Achumani",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.530627,
    "lng": -68.073367,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_farmacorp_018",
    "parentId": "farm_farmacorp",
    "name": "Plaza Venezuela",
    "kind": null,
    "addressText": "Av. 16 de Julio esq. Colombia N° 1408",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_019",
    "parentId": "farm_farmacorp",
    "name": "Av. Busch",
    "kind": null,
    "addressText": "Av. Busch esq. Panamá N° 1508",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_020",
    "parentId": "farm_farmacorp",
    "name": "Los Pinos II",
    "kind": null,
    "addressText": "Av. José Aguirre Acha N°27 esq. Calle 5",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_021",
    "parentId": "farm_farmacorp",
    "name": "Proxi Sopocachi",
    "kind": null,
    "addressText": "Av. Guachalla, Edificio Tiffany, Sopocachi",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -16.513404,
    "lng": -68.12894,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_map_001",
    "parentId": "farm_bolivia",
    "name": "A. Mendoza",
    "kind": null,
    "addressText": "GV46+QH3, La Paz",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": "+591 2 2453015",
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_map_002",
    "parentId": "farm_bolivia",
    "name": "Isabel la Católica",
    "kind": null,
    "addressText": "Av. Arce, La Paz",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": "+591 2 2616207",
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.508127,
    "lng": -68.125823,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_map_003",
    "parentId": "farm_bolivia",
    "name": "Yungas",
    "kind": null,
    "addressText": "Yungas 876",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": "+591 2 2200260",
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.497445,
    "lng": -68.128707,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_map_004",
    "parentId": "farm_chavez",
    "name": "Hernando Siles",
    "kind": null,
    "addressText": "Av. Hernando Siles 642",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.558535,
    "lng": -68.225386,
    "locationPrecision": "direccion"
  },
  {
    "id": "farm_suc_map_005",
    "parentId": "farm_chavez",
    "name": "Av. Busch",
    "kind": null,
    "addressText": "Torre C&C II, Av. Busch 1924",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.501943,
    "lng": -68.121241,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_map_006",
    "parentId": "farm_chavez",
    "name": "Pedro Salazar",
    "kind": null,
    "addressText": "Av. 20 de Octubre esq. Pedro Salazar 2497",
    "zone": null,
    "city": "La Paz",
    "department": "La Paz",
    "phone": null,
    "openingHours": null,
    "verificationState": "registro_publico_de_mapa/directorio; requiere_reconciliacion_agemed",
    "sourceIds": [
      "src_agemed"
    ],
    "lat": -16.495545,
    "lng": -68.133623,
    "locationPrecision": "ciudad"
  },
  {
    "id": "suc_magnus_central",
    "parentId": "lab_magnus",
    "name": "Central",
    "kind": "laboratorio",
    "addressText": "Av. Oquendo entre Heroínas y Colombia, Edificio Romero PB, oficina A",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": "63999980",
    "openingHours": "Lun-Vie 07:00-21:00; fines de semana 07:00-19:00",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_magnus"
    ],
    "lat": -17.390358,
    "lng": -66.150079,
    "locationPrecision": "via"
  },
  {
    "id": "suc_magnus_suecia",
    "parentId": "lab_magnus",
    "name": "Sucursal Av. Suecia",
    "kind": "laboratorio",
    "addressText": "Av. Suecia, referencia Biblioteca Avión",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": "63999980",
    "openingHours": null,
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_magnus"
    ],
    "lat": -17.419833,
    "lng": -66.142773,
    "locationPrecision": "via"
  },
  {
    "id": "suc_universo_cbba",
    "parentId": "lab_universo",
    "name": "Laboratorio Universo",
    "kind": "laboratorio",
    "addressText": "Av. Libertador Bolívar Nº 1708",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": "Emergencias 24 horas (servicio publicado)",
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_universo"
    ],
    "lat": -17.373912,
    "lng": -66.162297,
    "locationPrecision": "via"
  },
  {
    "id": "suc_praxis_cbba",
    "parentId": "lab_praxis",
    "name": "Central Cochabamba",
    "kind": "laboratorio",
    "addressText": "Av. Ramón Rivero Nº 330, Edificio Caprice, planta baja",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": "62224224 / 70793117",
    "openingHours": null,
    "verificationState": "verificado_sitio_oficial_2026",
    "sourceIds": [
      "src_praxis"
    ],
    "lat": -17.379457,
    "lng": -66.143927,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_022",
    "parentId": "farm_farmacorp",
    "name": "San Martín",
    "kind": null,
    "addressText": "Av. San Martín esq. Sucre",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.401246,
    "lng": -66.167568,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_023",
    "parentId": "farm_farmacorp",
    "name": "América",
    "kind": null,
    "addressText": "Av. América esq. Pando",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.401246,
    "lng": -66.167568,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_farmacorp_024",
    "parentId": "farm_farmacorp",
    "name": "Aranjuez",
    "kind": null,
    "addressText": "Av. América Nro. 488, Mall Aranjuez",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.373297,
    "lng": -66.155121,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_farmacorp_025",
    "parentId": "farm_farmacorp",
    "name": "Ecológica",
    "kind": null,
    "addressText": "Av. Ecológica Nro. 350, Zona Chilimarca",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "linea_base_historica_corporativa; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_farmacorp_hist"
    ],
    "lat": -17.324245,
    "lng": -66.208377,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_hipermaxi_001",
    "parentId": "farm_hipermaxi",
    "name": "Juan de la Rosa",
    "kind": null,
    "addressText": "Av. Juan de la Rosa y Gabriel René Moreno N°207033",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.401246,
    "lng": -66.167568,
    "locationPrecision": "ciudad"
  },
  {
    "id": "farm_suc_hipermaxi_002",
    "parentId": "farm_hipermaxi",
    "name": "Sacaba-CBBA",
    "kind": null,
    "addressText": "Av. Chapare esq. Villazón",
    "zone": null,
    "city": "Sacaba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.388289,
    "lng": -66.096024,
    "locationPrecision": "via"
  },
  {
    "id": "farm_suc_hipermaxi_003",
    "parentId": "farm_hipermaxi",
    "name": "Circunvalación CBBA",
    "kind": null,
    "addressText": "Av. Circunvalación entre Hernán Siles y Uzeda",
    "zone": null,
    "city": "Cochabamba",
    "department": "Cochabamba",
    "phone": null,
    "openingHours": null,
    "verificationState": "documento_corporativo_historico; vigencia_2026_no_inferida",
    "sourceIds": [
      "src_hipermaxi_hist"
    ],
    "lat": -17.346837,
    "lng": -66.194464,
    "locationPrecision": "via"
  }
];

export const CATEGORIAS_DEL_CORPUS: readonly CategoriaDelCorpus[] = [
  {
    "id": "hematologia",
    "name": "Hematología",
    "count": 37
  },
  {
    "id": "coagulacion_hemostasia",
    "name": "Coagulación y hemostasia",
    "count": 40
  },
  {
    "id": "quimica_clinica",
    "name": "Química clínica",
    "count": 98
  },
  {
    "id": "endocrinologia",
    "name": "Endocrinología",
    "count": 63
  },
  {
    "id": "inmunologia_autoinmunidad",
    "name": "Inmunología y autoinmunidad",
    "count": 62
  },
  {
    "id": "alergologia",
    "name": "Alergología",
    "count": 128
  },
  {
    "id": "serologia_infecciosas",
    "name": "Serología de infecciosas",
    "count": 76
  },
  {
    "id": "microbiologia_bacteriologia",
    "name": "Microbiología y bacteriología",
    "count": 34
  },
  {
    "id": "micologia",
    "name": "Micología",
    "count": 13
  },
  {
    "id": "parasitologia",
    "name": "Parasitología",
    "count": 20
  },
  {
    "id": "virologia",
    "name": "Virología",
    "count": 23
  },
  {
    "id": "biologia_molecular",
    "name": "Biología molecular",
    "count": 50
  },
  {
    "id": "genetica_citogenetica_genomica",
    "name": "Genética, citogenética y genómica",
    "count": 34
  },
  {
    "id": "oncologia_marcadores",
    "name": "Oncología y marcadores tumorales",
    "count": 27
  },
  {
    "id": "toxicologia_drogas",
    "name": "Toxicología y drogas",
    "count": 32
  },
  {
    "id": "monitoreo_terapeutico",
    "name": "Monitoreo terapéutico de fármacos",
    "count": 25
  },
  {
    "id": "uroanalisis",
    "name": "Uroanálisis",
    "count": 40
  },
  {
    "id": "heces_coproparasitologia",
    "name": "Heces y coproparasitología",
    "count": 19
  },
  {
    "id": "liquidos_biologicos",
    "name": "Líquidos biológicos",
    "count": 23
  },
  {
    "id": "fertilidad_andrologia",
    "name": "Fertilidad y andrología",
    "count": 21
  },
  {
    "id": "embarazo_prenatal",
    "name": "Embarazo y control prenatal",
    "count": 25
  },
  {
    "id": "inmunohematologia_banco_sangre",
    "name": "Inmunohematología y banco de sangre",
    "count": 21
  },
  {
    "id": "trasplantes_hla",
    "name": "Trasplantes y HLA",
    "count": 18
  },
  {
    "id": "anatomia_patologica_citologia",
    "name": "Anatomía patológica y citología",
    "count": 25
  },
  {
    "id": "metabolismo_neonatal",
    "name": "Metabolismo neonatal",
    "count": 30
  },
  {
    "id": "nutricion_vitaminas_oligoelementos",
    "name": "Nutrición, vitaminas y oligoelementos",
    "count": 26
  },
  {
    "id": "ocupacional_otros",
    "name": "Salud ocupacional y otros",
    "count": 25
  }
];

export const PRUEBAS_DEL_CORPUS: readonly PruebaDelCorpus[] = [
  {
    "id": "test_000001",
    "name": "Hemograma completo (biometría hemática)",
    "synonyms": [
      "CBC",
      "biometría hemática"
    ],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000002",
    "name": "Hemoglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": "g/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000003",
    "name": "Hematocrito",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": "%",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000004",
    "name": "Recuento de eritrocitos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000005",
    "name": "Recuento de leucocitos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000006",
    "name": "Fórmula leucocitaria automatizada",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000007",
    "name": "Fórmula leucocitaria manual",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000008",
    "name": "Recuento absoluto de neutrófilos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000009",
    "name": "Recuento absoluto de linfocitos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000010",
    "name": "Recuento absoluto de eosinófilos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000011",
    "name": "Recuento absoluto de basófilos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000012",
    "name": "Recuento de plaquetas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": "10^9/L",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000013",
    "name": "Volumen plaquetario medio (VPM)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000014",
    "name": "Recuento de reticulocitos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000015",
    "name": "Reticulocitos inmaduros (IRF)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000016",
    "name": "Índice de producción reticulocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000017",
    "name": "Velocidad de eritrosedimentación (VSG/VES)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000018",
    "name": "Frotis de sangre periférica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000019",
    "name": "Morfología eritrocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000020",
    "name": "Morfología leucocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000021",
    "name": "Morfología plaquetaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000022",
    "name": "Hemoglobina fetal (HbF)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000023",
    "name": "Electroforesis de hemoglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000024",
    "name": "Hemoglobina A2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000025",
    "name": "Detección de hemoglobina S",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000026",
    "name": "Fragilidad osmótica eritrocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000027",
    "name": "Glucosa-6-fosfato deshidrogenasa (G6PD)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000028",
    "name": "Hemosiderina urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000029",
    "name": "Haptoglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000030",
    "name": "Eritropoyetina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000031",
    "name": "Aspirado de médula ósea - estudio morfológico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000032",
    "name": "Biopsia de médula ósea - estudio histológico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000033",
    "name": "Citometría de flujo para leucemias/linfomas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000034",
    "name": "Inmunofenotipo de poblaciones linfocitarias",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000035",
    "name": "CD4 absoluto y porcentaje",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000036",
    "name": "CD8 absoluto y porcentaje",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000037",
    "name": "Relación CD4/CD8",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "hematologia",
    "target": null,
    "specimens": [
      "sangre total EDTA"
    ],
    "methods": [
      "analizador hematológico",
      "microscopía cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000038",
    "name": "Tiempo de protrombina (TP)",
    "synonyms": [
      "PT",
      "TP"
    ],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000039",
    "name": "INR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000040",
    "name": "Tiempo de tromboplastina parcial activada (TTPa/APTT)",
    "synonyms": [
      "aPTT",
      "TTPa",
      "APTT"
    ],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000041",
    "name": "Tiempo de trombina (TT)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000042",
    "name": "Tiempo de reptilasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000043",
    "name": "Fibrinógeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000044",
    "name": "Dímero D",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000045",
    "name": "Tiempo de sangría",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000046",
    "name": "Tiempo de coagulación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000047",
    "name": "Anti-Xa para heparina no fraccionada",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000048",
    "name": "Anti-Xa para heparina de bajo peso molecular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000049",
    "name": "Actividad de factor II",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000050",
    "name": "Actividad de factor V",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000051",
    "name": "Actividad de factor VII",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000052",
    "name": "Actividad de factor VIII",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000053",
    "name": "Actividad de factor IX",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000054",
    "name": "Actividad de factor X",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000055",
    "name": "Actividad de factor XI",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000056",
    "name": "Actividad de factor XII",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000057",
    "name": "Actividad de factor XIII",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000058",
    "name": "Inhibidor de factor VIII",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000059",
    "name": "Mezcla 1:1 de TTPa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000060",
    "name": "Mezcla 1:1 de TP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000061",
    "name": "Anticoagulante lúpico - tamizaje",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000062",
    "name": "Anticoagulante lúpico - confirmación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000063",
    "name": "DRVVT",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000064",
    "name": "Proteína C funcional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000065",
    "name": "Proteína S libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000066",
    "name": "Proteína S funcional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000067",
    "name": "Antitrombina III",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000068",
    "name": "Resistencia a proteína C activada",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000069",
    "name": "Factor V Leiden",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000070",
    "name": "Mutación de protrombina G20210A",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000071",
    "name": "Tiempo de oclusión plaquetaria PFA-100/PFA-200",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000072",
    "name": "Agregometría plaquetaria con ADP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000073",
    "name": "Agregometría plaquetaria con colágeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000074",
    "name": "Agregometría plaquetaria con ristocetina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000075",
    "name": "Factor von Willebrand antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000076",
    "name": "Factor von Willebrand actividad",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000077",
    "name": "Multímeros de von Willebrand",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "coagulacion_hemostasia",
    "target": null,
    "specimens": [
      "plasma citratado"
    ],
    "methods": [
      "coagulometría",
      "método funcional/inmunológico según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000078",
    "name": "Glucosa basal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mg/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000079",
    "name": "Glucosa 30 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000080",
    "name": "Glucosa 60 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000081",
    "name": "Glucosa 90 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000082",
    "name": "Glucosa 120 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000083",
    "name": "Glucosa 150 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000084",
    "name": "Glucosa 180 minutos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000085",
    "name": "Prueba oral de tolerancia a la glucosa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000086",
    "name": "Hemoglobina glicosilada (HbA1c)",
    "synonyms": [
      "HbA1c",
      "A1c"
    ],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "%",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000087",
    "name": "Fructosamina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000088",
    "name": "Urea",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000089",
    "name": "Nitrógeno ureico (BUN/NUS)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000090",
    "name": "Creatinina sérica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mg/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000091",
    "name": "Cistatina C",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000092",
    "name": "Ácido úrico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mg/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000093",
    "name": "Sodio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mmol/L",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000094",
    "name": "Potasio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mmol/L",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000095",
    "name": "Cloro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mmol/L",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000096",
    "name": "Bicarbonato/CO2 total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000097",
    "name": "Osmolalidad sérica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000098",
    "name": "Calcio total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mg/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000099",
    "name": "Calcio iónico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000100",
    "name": "Fósforo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000101",
    "name": "Magnesio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "mg/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000102",
    "name": "Hierro sérico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000103",
    "name": "Capacidad total de fijación del hierro (TIBC)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000104",
    "name": "Capacidad no saturada de fijación del hierro (UIBC)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000105",
    "name": "Saturación de transferrina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000106",
    "name": "Transferrina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000107",
    "name": "Ferritina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": "ng/mL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000108",
    "name": "Proteínas totales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000109",
    "name": "Albúmina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000110",
    "name": "Globulinas calculadas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000111",
    "name": "Relación albúmina/globulina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000112",
    "name": "Electroforesis de proteínas séricas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000113",
    "name": "Inmunofijación sérica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000114",
    "name": "Cadenas ligeras libres kappa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000115",
    "name": "Cadenas ligeras libres lambda",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000116",
    "name": "Relación kappa/lambda",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000117",
    "name": "Bilirrubina total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000118",
    "name": "Bilirrubina directa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000119",
    "name": "Bilirrubina indirecta",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000120",
    "name": "AST/TGO",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000121",
    "name": "ALT/TGP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000122",
    "name": "Fosfatasa alcalina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000123",
    "name": "GGT",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000124",
    "name": "5'-nucleotidasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000125",
    "name": "LDH total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000126",
    "name": "LDH isoenzimas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000127",
    "name": "Amilasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000128",
    "name": "Lipasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000129",
    "name": "Colinesterasa sérica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000130",
    "name": "Amonio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000131",
    "name": "Lactato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000132",
    "name": "Piruvato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000133",
    "name": "CK total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000134",
    "name": "CK-MB masa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000135",
    "name": "CK-MB actividad",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000136",
    "name": "Troponina I",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000137",
    "name": "Troponina T",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000138",
    "name": "Troponina I ultrasensible",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000139",
    "name": "Troponina T ultrasensible",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000140",
    "name": "Mioglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000141",
    "name": "BNP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000142",
    "name": "NT-proBNP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000143",
    "name": "Colesterol total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000144",
    "name": "HDL colesterol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000145",
    "name": "LDL colesterol directo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000146",
    "name": "LDL colesterol calculado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000147",
    "name": "VLDL colesterol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000148",
    "name": "Triglicéridos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000149",
    "name": "Apolipoproteína A1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000150",
    "name": "Apolipoproteína B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000151",
    "name": "Lipoproteína(a)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000152",
    "name": "PCR ultrasensible cardiovascular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000153",
    "name": "Homocisteína",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000154",
    "name": "Ácidos biliares totales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000155",
    "name": "Ceruloplasmina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000156",
    "name": "Alfa-1-antitripsina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000157",
    "name": "Aldolasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000158",
    "name": "Glutamato deshidrogenasa (GLDH)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000159",
    "name": "Fosfatasa ácida total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000160",
    "name": "Fosfatasa ácida prostática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000161",
    "name": "Fosfatasa alcalina ósea",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000162",
    "name": "Osteocalcina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000163",
    "name": "Beta-2 microglobulina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000164",
    "name": "Gasometría arterial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000165",
    "name": "Gasometría venosa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000166",
    "name": "pH sanguíneo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000167",
    "name": "pCO2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000168",
    "name": "pO2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000169",
    "name": "Bicarbonato calculado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000170",
    "name": "Exceso de base",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000171",
    "name": "Carboxihemoglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000172",
    "name": "Metahemoglobina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000173",
    "name": "Lactato en gasometría",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000174",
    "name": "Anión gap",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000175",
    "name": "Osmolar gap",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "quimica_clinica",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "espectrofotometría/enzimático/inmunoensayo según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000176",
    "name": "TSH ultrasensible",
    "synonyms": [
      "TSH",
      "TSHus"
    ],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": "µUI/mL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000177",
    "name": "T4 libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": "ng/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000178",
    "name": "T4 total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000179",
    "name": "T3 libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000180",
    "name": "T3 total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": "ng/dL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000181",
    "name": "Tiroglobulina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000182",
    "name": "Anticuerpo anti-tiroglobulina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000183",
    "name": "Anticuerpo anti-peroxidasa tiroidea (anti-TPO)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000184",
    "name": "Anticuerpo anti-receptor de TSH (TRAb)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000185",
    "name": "Calcitonina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000186",
    "name": "Parathormona intacta (PTH)",
    "synonyms": [
      "PTH",
      "PTHi"
    ],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000187",
    "name": "25-OH vitamina D",
    "synonyms": [
      "25(OH)D",
      "vitamina D total"
    ],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": "ng/mL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000188",
    "name": "1,25-(OH)2 vitamina D",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000189",
    "name": "Cortisol sérico AM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000190",
    "name": "Cortisol sérico PM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000191",
    "name": "Cortisol libre urinario 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000192",
    "name": "Cortisol salival nocturno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000193",
    "name": "ACTH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000194",
    "name": "DHEA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000195",
    "name": "DHEA-S",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000196",
    "name": "Aldosterona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000197",
    "name": "Renina directa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000198",
    "name": "Actividad de renina plasmática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000199",
    "name": "Relación aldosterona/renina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000200",
    "name": "Metanefrina plasmática libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000201",
    "name": "Normetanefrina plasmática libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000202",
    "name": "Metanefrinas urinarias fraccionadas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000203",
    "name": "Catecolaminas plasmáticas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000204",
    "name": "Catecolaminas urinarias",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000205",
    "name": "Ácido vainillilmandélico (VMA/AVM)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000206",
    "name": "5-HIAA urinario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000207",
    "name": "Hormona de crecimiento (GH)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000208",
    "name": "IGF-1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000209",
    "name": "IGFBP-3",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000210",
    "name": "Prolactina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000211",
    "name": "Macroprolactina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000212",
    "name": "FSH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000213",
    "name": "LH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000214",
    "name": "Estradiol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000215",
    "name": "Estrona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000216",
    "name": "Progesterona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000217",
    "name": "17-hidroxiprogesterona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000218",
    "name": "Testosterona total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000219",
    "name": "Testosterona libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000220",
    "name": "Testosterona biodisponible",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000221",
    "name": "SHBG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000222",
    "name": "Índice de andrógenos libres",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000223",
    "name": "Androstenediona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000224",
    "name": "Hormona antimülleriana (AMH)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000225",
    "name": "Inhibina B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000226",
    "name": "Insulina basal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000227",
    "name": "Insulina 30 min",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000228",
    "name": "Insulina 60 min",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000229",
    "name": "Insulina 90 min",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000230",
    "name": "Insulina 120 min",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000231",
    "name": "Péptido C",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000232",
    "name": "Índice HOMA-IR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000233",
    "name": "Gastrina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000234",
    "name": "Péptido intestinal vasoactivo (VIP)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000235",
    "name": "Somatostatina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000236",
    "name": "Glucagón",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000237",
    "name": "Leptina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000238",
    "name": "Adiponectina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "endocrinologia",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo; LC-MS/MS en pruebas seleccionadas"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000239",
    "name": "Proteína C reactiva cuantitativa",
    "synonyms": [
      "PCR",
      "CRP"
    ],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000240",
    "name": "Factor reumatoide cuantitativo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000241",
    "name": "Antiestreptolisina O (ASO/ASTO)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000242",
    "name": "ANA por inmunofluorescencia",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000243",
    "name": "ANA screen por inmunoensayo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000244",
    "name": "Anti-dsDNA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000245",
    "name": "Anti-ssDNA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000246",
    "name": "ENA screen",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000247",
    "name": "Anti-Sm",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000248",
    "name": "Anti-U1-RNP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000249",
    "name": "Anti-SSA/Ro52",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000250",
    "name": "Anti-SSA/Ro60",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000251",
    "name": "Anti-SSB/La",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000252",
    "name": "Anti-Scl-70",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000253",
    "name": "Anti-Jo-1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000254",
    "name": "Anti-ribosomal P",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000255",
    "name": "Anti-centromero B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000256",
    "name": "Anti-CCP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000257",
    "name": "ANCA por inmunofluorescencia",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000258",
    "name": "PR3-ANCA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000259",
    "name": "MPO-ANCA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000260",
    "name": "Anticardiolipina IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000261",
    "name": "Anticardiolipina IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000262",
    "name": "Beta-2 glicoproteína I IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000263",
    "name": "Beta-2 glicoproteína I IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000264",
    "name": "Antifosfolípidos IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000265",
    "name": "Antifosfolípidos IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000266",
    "name": "Anti-membrana basal glomerular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000267",
    "name": "Antimitocondriales AMA-M2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000268",
    "name": "Anti-músculo liso ASMA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000269",
    "name": "Anti-LKM-1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000270",
    "name": "Anti-SLA/LP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000271",
    "name": "Anti-gp210",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000272",
    "name": "Anti-Sp100",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000273",
    "name": "Anti-LC1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000274",
    "name": "Anticuerpos anti-transglutaminasa tisular IgA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000275",
    "name": "Anticuerpos anti-transglutaminasa tisular IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000276",
    "name": "Anticuerpos anti-endomisio IgA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000277",
    "name": "Anticuerpos anti-gliadina deamidada IgA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000278",
    "name": "Anticuerpos anti-gliadina deamidada IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000279",
    "name": "Anticuerpos anti-célula parietal gástrica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000280",
    "name": "Anticuerpos anti-factor intrínseco",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000281",
    "name": "ASCA IgA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000282",
    "name": "ASCA IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000283",
    "name": "Complemento C3",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000284",
    "name": "Complemento C4",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000285",
    "name": "Complemento CH50",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000286",
    "name": "Complemento AH50",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000287",
    "name": "Inmunoglobulina G",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000288",
    "name": "Inmunoglobulina A",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000289",
    "name": "Inmunoglobulina M",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000290",
    "name": "Inmunoglobulina E total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000291",
    "name": "IgG1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000292",
    "name": "IgG2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000293",
    "name": "IgG3",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000294",
    "name": "IgG4",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000295",
    "name": "Crioglobulinas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000296",
    "name": "Criofibrinógeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000297",
    "name": "Crioaglutininas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000298",
    "name": "Calprotectina sérica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000299",
    "name": "Calprotectina fecal cuantitativa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000300",
    "name": "Células LE (prueba histórica)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunologia_autoinmunidad",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo/IFI/inmunoblot según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000301",
    "name": "IgE específica Blomia tropicalis",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000302",
    "name": "IgE específica Dermatophagoides farinae",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000303",
    "name": "IgE específica Dermatophagoides pteronyssinus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000304",
    "name": "IgE específica ajo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000305",
    "name": "IgE específica brócoli",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000306",
    "name": "IgE específica cebolla",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000307",
    "name": "IgE específica durazno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000308",
    "name": "IgE específica fresa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000309",
    "name": "IgE específica kiwi",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000310",
    "name": "IgE específica limón",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000311",
    "name": "IgE específica mango",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000312",
    "name": "IgE específica manzana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000313",
    "name": "IgE específica naranja",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000314",
    "name": "IgE específica palta/aguacate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000315",
    "name": "IgE específica almendra",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000316",
    "name": "IgE específica arroz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000317",
    "name": "IgE específica avellana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000318",
    "name": "IgE específica avena",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000319",
    "name": "IgE específica maíz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000320",
    "name": "IgE específica lenteja",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000321",
    "name": "IgE específica maní/cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000322",
    "name": "IgE específica nuez",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000323",
    "name": "IgE específica nuez de Brasil",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000324",
    "name": "IgE específica soya",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000325",
    "name": "IgE específica papa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000326",
    "name": "IgE específica papaya",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000327",
    "name": "IgE específica pepino",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000328",
    "name": "IgE específica piña",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000329",
    "name": "IgE específica plátano",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000330",
    "name": "IgE específica tomate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000331",
    "name": "IgE específica uva",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000332",
    "name": "IgE específica zanahoria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000333",
    "name": "IgE específica atún",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000334",
    "name": "IgE específica bacalao",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000335",
    "name": "IgE específica camarón",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000336",
    "name": "IgE específica salmón",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000337",
    "name": "IgE específica trucha",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000338",
    "name": "IgE específica cerdo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000339",
    "name": "IgE específica clara de huevo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000340",
    "name": "IgE específica huevo entero",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000341",
    "name": "IgE específica yema de huevo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000342",
    "name": "IgE específica pavo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000343",
    "name": "IgE específica pollo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000344",
    "name": "IgE específica carne de res",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000345",
    "name": "IgE específica leche de vaca",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000346",
    "name": "IgE específica trigo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000347",
    "name": "IgE específica haba",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000348",
    "name": "IgE específica caspa de perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000349",
    "name": "IgE específica caspa de gato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000350",
    "name": "IgE específica caspa de caballo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000351",
    "name": "IgE específica epitelio de conejo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000352",
    "name": "IgE específica Alternaria alternata",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000353",
    "name": "IgE específica Aspergillus fumigatus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000354",
    "name": "IgE específica látex",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000355",
    "name": "IgE específica amoxicilina/amoxicilloyl",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000356",
    "name": "IgE específica penicilloyl G",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000357",
    "name": "IgE específica Acacia longifolia",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000358",
    "name": "IgE específica Betula verrucosa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000359",
    "name": "IgE específica Cupressus arizonica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000360",
    "name": "IgE específica Amaranthus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000361",
    "name": "IgE específica Ambrosia trifida",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000362",
    "name": "IgE específica Artemisia vulgaris",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000363",
    "name": "IgE específica Chenopodium",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000364",
    "name": "IgE específica Parietaria judaica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000365",
    "name": "IgE específica Salsola kali",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000366",
    "name": "IgE específica Poa pratensis",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000367",
    "name": "IgE específica Phleum pratense",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000368",
    "name": "IgE específica Cynodon dactylon",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000369",
    "name": "IgE específica Eucalyptus spp.",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000370",
    "name": "IgE específica Fraxinus americana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000371",
    "name": "IgE específica Juniperus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000372",
    "name": "IgE específica Ligustrum vulgare",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000373",
    "name": "IgE específica Liquidambar styraciflua",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000374",
    "name": "IgE específica Olea europaea",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000375",
    "name": "IgE específica Populus deltoides",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000376",
    "name": "IgE específica Quercus alba",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000377",
    "name": "IgE específica Schinus molle",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000378",
    "name": "IgE específica Morus rubra",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000379",
    "name": "IgE específica abeja",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000380",
    "name": "IgE específica abejorro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000381",
    "name": "IgE específica avispa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000382",
    "name": "IgE específica cucaracha americana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000383",
    "name": "IgE específica hormiga roja",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000384",
    "name": "IgE específica mosquito",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000385",
    "name": "Componente nBos d4 alfa-lactoalbúmina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000386",
    "name": "Componente nBos d5 beta-lactoglobulina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000387",
    "name": "Componente nBos d8 caseína",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000388",
    "name": "Componente nGal d1 ovomucoide",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000389",
    "name": "Componente nGal d2 ovoalbúmina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000390",
    "name": "Componente rCor a 1 avellana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000391",
    "name": "Componente rCor a 8 avellana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000392",
    "name": "Componente rCor a 14 avellana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000393",
    "name": "Componente rAra h 1 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000394",
    "name": "Componente rAra h 2 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000395",
    "name": "Componente rAra h 3 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000396",
    "name": "Componente rAra h 6 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000397",
    "name": "Componente rAra h 8 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000398",
    "name": "Componente rAra h 9 cacahuate",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000399",
    "name": "Componente rPru p 1 durazno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000400",
    "name": "Componente rPru p 3 durazno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000401",
    "name": "Componente rPru p 4 durazno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000402",
    "name": "Componente rMal d 1 manzana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000403",
    "name": "Componente rMal d 3 manzana",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000404",
    "name": "Componente rApi g 1.01 apio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000405",
    "name": "Componente rPen a 1 tropomiosina de camarón",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000406",
    "name": "Componente rGly m 4 PR-10 soya",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000407",
    "name": "Componente rTri a 19 omega-5 gliadina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000408",
    "name": "Componente rAlt a 1 Alternaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000409",
    "name": "Componente Asp f 1 Aspergillus fumigatus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000410",
    "name": "Componente Der p 1 ácaro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000411",
    "name": "Componente Der p 2 ácaro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000412",
    "name": "Componente Der p 10 ácaro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000413",
    "name": "Componente Der p 23 ácaro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000414",
    "name": "Componente Can f 1 perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000415",
    "name": "Componente Can f 2 perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000416",
    "name": "Componente Can f 3 perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000417",
    "name": "Componente Can f 5 perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000418",
    "name": "Componente Can f 6 perro",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000419",
    "name": "Componente Fel d 1 gato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000420",
    "name": "Componente Fel d 2 gato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000421",
    "name": "Componente Fel d 4 gato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000422",
    "name": "Phadiatop",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000423",
    "name": "Phadiatop infantil",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000424",
    "name": "Phadiatop Plus/Fx5",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000425",
    "name": "Panel de alérgenos alimentarios",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000426",
    "name": "Panel de alérgenos respiratorios",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000427",
    "name": "Panel de alérgenos pediátricos",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000428",
    "name": "Panel mixto respiratorio y alimentario",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "alergologia",
    "target": null,
    "specimens": [
      "suero"
    ],
    "methods": [
      "inmunoensayo de IgE específica, p.ej. ImmunoCAP"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000429",
    "name": "VIH 1/2 Ag/Ac cuarta generación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000430",
    "name": "VIH 1/2 prueba rápida",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000431",
    "name": "VIH-1 anticuerpos diferenciación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000432",
    "name": "VIH-2 anticuerpos diferenciación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000433",
    "name": "Hepatitis A anticuerpos totales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000434",
    "name": "Hepatitis A IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000435",
    "name": "HBsAg",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000436",
    "name": "Anti-HBs",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000437",
    "name": "Anti-HBc total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000438",
    "name": "Anti-HBc IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000439",
    "name": "HBeAg",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000440",
    "name": "Anti-HBe",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000441",
    "name": "Hepatitis C anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000442",
    "name": "Hepatitis E IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000443",
    "name": "Hepatitis E IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000444",
    "name": "Sífilis anticuerpos totales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000445",
    "name": "VDRL",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000446",
    "name": "RPR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000447",
    "name": "FTA-ABS",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000448",
    "name": "TPHA/TPPA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000449",
    "name": "Toxoplasma IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000450",
    "name": "Toxoplasma IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000451",
    "name": "Rubéola IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000452",
    "name": "Rubéola IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000453",
    "name": "CMV IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000454",
    "name": "CMV IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000455",
    "name": "HSV-1 IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000456",
    "name": "HSV-1 IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000457",
    "name": "HSV-2 IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000458",
    "name": "HSV-2 IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000459",
    "name": "Varicela zóster IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000460",
    "name": "Varicela zóster IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000461",
    "name": "EBV VCA IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000462",
    "name": "EBV VCA IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000463",
    "name": "EBV EBNA IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000464",
    "name": "EBV EA IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000465",
    "name": "Parvovirus B19 IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000466",
    "name": "Parvovirus B19 IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000467",
    "name": "Chagas anticuerpos totales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000468",
    "name": "Chagas HAI",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000469",
    "name": "Brucella IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000470",
    "name": "Brucella IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000471",
    "name": "Brucella aglutinación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000472",
    "name": "Chlamydia trachomatis IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000473",
    "name": "Chlamydia trachomatis IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000474",
    "name": "Mycoplasma pneumoniae IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000475",
    "name": "Mycoplasma pneumoniae IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000476",
    "name": "Helicobacter pylori IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000477",
    "name": "Helicobacter pylori IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000478",
    "name": "Dengue NS1 antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000479",
    "name": "Dengue IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000480",
    "name": "Dengue IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000481",
    "name": "Zika IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000482",
    "name": "Chikungunya IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000483",
    "name": "SARS-CoV-2 antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000484",
    "name": "SARS-CoV-2 IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000485",
    "name": "SARS-CoV-2 IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000486",
    "name": "SARS-CoV-2 anticuerpos neutralizantes anti-RBD",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000487",
    "name": "Influenza A antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000488",
    "name": "Influenza B antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000489",
    "name": "Virus sincitial respiratorio antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000490",
    "name": "Adenovirus antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000491",
    "name": "Rotavirus antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000492",
    "name": "Streptococcus grupo A antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000493",
    "name": "Cryptococcus antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000494",
    "name": "Aspergillus galactomanano",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000495",
    "name": "1,3-beta-D-glucano",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000496",
    "name": "Hidatidosis/Echinococcus anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000497",
    "name": "Cisticercosis anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000498",
    "name": "Toxocara canis anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000499",
    "name": "Leptospira IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000500",
    "name": "Leptospira IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000501",
    "name": "Rickettsia anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000502",
    "name": "HTLV-1/2 anticuerpos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000503",
    "name": "Hantavirus IgM",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000504",
    "name": "Hantavirus IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "serologia_infecciosas",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo/aglutinación/prueba rápida según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000505",
    "name": "Urocultivo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000506",
    "name": "Hemocultivo aerobio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000507",
    "name": "Hemocultivo anaerobio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000508",
    "name": "Hemocultivo seriado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000509",
    "name": "Coprocultivo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000510",
    "name": "Cultivo de esputo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000511",
    "name": "Cultivo de exudado faríngeo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000512",
    "name": "Cultivo de secreción vaginal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000513",
    "name": "Cultivo de secreción uretral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000514",
    "name": "Cultivo de herida",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000515",
    "name": "Cultivo de absceso",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000516",
    "name": "Cultivo de líquido cefalorraquídeo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000517",
    "name": "Cultivo de líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000518",
    "name": "Cultivo de líquido ascítico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000519",
    "name": "Cultivo de líquido sinovial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000520",
    "name": "Cultivo de líquido pericárdico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000521",
    "name": "Cultivo de catéter",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000522",
    "name": "Cultivo de punta de catéter",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000523",
    "name": "Cultivo de semen",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000524",
    "name": "Cultivo de secreción ocular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000525",
    "name": "Cultivo de secreción ótica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000526",
    "name": "Cultivo de tejido",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000527",
    "name": "Antibiograma por difusión",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000528",
    "name": "Antibiograma por MIC",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000529",
    "name": "Detección de BLEE fenotípica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000530",
    "name": "Detección de carbapenemasas fenotípica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000531",
    "name": "Tinción de Gram",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000532",
    "name": "Bacterioscopía",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000533",
    "name": "Baciloscopía para BAAR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000534",
    "name": "Baciloscopía seriada para BAAR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000535",
    "name": "Tinción de Ziehl-Neelsen",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000536",
    "name": "Tinción de auramina-rodamina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000537",
    "name": "Cultivo de micobacterias",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000538",
    "name": "Identificación bacteriana MALDI-TOF",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "microbiologia_bacteriologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "cultivo, microscopía e identificación; susceptibilidad cuando aplique"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000539",
    "name": "Examen directo con KOH para hongos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000540",
    "name": "Cultivo micológico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000541",
    "name": "Tinta china para Cryptococcus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000542",
    "name": "Antígeno criptocócico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000543",
    "name": "Galactomanano de Aspergillus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000544",
    "name": "Cultivo para dermatofitos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000545",
    "name": "Identificación de levaduras",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000546",
    "name": "Antifungigrama",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000547",
    "name": "Candida albicans cultivo/identificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000548",
    "name": "Candida glabrata cultivo/identificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000549",
    "name": "Candida tropicalis cultivo/identificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000550",
    "name": "Candida parapsilosis cultivo/identificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000551",
    "name": "Candida krusei cultivo/identificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "micologia",
    "target": null,
    "specimens": [
      "muestra clínica según foco"
    ],
    "methods": [
      "microscopía, cultivo, antígeno o susceptibilidad según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000552",
    "name": "Coproparasitológico simple",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000553",
    "name": "Coproparasitológico seriado 3 muestras",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000554",
    "name": "Examen directo de heces para protozoarios",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000555",
    "name": "Concentración de parásitos en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000556",
    "name": "Test de Graham para Enterobius vermicularis",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000557",
    "name": "Giardia antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000558",
    "name": "Entamoeba histolytica antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000559",
    "name": "Cryptosporidium antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000560",
    "name": "Cyclospora examen/tinción",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000561",
    "name": "Isospora/Cystoisospora examen/tinción",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000562",
    "name": "Microsporidios tinción",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000563",
    "name": "Gota gruesa para malaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000564",
    "name": "Frotis fino para malaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000565",
    "name": "Antígeno rápido de malaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000566",
    "name": "Leishmania examen directo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000567",
    "name": "Leishmania serología",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000568",
    "name": "Strongyloides serología",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000569",
    "name": "Toxocara serología",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000570",
    "name": "Cisticercosis serología",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000571",
    "name": "Hidatidosis serología",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "parasitologia",
    "target": null,
    "specimens": [
      "heces, sangre u otra según parásito"
    ],
    "methods": [
      "microscopía, antígeno o serología según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000572",
    "name": "Carga viral VIH-1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000573",
    "name": "Carga viral hepatitis B (HBV DNA)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000574",
    "name": "Carga viral hepatitis C (HCV RNA)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000575",
    "name": "CMV carga viral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000576",
    "name": "EBV carga viral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000577",
    "name": "BK virus carga viral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000578",
    "name": "Adenovirus PCR cuantitativa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000579",
    "name": "Parvovirus B19 PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000580",
    "name": "SARS-CoV-2 RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000581",
    "name": "Influenza A RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000582",
    "name": "Influenza B RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000583",
    "name": "Virus sincitial respiratorio RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000584",
    "name": "VPH alto riesgo detección/genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000585",
    "name": "HSV-1 PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000586",
    "name": "HSV-2 PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000587",
    "name": "VZV PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000588",
    "name": "Enterovirus PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000589",
    "name": "Norovirus PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000590",
    "name": "Rotavirus PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000591",
    "name": "Dengue RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000592",
    "name": "Zika RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000593",
    "name": "Chikungunya RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000594",
    "name": "Mpox/viruela símica PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "virologia",
    "target": null,
    "specimens": [
      "plasma, suero o hisopado según prueba"
    ],
    "methods": [
      "NAAT/RT-PCR, antígeno o cuantificación según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000595",
    "name": "Panel ITS por RT-PCR multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000596",
    "name": "Panel de úlceras genitales por RT-PCR multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000597",
    "name": "Panel de Candida por RT-PCR multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000598",
    "name": "VPH 14 genotipos de alto riesgo por RT-PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000599",
    "name": "Streptococcus grupo B por PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000600",
    "name": "Panel gastrointestinal viral multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000601",
    "name": "Panel gastrointestinal bacteriano 1 multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000602",
    "name": "Panel gastrointestinal bacteriano 2 multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000603",
    "name": "Panel gastrointestinal parasitario multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000604",
    "name": "H. pylori y resistencia a claritromicina por PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000605",
    "name": "Panel respiratorio viral 1 multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000606",
    "name": "Panel respiratorio viral 2 multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000607",
    "name": "Panel respiratorio viral 3 multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000608",
    "name": "Panel respiratorio bacteriano multiplex",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000609",
    "name": "Mycobacterium tuberculosis y resistencia a rifampicina/isoniazida por PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000610",
    "name": "Panel meningitis/encefalitis viral 1",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000611",
    "name": "Panel meningitis/encefalitis viral 2",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000612",
    "name": "Panel meningitis/encefalitis bacteriano",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000613",
    "name": "Panel SARS-CoV-2 e Influenza/RSV",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000614",
    "name": "Panel arbovirus Zika-Dengue-Chikungunya",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000615",
    "name": "BCR-ABL1 p210 cuantitativo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000616",
    "name": "BCR-ABL1 p190 cuantitativo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000617",
    "name": "JAK2 V617F",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000618",
    "name": "CALR mutaciones exón 9",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000619",
    "name": "MPL W515 mutaciones",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000620",
    "name": "PML-RARA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000621",
    "name": "FLT3 ITD/TKD",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000622",
    "name": "NPM1 mutación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000623",
    "name": "Factor V Leiden por PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000624",
    "name": "Protrombina G20210A por PCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000625",
    "name": "MTHFR C677T",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000626",
    "name": "MTHFR A1298C",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000627",
    "name": "HFE C282Y",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000628",
    "name": "HFE H63D",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000629",
    "name": "KRAS mutaciones",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000630",
    "name": "NRAS mutaciones",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000631",
    "name": "BRAF V600E",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000632",
    "name": "EGFR mutaciones",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000633",
    "name": "ALK reordenamiento molecular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000634",
    "name": "ROS1 reordenamiento molecular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000635",
    "name": "HER2 amplificación por ISH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000636",
    "name": "BRCA1/BRCA2 secuenciación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000637",
    "name": "DPYD variantes farmacogenéticas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000638",
    "name": "CYP2C19 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000639",
    "name": "CYP2D6 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000640",
    "name": "CYP2C9 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000641",
    "name": "VKORC1 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000642",
    "name": "UGT1A1 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000643",
    "name": "TPMT genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000644",
    "name": "NUDT15 genotipificación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "biologia_molecular",
    "target": null,
    "specimens": [
      "muestra clínica según diana; medio molecular cuando aplique"
    ],
    "methods": [
      "PCR/RT-PCR/qPCR/multiplex/NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000645",
    "name": "Cariotipo en sangre periférica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000646",
    "name": "Cariotipo en médula ósea",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000647",
    "name": "Cariotipo prenatal en líquido amniótico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000648",
    "name": "Cariotipo prenatal en vellosidades coriales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000649",
    "name": "FISH 13/18/21/X/Y prenatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000650",
    "name": "FISH BCR-ABL1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000651",
    "name": "FISH PML-RARA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000652",
    "name": "FISH HER2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000653",
    "name": "FISH ALK",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000654",
    "name": "FISH 1p/19q",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000655",
    "name": "Microarray cromosómico (CMA)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000656",
    "name": "Array-CGH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000657",
    "name": "SNP array",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000658",
    "name": "MLPA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000659",
    "name": "Secuenciación Sanger de gen único",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000660",
    "name": "Panel multigénico por NGS",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000661",
    "name": "Exoma clínico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000662",
    "name": "Exoma completo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000663",
    "name": "Genoma completo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000664",
    "name": "Secuenciación de ADN mitocondrial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000665",
    "name": "Prueba de expansión FMR1/X frágil",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000666",
    "name": "Prueba de expansión HTT/Huntington",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000667",
    "name": "Distrofia miotónica DMPK",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000668",
    "name": "Atrofia muscular espinal SMN1/SMN2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000669",
    "name": "Fibrosis quística CFTR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000670",
    "name": "Hemocromatosis HFE",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000671",
    "name": "Trombofilia genética",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000672",
    "name": "Farmacogenómica multigénica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000673",
    "name": "Tipaje HLA-DQ2/DQ8 para celiaquía",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000674",
    "name": "HLA-B27 molecular",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000675",
    "name": "HLA-B*57:01",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000676",
    "name": "HLA-B*58:01",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000677",
    "name": "HLA-A*31:01",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000678",
    "name": "HLA-B*15:02",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "genetica_citogenetica_genomica",
    "target": null,
    "specimens": [
      "sangre EDTA u otra muestra genética según indicación"
    ],
    "methods": [
      "cariotipo/FISH/PCR/MLPA/Sanger/NGS/microarray según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000679",
    "name": "AFP",
    "synonyms": [
      "alfafetoproteína"
    ],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000680",
    "name": "CEA",
    "synonyms": [
      "antígeno carcinoembrionario"
    ],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000681",
    "name": "PSA total",
    "synonyms": [
      "antígeno prostático específico total"
    ],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": "Evitar relaciones sexuales recientes y procedimientos prostáticos según indicación del laboratorio; confirmar ventana exacta antes de la toma.",
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000682",
    "name": "PSA libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": "Evitar relaciones sexuales recientes y procedimientos prostáticos según indicación del laboratorio; confirmar ventana exacta antes de la toma.",
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000683",
    "name": "Relación PSA libre/total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": "Evitar relaciones sexuales recientes y procedimientos prostáticos según indicación del laboratorio; confirmar ventana exacta antes de la toma.",
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000684",
    "name": "CA 125",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000685",
    "name": "CA 15-3",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000686",
    "name": "CA 19-9",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000687",
    "name": "CA 72-4",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000688",
    "name": "HE4",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000689",
    "name": "ROMA (HE4 + CA125)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000690",
    "name": "Tiroglobulina como marcador tumoral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000691",
    "name": "Beta-hCG cuantitativa como marcador tumoral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000692",
    "name": "LDH como marcador pronóstico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000693",
    "name": "Cromogranina A",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000694",
    "name": "NSE",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000695",
    "name": "CYFRA 21-1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000696",
    "name": "SCC antígeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000697",
    "name": "ProGRP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000698",
    "name": "CA 27.29",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000699",
    "name": "CA 50",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000700",
    "name": "CA 242",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000701",
    "name": "PIVKA-II/DCP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000702",
    "name": "Des-gamma-carboxiprotrombina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000703",
    "name": "S100B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000704",
    "name": "Tiroglobulina en lavado de aguja fina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000705",
    "name": "PSA ultrasensible",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "oncologia_marcadores",
    "target": null,
    "specimens": [
      "suero o plasma"
    ],
    "methods": [
      "inmunoensayo u otra plataforma validada"
    ],
    "units": null,
    "patientPreparation": "Evitar relaciones sexuales recientes y procedimientos prostáticos según indicación del laboratorio; confirmar ventana exacta antes de la toma.",
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000706",
    "name": "Etanol en sangre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000707",
    "name": "Metanol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000708",
    "name": "Etilenglicol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000709",
    "name": "Isopropanol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000710",
    "name": "Acetona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000711",
    "name": "Plomo en sangre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000712",
    "name": "Mercurio en sangre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000713",
    "name": "Mercurio en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000714",
    "name": "Arsénico en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000715",
    "name": "Cadmio en sangre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000716",
    "name": "Cadmio en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000717",
    "name": "Cobre en sangre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000718",
    "name": "Cocaína/metabolito benzoilecgonina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000719",
    "name": "Cannabinoides/THC",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000720",
    "name": "Opiáceos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000721",
    "name": "Morfina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000722",
    "name": "Codeína",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000723",
    "name": "6-MAM heroína",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000724",
    "name": "Anfetaminas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000725",
    "name": "Metanfetaminas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000726",
    "name": "MDMA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000727",
    "name": "Barbitúricos",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000728",
    "name": "Benzodiacepinas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000729",
    "name": "Metadona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000730",
    "name": "Buprenorfina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000731",
    "name": "Tramadol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000732",
    "name": "Fenciclidina PCP",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000733",
    "name": "Antidepresivos tricíclicos screen",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000734",
    "name": "Fentanilo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000735",
    "name": "Oxicodona",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000736",
    "name": "Ketamina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000737",
    "name": "Cotininina/nicotina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "toxicologia_drogas",
    "target": null,
    "specimens": [
      "sangre u orina según analito"
    ],
    "methods": [
      "inmunoensayo de tamizaje y/o GC-MS/LC-MS/MS confirmatorio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000738",
    "name": "Ácido valproico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000739",
    "name": "Carbamazepina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000740",
    "name": "Fenitoína",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000741",
    "name": "Fenobarbital",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000742",
    "name": "Digoxina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000743",
    "name": "Litio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000744",
    "name": "Ciclosporina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000745",
    "name": "Tacrolimus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000746",
    "name": "Sirolimus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000747",
    "name": "Everolimus",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000748",
    "name": "Vancomicina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000749",
    "name": "Gentamicina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000750",
    "name": "Amikacina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000751",
    "name": "Tobramicina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000752",
    "name": "Teofilina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000753",
    "name": "Metotrexato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000754",
    "name": "Acetaminofén/paracetamol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000755",
    "name": "Salicilato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000756",
    "name": "Voriconazol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000757",
    "name": "Posaconazol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000758",
    "name": "Levetiracetam",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000759",
    "name": "Lamotrigina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000760",
    "name": "Oxcarbazepina metabolito MHD",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000761",
    "name": "Clozapina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000762",
    "name": "Norclozapina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "monitoreo_terapeutico",
    "target": null,
    "specimens": [
      "suero, plasma o sangre total según fármaco"
    ],
    "methods": [
      "inmunoensayo, HPLC o LC-MS/MS según fármaco"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000763",
    "name": "Examen general de orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000764",
    "name": "Densidad urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000765",
    "name": "pH urinario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000766",
    "name": "Proteínas en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000767",
    "name": "Glucosa en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000768",
    "name": "Cetonas en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000769",
    "name": "Sangre/hemoglobina en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000770",
    "name": "Nitritos en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000771",
    "name": "Esterasa leucocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000772",
    "name": "Bilirrubina urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000773",
    "name": "Urobilinógeno",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000774",
    "name": "Sedimento urinario automatizado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000775",
    "name": "Sedimento urinario manual",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000776",
    "name": "Microalbuminuria orina ocasional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000777",
    "name": "Microalbuminuria 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000778",
    "name": "Relación albúmina/creatinina urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000779",
    "name": "Proteína orina ocasional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000780",
    "name": "Proteína orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000781",
    "name": "Relación proteína/creatinina urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000782",
    "name": "Creatinina orina ocasional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000783",
    "name": "Creatinina orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000784",
    "name": "Depuración de creatinina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000785",
    "name": "Calcio orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000786",
    "name": "Calcio orina ocasional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000787",
    "name": "Ácido úrico orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000788",
    "name": "Sodio orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000789",
    "name": "Sodio orina ocasional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000790",
    "name": "Potasio orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000791",
    "name": "Cloro orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000792",
    "name": "Magnesio orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000793",
    "name": "Urea orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000794",
    "name": "Nitrógeno ureico orina 24 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000795",
    "name": "Amilasa urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000796",
    "name": "Osmolalidad urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000797",
    "name": "Citrato urinario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000798",
    "name": "Oxalato urinario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000799",
    "name": "Estudio de cálculo renal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000800",
    "name": "Bence Jones/proteína monoclonal urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000801",
    "name": "Electroforesis de proteínas urinarias",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000802",
    "name": "Inmunofijación urinaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "uroanalisis",
    "target": null,
    "specimens": [
      "orina"
    ],
    "methods": [
      "tira reactiva, química y microscopía/automatización"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000803",
    "name": "Sangre oculta fecal inmunoquímica (FIT/FOB)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000804",
    "name": "Sangre oculta fecal seriada",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000805",
    "name": "Moco fecal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000806",
    "name": "pH fecal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000807",
    "name": "Azúcares reductores en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000808",
    "name": "Grasa fecal cualitativa Sudan",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000809",
    "name": "Grasa fecal cuantitativa 72 h",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000810",
    "name": "Esteatocrito ácido",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000811",
    "name": "Elastasa pancreática fecal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000812",
    "name": "Calprotectina fecal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000813",
    "name": "Lactoferrina fecal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000814",
    "name": "Helicobacter pylori antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000815",
    "name": "Rotavirus antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000816",
    "name": "Adenovirus antígeno en heces",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000817",
    "name": "Clostridioides difficile GDH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000818",
    "name": "Clostridioides difficile toxina A/B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000819",
    "name": "Coproparasitológico seriado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000820",
    "name": "Amebas en fresco",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000821",
    "name": "Test de Graham",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "heces_coproparasitologia",
    "target": null,
    "specimens": [
      "heces"
    ],
    "methods": [
      "inmunoquímica, química, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000822",
    "name": "Citoquímico de líquido cefalorraquídeo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000823",
    "name": "Recuento celular en LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000824",
    "name": "Proteínas en LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000825",
    "name": "Glucosa en LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000826",
    "name": "Lactato en LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000827",
    "name": "Bandas oligoclonales en LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000828",
    "name": "Índice IgG LCR/suero",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000829",
    "name": "Cultivo de LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000830",
    "name": "Citoquímico de líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000831",
    "name": "Citoquímico de líquido ascítico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000832",
    "name": "Citoquímico de líquido sinovial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000833",
    "name": "Citoquímico de líquido pericárdico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000834",
    "name": "Cristales en líquido sinovial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000835",
    "name": "Recuento celular en líquido sinovial",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000836",
    "name": "ADA en líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000837",
    "name": "ADA en líquido ascítico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000838",
    "name": "Triglicéridos en líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000839",
    "name": "Amilasa en líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000840",
    "name": "pH de líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000841",
    "name": "LDH en líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000842",
    "name": "Proteínas en líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000843",
    "name": "SAAG albúmina suero-ascitis",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000844",
    "name": "Citología de líquidos corporales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "liquidos_biologicos",
    "target": null,
    "specimens": [
      "líquido biológico especificado"
    ],
    "methods": [
      "química, recuento celular, microscopía o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000845",
    "name": "Espermatograma básico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000846",
    "name": "Concentración espermática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000847",
    "name": "Movilidad espermática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000848",
    "name": "Morfología espermática estricta",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000849",
    "name": "Vitalidad espermática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000850",
    "name": "Leucocitos en semen",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000851",
    "name": "MAR test IgG",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000852",
    "name": "MAR test IgA",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000853",
    "name": "Anticuerpos antiespermatozoides",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000854",
    "name": "Fragmentación de ADN espermático",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000855",
    "name": "Capacitación espermática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000856",
    "name": "Prueba de migración espermática",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000857",
    "name": "Fructosa seminal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000858",
    "name": "Ácido cítrico seminal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000859",
    "name": "Fosfatasa ácida prostática seminal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000860",
    "name": "Zinc seminal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000861",
    "name": "AMH",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000862",
    "name": "FSH para evaluación de fertilidad",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000863",
    "name": "LH para evaluación de fertilidad",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000864",
    "name": "Estradiol para fertilidad",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000865",
    "name": "Progesterona para ovulación",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "fertilidad_andrologia",
    "target": null,
    "specimens": [
      "semen o suero según prueba"
    ],
    "methods": [
      "microscopía, CASA, inmunoensayo o cultivo según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000866",
    "name": "hCG cualitativa en orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000867",
    "name": "Beta-hCG cuantitativa sérica",
    "synonyms": [
      "β-hCG",
      "beta HCG"
    ],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000868",
    "name": "PAPP-A",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000869",
    "name": "hCG beta libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000870",
    "name": "Estriol no conjugado",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000871",
    "name": "AFP materna",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000872",
    "name": "Screening prenatal primer trimestre bioquímico",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000873",
    "name": "Screening prenatal segundo trimestre triple",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000874",
    "name": "Screening prenatal segundo trimestre cuádruple",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000875",
    "name": "NIPT trisomía 21",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000876",
    "name": "NIPT trisomía 18",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000877",
    "name": "NIPT trisomía 13",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000878",
    "name": "NIPT aneuploidías sexuales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000879",
    "name": "NIPT microdeleciones (según plataforma)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000880",
    "name": "Cariotipo prenatal líquido amniótico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000881",
    "name": "Cariotipo prenatal vellosidades coriales",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000882",
    "name": "QF-PCR aneuploidías 13/18/21/X/Y",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000883",
    "name": "FISH prenatal aneuploidías comunes",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000884",
    "name": "Alfafetoproteína en líquido amniótico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000885",
    "name": "Acetilcolinesterasa en líquido amniótico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000886",
    "name": "Cristalización de líquido amniótico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000887",
    "name": "Fibronectina fetal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000888",
    "name": "PAMG-1 ruptura de membranas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000889",
    "name": "IGFBP-1 ruptura de membranas",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000890",
    "name": "Streptococcus grupo B PCR prenatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "embarazo_prenatal",
    "target": null,
    "specimens": [
      "suero materno, orina o muestra prenatal según prueba"
    ],
    "methods": [
      "inmunoensayo, PCR, FISH, cariotipo o NGS según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000891",
    "name": "Grupo ABO",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000892",
    "name": "Factor RhD",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000893",
    "name": "Fenotipo Rh extendido C/c/E/e",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000894",
    "name": "Fenotipo Kell",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000895",
    "name": "Antígeno K",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000896",
    "name": "Prueba de Coombs directa (DAT)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000897",
    "name": "Coombs indirecta (IAT)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000898",
    "name": "Screening de anticuerpos irregulares",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000899",
    "name": "Identificación de anticuerpos irregulares",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000900",
    "name": "Titulación de anticuerpos eritrocitarios",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000901",
    "name": "Prueba cruzada mayor",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000902",
    "name": "Prueba cruzada menor",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000903",
    "name": "Compatibilidad pretransfusional electrónica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000904",
    "name": "Elución de anticuerpos eritrocitarios",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000905",
    "name": "Adsorción autóloga",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000906",
    "name": "Adsorción alogénica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000907",
    "name": "Prueba de Kleihauer-Betke",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000908",
    "name": "Cuantificación de hemorragia fetomaterna por citometría",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000909",
    "name": "Fenotipo D débil",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000910",
    "name": "Genotipo RhD",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000911",
    "name": "Genotipo eritrocitario extendido",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "inmunohematologia_banco_sangre",
    "target": null,
    "specimens": [
      "sangre total EDTA/suero según prueba"
    ],
    "methods": [
      "hemaglutinación, gel, fase sólida o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000912",
    "name": "Tipificación HLA-A",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000913",
    "name": "Tipificación HLA-B",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000914",
    "name": "Tipificación HLA-C",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000915",
    "name": "Tipificación HLA-DRB1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000916",
    "name": "Tipificación HLA-DQB1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000917",
    "name": "Tipificación HLA-DPB1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000918",
    "name": "Tipificación HLA alta resolución NGS",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000919",
    "name": "HLA-B27",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000920",
    "name": "HLA-DQ2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000921",
    "name": "HLA-DQ8",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000922",
    "name": "Panel reactivo de anticuerpos HLA (PRA)",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000923",
    "name": "Anticuerpos anti-HLA clase I",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000924",
    "name": "Anticuerpos anti-HLA clase II",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000925",
    "name": "Anticuerpos específicos del donante (DSA)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000926",
    "name": "Crossmatch linfocitario CDC",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000927",
    "name": "Crossmatch por citometría de flujo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000928",
    "name": "Crossmatch virtual",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000929",
    "name": "C4d en biopsia de trasplante",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "trasplantes_hla",
    "target": null,
    "specimens": [
      "sangre EDTA y/o suero"
    ],
    "methods": [
      "PCR-SSO/SSP, Sanger/NGS, Luminex o citometría según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000930",
    "name": "Citología cervicovaginal Papanicolaou",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000931",
    "name": "Citología en base líquida",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000932",
    "name": "Citología de orina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000933",
    "name": "Citología de esputo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000934",
    "name": "Citología de líquido pleural",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000935",
    "name": "Citología de líquido ascítico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000936",
    "name": "Citología de líquido pericárdico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000937",
    "name": "Citología de LCR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000938",
    "name": "Citología por punción aspiración con aguja fina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000939",
    "name": "Histopatología de biopsia pequeña",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000940",
    "name": "Histopatología de pieza quirúrgica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000941",
    "name": "Biopsia de médula ósea histopatológica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000942",
    "name": "Inmunohistoquímica ER",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000943",
    "name": "Inmunohistoquímica PR",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000944",
    "name": "Inmunohistoquímica HER2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000945",
    "name": "Inmunohistoquímica Ki-67",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000946",
    "name": "Inmunohistoquímica PD-L1",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000947",
    "name": "Inmunohistoquímica mismatch repair MLH1/PMS2/MSH2/MSH6",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000948",
    "name": "Hibridación in situ HER2",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000949",
    "name": "Hibridación in situ EBV-EBER",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000950",
    "name": "Tinción PAS",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000951",
    "name": "Tinción Ziehl-Neelsen en tejido",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000952",
    "name": "Tinción Grocott/GMS",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000953",
    "name": "Tinción tricrómica",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000954",
    "name": "Tinción Congo rojo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "anatomia_patologica_citologia",
    "target": null,
    "specimens": [
      "tejido, citología o líquido según estudio"
    ],
    "methods": [
      "microscopía, histología, inmunohistoquímica o ISH según estudio"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000955",
    "name": "TSH neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000956",
    "name": "T4 neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000957",
    "name": "17-OH progesterona neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000958",
    "name": "Fenilalanina neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000959",
    "name": "Galactosa neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000960",
    "name": "Actividad GALT",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000961",
    "name": "Biotinidasa",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000962",
    "name": "Tripsinógeno inmunorreactivo (IRT)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000963",
    "name": "Tamiz neonatal para fibrosis quística",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000964",
    "name": "Hemoglobinopatías neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000965",
    "name": "Aminoácidos por MS/MS neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000966",
    "name": "Acilcarnitinas por MS/MS neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000967",
    "name": "Fenilcetonuria tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000968",
    "name": "Enfermedad de jarabe de arce tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000969",
    "name": "Homocistinuria tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000970",
    "name": "Tirosinemia tipo I tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000971",
    "name": "MCAD tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000972",
    "name": "VLCAD tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000973",
    "name": "Deficiencia de carnitina primaria tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000974",
    "name": "Acidemia propiónica tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000975",
    "name": "Acidemia metilmalónica tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000976",
    "name": "Acidemia glutárica tipo I tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000977",
    "name": "Hiperplasia suprarrenal congénita tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000978",
    "name": "Deficiencia de biotinidasa tamiz",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000979",
    "name": "Deficiencia G6PD neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000980",
    "name": "SCID TREC neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000981",
    "name": "Atrofia muscular espinal neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000982",
    "name": "Enfermedad de Pompe neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000983",
    "name": "Mucopolisacaridosis I neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000984",
    "name": "Adrenoleucodistrofia ligada a X neonatal",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "metabolismo_neonatal",
    "target": null,
    "specimens": [
      "sangre seca en papel filtro o muestra específica"
    ],
    "methods": [
      "inmunoensayo, fluorometría, MS/MS o molecular según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000985",
    "name": "Vitamina B12",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": "pg/mL",
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000986",
    "name": "Ácido fólico sérico",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": true,
    "availabilityEvidenceIds": [
      "src_plexus_tests",
      "src_zuna_tests"
    ],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000987",
    "name": "Folato eritrocitario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000988",
    "name": "Vitamina B1 tiamina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000989",
    "name": "Vitamina B2 riboflavina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000990",
    "name": "Vitamina B6 piridoxal-5-fosfato",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000991",
    "name": "Vitamina C",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000992",
    "name": "Vitamina A retinol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000993",
    "name": "Vitamina E alfa-tocoferol",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000994",
    "name": "Vitamina K",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000995",
    "name": "1,25-dihidroxivitamina D",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000996",
    "name": "Zinc",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000997",
    "name": "Cobre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000998",
    "name": "Selenio",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_000999",
    "name": "Manganeso",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001000",
    "name": "Cromo",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001001",
    "name": "Yodo urinario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001002",
    "name": "Magnesio eritrocitario",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001003",
    "name": "Prealbúmina",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001004",
    "name": "Retinol-binding protein",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001005",
    "name": "Carnitina libre",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001006",
    "name": "Carnitina total",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001007",
    "name": "Perfil de aminoácidos plasmáticos",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001008",
    "name": "Perfil de ácidos orgánicos urinarios",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001009",
    "name": "Perfil de acilcarnitinas",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001010",
    "name": "Omega-3 index",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "nutricion_vitaminas_oligoelementos",
    "target": null,
    "specimens": [
      "suero/plasma/sangre/orina según analito"
    ],
    "methods": [
      "inmunoensayo, HPLC, espectrometría o ICP-MS según analito"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001011",
    "name": "Plomo en sangre ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001012",
    "name": "Mercurio urinario ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001013",
    "name": "Arsénico urinario ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001014",
    "name": "Cadmio urinario ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001015",
    "name": "Colinesterasa sérica ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001016",
    "name": "Acetilcolinesterasa eritrocitaria",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001017",
    "name": "Carboxihemoglobina ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001018",
    "name": "Metahemoglobina ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001019",
    "name": "Alcohol en sangre ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001020",
    "name": "Panel drogas de abuso prelaboral",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001021",
    "name": "Cocaína prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001022",
    "name": "THC prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001023",
    "name": "Opiáceos prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001024",
    "name": "Anfetaminas prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001025",
    "name": "Benzodiacepinas prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001026",
    "name": "Barbitúricos prelaboral",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001027",
    "name": "Prueba de embarazo ocupacional cuando legalmente indicada",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001028",
    "name": "Examen general de orina ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001029",
    "name": "Hemograma ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001030",
    "name": "Glucosa ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001031",
    "name": "Perfil lipídico ocupacional",
    "synonyms": [],
    "kind": "PANEL",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001032",
    "name": "Función hepática ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001033",
    "name": "Función renal ocupacional",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001034",
    "name": "Espirometría (diagnóstico funcional; no laboratorio clínico puro)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  },
  {
    "id": "test_001035",
    "name": "Audiometría (diagnóstico funcional; no laboratorio clínico puro)",
    "synonyms": [],
    "kind": "TEST",
    "categoryId": "ocupacional_otros",
    "target": null,
    "specimens": [
      "muestra según prueba"
    ],
    "methods": [
      "método validado según prueba"
    ],
    "units": null,
    "patientPreparation": null,
    "availableInBolivia": false,
    "availabilityEvidenceIds": [],
    "reviewedAt": "2026-09-13"
  }
];

export const PANELES_DEL_CORPUS: readonly PanelDelCorpus[] = [
  {
    "id": "panel_renal",
    "name": "Perfil renal",
    "componentIds": [
      "test_000090",
      "test_000089",
      "test_000092",
      "test_000088"
    ],
    "componentNames": [
      "Creatinina sérica",
      "Nitrógeno ureico (BUN/NUS)",
      "Ácido úrico",
      "Urea"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_lipidico",
    "name": "Perfil lipídico",
    "componentIds": [
      "test_000143",
      "test_000144",
      "test_000145",
      "test_000147",
      "test_000148"
    ],
    "componentNames": [
      "Colesterol total",
      "HDL colesterol",
      "LDL colesterol directo",
      "VLDL colesterol",
      "Triglicéridos"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_hepatico",
    "name": "Perfil hepático",
    "componentIds": [
      "test_000120",
      "test_000121",
      "test_000122",
      "test_000117",
      "test_000118",
      "test_000119",
      "test_000123"
    ],
    "componentNames": [
      "AST/TGO",
      "ALT/TGP",
      "Fosfatasa alcalina",
      "Bilirrubina total",
      "Bilirrubina directa",
      "Bilirrubina indirecta",
      "GGT"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_electrolitos",
    "name": "Perfil electrolítico",
    "componentIds": [
      "test_000093",
      "test_000094",
      "test_000095"
    ],
    "componentNames": [
      "Sodio",
      "Potasio",
      "Cloro"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_hierro",
    "name": "Perfil de hierro",
    "componentIds": [
      "test_000102",
      "test_000103",
      "test_000105",
      "test_000107",
      "test_000106"
    ],
    "componentNames": [
      "Hierro sérico",
      "Capacidad total de fijación del hierro (TIBC)",
      "Saturación de transferrina",
      "Ferritina",
      "Transferrina"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_tiroideo",
    "name": "Perfil tiroideo",
    "componentIds": [
      "test_000176",
      "test_000177",
      "test_000179"
    ],
    "componentNames": [
      "TSH ultrasensible",
      "T4 libre",
      "T3 libre"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_prostatico",
    "name": "Perfil prostático",
    "componentIds": [
      "test_000681",
      "test_000682",
      "test_000683"
    ],
    "componentNames": [
      "PSA total",
      "PSA libre",
      "Relación PSA libre/total"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_torch_igg",
    "name": "TORCH IgG",
    "componentIds": [
      "test_000449",
      "test_000451",
      "test_000453",
      "test_000455",
      "test_000457"
    ],
    "componentNames": [
      "Toxoplasma IgG",
      "Rubéola IgG",
      "CMV IgG",
      "HSV-1 IgG",
      "HSV-2 IgG"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  },
  {
    "id": "panel_torch_igm",
    "name": "TORCH IgM",
    "componentIds": [
      "test_000450",
      "test_000452",
      "test_000454",
      "test_000456",
      "test_000458"
    ],
    "componentNames": [
      "Toxoplasma IgM",
      "Rubéola IgM",
      "CMV IgM",
      "HSV-1 IgM",
      "HSV-2 IgM"
    ],
    "sourceIds": [
      "src_plexus_tests"
    ]
  }
];

export const RELACIONES_DEL_CORPUS: readonly RelacionDelCorpus[] = [
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000001",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000002",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000003",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000012",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000014",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000017",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000038",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000039",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000040",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000043",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000044",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000078",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000086",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000088",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000089",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000090",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000092",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000093",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000094",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000095",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000098",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000099",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000100",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000101",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000102",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000107",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000108",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000109",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000117",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000118",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000119",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000120",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000121",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000122",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000123",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000125",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000127",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000128",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000129",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000130",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000131",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000133",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000136",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000143",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000144",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000147",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000148",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000163",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000176",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000177",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000178",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000179",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000180",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000181",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000182",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000183",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000184",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000185",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000186",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000187",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000189",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000190",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000193",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000194",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000195",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000207",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000208",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000209",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000210",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000211",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000212",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000213",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000214",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000216",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000217",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000218",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000219",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000220",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000221",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000222",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000223",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000224",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000226",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000227",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000228",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000229",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000230",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000231",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000232",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000239",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000240",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000241",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000243",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000244",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000246",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000247",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000248",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000251",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000252",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000253",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000254",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000255",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000256",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000258",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000259",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000260",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000261",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000262",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000263",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000266",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000267",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000274",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000275",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000276",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000283",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000284",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000287",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000288",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000289",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000290",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000295",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000435",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000436",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000437",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000439",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000440",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000441",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000444",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000445",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000446",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000449",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000450",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000451",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000452",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000453",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000454",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000466",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000467",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000468",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000469",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000470",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000472",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000473",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000476",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000478",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000483",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000484",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000485",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000486",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000487",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000489",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000490",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000491",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000492",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000493",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000494",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000495",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000496",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000505",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000506",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000509",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000510",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000512",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000531",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000533",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000539",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000540",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000541",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000552",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000553",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000556",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000557",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000580",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000584",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000594",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000595",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000596",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000597",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000598",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000599",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000600",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000601",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000602",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000603",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000604",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000605",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000606",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000607",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000608",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000609",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000610",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000611",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000612",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000613",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000614",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000673",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000679",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000680",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000681",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000682",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000684",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000685",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000686",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000706",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000711",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000718",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000719",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000720",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000724",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000725",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000727",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000728",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000729",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000731",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000732",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000738",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000739",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000740",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000744",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000745",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000763",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000776",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000777",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000780",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000784",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000799",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000803",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000805",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000806",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000807",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000808",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000812",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000814",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000817",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000822",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000830",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000831",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000832",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000833",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000866",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000867",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000868",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000869",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000870",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000871",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000919",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000930",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000955",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000958",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000959",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000985",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  },
  {
    "establishmentId": "lab_plexus",
    "testId": "test_000986",
    "state": "catalogo_red_verificado",
    "sourceId": "src_plexus_tests"
  }
];

