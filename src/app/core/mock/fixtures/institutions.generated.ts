/* ============================================================================
    Las instituciones de salud reales de Bolivia, portadas al simulador.

    **GENERADO por `scripts/gen-institutions-fixture.mjs`. No editar a mano.**
    La fuente es `data/bolivia-instituciones/`, que destila
    `tools/extract-bolivia-institutions.py` de las planillas del propietario.

    22 clínicas privadas · 17 hospitales públicos y cajas ·
    19 aseguradoras.

    Reemplazan a «Clínica Los Olivos», «Hospital San Lucas» y «Clínica Nueva
    Esperanza», que eran nombres inventados en un producto que se le enseña a
    clínicas bolivianas de verdad.

    ## Lo que NO trae, y por qué

    · **Los 464 centros de primer nivel.** Están en `data/` pero no acá:
      son postas rurales de todo el departamento, sin teléfono ni punto, y
      llenarían el directorio de una ciudad con lugares a horas de viaje.

    · **Lo que la planilla deja vacío.** Cuatro clínicas no declaran razón social
      ni NIT, y viajan en `null`. No se completa.

    · **Habilitaciones, acreditaciones y servicios.** Las planillas no los
      declaran. Inventarlos para un establecimiento real sería peor que no
      tenerlos.

    ## Las coordenadas son derivadas, y lo dicen

    Las planillas traen dirección. El punto sale de Nominatim y cada uno viaja
    con su precisión: `via` — 25 · `ciudad` — 24 · `direccion` — 9.
    `ciudad` significa que no se reconoció la dirección y el punto es el centro
    — la ficha debe decirlo en vez de fingir precisión.

    ## Las aseguradoras vienen en dos ramos

    `coversHealth` sale de la sección de la planilla: 9 de personas
    (cubren salud) y 10 generales y de fianzas, que no.

    Regenerar con `yarn mock:institutions`.
    ========================================================================== */

/** Con cuánta precisión se resolvió el punto de una institución. */
export type PrecisionDeInstitucion = 'direccion' | 'via' | 'ciudad';

/** Una clínica privada. `legalName` y `taxId` son `null` si la planilla no los trae. */
export interface ClinicaReal {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly taxId: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  readonly city: string;
  readonly sector: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** Un hospital público o una caja de salud. `level` es el nivel de atención. */
export interface HospitalReal {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  /** Sólo los de segundo nivel declaran red. */
  readonly healthNetwork: string | null;
  readonly kind: string;
  readonly level: number | null;
  readonly city: string;
  readonly sector: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** Una aseguradora. `coversHealth` lo declara la sección de la planilla. */
export interface AseguradoraReal {
  readonly id: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly taxId: string | null;
  readonly address: string | null;
  readonly branch: string;
  readonly coversHealth: boolean;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** La procedencia, para mostrarla al pie de las pantallas. */
export const INSTITUCIONES_META = {
  package: "bolivia-instituciones-de-salud",
  schemaVersion: "1.0.0",
  extractedOn: "2026-09-17",
  scope: "Clínicas privadas, hospitales públicos y cajas: Santa Cruz de la Sierra. Centros de primer nivel: departamento de Santa Cruz, no el padrón nacional. Aseguradoras: de alcance nacional, con domicilio legal declarado.",
  warnings: ["Sin coordenadas: las planillas traen dirección, no geolocalización.","Cuatro clínicas no declaran razón social ni NIT; viajan en null.","Los centros de primer nivel no traen teléfono.","No es un padrón oficial completo ni un registro de habilitación vigente."],
} as const;

export const CLINICAS_REALES: readonly ClinicaReal[] = [
  {
    "id": "cli-clinica-las-americas",
    "name": "Clinica Las Americas",
    "legalName": "Clínica Metropolitana de las Américas S.A.",
    "taxId": "316258024",
    "address": "Av. Sexto Anillo esq. Beni # 5100",
    "phone": "800101055",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-foianini",
    "name": "Clinica Foianini",
    "legalName": "Clínica Angel Foianini S.R.L.",
    "taxId": "1028455022",
    "address": "Av. Irala # 468 / Calle Chuquisaca # 737",
    "phone": "3362211",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7931433,
    "lng": -63.1863254,
    "precision": "via"
  },
  {
    "id": "cli-clinica-universitario-martin-dockweiler",
    "name": "Clinica Universitario Martin Dockweiler",
    "legalName": "Operadora Lativ Administración S.A.",
    "taxId": "4010340662",
    "address": "Av. Noel Kempff Mercado (3er anillo interno)",
    "phone": "3180060",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-incor",
    "name": "Clinica Incor",
    "legalName": "Clínica Incor S.R.L.",
    "taxId": "1012499022",
    "address": "Av. 26 de Febrero, calle caranda",
    "phone": "3520444",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7849072,
    "lng": -63.1949106,
    "precision": "via"
  },
  {
    "id": "cli-clinica-urbari",
    "name": "Clinica Urbari",
    "legalName": "CLINICA URBARÍ S.A.",
    "taxId": "1028441025",
    "address": "Barrio Urbarí, Calle Igmiri # 555",
    "phone": "3534000",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-nino-jesus",
    "name": "Clinica Niño Jesus",
    "legalName": "Clínica Privada de Asistencia Médica Niño Jesús S.A.",
    "taxId": "1028557028",
    "address": "Av. Cañoto esq. Rafael Peña, primer anillo, zona central",
    "phone": "3366969",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-nino-jesus-ii",
    "name": "Clinica Niño Jesus II",
    "legalName": "Clinica Privada De Asistencia Medica Niño Jesus S.A.",
    "taxId": "1028557028",
    "address": "Calle Ballivián # 747",
    "phone": "78456019",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7842207,
    "lng": -63.1740413,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-montalvo",
    "name": "Clinica Montalvo",
    "legalName": "Clínica Bioginecológica Montalvo S.R.L.",
    "taxId": "1012565021",
    "address": "Barrio Urbarí, Av. Universo # 641.",
    "phone": "3581919",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-sirani",
    "name": "Clinica Sirani",
    "legalName": "Clinica Medica Sirani Ltda.",
    "taxId": "122079029",
    "address": "René Moreno # 667",
    "phone": "3352200",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7880063,
    "lng": -63.1810673,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-lourdes",
    "name": "Clinica Lourdes",
    "legalName": null,
    "taxId": null,
    "address": "René Moreno # 352.",
    "phone": "3325518",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7880063,
    "lng": -63.1810673,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-italia",
    "name": "Clinica Italia",
    "legalName": null,
    "taxId": null,
    "address": "Calle Colón Nº 345, entre las calles Pari y Mercado, zona de las siete calles",
    "phone": "67718675",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7856764,
    "lng": -63.1845842,
    "precision": "via"
  },
  {
    "id": "cli-clinica-santa-maria",
    "name": "Clinica Santa Maria",
    "legalName": "CLINICA SANTA MARIA",
    "taxId": "1453397017",
    "address": "Av. Viedma # 754",
    "phone": "3352002",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7887332,
    "lng": -63.1712458,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-san-pedro",
    "name": "Clinica San Pedro",
    "legalName": "Clínica San Pedro S.R.L.",
    "taxId": "1023211026",
    "address": "3er Anillo Externo Radial 15, # 37, zona Alto San Pedro",
    "phone": "70090283",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-cosalud",
    "name": "Clinica Cosalud",
    "legalName": "Corporación de Salud Cosalud S.R.L.",
    "taxId": "148758024",
    "address": "Oruro # 366",
    "phone": "3393960",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.8275514,
    "lng": -63.102714,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-cristo-rey",
    "name": "Clinica Cristo REY",
    "legalName": null,
    "taxId": null,
    "address": "Av. Roca y Coronado calle Chilón # 2025",
    "phone": "3523841",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-de-ojos-santa-cruz",
    "name": "Clinica DE Ojos Santa Cruz",
    "legalName": "CLINICA DE OJOS SANTA CRUZ LTDA.",
    "taxId": "4035895",
    "address": "Av. Centenario, Pasillo A. Barbery",
    "phone": "3327327",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7785965,
    "lng": -63.1984117,
    "precision": "via"
  },
  {
    "id": "cli-clinica-el-trompillo",
    "name": "Clinica EL Trompillo",
    "legalName": "Clínica Médica Quirúrgica El Trompillo",
    "taxId": "3729982013",
    "address": "Barrio El Trompillo, calle Zoilo Flores # 164",
    "phone": "3590011",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-grumedso",
    "name": "Clinica Grumedso",
    "legalName": "GRUPO MEDICO SOLIDARIO S.R.L.",
    "taxId": "136935024",
    "address": "Av. Moscu 6to. Anillo, Zona de la Cuchilla (frente a la Universidad Evangélica Boliviana",
    "phone": "3584050",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "cli-clinica-kamiya",
    "name": "Clinica Kamiya",
    "legalName": "CLINICA KAMIYA S.R.L.",
    "taxId": "1015047023",
    "address": "Av. Monseñor Rivero # 265.",
    "phone": "3363400",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7742738,
    "lng": -63.1823242,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-melendres",
    "name": "Clinica Melendres",
    "legalName": "Clínica Médica Melendres S.R.L.",
    "taxId": "136165029",
    "address": "Av. Grigotá # 2450 / 3er. Anillo.",
    "phone": "3520982",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7951834,
    "lng": -63.1894921,
    "precision": "via"
  },
  {
    "id": "cli-clinica-san-jose",
    "name": "Clinica San Jose",
    "legalName": "CLINICA SAN JOSE S.R.L.",
    "taxId": "1013979025",
    "address": "Calle Ingavi # 720",
    "phone": "3521542",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.7856797,
    "lng": -63.1909858,
    "precision": "direccion"
  },
  {
    "id": "cli-clinica-universitaria-ucebol",
    "name": "Clinica Universitaria Ucebol",
    "legalName": null,
    "taxId": "1026225020",
    "address": "Carretera al Norte, Km. 5",
    "phone": "3221317",
    "city": "Santa Cruz de la Sierra",
    "sector": "privado",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  }
];

export const HOSPITALES_REALES: readonly HospitalReal[] = [
  {
    "id": "hos-hospital-san-juan-de-dios",
    "name": "Hospital San Juan DE Dios",
    "address": "Calle Cuéllar #474 esq. España, Zona Central",
    "phone": "3332222",
    "healthNetwork": null,
    "kind": "hospital_tercer_nivel",
    "level": 3,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.7789963,
    "lng": -63.1841539,
    "precision": "via"
  },
  {
    "id": "hos-hospital-de-ninos-dr-mario-ortiz-suarez",
    "name": "Hospital DE Niños Dr. Mario Ortiz Suarez",
    "address": "Calle Santa Bárbara esq. Seoane, Zona Central",
    "phone": "3371110",
    "healthNetwork": null,
    "kind": "hospital_tercer_nivel",
    "level": 3,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-hospital-universitario-japones",
    "name": "Hospital Universitario Japones",
    "address": "3er Anillo Interno Av. Japón, entre canal Cotoca y Av. Paragua",
    "phone": "3462032",
    "healthNetwork": null,
    "kind": "hospital_tercer_nivel",
    "level": 3,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-instituto-oncologico-del-oriente-boliviano",
    "name": "Instituto Oncologico Del Oriente Boliviano",
    "address": "Av. Noel Kempff Mercado #890 3er Anillo Interno entre Av. San Martín y Canal Isuto",
    "phone": "3425502",
    "healthNetwork": null,
    "kind": "hospital_tercer_nivel",
    "level": 3,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.7704769,
    "lng": -63.20204,
    "precision": "via"
  },
  {
    "id": "hos-maternidad-percy-boland",
    "name": "Maternidad Percy Boland",
    "address": "Calle Rafael Peña, cerca del Primer Anillo",
    "phone": "3363522",
    "healthNetwork": null,
    "kind": "hospital_tercer_nivel",
    "level": 3,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.7780374,
    "lng": -63.1862777,
    "precision": "via"
  },
  {
    "id": "hos-hospital-municipal-bajio-del-oriente",
    "name": "Hospital Municipal Bajío del Oriente",
    "address": "Av. Simón Bolívar dos cuadras del 6to anillo, zona norte/este",
    "phone": "770-63226 / 3555008",
    "healthNetwork": "Red Sud",
    "kind": "hospital_segundo_nivel",
    "level": 2,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-hospital-municipal-frances",
    "name": "Hospital Municipal Francés",
    "address": "Av Santos Dumont 6to anillo Urbanizacion Paititi Uv. 129, zona sur",
    "phone": "3555008 / 3569090",
    "healthNetwork": "Red Sud",
    "kind": "hospital_segundo_nivel",
    "level": 2,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-hospital-municipal-pampa-de-la-isla",
    "name": "Hospital Municipal Pampa de la Isla",
    "address": "Av. Montecristo, zona este",
    "phone": "3518973",
    "healthNetwork": "Red Norte",
    "kind": "hospital_segundo_nivel",
    "level": 2,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.7540514,
    "lng": -63.0992748,
    "precision": "via"
  },
  {
    "id": "hos-hospital-municipal-plan-3000",
    "name": "Hospital Municipal Plan 3000",
    "address": "Av. Prefectural, diagonal al mercado Los Pocitos, Zona Plan 3000, zona sureste",
    "phone": "3494008",
    "healthNetwork": "Red Este",
    "kind": "hospital_segundo_nivel",
    "level": 2,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-hospital-municipal-villa-1ro-de-mayo",
    "name": "Hospital Municipal Villa 1ro de Mayo",
    "address": "7mo anillo, entre Cumavi y Av. Tres Pasos al Frente, zona este",
    "phone": "3621402",
    "healthNetwork": "Red Este",
    "kind": "hospital_segundo_nivel",
    "level": 2,
    "city": "Santa Cruz de la Sierra",
    "sector": "publico",
    "lat": -17.7347318,
    "lng": -63.1439004,
    "precision": "via"
  },
  {
    "id": "hos-caja-petrolera-santa-cruz",
    "name": "Caja Petrolera Santa Cruz",
    "address": "Rafael Peña / España",
    "phone": "3339111",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.7780374,
    "lng": -63.1862777,
    "precision": "via"
  },
  {
    "id": "hos-caja-nacional-de-salud",
    "name": "Caja Nacional DE Salud",
    "address": "Av. Irala entre Rene Moreno y MJ Santiestevan",
    "phone": "3362627",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-corporacion-del-seguro-social-militar",
    "name": "Corporacion Del Seguro Social Militar",
    "address": "Calle José Callaú Nº 192, Santa Cruz de la Sierra",
    "phone": "3324411",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.7853981,
    "lng": -63.1882976,
    "precision": "direccion"
  },
  {
    "id": "hos-caja-de-salud-cordes",
    "name": "Caja DE Salud Cordes",
    "address": "Tte. Juan Humberto Rivero, santa cruz de la sierra",
    "phone": "3346167",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "hos-caja-de-salud-de-caminos",
    "name": "Caja DE Salud DE Caminos",
    "address": "Av. Guapay, santa cruz de la sierra",
    "phone": "3461111",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.7766167,
    "lng": -63.1547963,
    "precision": "via"
  },
  {
    "id": "hos-caja-de-salud-de-la-banca-privada",
    "name": "Caja DE Salud DE LA Banca Privada",
    "address": "Calle España Nº 688, entre Andrés Ibáñez y Rafael Peña.",
    "phone": "3373131",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.7815911,
    "lng": -63.1850165,
    "precision": "via"
  },
  {
    "id": "hos-seguro-social-universitario",
    "name": "Seguro Social Universitario",
    "address": "Calle Colón #58",
    "phone": "3392816",
    "healthNetwork": null,
    "kind": "caja_de_salud",
    "level": null,
    "city": "Santa Cruz de la Sierra",
    "sector": "seguridad_social",
    "lat": -17.7889639,
    "lng": -63.1841244,
    "precision": "direccion"
  }
];

export const ASEGURADORAS_REALES: readonly AseguradoraReal[] = [
  {
    "id": "ase-personas-alianza-vida-seguros-y-reaseguros-s-a",
    "name": "Alianza Vida Seguros y Reaseguros S.A.",
    "shortName": "Alianza Vida S.A.",
    "taxId": "1015327022",
    "address": "Mario Gutiérrez Nº 3325, esq. Av. Roca y Coronado, Edificio Alianza, Zona Villa Mercedes, Santa Cruz de la Sierra, Bolivia.",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7873075,
    "lng": -63.2066206,
    "precision": "via"
  },
  {
    "id": "ase-personas-bisa-seguros-y-reaseguros-s-a",
    "name": "BISA Seguros y Reaseguros S.A.",
    "shortName": "BISA Seguros y Reaseguros S.A.",
    "taxId": "1020655027",
    "address": "Av. Arce N° 2631, Edificio Multicine, Piso N° 14, zona de San Jorge, La Paz, Bolivia",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7531652,
    "lng": -63.1644984,
    "precision": "via"
  },
  {
    "id": "ase-personas-compania-de-seguros-y-reaseguros-fortaleza-s-a",
    "name": "Compañía de Seguros y Reaseguros Fortaleza S.A.",
    "shortName": "Fortaleza Seguros y Reaseguros S.A.",
    "taxId": "1028175023",
    "address": "Av. Virgen de Cotoca N° 2080, Zona Lazareto, Santa Cruz de la Sierra, Bolivia",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7799409,
    "lng": -63.1484197,
    "precision": "via"
  },
  {
    "id": "ase-personas-crediseguro-s-a-seguros-personales",
    "name": "Crediseguro S.A. Seguros Personales",
    "shortName": "Crediseguro S.A. Seguros Personales",
    "taxId": "191310020",
    "address": "Av. Hernando Siles esq. calle 10 de Obrajes, Torre Empresarial ESIMSA, Piso 9, La Paz, Bolivia.",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-personas-la-boliviana-ciacruz-seguros-personales-s-a",
    "name": "LA BOLIVIANA CIACRUZ SEGUROS PERSONALES S.A.",
    "shortName": "LA BOLIVIANA CIACRUZ SEGUROS PERSONALES S.A.",
    "taxId": "1006989027",
    "address": "Calle Colón N° 288, Piso 2°, en la ciudad de La Paz, Bolivia.",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7856764,
    "lng": -63.1845842,
    "precision": "via"
  },
  {
    "id": "ase-personas-la-vitalicia-seguros-y-reaseguros-de-vida-s-a",
    "name": "LA VITALICIA SEGUROS Y REASEGUROS DE VIDA S.A.",
    "shortName": "LA VITALICIA SEGUROS Y REASEGUROS DE VIDA S.A.",
    "taxId": "1020687029",
    "address": "Av. 6 de Agosto Nº 2860, Zona San Jorge, La Paz, Bolivia",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.8231198,
    "lng": -63.1201558,
    "precision": "via"
  },
  {
    "id": "ase-personas-nacional-seguros-vida-y-salud-s-a",
    "name": "Nacional Seguros Vida y Salud S.A.",
    "shortName": "Nacional Seguros Vida y Salud S.A.",
    "taxId": "1028483024",
    "address": "Avenida Cristóbal de Mendoza esquina Avenida Alemana N° 333 (Segundo Anillo), Santa Cruz, Bolivia",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-personas-empresa-de-seguros-y-reaseguros-personales-univida-s-a",
    "name": "Empresa de Seguros y Reaseguros Personales UNIVIDA S.A.",
    "shortName": "UNIVIDA S.A.",
    "taxId": "301204024",
    "address": "Av. Camacho N° 1485, Edificio La Urbana, Piso 3, La Paz, Bolivia",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7498538,
    "lng": -63.165577,
    "precision": "via"
  },
  {
    "id": "ase-personas-santa-cruz-vida-y-salud-seguros-y-reaseguros-personales-s-a",
    "name": "Santa Cruz Vida y Salud Seguros y Reaseguros Personales S.A.",
    "shortName": "Santa Cruz Vida y Salud S.A.",
    "taxId": "370008027",
    "address": "Avenida San Martín, Edificio Manzana 40, Torre 2, Piso 13, Zona Equipetrol, Santa Cruz de la Sierra, Bolivia.",
    "branch": "personas",
    "coversHealth": true,
    "lat": -17.7714522,
    "lng": -63.1912143,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-alianza-compania-de-seguros-y-reaseguros-s-a",
    "name": "Alianza Compañía de Seguros y Reaseguros S.A.",
    "shortName": "Alianza Seguros S.A.",
    "taxId": "1020351029",
    "address": "Av. Roca y Coronado Nº 1380, Santa Cruz de la Sierra, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.7848559,
    "lng": -63.1962108,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-bisa-seguros-y-reaseguros-s-a",
    "name": "BISA Seguros y Reaseguros S.A.",
    "shortName": "BISA Seguros y Reaseguros S.A.",
    "taxId": "1020655027",
    "address": "Av. Arce N° 2631, Edificio Multicine, Piso N° 14, zona de San Jorge, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.7531652,
    "lng": -63.1644984,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-compania-de-seguros-y-reaseguros-fortaleza-s-a",
    "name": "Compañía de Seguros y Reaseguros Fortaleza S.A.",
    "shortName": "Fortaleza Seguros y Reaseguros S.A.",
    "taxId": "1028175023",
    "address": "Av. Virgen de Cotoca N° 2080, Zona Lazareto, Santa Cruz de la Sierra, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.7799409,
    "lng": -63.1484197,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-crediseguro-s-a-seguros-generales",
    "name": "Crediseguro S.A. Seguros Generales",
    "shortName": "Crediseguro S.A. Seguros Generales",
    "taxId": "343764028",
    "address": "Avenida Hernando Siles esquina Calle 10 de Obrajes, Torre Empresarial ESIMSA, Piso 9, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-generales_y_fianzas-la-boliviana-ciacruz-de-seguros-y-reaseguros-s-a",
    "name": "La Boliviana Ciacruz de Seguros y Reaseguros S.A.",
    "shortName": "La Boliviana Ciacruz de Seguros y Reaseguros S.A.",
    "taxId": "1007017028",
    "address": "Calle Colón N° 288, Edificio La Boliviana Ciacruz (Zona Central), La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.7856764,
    "lng": -63.1845842,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-mercantil-santa-cruz-seguros-y-reaseguros-generales-s-a",
    "name": "Mercantil Santa Cruz Seguros y Reaseguros Generales S.A.",
    "shortName": "Mercantil Santa Cruz Seguros y Reaseguros Generales S.A.",
    "taxId": "399309026",
    "address": "Av. Camacho N° 1448, Edif. Banco Mercantil Santa Cruz, Piso 11, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.7498538,
    "lng": -63.165577,
    "precision": "via"
  },
  {
    "id": "ase-generales_y_fianzas-nacional-seguros-patrimoniales-y-fianzas-s-a",
    "name": "Nacional Seguros Patrimoniales y Fianzas S.A.",
    "shortName": "Nacional Seguros Patrimoniales y Fianzas S.A.",
    "taxId": "145776027",
    "address": "Avenida Cristóbal de Mendoza esquina Avenida Alemana Nº 333 (Segundo Anillo), Santa Cruz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-generales_y_fianzas-seguros-y-reaseguros-credinform-international-s-a",
    "name": "Seguros y Reaseguros Credinform International S.A.",
    "shortName": "Seguros y Reaseguros Credinform International S.A.",
    "taxId": "1006765027",
    "address": "Calle Julio Patiño N° 550, esquina calle 12, Calacoto, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-generales_y_fianzas-seguros-illimani-s-a",
    "name": "Seguros Illimani S.A.",
    "shortName": "Seguros Illimani S.A.",
    "taxId": "1007165029",
    "address": "Calle Loayza N° 233, Edificio Mariscal de Ayacucho, Piso 10, Oficinas 1004-1013, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  },
  {
    "id": "ase-generales_y_fianzas-unibienes-seguros-y-reaseguros-patrimoniales-s-a",
    "name": "UNIBIENES Seguros y Reaseguros Patrimoniales S.A.",
    "shortName": "Unibienes S.A.",
    "taxId": "338090023",
    "address": "Calle 10 de Calacoto, Edificio Emporium N° 7812, Piso 5, Zona Sur, La Paz, Bolivia",
    "branch": "generales_y_fianzas",
    "coversHealth": false,
    "lat": -17.783327,
    "lng": -63.18214,
    "precision": "ciudad"
  }
];

