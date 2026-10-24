/* ============================================================================
    Arancel FONASA 2026 (Chile, Modalidad Libre Elección), Grupos 03
    «Laboratorio» y 04 «Imagenología», convertido a bolivianos.

    **GENERADO por `scripts/gen-fonasa-fixture.mjs`. No editar a mano.**
    Fuente: https://www.fonasa.gob.cl/wp-content/uploads/sites/3/2026/03/1-Libro-Arancel-MLE-2026.pdf
    Copia leída: https://redsalud.ssmso.cl/wp-content/uploads/2026/05/1-Libro-Arancel-MLE-2026.pdf · SHA-256: 79b0021be23a702fb750022a6c85bca30a05b4430329bb7933a71c24e797cf6a
    Columna: NIVEL 1 · TOTAL (valores verbatim en `valueClp`).
    Conversión: CLP ÷ 972.6 × 12 — Dólar observado, Banco Central de Chile (SII), 01/10/2026; Tipo de Cambio Oficial del Banco Central de Bolivia, vigente el 01/10/2026.

    Es una REFERENCIA EXTRANJERA: se usa sólo donde no hay dato boliviano
    (INLASA para laboratorio; para imagen no existe).
    ========================================================================== */

/** Una prestación del arancel. `priceBs` es la cadena decimal exacta («39.11»). */
export interface PrestacionFonasa {
  readonly code: string;
  readonly name: string;
  readonly officialName: string;
  readonly section: string | null;
  readonly valueClp: number;
  readonly priceBs: string;
}

export const FONASA_FUENTE = {"url":"https://www.fonasa.gob.cl/wp-content/uploads/sites/3/2026/03/1-Libro-Arancel-MLE-2026.pdf","vigencia":"2026-03-16","sha256":"79b0021be23a702fb750022a6c85bca30a05b4430329bb7933a71c24e797cf6a"} as const;

export const FONASA_CONVERSION = {
  "fecha": "2026-10-01",
  "clpPorUsd": 972.6,
  "fuenteClp": "Dólar observado, Banco Central de Chile (SII), 01/10/2026",
  "bobPorUsd": 12,
  "fuenteBob": "Tipo de Cambio Oficial del Banco Central de Bolivia, vigente el 01/10/2026"
} as const;

export const FONASA_LABORATORIO: readonly PrestacionFonasa[] = [
  {
    "code": "03-01-002",
    "name": "Acido fólico o folatos",
    "officialName": "ACIDO FÓLICO O FOLATOS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5140,
    "priceBs": "63.42"
  },
  {
    "code": "03-01-003",
    "name": "Adenograma, mielograma, c/u",
    "officialName": "ADENOGRAMA, MIELOGRAMA, C/U",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 8490,
    "priceBs": "104.75"
  },
  {
    "code": "03-01-006",
    "name": "Agregación plaquetaria con diferentes agonistas",
    "officialName": "AGREGACIÓN PLAQUETARIA CON DIFERENTES AGONISTAS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4970,
    "priceBs": "61.32"
  },
  {
    "code": "03-01-007",
    "name": "Anticoagulantes circulantes o anticoagulante lúpico",
    "officialName": "ANTICOAGULANTES CIRCULANTES O ANTICOAGULANTE LÚPICO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5370,
    "priceBs": "66.26"
  },
  {
    "code": "03-01-008",
    "name": "Antitrombina iii",
    "officialName": "ANTITROMBINA III",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5370,
    "priceBs": "66.26"
  },
  {
    "code": "03-01-011",
    "name": "Coagulación, tiempo de",
    "officialName": "COAGULACIÓN, TIEMPO DE",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1540,
    "priceBs": "19.00"
  },
  {
    "code": "03-01-013",
    "name": "Tiempo de lisis del coágulo",
    "officialName": "TIEMPO DE LISIS DEL COÁGULO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 710,
    "priceBs": "8.76"
  },
  {
    "code": "03-01-014",
    "name": "Prueba de antiglobulina directa",
    "officialName": "PRUEBA DE ANTIGLOBULINA DIRECTA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1430,
    "priceBs": "17.64"
  },
  {
    "code": "03-01-017",
    "name": "Deshidrogenasa glucosa-6-fosfato en eritrocitos",
    "officialName": "DESHIDROGENASA GLUCOSA-6-FOSFATO EN ERITROCITOS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4910,
    "priceBs": "60.58"
  },
  {
    "code": "03-01-020",
    "name": "Tiempo de lisis de euglobulinas",
    "officialName": "TIEMPO DE LISIS DE EUGLOBULINAS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1680,
    "priceBs": "20.73"
  },
  {
    "code": "03-01-021",
    "name": "Fibrinógeno",
    "officialName": "FIBRINÓGENO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2620,
    "priceBs": "32.33"
  },
  {
    "code": "03-01-022",
    "name": "Test de neutralización plaquetaria",
    "officialName": "TEST DE NEUTRALIZACIÓN PLAQUETARIA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5150,
    "priceBs": "63.54"
  },
  {
    "code": "03-01-024",
    "name": "Factor v",
    "officialName": "FACTOR V",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2300,
    "priceBs": "28.38"
  },
  {
    "code": "03-01-025",
    "name": "Factores vii, viii, ix, x, xi, xii, xiii, c/u",
    "officialName": "FACTORES VII, VIII, IX, X, XI, XII, XIII, C/U",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5190,
    "priceBs": "64.03"
  },
  {
    "code": "03-01-026",
    "name": "Ferritina",
    "officialName": "FERRITINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 6170,
    "priceBs": "76.13"
  },
  {
    "code": "03-01-027",
    "name": "Fibrinógeno, productos de degradación del",
    "officialName": "FIBRINÓGENO, PRODUCTOS DE DEGRADACIÓN DEL",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5150,
    "priceBs": "63.54"
  },
  {
    "code": "03-01-028",
    "name": "Fierro sérico",
    "officialName": "FIERRO SÉRICO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2180,
    "priceBs": "26.90"
  },
  {
    "code": "03-01-029",
    "name": "Fierro, capacidad de fijación del (incluye fierro sérico)",
    "officialName": "FIERRO, CAPACIDAD DE FIJACIÓN DEL (INCLUYE FIERRO SÉRICO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4740,
    "priceBs": "58.48"
  },
  {
    "code": "03-01-030",
    "name": "Fierro, cinética del (cada determinación)",
    "officialName": "FIERRO, CINÉTICA DEL (CADA DETERMINACIÓN)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5340,
    "priceBs": "65.89"
  },
  {
    "code": "03-01-034",
    "name": "Clasificación sanguínea ab0 y rhd",
    "officialName": "CLASIFICACIÓN SANGUÍNEA AB0 Y RHD",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2560,
    "priceBs": "31.59"
  },
  {
    "code": "03-01-035",
    "name": "Haptoglobina cuantitativa",
    "officialName": "HAPTOGLOBINA CUANTITATIVA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4880,
    "priceBs": "60.21"
  },
  {
    "code": "03-01-036",
    "name": "Hematocrito (proc. aut.)",
    "officialName": "HEMATOCRITO (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 790,
    "priceBs": "9.75"
  },
  {
    "code": "03-01-038",
    "name": "Hemoglobina en sangre total (proc. aut.)",
    "officialName": "HEMOGLOBINA EN SANGRE TOTAL (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 790,
    "priceBs": "9.75"
  },
  {
    "code": "03-01-040",
    "name": "Hemoglobina fetal cuantitativa en eritrocitos",
    "officialName": "HEMOGLOBINA FETAL CUANTITATIVA EN ERITROCITOS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4980,
    "priceBs": "61.44"
  },
  {
    "code": "03-01-041",
    "name": "Hemoglobina glicada a1c",
    "officialName": "HEMOGLOBINA GLICADA A1C",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4640,
    "priceBs": "57.25"
  },
  {
    "code": "03-01-042",
    "name": "Hemoglobina plasmática",
    "officialName": "HEMOGLOBINA PLASMÁTICA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1050,
    "priceBs": "12.95"
  },
  {
    "code": "03-01-044",
    "name": "Electroforesis de hemoglobina",
    "officialName": "ELECTROFORESIS DE HEMOGLOBINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5430,
    "priceBs": "67.00"
  },
  {
    "code": "03-01-045",
    "name": "Hemograma (incluye recuentos de leucocitos, eritrocitos, plaquetas, hemoglobina, hematocrito, fórmula leucocitaria, características de los elementos figurados y velocidad de eritrosedimentación)",
    "officialName": "HEMOGRAMA (INCLUYE RECUENTOS DE LEUCOCITOS, ERITROCITOS, PLAQUETAS, HEMOGLOBINA, HEMATOCRITO, FÓRMULA LEUCOCITARIA, CARACTERÍSTICAS DE LOS ELEMENTOS FIGURADOS Y VELOCIDAD DE ERITROSEDIMENTACIÓN)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 3170,
    "priceBs": "39.11"
  },
  {
    "code": "03-01-048",
    "name": "Hemosiderina medular",
    "officialName": "HEMOSIDERINA MEDULAR",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1250,
    "priceBs": "15.42"
  },
  {
    "code": "03-01-049",
    "name": "Cuantificación de heparina",
    "officialName": "CUANTIFICACIÓN DE HEPARINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5960,
    "priceBs": "73.53"
  },
  {
    "code": "03-01-051",
    "name": "Identificación de anticuerpos irregulares eritrocitarios",
    "officialName": "IDENTIFICACIÓN DE ANTICUERPOS IRREGULARES ERITROCITARIOS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5150,
    "priceBs": "63.54"
  },
  {
    "code": "03-01-054",
    "name": "Metahemoglobina",
    "officialName": "METAHEMOGLOBINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1580,
    "priceBs": "19.49"
  },
  {
    "code": "03-01-059",
    "name": "Tiempo de protrombina (incluye inr, razón internacional normalizada)",
    "officialName": "TIEMPO DE PROTROMBINA (INCLUYE INR, RAZÓN INTERNACIONAL NORMALIZADA)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1590,
    "priceBs": "19.62"
  },
  {
    "code": "03-01-062",
    "name": "Recuento de basófilos (absoluto)",
    "officialName": "RECUENTO DE BASÓFILOS (ABSOLUTO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1080,
    "priceBs": "13.33"
  },
  {
    "code": "03-01-063",
    "name": "Recuento de eosinófilos (absoluto)",
    "officialName": "RECUENTO DE EOSINÓFILOS (ABSOLUTO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1010,
    "priceBs": "12.46"
  },
  {
    "code": "03-01-064",
    "name": "Recuento de eritrocitos, absoluto (proc. aut.)",
    "officialName": "RECUENTO DE ERITROCITOS, ABSOLUTO (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 770,
    "priceBs": "9.50"
  },
  {
    "code": "03-01-065",
    "name": "Recuento de leucocitos, absoluto (proc. aut.)",
    "officialName": "RECUENTO DE LEUCOCITOS, ABSOLUTO (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 750,
    "priceBs": "9.25"
  },
  {
    "code": "03-01-066",
    "name": "Recuento de linfocitos (absoluto)",
    "officialName": "RECUENTO DE LINFOCITOS (ABSOLUTO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1300,
    "priceBs": "16.04"
  },
  {
    "code": "03-01-067",
    "name": "Recuento de plaquetas (absoluto)",
    "officialName": "RECUENTO DE PLAQUETAS (ABSOLUTO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1330,
    "priceBs": "16.41"
  },
  {
    "code": "03-01-068",
    "name": "Recuento de reticulocitos (absoluto o porcentual)",
    "officialName": "RECUENTO DE RETICULOCITOS (ABSOLUTO O PORCENTUAL)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1030,
    "priceBs": "12.71"
  },
  {
    "code": "03-01-069",
    "name": "Recuento diferencial o fórmula leucocitaria (proc. aut.)",
    "officialName": "RECUENTO DIFERENCIAL O FÓRMULA LEUCOCITARIA (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2180,
    "priceBs": "26.90"
  },
  {
    "code": "03-01-070",
    "name": "Resistencia globular osmótica",
    "officialName": "RESISTENCIA GLOBULAR OSMÓTICA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 3430,
    "priceBs": "42.32"
  },
  {
    "code": "03-01-072",
    "name": "Tiempo de sangría (no incluye dispositivo asociado)",
    "officialName": "TIEMPO DE SANGRÍA (NO INCLUYE DISPOSITIVO ASOCIADO)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 1540,
    "priceBs": "19.00"
  },
  {
    "code": "03-01-082",
    "name": "Transferrina",
    "officialName": "TRANSFERRINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 5640,
    "priceBs": "69.59"
  },
  {
    "code": "03-01-083",
    "name": "Trombina, tiempo de",
    "officialName": "TROMBINA, TIEMPO DE",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2120,
    "priceBs": "26.16"
  },
  {
    "code": "03-01-085",
    "name": "Tromboplastina, tiempo parcial de (ttpa, ttpk o similares)",
    "officialName": "TROMBOPLASTINA, TIEMPO PARCIAL DE (TTPA, TTPK O SIMILARES)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 2450,
    "priceBs": "30.23"
  },
  {
    "code": "03-01-086",
    "name": "Velocidad de eritrosedimentación (proc. aut.)",
    "officialName": "VELOCIDAD DE ERITROSEDIMENTACIÓN (PROC. AUT.)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 570,
    "priceBs": "7.03"
  },
  {
    "code": "03-01-089",
    "name": "Factor von willebrand antigénico (fvw:ag)",
    "officialName": "FACTOR VON WILLEBRAND ANTIGÉNICO (FVW:AG)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 10330,
    "priceBs": "127.45"
  },
  {
    "code": "03-01-090",
    "name": "Factor von willebrand antigénico cofactor ristocetina (fvw:coris)",
    "officialName": "FACTOR VON WILLEBRAND ANTIGÉNICO COFACTOR RISTOCETINA (FVW:CORIS)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 9770,
    "priceBs": "120.54"
  },
  {
    "code": "03-01-091",
    "name": "Proteína c funcional",
    "officialName": "PROTEÍNA C FUNCIONAL",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 31990,
    "priceBs": "394.69"
  },
  {
    "code": "03-01-092",
    "name": "Proteína s",
    "officialName": "PROTEÍNA S",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 37830,
    "priceBs": "466.75"
  },
  {
    "code": "03-01-093",
    "name": "Resistencia a la proteína c activada",
    "officialName": "RESISTENCIA A LA PROTEÍNA C ACTIVADA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 23820,
    "priceBs": "293.89"
  },
  {
    "code": "03-01-094",
    "name": "Estudio de la hemoglobinuria paroxística nocturna (hpn) por citometría de flujo",
    "officialName": "ESTUDIO DE LA HEMOGLOBINURIA PAROXÍSTICA NOCTURNA (HPN) POR CITOMETRÍA DE FLUJO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 49130,
    "priceBs": "606.17"
  },
  {
    "code": "03-01-095",
    "name": "Dímero-d",
    "officialName": "DÍMERO-D",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 12280,
    "priceBs": "151.51"
  },
  {
    "code": "03-01-096",
    "name": "Procalcitonina",
    "officialName": "PROCALCITONINA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 44720,
    "priceBs": "551.76"
  },
  {
    "code": "03-01-097",
    "name": "Inhibidor de factor de la coagulación",
    "officialName": "INHIBIDOR DE FACTOR DE LA COAGULACIÓN",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 93130,
    "priceBs": "1149.04"
  },
  {
    "code": "03-01-098",
    "name": "Secreción plaquetaria con diferentes agonistas",
    "officialName": "SECRECIÓN PLAQUETARIA CON DIFERENTES AGONISTAS",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 120070,
    "priceBs": "1481.43"
  },
  {
    "code": "03-01-099",
    "name": "Tiempo de veneno de víbora de russell diluído",
    "officialName": "TIEMPO DE VENENO DE VÍBORA DE RUSSELL DILUÍDO",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 45100,
    "priceBs": "556.45"
  },
  {
    "code": "03-01-100",
    "name": "Antitrombina iii antigénica",
    "officialName": "ANTITROMBINA III ANTIGÉNICA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 45240,
    "priceBs": "558.17"
  },
  {
    "code": "03-01-114",
    "name": "Proteína c antigénica",
    "officialName": "PROTEÍNA C ANTIGÉNICA",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 45400,
    "priceBs": "560.15"
  },
  {
    "code": "03-01-116",
    "name": "Hemoglobina glicada, a1c, test rápido en el lugar de asistencia (incluye toma de muestra sangre capilar)",
    "officialName": "HEMOGLOBINA GLICADA, A1C, TEST RÁPIDO EN EL LUGAR DE ASISTENCIA (INCLUYE TOMA DE MUESTRA SANGRE CAPILAR)",
    "section": "SANGRE, HEMATOLOGIA",
    "valueClp": 4640,
    "priceBs": "57.25"
  },
  {
    "code": "03-02-001",
    "name": "Cuerpos cetónicos en sangre",
    "officialName": "CUERPOS CETÓNICOS EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 960,
    "priceBs": "11.84"
  },
  {
    "code": "03-02-002",
    "name": "Acido cítrico",
    "officialName": "ACIDO CÍTRICO",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3340,
    "priceBs": "41.21"
  },
  {
    "code": "03-02-004",
    "name": "Lactato en sangre",
    "officialName": "LACTATO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 4180,
    "priceBs": "51.57"
  },
  {
    "code": "03-02-005",
    "name": "Acido úrico, en sangre",
    "officialName": "ACIDO ÚRICO, EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1560,
    "priceBs": "19.25"
  },
  {
    "code": "03-02-008",
    "name": "Amilasa, en sangre",
    "officialName": "AMILASA, EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2450,
    "priceBs": "30.23"
  },
  {
    "code": "03-02-009",
    "name": "Aminoácidos, cualitativo en sangre",
    "officialName": "AMINOÁCIDOS, CUALITATIVO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6900,
    "priceBs": "85.13"
  },
  {
    "code": "03-02-010",
    "name": "Amonio",
    "officialName": "AMONIO",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2530,
    "priceBs": "31.22"
  },
  {
    "code": "03-02-070",
    "name": "Apolipoproteínas (a1, b u otras) c/u",
    "officialName": "APOLIPOPROTEÍNAS (A1, B U OTRAS) C/U",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 7100,
    "priceBs": "87.60"
  },
  {
    "code": "03-02-011",
    "name": "Bicarbonato (proc. aut.)",
    "officialName": "BICARBONATO (PROC. AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 740,
    "priceBs": "9.13"
  },
  {
    "code": "03-02-012",
    "name": "Bilirrubina total (proc. aut.)",
    "officialName": "BILIRRUBINA TOTAL (PROC. AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1590,
    "priceBs": "19.62"
  },
  {
    "code": "03-02-013",
    "name": "Bilirrubina total y conjugada",
    "officialName": "BILIRRUBINA TOTAL Y CONJUGADA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1500,
    "priceBs": "18.51"
  },
  {
    "code": "03-02-015",
    "name": "Calcio en sangre",
    "officialName": "CALCIO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1420,
    "priceBs": "17.52"
  },
  {
    "code": "03-02-017",
    "name": "Caroteno",
    "officialName": "CAROTENO",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2270,
    "priceBs": "28.01"
  },
  {
    "code": "03-02-018",
    "name": "Caroteno, prueba de sobrecarga de, además 2 códigos 03-07-011 o 03-07-012.",
    "officialName": "CAROTENO, PRUEBA DE SOBRECARGA DE, ADEMÁS 2 CÓDIGOS 03-07-011 O 03-07-012.",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 4920,
    "priceBs": "60.70"
  },
  {
    "code": "03-02-019",
    "name": "Ceruloplasmina",
    "officialName": "CERULOPLASMINA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3790,
    "priceBs": "46.76"
  },
  {
    "code": "03-02-020",
    "name": "Cobre en sangre",
    "officialName": "COBRE EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2110,
    "priceBs": "26.03"
  },
  {
    "code": "03-02-067",
    "name": "Colesterol total (proc. aut.)",
    "officialName": "COLESTEROL TOTAL (PROC. AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1390,
    "priceBs": "17.15"
  },
  {
    "code": "03-02-068",
    "name": "Colesterol HDL (proc. aut.)",
    "officialName": "COLESTEROL HDL (PROC. AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2070,
    "priceBs": "25.54"
  },
  {
    "code": "03-02-021",
    "name": "Colinesterasa en suero o plasma",
    "officialName": "COLINESTERASA EN SUERO O PLASMA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3050,
    "priceBs": "37.63"
  },
  {
    "code": "03-02-023",
    "name": "Creatinina en sangre",
    "officialName": "CREATININA EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1370,
    "priceBs": "16.90"
  },
  {
    "code": "03-02-024",
    "name": "Clearance de creatinina (proc.aut.)",
    "officialName": "CLEARANCE DE CREATININA (PROC.AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3020,
    "priceBs": "37.26"
  },
  {
    "code": "03-02-025",
    "name": "Creatinquinasa CK - MB actividad",
    "officialName": "CREATINQUINASA CK - MB ACTIVIDAD",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 5440,
    "priceBs": "67.12"
  },
  {
    "code": "03-02-026",
    "name": "Creatinquinasa CK - total",
    "officialName": "CREATINQUINASA CK - TOTAL",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3900,
    "priceBs": "48.12"
  },
  {
    "code": "03-02-027",
    "name": "Troponina",
    "officialName": "TROPONINA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 11650,
    "priceBs": "143.74"
  },
  {
    "code": "03-02-030",
    "name": "Deshidrogenasa láctica total (LDH)",
    "officialName": "DESHIDROGENASA LÁCTICA TOTAL (LDH)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2450,
    "priceBs": "30.23"
  },
  {
    "code": "03-02-031",
    "name": "Deshidrogenasa láctica total (LDH), con separación de isoenzimas",
    "officialName": "DESHIDROGENASA LÁCTICA TOTAL (LDH), CON SEPARACIÓN DE ISOENZIMAS",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6740,
    "priceBs": "83.16"
  },
  {
    "code": "03-02-032",
    "name": "Electrolitos plasmáticos (sodio, potasio, cloro) c/u",
    "officialName": "ELECTROLITOS PLASMÁTICOS (SODIO, POTASIO, CLORO) C/U",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1320,
    "priceBs": "16.29"
  },
  {
    "code": "03-02-033",
    "name": "Enzima convertidora de angiotensina i",
    "officialName": "ENZIMA CONVERTIDORA DE ANGIOTENSINA I",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 8170,
    "priceBs": "100.80"
  },
  {
    "code": "03-02-034",
    "name": "Perfil lipídico (incluye mediciones de colesterol total, hdl-colesterol y triglicéridos con estimaciones por fórmula de ldl-colesterol, vldl-colesterol y colesterol no-hdl)",
    "officialName": "PERFIL LIPÍDICO (INCLUYE MEDICIONES DE COLESTEROL TOTAL, HDL-COLESTEROL Y TRIGLICÉRIDOS CON ESTIMACIONES POR FÓRMULA DE LDL-COLESTEROL, VLDL-COLESTEROL Y COLESTEROL NO-HDL)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6380,
    "priceBs": "78.72"
  },
  {
    "code": "03-02-035",
    "name": "Fármacos y/o drogas; niveles plasmáticos de (alcohol, anorexígenos, antiarrítmicos, antibióticos, antidepresivos, antiepilépticos, antihistamínicos, antiinflamatorios y analgésicos, estimulantes respiratorios, tranquilizantes mayores y menores, etc.) c/u",
    "officialName": "FÁRMACOS Y/O DROGAS; NIVELES PLASMÁTICOS DE (ALCOHOL, ANOREXÍGENOS, ANTIARRÍTMICOS, ANTIBIÓTICOS, ANTIDEPRESIVOS, ANTIEPILÉPTICOS, ANTIHISTAMÍNICOS, ANTIINFLAMATORIOS Y ANALGÉSICOS, ESTIMULANTES RESPIRATORIOS, TRANQUILIZANTES MAYORES Y MENORES, ETC.) C/U",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6410,
    "priceBs": "79.09"
  },
  {
    "code": "03-02-036",
    "name": "Fenilalanina",
    "officialName": "FENILALANINA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2660,
    "priceBs": "32.82"
  },
  {
    "code": "03-02-039",
    "name": "Fosfatasas alcalinas con separación de isoenzimas hepáticas, intestinales, óseas c/u",
    "officialName": "FOSFATASAS ALCALINAS CON SEPARACIÓN DE ISOENZIMAS HEPÁTICAS, INTESTINALES, ÓSEAS C/U",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6490,
    "priceBs": "80.07"
  },
  {
    "code": "03-02-040",
    "name": "Fosfatasas alcalinas totales",
    "officialName": "FOSFATASAS ALCALINAS TOTALES",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1310,
    "priceBs": "16.16"
  },
  {
    "code": "03-02-042",
    "name": "Fósforo (fosfatos) en sangre",
    "officialName": "FÓSFORO (FOSFATOS) EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1880,
    "priceBs": "23.20"
  },
  {
    "code": "03-02-043",
    "name": "Galactosa",
    "officialName": "GALACTOSA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 910,
    "priceBs": "11.23"
  },
  {
    "code": "03-02-045",
    "name": "Gamma glutamiltranspeptidasa (GGT)",
    "officialName": "GAMMA GLUTAMILTRANSPEPTIDASA (GGT)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2300,
    "priceBs": "28.38"
  },
  {
    "code": "03-02-046",
    "name": "Gases y equilibrio ácido base en sangre (incluye: ph, o2, co2, exceso de base y bicarbonato), todos o cada uno de los parámetros",
    "officialName": "GASES Y EQUILIBRIO ÁCIDO BASE EN SANGRE (INCLUYE: PH, O2, CO2, EXCESO DE BASE Y BICARBONATO), TODOS O CADA UNO DE LOS PARÁMETROS",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 4020,
    "priceBs": "49.60"
  },
  {
    "code": "03-02-047",
    "name": "Glucosa en sangre",
    "officialName": "GLUCOSA EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1280,
    "priceBs": "15.79"
  },
  {
    "code": "03-02-048",
    "name": "Glucosa, prueba de tolerancia a la glucosa oral (ptgo), (dos determinaciones; no incluye la glucosa que se administra; incluye el valor de las dos tomas de muestras)",
    "officialName": "GLUCOSA, PRUEBA DE TOLERANCIA A LA GLUCOSA ORAL (PTGO), (DOS DETERMINACIONES; NO INCLUYE LA GLUCOSA QUE SE ADMINISTRA; INCLUYE EL VALOR DE LAS DOS TOMAS DE MUESTRAS)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 5960,
    "priceBs": "73.53"
  },
  {
    "code": "03-02-050",
    "name": "Adenosindeaminasa en sangre u otro fluido biológico (ada)",
    "officialName": "ADENOSINDEAMINASA EN SANGRE U OTRO FLUIDO BIOLÓGICO (ADA)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 5450,
    "priceBs": "67.24"
  },
  {
    "code": "03-02-052",
    "name": "Leucinaminopeptidasa (lap)",
    "officialName": "LEUCINAMINOPEPTIDASA (LAP)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2390,
    "priceBs": "29.49"
  },
  {
    "code": "03-02-053",
    "name": "Lipasa en sangre",
    "officialName": "LIPASA EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2720,
    "priceBs": "33.56"
  },
  {
    "code": "03-02-055",
    "name": "Litio en sangre",
    "officialName": "LITIO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2990,
    "priceBs": "36.89"
  },
  {
    "code": "03-02-056",
    "name": "Magnesio en sangre",
    "officialName": "MAGNESIO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3270,
    "priceBs": "40.35"
  },
  {
    "code": "03-02-057",
    "name": "Nitrógeno ureico y/o urea, en sangre",
    "officialName": "NITRÓGENO UREICO Y/O UREA, EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1350,
    "priceBs": "16.66"
  },
  {
    "code": "03-02-058",
    "name": "Osmolalidad en sangre",
    "officialName": "OSMOLALIDAD EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2120,
    "priceBs": "26.16"
  },
  {
    "code": "03-02-075",
    "name": "Perfil bioquímico (determinación automatizada de 12 parámetros)",
    "officialName": "PERFIL BIOQUÍMICO (DETERMINACIÓN AUTOMATIZADA DE 12 PARÁMETROS)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 8960,
    "priceBs": "110.55"
  },
  {
    "code": "03-02-061",
    "name": "Electroforesis de proteínas (incluye cód. 03-02-100 y 03-02-101 )",
    "officialName": "ELECTROFORESIS DE PROTEÍNAS (INCLUYE CÓD. 03-02-100 Y 03-02-101 )",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 6450,
    "priceBs": "79.58"
  },
  {
    "code": "03-02-076",
    "name": "Perfil hepático (incluye tiempo de protrombina, bilirrubina total y conjugada, fosfatasas alcalinas totales, GGT, transaminasas got/ast y gpt/alt)",
    "officialName": "PERFIL HEPÁTICO (INCLUYE TIEMPO DE PROTROMBINA, BILIRRUBINA TOTAL Y CONJUGADA, FOSFATASAS ALCALINAS TOTALES, GGT, TRANSAMINASAS GOT/AST Y GPT/ALT)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 10490,
    "priceBs": "129.43"
  },
  {
    "code": "03-02-063",
    "name": "Transaminasas, oxalacética (got/ast), pirúvica (gpt/alt), c/u",
    "officialName": "TRANSAMINASAS, OXALACÉTICA (GOT/AST), PIRÚVICA (GPT/ALT), C/U",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1900,
    "priceBs": "23.44"
  },
  {
    "code": "03-02-064",
    "name": "Triglicéridos en sangre (proc.aut.)",
    "officialName": "TRIGLICÉRIDOS EN SANGRE (PROC.AUT.)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1810,
    "priceBs": "22.33"
  },
  {
    "code": "03-02-066",
    "name": "Xilosa, prueba de absorción (no incluye la xilosa que se administra)",
    "officialName": "XILOSA, PRUEBA DE ABSORCIÓN (NO INCLUYE LA XILOSA QUE SE ADMINISTRA)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 3640,
    "priceBs": "44.91"
  },
  {
    "code": "03-02-077",
    "name": "Vitamina b12 por inmunoensayo",
    "officialName": "VITAMINA B12 POR INMUNOENSAYO",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 7780,
    "priceBs": "95.99"
  },
  {
    "code": "03-02-078",
    "name": "25 oh vitamina d total por inmunoensayo (quimioluminiscencia, enzimoinmunoensayo, radio inmunoensayo y otros)",
    "officialName": "25 OH VITAMINA D TOTAL POR INMUNOENSAYO (QUIMIOLUMINISCENCIA, ENZIMOINMUNOENSAYO, RADIO INMUNOENSAYO Y OTROS)",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 17280,
    "priceBs": "213.20"
  },
  {
    "code": "03-02-080",
    "name": "Vitamina b6 por hplc",
    "officialName": "VITAMINA B6 POR HPLC",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 53090,
    "priceBs": "655.03"
  },
  {
    "code": "03-02-081",
    "name": "Calcio iónico. incluye medición de ph método ión selectivo. no incluye point of care testing poct",
    "officialName": "CALCIO IÓNICO. INCLUYE MEDICIÓN DE PH MÉTODO IÓN SELECTIVO. NO INCLUYE POINT OF CARE TESTING POCT",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 2550,
    "priceBs": "31.46"
  },
  {
    "code": "03-02-082",
    "name": "Fenilalanina cuantitativa en gotas de sangre seca",
    "officialName": "FENILALANINA CUANTITATIVA EN GOTAS DE SANGRE SECA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 8790,
    "priceBs": "108.45"
  },
  {
    "code": "03-02-083",
    "name": "Carboxihemoglobina",
    "officialName": "CARBOXIHEMOGLOBINA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 23780,
    "priceBs": "293.40"
  },
  {
    "code": "03-02-084",
    "name": "Plomo en sangre",
    "officialName": "PLOMO EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 65950,
    "priceBs": "813.70"
  },
  {
    "code": "03-02-085",
    "name": "Prealbumina",
    "officialName": "PREALBUMINA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 31170,
    "priceBs": "384.58"
  },
  {
    "code": "03-02-086",
    "name": "Homocisteína",
    "officialName": "HOMOCISTEÍNA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 61690,
    "priceBs": "761.14"
  },
  {
    "code": "03-02-100",
    "name": "Proteínas totales en sangre",
    "officialName": "PROTEÍNAS TOTALES EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1510,
    "priceBs": "18.63"
  },
  {
    "code": "03-02-101",
    "name": "Albúminas en sangre",
    "officialName": "ALBÚMINAS EN SANGRE",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 1510,
    "priceBs": "18.63"
  },
  {
    "code": "03-02-095",
    "name": "Tiopurina metiltransferasa, actividad enzimatica",
    "officialName": "TIOPURINA METILTRANSFERASA, ACTIVIDAD ENZIMATICA",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 62430,
    "priceBs": "770.27"
  },
  {
    "code": "03-02-097",
    "name": "Hormona tiroestimulante, neonatal en gss",
    "officialName": "HORMONA TIROESTIMULANTE, NEONATAL EN GSS",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 23080,
    "priceBs": "284.76"
  },
  {
    "code": "03-02-098",
    "name": "Perfil de aminoácidos y acilcarnitinas en gss",
    "officialName": "PERFIL DE AMINOÁCIDOS Y ACILCARNITINAS EN GSS",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 82590,
    "priceBs": "1019.00"
  },
  {
    "code": "03-02-099",
    "name": "Pesquisa neonatal ampliada en gss (incluye perfil de aminoácidos y acilcarnitinas; succinilacetona; hormona tiroestimulante, neonatal; biotinidasa; galactosa total; galactosa-1-fosfato uridiltransferasa; 17-hidroxiprogesterona; tripsina inmunorreactiva).",
    "officialName": "PESQUISA NEONATAL AMPLIADA EN GSS (INCLUYE PERFIL DE AMINOÁCIDOS Y ACILCARNITINAS; SUCCINILACETONA; HORMONA TIROESTIMULANTE, NEONATAL; BIOTINIDASA; GALACTOSA TOTAL; GALACTOSA-1-FOSFATO URIDILTRANSFERASA; 17-HIDROXIPROGESTERONA; TRIPSINA INMUNORREACTIVA).",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 131180,
    "priceBs": "1618.51"
  },
  {
    "code": "03-02-102",
    "name": "Leucina cualitativa en gss",
    "officialName": "LEUCINA CUALITATIVA EN GSS",
    "section": "SANGRE, EXAMENES BIOQUIMICOS",
    "valueClp": 35230,
    "priceBs": "434.67"
  },
  {
    "code": "03-03-001",
    "name": "Adenocorticotrofina (ACTH)",
    "officialName": "ADENOCORTICOTROFINA (ACTH)",
    "section": "HORMONAS",
    "valueClp": 8800,
    "priceBs": "108.57"
  },
  {
    "code": "03-03-002",
    "name": "Aldosterona",
    "officialName": "ALDOSTERONA",
    "section": "HORMONAS",
    "valueClp": 7260,
    "priceBs": "89.57"
  },
  {
    "code": "03-03-003",
    "name": "Androstenediona",
    "officialName": "ANDROSTENEDIONA",
    "section": "HORMONAS",
    "valueClp": 5730,
    "priceBs": "70.70"
  },
  {
    "code": "03-03-004",
    "name": "Angiotensina",
    "officialName": "ANGIOTENSINA",
    "section": "HORMONAS",
    "valueClp": 6990,
    "priceBs": "86.24"
  },
  {
    "code": "03-03-006",
    "name": "Cortisol",
    "officialName": "CORTISOL",
    "section": "HORMONAS",
    "valueClp": 5730,
    "priceBs": "70.70"
  },
  {
    "code": "03-03-007",
    "name": "Crecimiento, hormona de (hgh) (somatotrofina)",
    "officialName": "CRECIMIENTO, HORMONA DE (HGH) (SOMATOTROFINA)",
    "section": "HORMONAS",
    "valueClp": 7260,
    "priceBs": "89.57"
  },
  {
    "code": "03-03-008",
    "name": "Dehidroepiandrosterona sulfato (dhea-s)",
    "officialName": "DEHIDROEPIANDROSTERONA SULFATO (DHEA-S)",
    "section": "HORMONAS",
    "valueClp": 7150,
    "priceBs": "88.22"
  },
  {
    "code": "03-03-009",
    "name": "Eritropoyetina",
    "officialName": "ERITROPOYETINA",
    "section": "HORMONAS",
    "valueClp": 6020,
    "priceBs": "74.28"
  },
  {
    "code": "03-03-012",
    "name": "Gastrina",
    "officialName": "GASTRINA",
    "section": "HORMONAS",
    "valueClp": 7690,
    "priceBs": "94.88"
  },
  {
    "code": "03-03-014",
    "name": "Gonadotrofina coriónica, sub-unidad beta (cuantificación)",
    "officialName": "GONADOTROFINA CORIÓNICA, SUB-UNIDAD BETA (CUANTIFICACIÓN)",
    "section": "HORMONAS",
    "valueClp": 5520,
    "priceBs": "68.11"
  },
  {
    "code": "03-03-015",
    "name": "Hormona folículo estimulante (fsh)",
    "officialName": "HORMONA FOLÍCULO ESTIMULANTE (FSH)",
    "section": "HORMONAS",
    "valueClp": 5640,
    "priceBs": "69.59"
  },
  {
    "code": "03-03-016",
    "name": "Hormona luteinizante (lh)",
    "officialName": "HORMONA LUTEINIZANTE (LH)",
    "section": "HORMONAS",
    "valueClp": 5650,
    "priceBs": "69.71"
  },
  {
    "code": "03-03-047",
    "name": "Igf1 o somatomedina - c (insuline like growth factor)",
    "officialName": "IGF1 O SOMATOMEDINA - C (INSULINE LIKE GROWTH FACTOR)",
    "section": "HORMONAS",
    "valueClp": 14000,
    "priceBs": "172.73"
  },
  {
    "code": "03-03-048",
    "name": "Igfbp3, igfbp1 (insulin like growth factor binding proteins) c/u",
    "officialName": "IGFBP3, IGFBP1 (INSULIN LIKE GROWTH FACTOR BINDING PROTEINS) C/U",
    "section": "HORMONAS",
    "valueClp": 13790,
    "priceBs": "170.14"
  },
  {
    "code": "03-03-017",
    "name": "Insulina",
    "officialName": "INSULINA",
    "section": "HORMONAS",
    "valueClp": 5250,
    "priceBs": "64.77"
  },
  {
    "code": "03-03-031",
    "name": "Insulina, curva de (mínimo dos determinaciones e incluye todas las tomas de muestra necesarias. no incluye la glucosa que se administra)",
    "officialName": "INSULINA, CURVA DE (MÍNIMO DOS DETERMINACIONES E INCLUYE TODAS LAS TOMAS DE MUESTRA NECESARIAS. NO INCLUYE LA GLUCOSA QUE SE ADMINISTRA)",
    "section": "HORMONAS",
    "valueClp": 14160,
    "priceBs": "174.71"
  },
  {
    "code": "03-03-018",
    "name": "Parathormona, hormona paratiroídea o PTH.",
    "officialName": "PARATHORMONA, HORMONA PARATIROÍDEA O PTH.",
    "section": "HORMONAS",
    "valueClp": 8600,
    "priceBs": "106.11"
  },
  {
    "code": "03-03-019",
    "name": "Progesterona",
    "officialName": "PROGESTERONA",
    "section": "HORMONAS",
    "valueClp": 5340,
    "priceBs": "65.89"
  },
  {
    "code": "03-03-020",
    "name": "Prolactina (prl)",
    "officialName": "PROLACTINA (PRL)",
    "section": "HORMONAS",
    "valueClp": 5640,
    "priceBs": "69.59"
  },
  {
    "code": "03-03-021",
    "name": "Renina",
    "officialName": "RENINA",
    "section": "HORMONAS",
    "valueClp": 9120,
    "priceBs": "112.52"
  },
  {
    "code": "03-03-046",
    "name": "Shbg (sex-hormone binding globulin)",
    "officialName": "SHBG (SEX-HORMONE BINDING GLOBULIN)",
    "section": "HORMONAS",
    "valueClp": 13000,
    "priceBs": "160.39"
  },
  {
    "code": "03-03-022",
    "name": "Testosterona en sangre",
    "officialName": "TESTOSTERONA EN SANGRE",
    "section": "HORMONAS",
    "valueClp": 5860,
    "priceBs": "72.30"
  },
  {
    "code": "03-03-023",
    "name": "Testosterona libre en sangre",
    "officialName": "TESTOSTERONA LIBRE EN SANGRE",
    "section": "HORMONAS",
    "valueClp": 6700,
    "priceBs": "82.67"
  },
  {
    "code": "03-03-123",
    "name": "Índice androgénico (incluye testosterona total y shbg)",
    "officialName": "ÍNDICE ANDROGÉNICO (INCLUYE TESTOSTERONA TOTAL Y SHBG)",
    "section": "HORMONAS",
    "valueClp": 13270,
    "priceBs": "163.73"
  },
  {
    "code": "03-03-024",
    "name": "Tiroestimulante (TSH), hormona (adulto, niño o R.N.)",
    "officialName": "TIROESTIMULANTE (TSH), HORMONA (ADULTO, NIÑO O R.N.)",
    "section": "HORMONAS",
    "valueClp": 4640,
    "priceBs": "57.25"
  },
  {
    "code": "03-03-025",
    "name": "Tiroglobulina",
    "officialName": "TIROGLOBULINA",
    "section": "HORMONAS",
    "valueClp": 7260,
    "priceBs": "89.57"
  },
  {
    "code": "03-03-026",
    "name": "Tiroxina libre (t4l)",
    "officialName": "TIROXINA LIBRE (T4L)",
    "section": "HORMONAS",
    "valueClp": 5340,
    "priceBs": "65.89"
  },
  {
    "code": "03-03-027",
    "name": "Tiroxina o tetrayodotironina (t4)",
    "officialName": "TIROXINA O TETRAYODOTIRONINA (T4)",
    "section": "HORMONAS",
    "valueClp": 4640,
    "priceBs": "57.25"
  },
  {
    "code": "03-03-028",
    "name": "Triyodotironina (t3)",
    "officialName": "TRIYODOTIRONINA (T3)",
    "section": "HORMONAS",
    "valueClp": 4820,
    "priceBs": "59.47"
  },
  {
    "code": "03-03-029",
    "name": "17 - hidroxiprogesterona",
    "officialName": "17 - HIDROXIPROGESTERONA",
    "section": "HORMONAS",
    "valueClp": 7260,
    "priceBs": "89.57"
  },
  {
    "code": "03-03-030",
    "name": "Estradiol (17-beta)",
    "officialName": "ESTRADIOL (17-BETA)",
    "section": "HORMONAS",
    "valueClp": 5540,
    "priceBs": "68.35"
  },
  {
    "code": "03-03-049",
    "name": "Catecolaminas en sangre (incluye medición de adrenalina, noradrenalina y dopamina por separado por métodos cromatográficos)",
    "officialName": "CATECOLAMINAS EN SANGRE (INCLUYE MEDICIÓN DE ADRENALINA, NORADRENALINA Y DOPAMINA POR SEPARADO POR MÉTODOS CROMATOGRÁFICOS)",
    "section": "HORMONAS",
    "valueClp": 35710,
    "priceBs": "440.59"
  },
  {
    "code": "03-03-052",
    "name": "Peptido c",
    "officialName": "PEPTIDO C",
    "section": "HORMONAS",
    "valueClp": 46310,
    "priceBs": "571.38"
  },
  {
    "code": "03-03-053",
    "name": "Calcitonina",
    "officialName": "CALCITONINA",
    "section": "HORMONAS",
    "valueClp": 46980,
    "priceBs": "579.64"
  },
  {
    "code": "03-03-054",
    "name": "Inhibina b",
    "officialName": "INHIBINA B",
    "section": "HORMONAS",
    "valueClp": 54150,
    "priceBs": "668.11"
  },
  {
    "code": "03-03-055",
    "name": "Nt-pro BNP o BNP",
    "officialName": "NT-PRO BNP O BNP",
    "section": "HORMONAS",
    "valueClp": 54790,
    "priceBs": "676.00"
  },
  {
    "code": "03-03-057",
    "name": "Triyodotironina libre (t3 libre)",
    "officialName": "TRIYODOTIRONINA LIBRE (T3 LIBRE)",
    "section": "HORMONAS",
    "valueClp": 21690,
    "priceBs": "267.61"
  },
  {
    "code": "03-03-058",
    "name": "Hormona antimulleriana",
    "officialName": "HORMONA ANTIMULLERIANA",
    "section": "HORMONAS",
    "valueClp": 47720,
    "priceBs": "588.77"
  },
  {
    "code": "03-03-033",
    "name": "Angiotensina",
    "officialName": "ANGIOTENSINA",
    "section": "HORMONAS",
    "valueClp": 6540,
    "priceBs": "80.69"
  },
  {
    "code": "03-03-035",
    "name": "Cortisol libre urinario",
    "officialName": "CORTISOL LIBRE URINARIO",
    "section": "HORMONAS",
    "valueClp": 5810,
    "priceBs": "71.68"
  },
  {
    "code": "03-03-039",
    "name": "Gonadotrofina coriónica, sub-unidad beta; titulación por (elisa; ria o irma; quimioluminiscencia u otra técnica)",
    "officialName": "GONADOTROFINA CORIÓNICA, SUB-UNIDAD BETA; TITULACIÓN POR (ELISA; RIA O IRMA; QUIMIOLUMINISCENCIA U OTRA TÉCNICA)",
    "section": "HORMONAS",
    "valueClp": 5510,
    "priceBs": "67.98"
  },
  {
    "code": "03-03-050",
    "name": "Metanefrinas urinarias (incluye determinación de metanefrina y normetanefrina por separado por métodos cromatográficos)",
    "officialName": "METANEFRINAS URINARIAS (INCLUYE DETERMINACIÓN DE METANEFRINA Y NORMETANEFRINA POR SEPARADO POR MÉTODOS CROMATOGRÁFICOS)",
    "section": "HORMONAS",
    "valueClp": 43470,
    "priceBs": "536.34"
  },
  {
    "code": "03-03-051",
    "name": "Catecolaminas urinarias (incluye medición de adrenalina, noradrenalina y dopamina por separado por métodos cromatográficos)",
    "officialName": "CATECOLAMINAS URINARIAS (INCLUYE MEDICIÓN DE ADRENALINA, NORADRENALINA Y DOPAMINA POR SEPARADO POR MÉTODOS CROMATOGRÁFICOS)",
    "section": "HORMONAS",
    "valueClp": 37370,
    "priceBs": "461.07"
  },
  {
    "code": "03-03-056",
    "name": "Cortisol salival",
    "officialName": "CORTISOL SALIVAL",
    "section": "HORMONAS",
    "valueClp": 50090,
    "priceBs": "618.01"
  },
  {
    "code": "03-04-001",
    "name": "Cariotipo en sangre por cultivo de linfocitos (incluye mínimo 25 mitosis con bandeo g y eventualmente q, r, c, nor) (montaje de 3 metafases bandeadas)",
    "officialName": "CARIOTIPO EN SANGRE POR CULTIVO DE LINFOCITOS (INCLUYE MÍNIMO 25 MITOSIS CON BANDEO G Y EVENTUALMENTE Q, R, C, NOR) (MONTAJE DE 3 METAFASES BANDEADAS)",
    "section": "GENETICA",
    "valueClp": 66460,
    "priceBs": "819.99"
  },
  {
    "code": "03-04-002",
    "name": "Cariotipo con técnicas especiales (incluye muestra de sangre o de médula ósea, tratamiento con fudr, bromuro de etidio, medio deficiente en ácido fólico)",
    "officialName": "CARIOTIPO CON TÉCNICAS ESPECIALES (INCLUYE MUESTRA DE SANGRE O DE MÉDULA ÓSEA, TRATAMIENTO CON FUDR, BROMURO DE ETIDIO, MEDIO DEFICIENTE EN ÁCIDO FÓLICO)",
    "section": "GENETICA",
    "valueClp": 68180,
    "priceBs": "841.21"
  },
  {
    "code": "03-04-003",
    "name": "Cariotipo en fibroblastos por cultivo de trofoblasto, líquido amniótico, piel u otros bandeos g y eventualmente q, r, c, nor",
    "officialName": "CARIOTIPO EN FIBROBLASTOS POR CULTIVO DE TROFOBLASTO, LÍQUIDO AMNIÓTICO, PIEL U OTROS BANDEOS G Y EVENTUALMENTE Q, R, C, NOR",
    "section": "GENETICA",
    "valueClp": 62400,
    "priceBs": "769.90"
  },
  {
    "code": "03-04-006",
    "name": "Fish cromosomas x e y",
    "officialName": "FISH CROMOSOMAS X E Y",
    "section": "GENETICA",
    "valueClp": 89440,
    "priceBs": "1103.52"
  },
  {
    "code": "03-04-007",
    "name": "Diagnóstico genético molecular: displasia tanatofórica tipo i y ii",
    "officialName": "DIAGNÓSTICO GENÉTICO MOLECULAR: DISPLASIA TANATOFÓRICA TIPO I Y II",
    "section": "GENETICA",
    "valueClp": 39300,
    "priceBs": "484.89"
  },
  {
    "code": "03-04-008",
    "name": "Amplificación por PCR más análisis de fragmentos fluorescentes por electroforesis capilar (hasta 5 fragmentos)",
    "officialName": "AMPLIFICACIÓN POR PCR MÁS ANÁLISIS DE FRAGMENTOS FLUORESCENTES POR ELECTROFORESIS CAPILAR (HASTA 5 FRAGMENTOS)",
    "section": "GENETICA",
    "valueClp": 213060,
    "priceBs": "2628.75"
  },
  {
    "code": "03-04-009",
    "name": "Estudio de deleciones y duplicaciones por amplificación múltiple de sondas dependiente de ligación (mlpa) (1 o varios genes)",
    "officialName": "ESTUDIO DE DELECIONES Y DUPLICACIONES POR AMPLIFICACIÓN MÚLTIPLE DE SONDAS DEPENDIENTE DE LIGACIÓN (MLPA) (1 O VARIOS GENES)",
    "section": "GENETICA",
    "valueClp": 110280,
    "priceBs": "1360.64"
  },
  {
    "code": "03-04-010",
    "name": "Estudio de deleciones y duplicaciones por amplificación múltiple de sondas dependiente de ligación (mlpa) más estudio de metilación o segundo set de sondas (1 o varios genes)",
    "officialName": "ESTUDIO DE DELECIONES Y DUPLICACIONES POR AMPLIFICACIÓN MÚLTIPLE DE SONDAS DEPENDIENTE DE LIGACIÓN (MLPA) MÁS ESTUDIO DE METILACIÓN O SEGUNDO SET DE SONDAS (1 O VARIOS GENES)",
    "section": "GENETICA",
    "valueClp": 130250,
    "priceBs": "1607.03"
  },
  {
    "code": "03-04-012",
    "name": "Amplificación por PCR en tiempo real cuantitativo con sonda",
    "officialName": "AMPLIFICACIÓN POR PCR EN TIEMPO REAL CUANTITATIVO CON SONDA",
    "section": "GENETICA",
    "valueClp": 201540,
    "priceBs": "2486.61"
  },
  {
    "code": "03-04-013",
    "name": "Amplificación de adn y arn por PCR convencional de 1 fragmento",
    "officialName": "AMPLIFICACIÓN DE ADN Y ARN POR PCR CONVENCIONAL DE 1 FRAGMENTO",
    "section": "GENETICA",
    "valueClp": 182250,
    "priceBs": "2248.61"
  },
  {
    "code": "03-04-014",
    "name": "Amplificación por PCR más análisis por restricción enzimática",
    "officialName": "AMPLIFICACIÓN POR PCR MÁS ANÁLISIS POR RESTRICCIÓN ENZIMÁTICA",
    "section": "GENETICA",
    "valueClp": 146780,
    "priceBs": "1810.98"
  },
  {
    "code": "03-04-015",
    "name": "Fish en frotis frescos de médula ósea, sangre, concentrado de células plasmáticas seleccionadas, búsqueda de alteraciones adquiridas",
    "officialName": "FISH EN FROTIS FRESCOS DE MÉDULA ÓSEA, SANGRE, CONCENTRADO DE CÉLULAS PLASMÁTICAS SELECCIONADAS, BÚSQUEDA DE ALTERACIONES ADQUIRIDAS",
    "section": "GENETICA",
    "valueClp": 300990,
    "priceBs": "3713.63"
  },
  {
    "code": "03-04-016",
    "name": "Cariotipo molecular (hibridación genómica comparativa en micromatrices) 60k (incluye la extracción de adn)",
    "officialName": "CARIOTIPO MOLECULAR (HIBRIDACIÓN GENÓMICA COMPARATIVA EN MICROMATRICES) 60K (INCLUYE LA EXTRACCIÓN DE ADN)",
    "section": "GENETICA",
    "valueClp": 834430,
    "priceBs": "10295.25"
  },
  {
    "code": "03-05-001",
    "name": "Alfa -1- antitripsina cuantitativa",
    "officialName": "ALFA -1- ANTITRIPSINA CUANTITATIVA",
    "section": "INMUNOLOGIA",
    "valueClp": 5510,
    "priceBs": "67.98"
  },
  {
    "code": "03-05-002",
    "name": "Alfa -2- macroglobulina",
    "officialName": "ALFA -2- MACROGLOBULINA",
    "section": "INMUNOLOGIA",
    "valueClp": 5690,
    "priceBs": "70.20"
  },
  {
    "code": "03-05-003",
    "name": "Alfa fetoproteínas",
    "officialName": "ALFA FETOPROTEÍNAS",
    "section": "INMUNOLOGIA",
    "valueClp": 5340,
    "priceBs": "65.89"
  },
  {
    "code": "03-05-004",
    "name": "Tamizaje de anticuerpos anti-antígenos nucleares extractables (a- ena) (incluye sm, rnp, ro, la, scl- 70 y jo- 1).",
    "officialName": "TAMIZAJE DE ANTICUERPOS ANTI-ANTÍGENOS NUCLEARES EXTRACTABLES (A- ENA) (INCLUYE SM, RNP, RO, LA, SCL- 70 Y JO- 1).",
    "section": "INMUNOLOGIA",
    "valueClp": 11050,
    "priceBs": "136.34"
  },
  {
    "code": "03-05-005",
    "name": "Anticuerpos antinucleares (ana), antimitocondriales, anti dna (adna), anti músculo liso, anticentrómero, u otros, c/u.",
    "officialName": "ANTICUERPOS ANTINUCLEARES (ANA), ANTIMITOCONDRIALES, ANTI DNA (ADNA), ANTI MÚSCULO LISO, ANTICENTRÓMERO, U OTROS, C/U.",
    "section": "INMUNOLOGIA",
    "valueClp": 7780,
    "priceBs": "95.99"
  },
  {
    "code": "03-05-007",
    "name": "Anticuerpos específicos y otros autoanticuerpos (anticuerpos antitiroídeos: anticuerpos antimicrosomales y antitiroglobulinas y otros anticuerpos: prostático, espermios, etc.) c/u",
    "officialName": "ANTICUERPOS ESPECÍFICOS Y OTROS AUTOANTICUERPOS (ANTICUERPOS ANTITIROÍDEOS: ANTICUERPOS ANTIMICROSOMALES Y ANTITIROGLOBULINAS Y OTROS ANTICUERPOS: PROSTÁTICO, ESPERMIOS, ETC.) C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 6210,
    "priceBs": "76.62"
  },
  {
    "code": "03-05-008",
    "name": "Antiestreptolisina o, por técnica de látex",
    "officialName": "ANTIESTREPTOLISINA O, POR TÉCNICA DE LÁTEX",
    "section": "INMUNOLOGIA",
    "valueClp": 4800,
    "priceBs": "59.22"
  },
  {
    "code": "03-05-009",
    "name": "Antígeno carcinoembrionario (CEA)",
    "officialName": "ANTÍGENO CARCINOEMBRIONARIO (CEA)",
    "section": "INMUNOLOGIA",
    "valueClp": 7260,
    "priceBs": "89.57"
  },
  {
    "code": "03-05-070",
    "name": "Antígeno prostático específico",
    "officialName": "ANTÍGENO PROSTÁTICO ESPECÍFICO",
    "section": "INMUNOLOGIA",
    "valueClp": 9340,
    "priceBs": "115.24"
  },
  {
    "code": "03-05-170",
    "name": "Antígeno ca 125, ca 15-3 y ca 19-9, c/u",
    "officialName": "ANTÍGENO CA 125, CA 15-3 Y CA 19-9, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 9680,
    "priceBs": "119.43"
  },
  {
    "code": "03-05-010",
    "name": "Beta-2-microglobulina",
    "officialName": "BETA-2-MICROGLOBULINA",
    "section": "INMUNOLOGIA",
    "valueClp": 8250,
    "priceBs": "101.79"
  },
  {
    "code": "03-05-012",
    "name": "Complemento c1q, c2, c3, c4, etc., c/u",
    "officialName": "COMPLEMENTO C1Q, C2, C3, C4, ETC., C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 4800,
    "priceBs": "59.22"
  },
  {
    "code": "03-05-013",
    "name": "Complemento hemolítico (ch 50)",
    "officialName": "COMPLEMENTO HEMOLÍTICO (CH 50)",
    "section": "INMUNOLOGIA",
    "valueClp": 7720,
    "priceBs": "95.25"
  },
  {
    "code": "03-05-014",
    "name": "Crioglobulinas, precipitación en frío (cualitativa) o cuantitativa c/u",
    "officialName": "CRIOGLOBULINAS, PRECIPITACIÓN EN FRÍO (CUALITATIVA) O CUANTITATIVA C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 1310,
    "priceBs": "16.16"
  },
  {
    "code": "03-05-019",
    "name": "Factor reumatoídeo por técnica de látex u otras similares",
    "officialName": "FACTOR REUMATOÍDEO POR TÉCNICA DE LÁTEX U OTRAS SIMILARES",
    "section": "INMUNOLOGIA",
    "valueClp": 2750,
    "priceBs": "33.93"
  },
  {
    "code": "03-05-020",
    "name": "Factor reumatoídeo por técnica de scat, waaler rose, nefelométricas y/o turbidimétricas",
    "officialName": "FACTOR REUMATOÍDEO POR TÉCNICA DE SCAT, WAALER ROSE, NEFELOMÉTRICAS Y/O TURBIDIMÉTRICAS",
    "section": "INMUNOLOGIA",
    "valueClp": 4720,
    "priceBs": "58.24"
  },
  {
    "code": "03-05-021",
    "name": "Inhibidor de c1q, c2 y c3, c/u",
    "officialName": "INHIBIDOR DE C1Q, C2 Y C3, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 6020,
    "priceBs": "74.28"
  },
  {
    "code": "03-05-025",
    "name": "Inmunofijación de inmunoglobulina, c/u",
    "officialName": "INMUNOFIJACIÓN DE INMUNOGLOBULINA, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 9550,
    "priceBs": "117.83"
  },
  {
    "code": "03-05-026",
    "name": "Inmunoglobulina iga secretora",
    "officialName": "INMUNOGLOBULINA IGA SECRETORA",
    "section": "INMUNOLOGIA",
    "valueClp": 4510,
    "priceBs": "55.64"
  },
  {
    "code": "03-05-027",
    "name": "Inmunoglobulinas iga, igg, igm, c/u",
    "officialName": "INMUNOGLOBULINAS IGA, IGG, IGM, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 5280,
    "priceBs": "65.14"
  },
  {
    "code": "03-05-028",
    "name": "Inmunoglobulinas ige, igd total, c/u",
    "officialName": "INMUNOGLOBULINAS IGE, IGD TOTAL, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 5510,
    "priceBs": "67.98"
  },
  {
    "code": "03-05-029",
    "name": "Inmunoglobulinas ige, igg específicas, c/u",
    "officialName": "INMUNOGLOBULINAS IGE, IGG ESPECÍFICAS, C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 5410,
    "priceBs": "66.75"
  },
  {
    "code": "03-05-030",
    "name": "Proteína c reactiva por técnica de látex u otras similares",
    "officialName": "PROTEÍNA C REACTIVA POR TÉCNICA DE LÁTEX U OTRAS SIMILARES",
    "section": "INMUNOLOGIA",
    "valueClp": 4980,
    "priceBs": "61.44"
  },
  {
    "code": "03-05-031",
    "name": "Proteína c reactiva por técnicas automatizadas",
    "officialName": "PROTEÍNA C REACTIVA POR TÉCNICAS AUTOMATIZADAS",
    "section": "INMUNOLOGIA",
    "valueClp": 6240,
    "priceBs": "76.99"
  },
  {
    "code": "03-05-081",
    "name": "Anticuerpo antiendomisio (ema, antimembrana basal glomerular (gbm), antireticulina, por ifi c/u.",
    "officialName": "ANTICUERPO ANTIENDOMISIO (EMA, ANTIMEMBRANA BASAL GLOMERULAR (GBM), ANTIRETICULINA, POR IFI C/U.",
    "section": "INMUNOLOGIA",
    "valueClp": 11640,
    "priceBs": "143.62"
  },
  {
    "code": "03-05-181",
    "name": "Anticuerpos antitransglutaminasa (ttg)(incluye igg e iga)",
    "officialName": "ANTICUERPOS ANTITRANSGLUTAMINASA (TTG)(INCLUYE IGG E IGA)",
    "section": "INMUNOLOGIA",
    "valueClp": 12450,
    "priceBs": "153.61"
  },
  {
    "code": "03-05-082",
    "name": "Anticuerpos anticitoplasma de neutrófilos (anca), (incluye c-anca y p-anca), por ifi.",
    "officialName": "ANTICUERPOS ANTICITOPLASMA DE NEUTRÓFILOS (ANCA), (INCLUYE C-ANCA Y P-ANCA), POR IFI.",
    "section": "INMUNOLOGIA",
    "valueClp": 16650,
    "priceBs": "205.43"
  },
  {
    "code": "03-05-083",
    "name": "Determinación de isotipos de anticuerpos anticitoplasma de neutrófilos (g-m-a-c'3), por ifi, c/u.",
    "officialName": "DETERMINACIÓN DE ISOTIPOS DE ANTICUERPOS ANTICITOPLASMA DE NEUTRÓFILOS (G-M-A-C'3), POR IFI, C/U.",
    "section": "INMUNOLOGIA",
    "valueClp": 7990,
    "priceBs": "98.58"
  },
  {
    "code": "03-05-084",
    "name": "Anticuerpos anticardiolipinas (igg, igm), c/u",
    "officialName": "ANTICUERPOS ANTICARDIOLIPINAS (IGG, IGM), C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 13230,
    "priceBs": "163.23"
  },
  {
    "code": "03-05-085",
    "name": "Anticuerpos anti lkm-1",
    "officialName": "ANTICUERPOS ANTI LKM-1",
    "section": "INMUNOLOGIA",
    "valueClp": 23640,
    "priceBs": "291.67"
  },
  {
    "code": "03-05-086",
    "name": "Anticuerpos contra péptidos deaminados de gliadina igg e iga",
    "officialName": "ANTICUERPOS CONTRA PÉPTIDOS DEAMINADOS DE GLIADINA IGG E IGA",
    "section": "INMUNOLOGIA",
    "valueClp": 10860,
    "priceBs": "133.99"
  },
  {
    "code": "03-05-098",
    "name": "Cromogranina a",
    "officialName": "CROMOGRANINA A",
    "section": "INMUNOLOGIA",
    "valueClp": 50170,
    "priceBs": "619.00"
  },
  {
    "code": "03-05-099",
    "name": "Péptido cíclico citrulinado, anticuerpos igg",
    "officialName": "PÉPTIDO CÍCLICO CITRULINADO, ANTICUERPOS IGG",
    "section": "INMUNOLOGIA",
    "valueClp": 38830,
    "priceBs": "479.09"
  },
  {
    "code": "03-05-104",
    "name": "Antígeno prostático total y libre",
    "officialName": "ANTÍGENO PROSTÁTICO TOTAL Y LIBRE",
    "section": "INMUNOLOGIA",
    "valueClp": 24690,
    "priceBs": "304.63"
  },
  {
    "code": "03-05-105",
    "name": "Anticuerpos anti-beta 2 glicoproteina 1 (igg, igm), c/u",
    "officialName": "ANTICUERPOS ANTI-BETA 2 GLICOPROTEINA 1 (IGG, IGM), C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 41120,
    "priceBs": "507.34"
  },
  {
    "code": "03-05-106",
    "name": "Estudio inmunológico de diabetes (incluye determinación simultánea de anticuerpos anti-células de islotes (ica), auto anticuerpo insulina nativa (iaa), anti-antígeno de insulinoma-2 (ia2) y anti-glutamato descarboxilasa (gada).",
    "officialName": "ESTUDIO INMUNOLÓGICO DE DIABETES (INCLUYE DETERMINACIÓN SIMULTÁNEA DE ANTICUERPOS ANTI-CÉLULAS DE ISLOTES (ICA), AUTO ANTICUERPO INSULINA NATIVA (IAA), ANTI-ANTÍGENO DE INSULINOMA-2 (IA2) Y ANTI-GLUTAMATO DESCARBOXILASA (GADA).",
    "section": "INMUNOLOGIA",
    "valueClp": 109630,
    "priceBs": "1352.62"
  },
  {
    "code": "03-05-107",
    "name": "Anticuerpos anti-mpo (mieloperoxidasa)",
    "officialName": "ANTICUERPOS ANTI-MPO (MIELOPEROXIDASA)",
    "section": "INMUNOLOGIA",
    "valueClp": 40460,
    "priceBs": "499.20"
  },
  {
    "code": "03-05-108",
    "name": "Anticuerpos anti antígenos nucleares extractables (a-ena): sm, rnp, ss-a/ro, ss-b/la, scl-70, jo-1). c/u",
    "officialName": "ANTICUERPOS ANTI ANTÍGENOS NUCLEARES EXTRACTABLES (A-ENA): SM, RNP, SS-A/RO, SS-B/LA, SCL-70, JO-1). C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 23220,
    "priceBs": "286.49"
  },
  {
    "code": "03-05-124",
    "name": "Receptor de tirotropina (trab), anticuerpos anti",
    "officialName": "RECEPTOR DE TIROTROPINA (TRAB), ANTICUERPOS ANTI",
    "section": "INMUNOLOGIA",
    "valueClp": 35290,
    "priceBs": "435.41"
  },
  {
    "code": "03-05-035",
    "name": "Detección, identificación y titulación de crioaglutininas",
    "officialName": "DETECCIÓN, IDENTIFICACIÓN Y TITULACIÓN DE CRIOAGLUTININAS",
    "section": "INMUNOLOGIA",
    "valueClp": 2730,
    "priceBs": "33.68"
  },
  {
    "code": "03-05-036",
    "name": "Criohemolisinas",
    "officialName": "CRIOHEMOLISINAS",
    "section": "INMUNOLOGIA",
    "valueClp": 2730,
    "priceBs": "33.68"
  },
  {
    "code": "03-05-037",
    "name": "Digestión fagocítica nitroblue-tetrazolium cualitativo y cuantitativo",
    "officialName": "DIGESTIÓN FAGOCÍTICA NITROBLUE-TETRAZOLIUM CUALITATIVO Y CUANTITATIVO",
    "section": "INMUNOLOGIA",
    "valueClp": 8140,
    "priceBs": "100.43"
  },
  {
    "code": "03-05-038",
    "name": "Fagocitosis: ingestión y digestión (killing) de levaduras por polimorfonucleares",
    "officialName": "FAGOCITOSIS: INGESTIÓN Y DIGESTIÓN (KILLING) DE LEVADURAS POR POLIMORFONUCLEARES",
    "section": "INMUNOLOGIA",
    "valueClp": 13050,
    "priceBs": "161.01"
  },
  {
    "code": "03-05-039",
    "name": "Fagocitosis: ingestión y digestión (killing) de bacterias por polimorfonucleares",
    "officialName": "FAGOCITOSIS: INGESTIÓN Y DIGESTIÓN (KILLING) DE BACTERIAS POR POLIMORFONUCLEARES",
    "section": "INMUNOLOGIA",
    "valueClp": 13930,
    "priceBs": "171.87"
  },
  {
    "code": "03-05-040",
    "name": "Inmunoadherencia de leucocitos macrófagos",
    "officialName": "INMUNOADHERENCIA DE LEUCOCITOS MACRÓFAGOS",
    "section": "INMUNOLOGIA",
    "valueClp": 6540,
    "priceBs": "80.69"
  },
  {
    "code": "03-05-041",
    "name": "Intradermorreacción (ppd, histoplasmina, aspergilina, u otros, incluye el valor del antígeno y reacción de control), c/u.",
    "officialName": "INTRADERMORREACCIÓN (PPD, HISTOPLASMINA, ASPERGILINA, U OTROS, INCLUYE EL VALOR DEL ANTÍGENO Y REACCIÓN DE CONTROL), C/U.",
    "section": "INMUNOLOGIA",
    "valueClp": 5160,
    "priceBs": "63.66"
  },
  {
    "code": "03-05-080",
    "name": "Estudio para hipersensibilidad retardada",
    "officialName": "ESTUDIO PARA HIPERSENSIBILIDAD RETARDADA",
    "section": "INMUNOLOGIA",
    "valueClp": 20720,
    "priceBs": "255.64"
  },
  {
    "code": "03-05-042",
    "name": "Lif o mif",
    "officialName": "LIF O MIF",
    "section": "INMUNOLOGIA",
    "valueClp": 6110,
    "priceBs": "75.39"
  },
  {
    "code": "03-05-044",
    "name": "Linfocitos b (rosetas eac) y linfocitos t (rosetas e) c/u",
    "officialName": "LINFOCITOS B (ROSETAS EAC) Y LINFOCITOS T (ROSETAS E) C/U",
    "section": "INMUNOLOGIA",
    "valueClp": 7600,
    "priceBs": "93.77"
  },
  {
    "code": "03-05-047",
    "name": "Linfotoxinas humanas, detección de",
    "officialName": "LINFOTOXINAS HUMANAS, DETECCIÓN DE",
    "section": "INMUNOLOGIA",
    "valueClp": 9080,
    "priceBs": "112.03"
  },
  {
    "code": "03-05-049",
    "name": "Transformación linfoblástica a drogas, análisis de transformación espontánea con estímulo inespecífico y con diferentes concentraciones de la droga en 1000 células",
    "officialName": "TRANSFORMACIÓN LINFOBLÁSTICA A DROGAS, ANÁLISIS DE TRANSFORMACIÓN ESPONTÁNEA CON ESTÍMULO INESPECÍFICO Y CON DIFERENTES CONCENTRACIONES DE LA DROGA EN 1000 CÉLULAS",
    "section": "INMUNOLOGIA",
    "valueClp": 28610,
    "priceBs": "352.99"
  },
  {
    "code": "03-05-089",
    "name": "Linfocitos b totales (cd19). técnica citometría de flujo",
    "officialName": "LINFOCITOS B TOTALES (CD19). TÉCNICA CITOMETRÍA DE FLUJO",
    "section": "INMUNOLOGIA",
    "valueClp": 46920,
    "priceBs": "578.90"
  },
  {
    "code": "03-05-091",
    "name": "Linfocitos t (incluye cd3, cd4, cd8). técnica citometría de flujo",
    "officialName": "LINFOCITOS T (INCLUYE CD3, CD4, CD8). TÉCNICA CITOMETRÍA DE FLUJO",
    "section": "INMUNOLOGIA",
    "valueClp": 29930,
    "priceBs": "369.28"
  },
  {
    "code": "03-05-092",
    "name": "Natural killers (incluye cd16, cd 56). técnica citometría de flujo",
    "officialName": "NATURAL KILLERS (INCLUYE CD16, CD 56). TÉCNICA CITOMETRÍA DE FLUJO",
    "section": "INMUNOLOGIA",
    "valueClp": 29150,
    "priceBs": "359.65"
  },
  {
    "code": "03-05-093",
    "name": "Inmunofenotipo en leucemias agudas",
    "officialName": "INMUNOFENOTIPO EN LEUCEMIAS AGUDAS",
    "section": "INMUNOLOGIA",
    "valueClp": 349950,
    "priceBs": "4317.71"
  },
  {
    "code": "03-05-094",
    "name": "Inmunofenotipo en síndrome linfoproliferativos",
    "officialName": "INMUNOFENOTIPO EN SÍNDROME LINFOPROLIFERATIVOS",
    "section": "INMUNOLOGIA",
    "valueClp": 298260,
    "priceBs": "3679.95"
  },
  {
    "code": "03-05-095",
    "name": "Inmunofenotipo en síndrome mielodisplásicos",
    "officialName": "INMUNOFENOTIPO EN SÍNDROME MIELODISPLÁSICOS",
    "section": "INMUNOLOGIA",
    "valueClp": 303690,
    "priceBs": "3746.95"
  },
  {
    "code": "03-05-096",
    "name": "Detección de enfermedad residual mínima",
    "officialName": "DETECCIÓN DE ENFERMEDAD RESIDUAL MÍNIMA",
    "section": "INMUNOLOGIA",
    "valueClp": 192860,
    "priceBs": "2379.52"
  },
  {
    "code": "03-05-097",
    "name": "Cuantificación de células progenitoras hematopoyéticas cd 34",
    "officialName": "CUANTIFICACIÓN DE CÉLULAS PROGENITORAS HEMATOPOYÉTICAS CD 34",
    "section": "INMUNOLOGIA",
    "valueClp": 82680,
    "priceBs": "1020.11"
  },
  {
    "code": "03-05-110",
    "name": "Alocross match linfocitos t y linfocitos b (citometría de flujo)",
    "officialName": "ALOCROSS MATCH LINFOCITOS T Y LINFOCITOS B (CITOMETRÍA DE FLUJO)",
    "section": "INMUNOLOGIA",
    "valueClp": 295040,
    "priceBs": "3640.22"
  },
  {
    "code": "03-05-111",
    "name": "Anticuerpo anti HLA clase i y ii screening (luminex)",
    "officialName": "ANTICUERPO ANTI HLA CLASE I Y II SCREENING (LUMINEX)",
    "section": "INMUNOLOGIA",
    "valueClp": 65900,
    "priceBs": "813.08"
  },
  {
    "code": "03-05-112",
    "name": "Autocrossmatch linfocitos t y b (citometría de flujo )",
    "officialName": "AUTOCROSSMATCH LINFOCITOS T Y B (CITOMETRÍA DE FLUJO )",
    "section": "INMUNOLOGIA",
    "valueClp": 295040,
    "priceBs": "3640.22"
  },
  {
    "code": "03-05-113",
    "name": "Especificidad de anticuerpos HLA con antígenos individuales clase i (luminex)",
    "officialName": "ESPECIFICIDAD DE ANTICUERPOS HLA CON ANTÍGENOS INDIVIDUALES CLASE I (LUMINEX)",
    "section": "INMUNOLOGIA",
    "valueClp": 250460,
    "priceBs": "3090.19"
  },
  {
    "code": "03-05-114",
    "name": "Especificidad de anticuerpos HLA con antígenos individuales clase ii (luminex)",
    "officialName": "ESPECIFICIDAD DE ANTICUERPOS HLA CON ANTÍGENOS INDIVIDUALES CLASE II (LUMINEX)",
    "section": "INMUNOLOGIA",
    "valueClp": 295040,
    "priceBs": "3640.22"
  },
  {
    "code": "03-05-115",
    "name": "Estudio receptor trasplantado con donante cadáver",
    "officialName": "ESTUDIO RECEPTOR TRASPLANTADO CON DONANTE CADÁVER",
    "section": "INMUNOLOGIA",
    "valueClp": 474600,
    "priceBs": "5855.64"
  },
  {
    "code": "03-05-116",
    "name": "Hla-ab tipificación (biología molecular)",
    "officialName": "HLA-AB TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 177420,
    "priceBs": "2189.02"
  },
  {
    "code": "03-05-117",
    "name": "Hla-abdr tipificación (biología molecular)",
    "officialName": "HLA-ABDR TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 295040,
    "priceBs": "3640.22"
  },
  {
    "code": "03-05-118",
    "name": "Hla-b27 tipificación (biología molecular)",
    "officialName": "HLA-B27 TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 93150,
    "priceBs": "1149.29"
  },
  {
    "code": "03-05-119",
    "name": "Hla-c tipificación (biología molecular)",
    "officialName": "HLA-C TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 108300,
    "priceBs": "1336.21"
  },
  {
    "code": "03-05-120",
    "name": "Hla-dp tipificación (biología molecular)",
    "officialName": "HLA-DP TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 108300,
    "priceBs": "1336.21"
  },
  {
    "code": "03-05-121",
    "name": "Hla-dq tipificación (biología molecular)",
    "officialName": "HLA-DQ TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 164880,
    "priceBs": "2034.30"
  },
  {
    "code": "03-05-122",
    "name": "Hla-dr tipificación (biología molecular)",
    "officialName": "HLA-DR TIPIFICACIÓN (BIOLOGÍA MOLECULAR)",
    "section": "INMUNOLOGIA",
    "valueClp": 116540,
    "priceBs": "1437.88"
  },
  {
    "code": "03-05-123",
    "name": "Seroteca mensual y mantención en lista de espera",
    "officialName": "SEROTECA MENSUAL Y MANTENCIÓN EN LISTA DE ESPERA",
    "section": "INMUNOLOGIA",
    "valueClp": 27250,
    "priceBs": "336.21"
  },
  {
    "code": "03-06-001",
    "name": "Baciloscopía por método de concentración",
    "officialName": "BACILOSCOPÍA POR MÉTODO DE CONCENTRACIÓN",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2710,
    "priceBs": "33.44"
  },
  {
    "code": "03-06-002",
    "name": "Baciloscopía ziehl-neelsen, c/u",
    "officialName": "BACILOSCOPÍA ZIEHL-NEELSEN, C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 1770,
    "priceBs": "21.84"
  },
  {
    "code": "03-06-004",
    "name": "Examen directo al fresco, c/s tinción (incluye trichomonas)",
    "officialName": "EXAMEN DIRECTO AL FRESCO, C/S TINCIÓN (INCLUYE TRICHOMONAS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 1540,
    "priceBs": "19.00"
  },
  {
    "code": "03-06-005",
    "name": "Tinción de gram",
    "officialName": "TINCIÓN DE GRAM",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 710,
    "priceBs": "8.76"
  },
  {
    "code": "03-06-006",
    "name": "Ultramicroscopía (incluye toma de muestras)",
    "officialName": "ULTRAMICROSCOPÍA (INCLUYE TOMA DE MUESTRAS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5230,
    "priceBs": "64.53"
  },
  {
    "code": "03-06-102",
    "name": "Tinción de toluidina",
    "officialName": "TINCIÓN DE TOLUIDINA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 48820,
    "priceBs": "602.34"
  },
  {
    "code": "03-06-007",
    "name": "Coprocultivo, c/u",
    "officialName": "COPROCULTIVO, C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 4260,
    "priceBs": "52.56"
  },
  {
    "code": "03-06-008",
    "name": "Cultivo corriente (excepto coprocultivo, hemocultivo y urocultivo) c/u",
    "officialName": "CULTIVO CORRIENTE (EXCEPTO COPROCULTIVO, HEMOCULTIVO Y UROCULTIVO) C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3720,
    "priceBs": "45.90"
  },
  {
    "code": "03-06-011",
    "name": "Urocultivo, recuento de colonias y antibiograma (cualquier técnica) (incluye toma de orina aséptica y frasco recolector) (no incluye recolector pediátrico ni sonda)",
    "officialName": "UROCULTIVO, RECUENTO DE COLONIAS Y ANTIBIOGRAMA (CUALQUIER TÉCNICA) (INCLUYE TOMA DE ORINA ASÉPTICA Y FRASCO RECOLECTOR) (NO INCLUYE RECOLECTOR PEDIÁTRICO NI SONDA)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3800,
    "priceBs": "46.88"
  },
  {
    "code": "03-06-091",
    "name": "Hemocultivo automatizado. incluye antibiograma con cim. 2 frascos (costo no incluido en el arancel)",
    "officialName": "HEMOCULTIVO AUTOMATIZADO. INCLUYE ANTIBIOGRAMA CON CIM. 2 FRASCOS (COSTO NO INCLUIDO EN EL ARANCEL)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 18130,
    "priceBs": "223.69"
  },
  {
    "code": "03-06-093",
    "name": "Hemocultivo automatizado para micobacterias.1 frasco (costo no incluido en el arancel)",
    "officialName": "HEMOCULTIVO AUTOMATIZADO PARA MICOBACTERIAS.1 FRASCO (COSTO NO INCLUIDO EN EL ARANCEL)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 19110,
    "priceBs": "235.78"
  },
  {
    "code": "03-06-101",
    "name": "Cultivo de líquido de cavidades estériles en frasco de hemocultivo automatizado. incluye antibiograma por difusión o dilución (1 frasco, costo no incluido en arancel).",
    "officialName": "CULTIVO DE LÍQUIDO DE CAVIDADES ESTÉRILES EN FRASCO DE HEMOCULTIVO AUTOMATIZADO. INCLUYE ANTIBIOGRAMA POR DIFUSIÓN O DILUCIÓN (1 FRASCO, COSTO NO INCLUIDO EN ARANCEL).",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 22160,
    "priceBs": "273.41"
  },
  {
    "code": "03-06-106",
    "name": "Hemocultivo automatizado para hongos",
    "officialName": "HEMOCULTIVO AUTOMATIZADO PARA HONGOS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 21290,
    "priceBs": "262.68"
  },
  {
    "code": "03-06-012",
    "name": "Cultivo para anaerobios (incluye cód. 03-06-008)",
    "officialName": "CULTIVO PARA ANAEROBIOS (INCLUYE CÓD. 03-06-008)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 9090,
    "priceBs": "112.15"
  },
  {
    "code": "03-06-013",
    "name": "Cultivo para bordetella",
    "officialName": "CULTIVO PARA BORDETELLA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7210,
    "priceBs": "88.96"
  },
  {
    "code": "03-06-014",
    "name": "Cultivo para campylobacter, yersinia, vibrio, c/u",
    "officialName": "CULTIVO PARA CAMPYLOBACTER, YERSINIA, VIBRIO, C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5450,
    "priceBs": "67.24"
  },
  {
    "code": "03-06-016",
    "name": "Neisseria gonorrhoeae (gonococo)",
    "officialName": "NEISSERIA GONORRHOEAE (GONOCOCO)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3040,
    "priceBs": "37.51"
  },
  {
    "code": "03-06-017",
    "name": "Cultivo para hongos (levaduras y filamentosos)",
    "officialName": "CULTIVO PARA HONGOS (LEVADURAS Y FILAMENTOSOS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2760,
    "priceBs": "34.05"
  },
  {
    "code": "03-06-117",
    "name": "Cultivo para dermatofitos",
    "officialName": "CULTIVO PARA DERMATOFITOS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3120,
    "priceBs": "38.49"
  },
  {
    "code": "03-06-018",
    "name": "Cultivo para micobacterias (incluye bacilo de koch)",
    "officialName": "CULTIVO PARA MICOBACTERIAS (INCLUYE BACILO DE KOCH)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 4700,
    "priceBs": "57.99"
  },
  {
    "code": "03-06-019",
    "name": "Cultivo para legionella",
    "officialName": "CULTIVO PARA LEGIONELLA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6330,
    "priceBs": "78.10"
  },
  {
    "code": "03-06-022",
    "name": "Cultivo y tipificación de micobacterias",
    "officialName": "CULTIVO Y TIPIFICACIÓN DE MICOBACTERIAS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6330,
    "priceBs": "78.10"
  },
  {
    "code": "03-06-023",
    "name": "Cultivo mycoplasma y ureaplasma, c/u.",
    "officialName": "CULTIVO MYCOPLASMA Y UREAPLASMA, C/U.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6470,
    "priceBs": "79.83"
  },
  {
    "code": "03-06-099",
    "name": "Streptococcus grupo b/ agalactiae en embarazada por cultivo con medio selectivo y/o enriquecido.",
    "officialName": "STREPTOCOCCUS GRUPO B/ AGALACTIAE EN EMBARAZADA POR CULTIVO CON MEDIO SELECTIVO Y/O ENRIQUECIDO.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 15820,
    "priceBs": "195.19"
  },
  {
    "code": "03-06-100",
    "name": "Cultivo acelerado para micobacterias",
    "officialName": "CULTIVO ACELERADO PARA MICOBACTERIAS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 26640,
    "priceBs": "328.69"
  },
  {
    "code": "03-06-025",
    "name": "Antibiograma bacilo de koch (cada fármaco)",
    "officialName": "ANTIBIOGRAMA BACILO DE KOCH (CADA FÁRMACO)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5400,
    "priceBs": "66.63"
  },
  {
    "code": "03-06-026",
    "name": "Antibiograma corriente (mínimo 10 fármacos) (en caso de urocultivo no corresponde su cobro; incluido en el valor 03-06-011)",
    "officialName": "ANTIBIOGRAMA CORRIENTE (MÍNIMO 10 FÁRMACOS) (EN CASO DE UROCULTIVO NO CORRESPONDE SU COBRO; INCLUIDO EN EL VALOR 03-06-011)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2760,
    "priceBs": "34.05"
  },
  {
    "code": "03-06-027",
    "name": "Antibiograma de estudio de sensibilidad por dilución (cim) (mínimo 6 fármacos) (en caso de urocultivo, no corresponde su cobro; incluido en el valor código 03-06-011)",
    "officialName": "ANTIBIOGRAMA DE ESTUDIO DE SENSIBILIDAD POR DILUCIÓN (CIM) (MÍNIMO 6 FÁRMACOS) (EN CASO DE UROCULTIVO, NO CORRESPONDE SU COBRO; INCLUIDO EN EL VALOR CÓDIGO 03-06-011)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 8300,
    "priceBs": "102.41"
  },
  {
    "code": "03-06-028",
    "name": "Antifungigrama (mínimo 4 fármacos antihongos)",
    "officialName": "ANTIFUNGIGRAMA (MÍNIMO 4 FÁRMACOS ANTIHONGOS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2780,
    "priceBs": "34.30"
  },
  {
    "code": "03-06-090",
    "name": "Test rápido de detección de streptococcus grupo a (pyogenes)",
    "officialName": "TEST RÁPIDO DE DETECCIÓN DE STREPTOCOCCUS GRUPO A (PYOGENES)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6240,
    "priceBs": "76.99"
  },
  {
    "code": "03-06-097",
    "name": "Chlamydia trachomatis y neisseria gonorrhoeae detección por técnica de biología molecular",
    "officialName": "CHLAMYDIA TRACHOMATIS Y NEISSERIA GONORRHOEAE DETECCIÓN POR TÉCNICA DE BIOLOGÍA MOLECULAR",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 43470,
    "priceBs": "536.34"
  },
  {
    "code": "03-06-098",
    "name": "Toxina clostridium difficile en deposiciones test rápido",
    "officialName": "TOXINA CLOSTRIDIUM DIFFICILE EN DEPOSICIONES TEST RÁPIDO",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 19870,
    "priceBs": "245.16"
  },
  {
    "code": "03-06-107",
    "name": "Pneumocystis jirovecci por técnica de biología molecular en tiempo real",
    "officialName": "PNEUMOCYSTIS JIROVECCI POR TÉCNICA DE BIOLOGÍA MOLECULAR EN TIEMPO REAL",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 86430,
    "priceBs": "1066.38"
  },
  {
    "code": "03-06-118",
    "name": "Amplificación de dna de bordetella pertussis por técnica de biología molecular en tiempo real",
    "officialName": "AMPLIFICACIÓN DE DNA DE BORDETELLA PERTUSSIS POR TÉCNICA DE BIOLOGÍA MOLECULAR EN TIEMPO REAL",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 65220,
    "priceBs": "804.69"
  },
  {
    "code": "03-06-033",
    "name": "Brucella abortus, melitensis y suis, anticuerpos, por aglutinación o elisa",
    "officialName": "BRUCELLA ABORTUS, MELITENSIS Y SUIS, ANTICUERPOS, POR AGLUTINACIÓN O ELISA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2130,
    "priceBs": "26.28"
  },
  {
    "code": "03-06-034",
    "name": "Clamidias por inmunofluorescencia, peroxidasa, elisa o similares",
    "officialName": "CLAMIDIAS POR INMUNOFLUORESCENCIA, PEROXIDASA, ELISA O SIMILARES",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5570,
    "priceBs": "68.72"
  },
  {
    "code": "03-06-036",
    "name": "Mononucleosis, reacción de paul bunnell, anticuerpos heterófilos o similares",
    "officialName": "MONONUCLEOSIS, REACCIÓN DE PAUL BUNNELL, ANTICUERPOS HETERÓFILOS O SIMILARES",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2450,
    "priceBs": "30.23"
  },
  {
    "code": "03-06-037",
    "name": "Mycoplasma igg, igm, c/u.",
    "officialName": "MYCOPLASMA IGG, IGM, C/U.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5350,
    "priceBs": "66.01"
  },
  {
    "code": "03-06-038",
    "name": "R.p.r.",
    "officialName": "R.P.R.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2770,
    "priceBs": "34.18"
  },
  {
    "code": "03-06-039",
    "name": "Tíficas, reacciones de aglutinación (eberth h y o, paratyphi a y b) (widal)",
    "officialName": "TÍFICAS, REACCIONES DE AGLUTINACIÓN (EBERTH H Y O, PARATYPHI A Y B) (WIDAL)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3640,
    "priceBs": "44.91"
  },
  {
    "code": "03-06-041",
    "name": "Treponema pallidum fta - abs, mha-tp c/u",
    "officialName": "TREPONEMA PALLIDUM FTA - ABS, MHA-TP C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5110,
    "priceBs": "63.05"
  },
  {
    "code": "03-06-042",
    "name": "V.d.r.l.",
    "officialName": "V.D.R.L.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3180,
    "priceBs": "39.24"
  },
  {
    "code": "03-06-094",
    "name": "Antígeno galactomanano",
    "officialName": "ANTÍGENO GALACTOMANANO",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 27470,
    "priceBs": "338.93"
  },
  {
    "code": "03-06-119",
    "name": "Interferón gamma tbc",
    "officialName": "INTERFERÓN GAMMA TBC",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 104210,
    "priceBs": "1285.75"
  },
  {
    "code": "03-06-043",
    "name": "Artrópodos macroscópicos y microscópicos (imagos y/o pupas y/o larvas), diagnóstico de",
    "officialName": "ARTRÓPODOS MACROSCÓPICOS Y MICROSCÓPICOS (IMAGOS Y/O PUPAS Y/O LARVAS), DIAGNÓSTICO DE",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3270,
    "priceBs": "40.35"
  },
  {
    "code": "03-06-045",
    "name": "Coproparasitario seriado con técnica para cryptosporidium sp o para diantamoeba fragilis (incluye los códigos 03-06-048 y/o 03-06-059 más aplicación de técnica de frotis con tinción tricrómica o tinción ziehl-neelsen en por lo menos 3 muestras, según corresponda)",
    "officialName": "COPROPARASITARIO SERIADO CON TÉCNICA PARA CRYPTOSPORIDIUM SP O PARA DIANTAMOEBA FRAGILIS (INCLUYE LOS CÓDIGOS 03-06-048 Y/O 03-06-059 MÁS APLICACIÓN DE TÉCNICA DE FROTIS CON TINCIÓN TRICRÓMICA O TINCIÓN ZIEHL-NEELSEN EN POR LO MENOS 3 MUESTRAS, SEGÚN CORRESPONDA)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 9110,
    "priceBs": "112.40"
  },
  {
    "code": "03-06-046",
    "name": "Coproparasitario seriado para fasciola hepática (incluye diagnóstico de gusanos macroscópicos y examen microscópico de 10 muestras por método de telemann y simultáneamente por técnica de sedimentación rápida (copa cónica)",
    "officialName": "COPROPARASITARIO SERIADO PARA FASCIOLA HEPÁTICA (INCLUYE DIAGNÓSTICO DE GUSANOS MACROSCÓPICOS Y EXAMEN MICROSCÓPICO DE 10 MUESTRAS POR MÉTODO DE TELEMANN Y SIMULTÁNEAMENTE POR TÉCNICA DE SEDIMENTACIÓN RÁPIDA (COPA CÓNICA)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 20760,
    "priceBs": "256.14"
  },
  {
    "code": "03-06-047",
    "name": "Coproparasitario seriado para isospora y sarcocystis (incluye diagnóstico de gusanos macroscópicos y examen microscópico de 3 muestras separadas)",
    "officialName": "COPROPARASITARIO SERIADO PARA ISOSPORA Y SARCOCYSTIS (INCLUYE DIAGNÓSTICO DE GUSANOS MACROSCÓPICOS Y EXAMEN MICROSCÓPICO DE 3 MUESTRAS SEPARADAS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 4790,
    "priceBs": "59.10"
  },
  {
    "code": "03-06-048",
    "name": "Coproparasitológico seriado simple (incluye diagnóstico de gusanos macroscópicos y examen microscópico por concentración de tres muestras separadas método telemann ) (proc. aut.)",
    "officialName": "COPROPARASITOLÓGICO SERIADO SIMPLE (INCLUYE DIAGNÓSTICO DE GUSANOS MACROSCÓPICOS Y EXAMEN MICROSCÓPICO POR CONCENTRACIÓN DE TRES MUESTRAS SEPARADAS MÉTODO TELEMANN ) (PROC. AUT.)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3050,
    "priceBs": "37.63"
  },
  {
    "code": "03-06-049",
    "name": "Diagnóstico de parásitos en jugo duodenal y/o bilis, examen macroscópico y microscópico (directo y/o concentración, c/s tinción)",
    "officialName": "DIAGNÓSTICO DE PARÁSITOS EN JUGO DUODENAL Y/O BILIS, EXAMEN MACROSCÓPICO Y MICROSCÓPICO (DIRECTO Y/O CONCENTRACIÓN, C/S TINCIÓN)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2910,
    "priceBs": "35.90"
  },
  {
    "code": "03-06-050",
    "name": "Diagnóstico parasitario en exudados, secreciones y otros líquidos orgánicos, examen macro y microscópico de (incluye concentración y/o tinción cuando proceda), c/u",
    "officialName": "DIAGNÓSTICO PARASITARIO EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS ORGÁNICOS, EXAMEN MACRO Y MICROSCÓPICO DE (INCLUYE CONCENTRACIÓN Y/O TINCIÓN CUANDO PROCEDA), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 3060,
    "priceBs": "37.75"
  },
  {
    "code": "03-06-051",
    "name": "Graham, examen de (incluye diagnóstico de gusanos macroscópicos y examen microscópico de 5 muestras separadas)",
    "officialName": "GRAHAM, EXAMEN DE (INCLUYE DIAGNÓSTICO DE GUSANOS MACROSCÓPICOS Y EXAMEN MICROSCÓPICO DE 5 MUESTRAS SEPARADAS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 2160,
    "priceBs": "26.65"
  },
  {
    "code": "03-06-052",
    "name": "Estudio de gusanos macroscópicos",
    "officialName": "ESTUDIO DE GUSANOS MACROSCÓPICOS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 1800,
    "priceBs": "22.21"
  },
  {
    "code": "03-06-053",
    "name": "Hemoparásitos, diagnóstico microscópico de (mínimo 10 frotis y/o gotas gruesas, c/s examen directo al fresco), cada sesión",
    "officialName": "HEMOPARÁSITOS, DIAGNÓSTICO MICROSCÓPICO DE (MÍNIMO 10 FROTIS Y/O GOTAS GRUESAS, C/S EXAMEN DIRECTO AL FRESCO), CADA SESIÓN",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 10220,
    "priceBs": "126.10"
  },
  {
    "code": "03-06-054",
    "name": "Hemoparásitos, diagnóstico por técnica de microstrout o similar en hasta 10 tubos capilares, cada sesión (chagas)",
    "officialName": "HEMOPARÁSITOS, DIAGNÓSTICO POR TÉCNICA DE MICROSTROUT O SIMILAR EN HASTA 10 TUBOS CAPILARES, CADA SESIÓN (CHAGAS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 11350,
    "priceBs": "140.04"
  },
  {
    "code": "03-06-056",
    "name": "Raspado de piel, examen microscópico de ('acarotest'): de 6 a 10 preparaciones",
    "officialName": "RASPADO DE PIEL, EXAMEN MICROSCÓPICO DE ('ACAROTEST'): DE 6 A 10 PREPARACIONES",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 4080,
    "priceBs": "50.34"
  },
  {
    "code": "03-06-059",
    "name": "Coproparasitológico seriado simple (incluye diagnóstico de gusanos macroscópicos y examen microscópico por concentración de tres muestras separadas método pafs) (proc. aut.)",
    "officialName": "COPROPARASITOLÓGICO SERIADO SIMPLE (INCLUYE DIAGNÓSTICO DE GUSANOS MACROSCÓPICOS Y EXAMEN MICROSCÓPICO POR CONCENTRACIÓN DE TRES MUESTRAS SEPARADAS MÉTODO PAFS) (PROC. AUT.)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 4060,
    "priceBs": "50.09"
  },
  {
    "code": "03-06-061",
    "name": "Parásitos igg/igm (chagas, hidatidosis, toxocariasis y otros por elisa o inmunofluorescencia), c/u",
    "officialName": "PARÁSITOS IGG/IGM (CHAGAS, HIDATIDOSIS, TOXOCARIASIS Y OTROS POR ELISA O INMUNOFLUORESCENCIA), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5760,
    "priceBs": "71.07"
  },
  {
    "code": "03-06-066",
    "name": "Inmunofluorescencia indirecta (toxoplasmosis, chagas, amebiasis y otras), c/u",
    "officialName": "INMUNOFLUORESCENCIA INDIRECTA (TOXOPLASMOSIS, CHAGAS, AMEBIASIS Y OTRAS), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6280,
    "priceBs": "77.48"
  },
  {
    "code": "03-06-095",
    "name": "Parásitos: determinación por reacción de polimerasa en cadena (PCR)",
    "officialName": "PARÁSITOS: DETERMINACIÓN POR REACCIÓN DE POLIMERASA EN CADENA (PCR)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 41770,
    "priceBs": "515.36"
  },
  {
    "code": "03-06-096",
    "name": "Parásitos: test rápido anticuerpos (chagas y otros)",
    "officialName": "PARÁSITOS: TEST RÁPIDO ANTICUERPOS (CHAGAS Y OTROS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 10970,
    "priceBs": "135.35"
  },
  {
    "code": "03-06-068",
    "name": "Aislamiento de virus (adenovirus, citomegalovirus, enterovirus, herpes, influenza, polio,sarampión y otros), c/u",
    "officialName": "AISLAMIENTO DE VIRUS (ADENOVIRUS, CITOMEGALOVIRUS, ENTEROVIRUS, HERPES, INFLUENZA, POLIO,SARAMPIÓN Y OTROS), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 9410,
    "priceBs": "116.10"
  },
  {
    "code": "03-06-069",
    "name": "Anticuerpos virales, determ. de (sars cov-2 igm igg), (adenovirus, citomegalovirus, herpes simple, rubéola, influenza a y b; virus varicela-zoster; virus sincicial respiratorio; parainfluenza 1, 2 y 3; epstein barr y otros), c/u",
    "officialName": "ANTICUERPOS VIRALES, DETERM. DE (SARS COV-2 IGM IGG), (ADENOVIRUS, CITOMEGALOVIRUS, HERPES SIMPLE, RUBÉOLA, INFLUENZA A Y B; VIRUS VARICELA-ZOSTER; VIRUS SINCICIAL RESPIRATORIO; PARAINFLUENZA 1, 2 Y 3; EPSTEIN BARR Y OTROS), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6400,
    "priceBs": "78.96"
  },
  {
    "code": "03-06-169",
    "name": "Anticuerpos virales, determ. de h.i.v.",
    "officialName": "ANTICUERPOS VIRALES, DETERM. DE H.I.V.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5550,
    "priceBs": "68.48"
  },
  {
    "code": "03-06-070",
    "name": "Antígenos virales determ. de (adenovirus, citomegalovirus, herpes simplex, rubeola, influenza y otros), (por cualquier técnica ej: inmunofluorescencia), c/u",
    "officialName": "ANTÍGENOS VIRALES DETERM. DE (ADENOVIRUS, CITOMEGALOVIRUS, HERPES SIMPLEX, RUBEOLA, INFLUENZA Y OTROS), (POR CUALQUIER TÉCNICA EJ: INMUNOFLUORESCENCIA), C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5730,
    "priceBs": "70.70"
  },
  {
    "code": "03-06-170",
    "name": "Antígenos virales determ. de rotavirus, por cualquier técnica",
    "officialName": "ANTÍGENOS VIRALES DETERM. DE ROTAVIRUS, POR CUALQUIER TÉCNICA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5250,
    "priceBs": "64.77"
  },
  {
    "code": "03-06-270",
    "name": "Antígenos virales determ. de virus sincicial, por cualquier técnica",
    "officialName": "ANTÍGENOS VIRALES DETERM. DE VIRUS SINCICIAL, POR CUALQUIER TÉCNICA",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 6060,
    "priceBs": "74.77"
  },
  {
    "code": "03-06-074",
    "name": "Virus hepatitis a, anticuerpos igg, igm o totales c/u",
    "officialName": "VIRUS HEPATITIS A, ANTICUERPOS IGG, IGM O TOTALES C/U",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7860,
    "priceBs": "96.98"
  },
  {
    "code": "03-06-075",
    "name": "Virus hepatitis b, anticuerpo del antígeno e del",
    "officialName": "VIRUS HEPATITIS B, ANTICUERPO DEL ANTÍGENO E DEL",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7690,
    "priceBs": "94.88"
  },
  {
    "code": "03-06-076",
    "name": "Virus hepatitis b, anticore total del (anti hbc total)",
    "officialName": "VIRUS HEPATITIS B, ANTICORE TOTAL DEL (ANTI HBC TOTAL)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7870,
    "priceBs": "97.10"
  },
  {
    "code": "03-06-078",
    "name": "Virus hepatitis b, antígeno e del (hbeag)",
    "officialName": "VIRUS HEPATITIS B, ANTÍGENO E DEL (HBEAG)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7110,
    "priceBs": "87.72"
  },
  {
    "code": "03-06-079",
    "name": "Virus hepatitis b, antígeno de superficie (hbsag)",
    "officialName": "VIRUS HEPATITIS B, ANTÍGENO DE SUPERFICIE (HBSAG)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 5620,
    "priceBs": "69.34"
  },
  {
    "code": "03-06-080",
    "name": "Virus hepatitis b, anticore igm del (anti hbc igm)",
    "officialName": "VIRUS HEPATITIS B, ANTICORE IGM DEL (ANTI HBC IGM)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7830,
    "priceBs": "96.61"
  },
  {
    "code": "03-06-081",
    "name": "Virus hepatitis c, anticuerpos de (anti hcv)",
    "officialName": "VIRUS HEPATITIS C, ANTICUERPOS DE (ANTI HCV)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 8580,
    "priceBs": "105.86"
  },
  {
    "code": "03-06-082",
    "name": "Reacción de polimerasa en cadena (P.C.R.) en tiempo real, sars cov-2, (incluye toma muestra hisopado nasofaríngeo).",
    "officialName": "REACCIÓN DE POLIMERASA EN CADENA (P.C.R.) EN TIEMPO REAL, SARS COV-2, (INCLUYE TOMA MUESTRA HISOPADO NASOFARÍNGEO).",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 25600,
    "priceBs": "315.85"
  },
  {
    "code": "03-06-182",
    "name": "Reacción de polimerasa en cadena (P.C.R.) en tiempo real, virus influenza, virus herpes, citomegalovirus, hepatitis c, mycobacteria tbc, c/u (incluye toma muestra hisopado nasofaríngeo).",
    "officialName": "REACCIÓN DE POLIMERASA EN CADENA (P.C.R.) EN TIEMPO REAL, VIRUS INFLUENZA, VIRUS HERPES, CITOMEGALOVIRUS, HEPATITIS C, MYCOBACTERIA TBC, C/U (INCLUYE TOMA MUESTRA HISOPADO NASOFARÍNGEO).",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 29710,
    "priceBs": "366.56"
  },
  {
    "code": "03-06-083",
    "name": "Citomegalovirus (cmv) shell vial aislamiento rápido",
    "officialName": "CITOMEGALOVIRUS (CMV) SHELL VIAL AISLAMIENTO RÁPIDO",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 76230,
    "priceBs": "940.53"
  },
  {
    "code": "03-06-084",
    "name": "Hepatitis b, carga viral",
    "officialName": "HEPATITIS B, CARGA VIRAL",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 116220,
    "priceBs": "1433.93"
  },
  {
    "code": "03-06-085",
    "name": "Hepatitis c carga viral. técnica PCR",
    "officialName": "HEPATITIS C CARGA VIRAL. TÉCNICA PCR",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 129320,
    "priceBs": "1595.56"
  },
  {
    "code": "03-06-086",
    "name": "VIH, carga viral",
    "officialName": "VIH, CARGA VIRAL",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 68730,
    "priceBs": "848.00"
  },
  {
    "code": "03-06-087",
    "name": "Virus epstein barr (veb) carga viral. técnica PCR",
    "officialName": "VIRUS EPSTEIN BARR (VEB) CARGA VIRAL. TÉCNICA PCR",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 161250,
    "priceBs": "1989.51"
  },
  {
    "code": "03-06-088",
    "name": "Polioma (bk) virus carga viral. técnica PCR",
    "officialName": "POLIOMA (BK) VIRUS CARGA VIRAL. TÉCNICA PCR",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 99900,
    "priceBs": "1232.57"
  },
  {
    "code": "03-06-109",
    "name": "VIH, genotipificación antivirales",
    "officialName": "VIH, GENOTIPIFICACIÓN ANTIVIRALES",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 441630,
    "priceBs": "5448.86"
  },
  {
    "code": "03-06-110",
    "name": "PCR metapneumovirus",
    "officialName": "PCR METAPNEUMOVIRUS",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 80790,
    "priceBs": "996.79"
  },
  {
    "code": "03-06-111",
    "name": "Htlv i y ii determinación de anticuerpos virales",
    "officialName": "HTLV I Y II DETERMINACIÓN DE ANTICUERPOS VIRALES",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 78910,
    "priceBs": "973.60"
  },
  {
    "code": "03-06-112",
    "name": "VIH, anticuerpos y antígenos virales, determ. de h.i.v.",
    "officialName": "VIH, ANTICUERPOS Y ANTÍGENOS VIRALES, DETERM. DE H.I.V.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 7430,
    "priceBs": "91.67"
  },
  {
    "code": "03-06-113",
    "name": "VIH, reacción de polimerasa en cadena (P.C.R.) en líquido cefaloraquídeo",
    "officialName": "VIH, REACCIÓN DE POLIMERASA EN CADENA (P.C.R.) EN LÍQUIDO CEFALORAQUÍDEO",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 64630,
    "priceBs": "797.41"
  },
  {
    "code": "03-06-120",
    "name": "Panel viral diarrea por PCR (determinación de rotavirus, norovirus g1, norovirus g2, astrovirus, adenovirus)",
    "officialName": "PANEL VIRAL DIARREA POR PCR (DETERMINACIÓN DE ROTAVIRUS, NOROVIRUS G1, NOROVIRUS G2, ASTROVIRUS, ADENOVIRUS)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 128020,
    "priceBs": "1579.52"
  },
  {
    "code": "03-06-121",
    "name": "Hanta virus, anticuerpos igm test rápido",
    "officialName": "HANTA VIRUS, ANTICUERPOS IGM TEST RÁPIDO",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 69720,
    "priceBs": "860.21"
  },
  {
    "code": "03-06-122",
    "name": "Panel virus respiratorio molecular (15 a 17 virus) (adenovirus, vrs a, vrs b, parainfluenza 1,2,3,4, influenza a y b, influenza a h1n1, bocavirus, coronavirus (2 tipos), rinovirus, enterovirus.",
    "officialName": "PANEL VIRUS RESPIRATORIO MOLECULAR (15 A 17 VIRUS) (ADENOVIRUS, VRS A, VRS B, PARAINFLUENZA 1,2,3,4, INFLUENZA A Y B, INFLUENZA A H1N1, BOCAVIRUS, CORONAVIRUS (2 TIPOS), RINOVIRUS, ENTEROVIRUS.",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 88000,
    "priceBs": "1085.75"
  },
  {
    "code": "03-06-123",
    "name": "Virus papiloma humano por PCR con genotipificación de papiloma de alto riesgo de cáncer cérvico uterino tipos 16 y 18",
    "officialName": "VIRUS PAPILOMA HUMANO POR PCR CON GENOTIPIFICACIÓN DE PAPILOMA DE ALTO RIESGO DE CÁNCER CÉRVICO UTERINO TIPOS 16 Y 18",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 28140,
    "priceBs": "347.19"
  },
  {
    "code": "03-06-146",
    "name": "Reacción de polimerasa en cadena (P.C.R.) virus viruela símica (incluye hisopado de lesiones cutáneas).",
    "officialName": "REACCIÓN DE POLIMERASA EN CADENA (P.C.R.) VIRUS VIRUELA SÍMICA (INCLUYE HISOPADO DE LESIONES CUTÁNEAS).",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 29830,
    "priceBs": "368.04"
  },
  {
    "code": "03-06-271",
    "name": "Test rápido de detección de antígenos sars-cov-2 (incluye toma de muestra)",
    "officialName": "TEST RÁPIDO DE DETECCIÓN DE ANTÍGENOS SARS-COV-2 (INCLUYE TOMA DE MUESTRA)",
    "section": "EXAMENES MICROBIOLOGICOS",
    "valueClp": 9710,
    "priceBs": "119.80"
  },
  {
    "code": "03-07-001",
    "name": "Dietilendiamina tetraacetato de sodio cromo (edta cr 51)",
    "officialName": "DIETILENDIAMINA TETRAACETATO DE SODIO CROMO (EDTA CR 51)",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 6130,
    "priceBs": "75.63"
  },
  {
    "code": "03-07-002",
    "name": "Prueba de la sed (volumen, densidad, osmolalidad seriada en sangre y orina)",
    "officialName": "PRUEBA DE LA SED (VOLUMEN, DENSIDAD, OSMOLALIDAD SERIADA EN SANGRE Y ORINA)",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 5410,
    "priceBs": "66.75"
  },
  {
    "code": "03-07-005",
    "name": "Reacción cutánea de parche c/u",
    "officialName": "REACCIÓN CUTÁNEA DE PARCHE C/U",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 820,
    "priceBs": "10.12"
  },
  {
    "code": "03-07-006",
    "name": "Sobrecarga hídrica",
    "officialName": "SOBRECARGA HÍDRICA",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 1920,
    "priceBs": "23.69"
  },
  {
    "code": "03-07-007",
    "name": "Test del sudor (procedimiento completo)",
    "officialName": "TEST DEL SUDOR (PROCEDIMIENTO COMPLETO)",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 16080,
    "priceBs": "198.40"
  },
  {
    "code": "03-07-008",
    "name": "Vasopresina test o similares (incluye además mediciones de diuresis)",
    "officialName": "VASOPRESINA TEST O SIMILARES (INCLUYE ADEMÁS MEDICIONES DE DIURESIS)",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 4590,
    "priceBs": "56.63"
  },
  {
    "code": "03-07-025",
    "name": "Test respiratorio de lactosa, lactulosa, fructuosa, c/u.",
    "officialName": "TEST RESPIRATORIO DE LACTOSA, LACTULOSA, FRUCTUOSA, C/U.",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 25670,
    "priceBs": "316.72"
  },
  {
    "code": "03-07-009",
    "name": "Arterial en adultos",
    "officialName": "ARTERIAL EN ADULTOS",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 1240,
    "priceBs": "15.30"
  },
  {
    "code": "03-07-010",
    "name": "Arterial en niños y lactantes",
    "officialName": "ARTERIAL EN NIÑOS Y LACTANTES",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 1830,
    "priceBs": "22.58"
  },
  {
    "code": "03-07-011",
    "name": "Venosa en adultos",
    "officialName": "VENOSA EN ADULTOS",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 910,
    "priceBs": "11.23"
  },
  {
    "code": "03-07-012",
    "name": "Venosa en niños y lactantes",
    "officialName": "VENOSA EN NIÑOS Y LACTANTES",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 830,
    "priceBs": "10.24"
  },
  {
    "code": "03-07-013",
    "name": "Con técnica aséptica para hemocultivo automatizado, c/u, no incluye frasco",
    "officialName": "CON TÉCNICA ASÉPTICA PARA HEMOCULTIVO AUTOMATIZADO, C/U, NO INCLUYE FRASCO",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 1430,
    "priceBs": "17.64"
  },
  {
    "code": "03-07-014",
    "name": "Capilar ( adultos, niños y lactantes )",
    "officialName": "CAPILAR ( ADULTOS, NIÑOS Y LACTANTES )",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 850,
    "priceBs": "10.49"
  },
  {
    "code": "03-07-016",
    "name": "Punción traqueal",
    "officialName": "PUNCIÓN TRAQUEAL",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 2480,
    "priceBs": "30.60"
  },
  {
    "code": "03-07-017",
    "name": "Punción vesical en recién nacidos",
    "officialName": "PUNCIÓN VESICAL EN RECIÉN NACIDOS",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 2700,
    "priceBs": "33.31"
  },
  {
    "code": "03-07-018",
    "name": "Punción medular ósea",
    "officialName": "PUNCIÓN MEDULAR ÓSEA",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 14450,
    "priceBs": "178.29"
  },
  {
    "code": "03-07-023",
    "name": "Aspirados nasofaríngeo para adulto y niño.",
    "officialName": "ASPIRADOS NASOFARÍNGEO PARA ADULTO Y NIÑO.",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 2540,
    "priceBs": "31.34"
  },
  {
    "code": "03-07-024",
    "name": "Reacción cutánea a alergenos (incluye el valor de los alergenos)",
    "officialName": "REACCIÓN CUTÁNEA A ALERGENOS (INCLUYE EL VALOR DE LOS ALERGENOS)",
    "section": "PROCEDIMIENTOS O DETERMINACIONES DIRECTAMENTE CON EL PACIENTE",
    "valueClp": 7510,
    "priceBs": "92.66"
  },
  {
    "code": "03-08-001",
    "name": "Azúcares reductores (benedict-fehling o similar)",
    "officialName": "AZÚCARES REDUCTORES (BENEDICT-FEHLING O SIMILAR)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1170,
    "priceBs": "14.44"
  },
  {
    "code": "03-08-003",
    "name": "Grasas neutras (sudán iii)",
    "officialName": "GRASAS NEUTRAS (SUDÁN III)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 670,
    "priceBs": "8.27"
  },
  {
    "code": "03-08-004",
    "name": "Hemorragias ocultas, (bencidina, guayaco o test de weber y similares), cualquier método, c/muestra",
    "officialName": "HEMORRAGIAS OCULTAS, (BENCIDINA, GUAYACO O TEST DE WEBER Y SIMILARES), CUALQUIER MÉTODO, C/MUESTRA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1210,
    "priceBs": "14.93"
  },
  {
    "code": "03-08-005",
    "name": "Leucocitos fecales",
    "officialName": "LEUCOCITOS FECALES",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1210,
    "priceBs": "14.93"
  },
  {
    "code": "03-08-006",
    "name": "Ph en deposiciones",
    "officialName": "PH EN DEPOSICIONES",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 670,
    "priceBs": "8.27"
  },
  {
    "code": "03-08-007",
    "name": "Elastasa fecal",
    "officialName": "ELASTASA FECAL",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 78830,
    "priceBs": "972.61"
  },
  {
    "code": "03-08-047",
    "name": "Esteatocrito",
    "officialName": "ESTEATOCRITO",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 16840,
    "priceBs": "207.77"
  },
  {
    "code": "03-08-049",
    "name": "Calprotectina cuantitativa por elisa",
    "officialName": "CALPROTECTINA CUANTITATIVA POR ELISA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 47010,
    "priceBs": "580.01"
  },
  {
    "code": "03-08-062",
    "name": "Análisis inmunoquímico/inmunológico de sangre oculta en deposiciones",
    "officialName": "ANÁLISIS INMUNOQUÍMICO/INMUNOLÓGICO DE SANGRE OCULTA EN DEPOSICIONES",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 14470,
    "priceBs": "178.53"
  },
  {
    "code": "03-08-063",
    "name": "Test de helicobacter pylori en deposiciones",
    "officialName": "TEST DE HELICOBACTER PYLORI EN DEPOSICIONES",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 30080,
    "priceBs": "371.13"
  },
  {
    "code": "03-08-009",
    "name": "Células neoplásicas en fluidos biológicos",
    "officialName": "CÉLULAS NEOPLÁSICAS EN FLUIDOS BIOLÓGICOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 5100,
    "priceBs": "62.92"
  },
  {
    "code": "03-08-010",
    "name": "Citológico c/s tinción (incluye examen al fresco, recuento celular y citológico porcentual)",
    "officialName": "CITOLÓGICO C/S TINCIÓN (INCLUYE EXAMEN AL FRESCO, RECUENTO CELULAR Y CITOLÓGICO PORCENTUAL)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 3430,
    "priceBs": "42.32"
  },
  {
    "code": "03-08-011",
    "name": "Directo al fresco c/s tinción, (incluye trichomonas)",
    "officialName": "DIRECTO AL FRESCO C/S TINCIÓN, (INCLUYE TRICHOMONAS)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1590,
    "priceBs": "19.62"
  },
  {
    "code": "03-08-012",
    "name": "Electrolitos (sodio, potasio, cloro), en exudados, secreciones y otros líquidos, c/u",
    "officialName": "ELECTROLITOS (SODIO, POTASIO, CLORO), EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS, C/U",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1690,
    "priceBs": "20.85"
  },
  {
    "code": "03-08-013",
    "name": "Eosinófilos en secreciones",
    "officialName": "EOSINÓFILOS EN SECRECIONES",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 830,
    "priceBs": "10.24"
  },
  {
    "code": "03-08-014",
    "name": "Físico-químico (incluye aspecto, color, ph, glucosa, proteína, pandy y filancia)",
    "officialName": "FÍSICO-QUÍMICO (INCLUYE ASPECTO, COLOR, PH, GLUCOSA, PROTEÍNA, PANDY Y FILANCIA)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 2880,
    "priceBs": "35.53"
  },
  {
    "code": "03-08-015",
    "name": "Glucosa en exudados, secreciones y otros líquidos",
    "officialName": "GLUCOSA EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 750,
    "priceBs": "9.25"
  },
  {
    "code": "03-08-016",
    "name": "Mucina, determinación de",
    "officialName": "MUCINA, DETERMINACIÓN DE",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1210,
    "priceBs": "14.93"
  },
  {
    "code": "03-08-017",
    "name": "Ph en exudados, secreciones y otros líquidos (proc. aut.)",
    "officialName": "PH EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS (PROC. AUT.)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 720,
    "priceBs": "8.88"
  },
  {
    "code": "03-08-019",
    "name": "Proteínas, electroforésis de (incluye proteínas totales) en otros líquidos biológicos",
    "officialName": "PROTEÍNAS, ELECTROFORÉSIS DE (INCLUYE PROTEÍNAS TOTALES) EN OTROS LÍQUIDOS BIOLÓGICOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 6830,
    "priceBs": "84.27"
  },
  {
    "code": "03-08-020",
    "name": "Bandas oligoclonales (incluye electroforesis de l.c.r., suero e inmunofijación)",
    "officialName": "BANDAS OLIGOCLONALES (INCLUYE ELECTROFORESIS DE L.C.R., SUERO E INMUNOFIJACIÓN)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 26780,
    "priceBs": "330.41"
  },
  {
    "code": "03-08-021",
    "name": "Glutamina",
    "officialName": "GLUTAMINA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 2080,
    "priceBs": "25.66"
  },
  {
    "code": "03-08-022",
    "name": "Índice igg/albúmina (incluye determ. de igg y albúmina en l.c.r. y suero)",
    "officialName": "ÍNDICE IGG/ALBÚMINA (INCLUYE DETERM. DE IGG Y ALBÚMINA EN L.C.R. Y SUERO)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 14870,
    "priceBs": "183.47"
  },
  {
    "code": "03-08-023",
    "name": "Estudio de cristales (con luz polarizada)",
    "officialName": "ESTUDIO DE CRISTALES (CON LUZ POLARIZADA)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1800,
    "priceBs": "22.21"
  },
  {
    "code": "03-08-025",
    "name": "Prueba de estimulación máxima con histamina, mínimo 5 muestras (no incluye la histamina ni el antihistamínico).",
    "officialName": "PRUEBA DE ESTIMULACIÓN MÁXIMA CON HISTAMINA, MÍNIMO 5 MUESTRAS (NO INCLUYE LA HISTAMINA NI EL ANTIHISTAMÍNICO).",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 6030,
    "priceBs": "74.40"
  },
  {
    "code": "03-08-029",
    "name": "Espermiograma (físico y microscópico, con o sin observación hasta 24 horas)",
    "officialName": "ESPERMIOGRAMA (FÍSICO Y MICROSCÓPICO, CON O SIN OBSERVACIÓN HASTA 24 HORAS)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 4870,
    "priceBs": "60.09"
  },
  {
    "code": "03-08-030",
    "name": "Fosfatasa ácida prostática",
    "officialName": "FOSFATASA ÁCIDA PROSTÁTICA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 3280,
    "priceBs": "40.47"
  },
  {
    "code": "03-08-031",
    "name": "Fructosa seminal",
    "officialName": "FRUCTOSA SEMINAL",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 2100,
    "priceBs": "25.91"
  },
  {
    "code": "03-08-033",
    "name": "Células anaranjadas (proc. aut.)",
    "officialName": "CÉLULAS ANARANJADAS (PROC. AUT.)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 820,
    "priceBs": "10.12"
  },
  {
    "code": "03-08-034",
    "name": "Contaminantes (meconio y sangre) (proc. aut.)",
    "officialName": "CONTAMINANTES (MECONIO Y SANGRE) (PROC. AUT.)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1200,
    "priceBs": "14.81"
  },
  {
    "code": "03-08-035",
    "name": "Creatinina en exudados, secreciones y otros líquidos (proc. aut.)",
    "officialName": "CREATININA EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS (PROC. AUT.)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1320,
    "priceBs": "16.29"
  },
  {
    "code": "03-08-036",
    "name": "Fosfatidil glicerol y/o fosfatidil inositol",
    "officialName": "FOSFATIDIL GLICEROL Y/O FOSFATIDIL INOSITOL",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 8080,
    "priceBs": "99.69"
  },
  {
    "code": "03-08-037",
    "name": "Índice de bilirrubina (prueba de liley)",
    "officialName": "ÍNDICE DE BILIRRUBINA (PRUEBA DE LILEY)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1620,
    "priceBs": "19.99"
  },
  {
    "code": "03-08-038",
    "name": "Índice lecitina/esfingomielina",
    "officialName": "ÍNDICE LECITINA/ESFINGOMIELINA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 6130,
    "priceBs": "75.63"
  },
  {
    "code": "03-08-039",
    "name": "Madurez fetal completa (físico; células anaranjadas, bilirrubina, test de clements, creatinina, contaminantes)",
    "officialName": "MADUREZ FETAL COMPLETA (FÍSICO; CÉLULAS ANARANJADAS, BILIRRUBINA, TEST DE CLEMENTS, CREATININA, CONTAMINANTES)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 7830,
    "priceBs": "96.61"
  },
  {
    "code": "03-08-040",
    "name": "Test de clements (proc. aut.)",
    "officialName": "TEST DE CLEMENTS (PROC. AUT.)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1360,
    "priceBs": "16.78"
  },
  {
    "code": "03-08-041",
    "name": "Colpocitograma",
    "officialName": "COLPOCITOGRAMA",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 2770,
    "priceBs": "34.18"
  },
  {
    "code": "03-08-043",
    "name": "Moco-semen, prueba de compatibilidad",
    "officialName": "MOCO-SEMEN, PRUEBA DE COMPATIBILIDAD",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 2620,
    "priceBs": "32.33"
  },
  {
    "code": "03-08-044",
    "name": "Flujo vaginal o secreción uretral, estudio de (incluye toma de muestra y códigos 03-06-004, 03-06-005, 03-06-008, 03-06-017 y 03-06-026)",
    "officialName": "FLUJO VAGINAL O SECRECIÓN URETRAL, ESTUDIO DE (INCLUYE TOMA DE MUESTRA Y CÓDIGOS 03-06-004, 03-06-005, 03-06-008, 03-06-017 Y 03-06-026)",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 7990,
    "priceBs": "98.58"
  },
  {
    "code": "03-08-045",
    "name": "Amilasa en líquidos biológicos",
    "officialName": "AMILASA EN LÍQUIDOS BIOLÓGICOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 4820,
    "priceBs": "59.47"
  },
  {
    "code": "03-08-046",
    "name": "Lipasa en líquidos biológicos",
    "officialName": "LIPASA EN LÍQUIDOS BIOLÓGICOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 3180,
    "priceBs": "39.24"
  },
  {
    "code": "03-08-050",
    "name": "Proteínas totales en exudados, secreciones y otros líquidos",
    "officialName": "PROTEÍNAS TOTALES EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1570,
    "priceBs": "19.37"
  },
  {
    "code": "03-08-051",
    "name": "Albúminas en exudados, secreciones y otros líquidos",
    "officialName": "ALBÚMINAS EN EXUDADOS, SECRECIONES Y OTROS LÍQUIDOS",
    "section": "EXAMENES DE DEPOSICIONES, EXUDADOS, SECRECIONES Y OTROS LIQUIDOS",
    "valueClp": 1570,
    "priceBs": "19.37"
  },
  {
    "code": "03-09-001",
    "name": "Acido ascórbico",
    "officialName": "ACIDO ASCÓRBICO",
    "section": "EXAMENES ORINA",
    "valueClp": 2680,
    "priceBs": "33.07"
  },
  {
    "code": "03-09-002",
    "name": "Acido delta aminolevulínico",
    "officialName": "ACIDO DELTA AMINOLEVULÍNICO",
    "section": "EXAMENES ORINA",
    "valueClp": 4700,
    "priceBs": "57.99"
  },
  {
    "code": "03-09-004",
    "name": "Ácido úrico en orina (cuantitativo)",
    "officialName": "ÁCIDO ÚRICO EN ORINA (CUANTITATIVO)",
    "section": "EXAMENES ORINA",
    "valueClp": 2270,
    "priceBs": "28.01"
  },
  {
    "code": "03-09-005",
    "name": "Acido 5 hidroxiindolacético cuantitativo",
    "officialName": "ACIDO 5 HIDROXIINDOLACÉTICO CUANTITATIVO",
    "section": "EXAMENES ORINA",
    "valueClp": 5630,
    "priceBs": "69.46"
  },
  {
    "code": "03-09-006",
    "name": "Amilasa cuantitativa en orina",
    "officialName": "AMILASA CUANTITATIVA EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 2780,
    "priceBs": "34.30"
  },
  {
    "code": "03-09-007",
    "name": "Aminoácidos en orina (cualitativo)(excepto fenilalanina, pku)",
    "officialName": "AMINOÁCIDOS EN ORINA (CUALITATIVO)(EXCEPTO FENILALANINA, PKU)",
    "section": "EXAMENES ORINA",
    "valueClp": 5980,
    "priceBs": "73.78"
  },
  {
    "code": "03-09-008",
    "name": "Calcio cuantitativo en orina",
    "officialName": "CALCIO CUANTITATIVO EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 2100,
    "priceBs": "25.91"
  },
  {
    "code": "03-09-009",
    "name": "Cálculo urinario (examen físico y químico)",
    "officialName": "CÁLCULO URINARIO (EXAMEN FÍSICO Y QUÍMICO)",
    "section": "EXAMENES ORINA",
    "valueClp": 4990,
    "priceBs": "61.57"
  },
  {
    "code": "03-09-010",
    "name": "Creatinina cuantitativa en orina",
    "officialName": "CREATININA CUANTITATIVA EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 1590,
    "priceBs": "19.62"
  },
  {
    "code": "03-09-012",
    "name": "Electrólitos (sodio, potasio, cloro) c/u, en orina",
    "officialName": "ELECTRÓLITOS (SODIO, POTASIO, CLORO) C/U, EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 1620,
    "priceBs": "19.99"
  },
  {
    "code": "03-09-013",
    "name": "Microalbuminuria cuantitativa",
    "officialName": "MICROALBUMINURIA CUANTITATIVA",
    "section": "EXAMENES ORINA",
    "valueClp": 2910,
    "priceBs": "35.90"
  },
  {
    "code": "03-09-014",
    "name": "Gonadotrofina coriónica, sub-unidad beta en orina (test rápido)",
    "officialName": "GONADOTROFINA CORIÓNICA, SUB-UNIDAD BETA EN ORINA (TEST RÁPIDO)",
    "section": "EXAMENES ORINA",
    "valueClp": 2770,
    "priceBs": "34.18"
  },
  {
    "code": "03-09-015",
    "name": "Fósforo cuantitativo en orina",
    "officialName": "FÓSFORO CUANTITATIVO EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 2100,
    "priceBs": "25.91"
  },
  {
    "code": "03-09-016",
    "name": "Glucosa (cuantitativo), en orina",
    "officialName": "GLUCOSA (CUANTITATIVO), EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 1430,
    "priceBs": "17.64"
  },
  {
    "code": "03-09-035",
    "name": "Hemosiderina",
    "officialName": "HEMOSIDERINA",
    "section": "EXAMENES ORINA",
    "valueClp": 1580,
    "priceBs": "19.49"
  },
  {
    "code": "03-09-017",
    "name": "Hidroxiprolina en orina",
    "officialName": "HIDROXIPROLINA EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 4740,
    "priceBs": "58.48"
  },
  {
    "code": "03-09-019",
    "name": "Mucopolisacáridos",
    "officialName": "MUCOPOLISACÁRIDOS",
    "section": "EXAMENES ORINA",
    "valueClp": 6130,
    "priceBs": "75.63"
  },
  {
    "code": "03-09-020",
    "name": "Nitrógeno ureico o urea en orina (cuantitativo)",
    "officialName": "NITRÓGENO UREICO O UREA EN ORINA (CUANTITATIVO)",
    "section": "EXAMENES ORINA",
    "valueClp": 880,
    "priceBs": "10.86"
  },
  {
    "code": "03-09-021",
    "name": "Nucleótidos cíclicos (camp, cgm, u otros) c/u",
    "officialName": "NUCLEÓTIDOS CÍCLICOS (CAMP, CGM, U OTROS) C/U",
    "section": "EXAMENES ORINA",
    "valueClp": 5190,
    "priceBs": "64.03"
  },
  {
    "code": "03-09-022",
    "name": "Orina completa, (incluye cód. 03-09-023 y 03-09-024)",
    "officialName": "ORINA COMPLETA, (INCLUYE CÓD. 03-09-023 Y 03-09-024)",
    "section": "EXAMENES ORINA",
    "valueClp": 1960,
    "priceBs": "24.18"
  },
  {
    "code": "03-09-023",
    "name": "Orina, físico-químico ( aspecto, color, densidad, ph; proteínas, glucosa, cuerpos cetónicos, urobilinogeno, bilirrubina, hemoglobina y nitritos, determinación cualitativa o semi cuantitativa) todos o cada uno de los parámetros (proc. aut.)",
    "officialName": "ORINA, FÍSICO-QUÍMICO ( ASPECTO, COLOR, DENSIDAD, PH; PROTEÍNAS, GLUCOSA, CUERPOS CETÓNICOS, UROBILINOGENO, BILIRRUBINA, HEMOGLOBINA Y NITRITOS, DETERMINACIÓN CUALITATIVA O SEMI CUANTITATIVA) TODOS O CADA UNO DE LOS PARÁMETROS (PROC. AUT.)",
    "section": "EXAMENES ORINA",
    "valueClp": 1430,
    "priceBs": "17.64"
  },
  {
    "code": "03-09-024",
    "name": "Sedimento de orina (proc. aut.)",
    "officialName": "SEDIMENTO DE ORINA (PROC. AUT.)",
    "section": "EXAMENES ORINA",
    "valueClp": 1130,
    "priceBs": "13.94"
  },
  {
    "code": "03-09-025",
    "name": "Osmolalidad",
    "officialName": "OSMOLALIDAD",
    "section": "EXAMENES ORINA",
    "valueClp": 1940,
    "priceBs": "23.94"
  },
  {
    "code": "03-09-027",
    "name": "Porfirinas, c/u",
    "officialName": "PORFIRINAS, C/U",
    "section": "EXAMENES ORINA",
    "valueClp": 2660,
    "priceBs": "32.82"
  },
  {
    "code": "03-09-028",
    "name": "Proteína (cuantitativa), en orina",
    "officialName": "PROTEÍNA (CUANTITATIVA), EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 1830,
    "priceBs": "22.58"
  },
  {
    "code": "03-09-029",
    "name": "Proteínas de bence-jones prueba térmica",
    "officialName": "PROTEÍNAS DE BENCE-JONES PRUEBA TÉRMICA",
    "section": "EXAMENES ORINA",
    "valueClp": 1180,
    "priceBs": "14.56"
  },
  {
    "code": "03-09-034",
    "name": "Arsenico en orina (muestra aislada)",
    "officialName": "ARSENICO EN ORINA (MUESTRA AISLADA)",
    "section": "EXAMENES ORINA",
    "valueClp": 48360,
    "priceBs": "596.67"
  },
  {
    "code": "03-09-036",
    "name": "Cobre en orina",
    "officialName": "COBRE EN ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 32810,
    "priceBs": "404.81"
  },
  {
    "code": "03-09-044",
    "name": "Ácidos orgánicos, orina",
    "officialName": "ÁCIDOS ORGÁNICOS, ORINA",
    "section": "EXAMENES ORINA",
    "valueClp": 304850,
    "priceBs": "3761.26"
  },
  {
    "code": "03-09-046",
    "name": "Screening de mucopolisacaridos",
    "officialName": "SCREENING DE MUCOPOLISACARIDOS",
    "section": "EXAMENES ORINA",
    "valueClp": 129960,
    "priceBs": "1603.45"
  }
];

export const FONASA_IMAGEN: readonly PrestacionFonasa[] = [
  {
    "code": "04-01-001",
    "name": "Radiografía de las glándulas salivales 'sialografía'",
    "officialName": "RADIOGRAFÍA DE LAS GLÁNDULAS SALIVALES 'SIALOGRAFÍA'",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 26040,
    "priceBs": "321.28"
  },
  {
    "code": "04-01-002",
    "name": "Radiografía de partes blandas, laringe lateral, cavum rinofaríngeo (rinofarinx).",
    "officialName": "RADIOGRAFÍA DE PARTES BLANDAS, LARINGE LATERAL, CAVUM RINOFARÍNGEO (RINOFARINX).",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 9730,
    "priceBs": "120.05"
  },
  {
    "code": "04-01-004",
    "name": "Radiografía de tórax, proyección complementaria (oblicuas, selectivas u otras)",
    "officialName": "RADIOGRAFÍA DE TÓRAX, PROYECCIÓN COMPLEMENTARIA (OBLICUAS, SELECTIVAS U OTRAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8960,
    "priceBs": "110.55"
  },
  {
    "code": "04-01-008",
    "name": "Radiografía de tórax frontal o lateral con equipo móvil fuera del departamento de rayos.",
    "officialName": "RADIOGRAFÍA DE TÓRAX FRONTAL O LATERAL CON EQUIPO MÓVIL FUERA DEL DEPARTAMENTO DE RAYOS.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 12670,
    "priceBs": "156.32"
  },
  {
    "code": "04-01-009",
    "name": "Radiografía de tórax simple frontal o lateral",
    "officialName": "RADIOGRAFÍA DE TÓRAX SIMPLE FRONTAL O LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11050,
    "priceBs": "136.34"
  },
  {
    "code": "04-01-070",
    "name": "Radiografía de tórax frontal y lateral",
    "officialName": "RADIOGRAFÍA DE TÓRAX FRONTAL Y LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 19930,
    "priceBs": "245.90"
  },
  {
    "code": "04-01-010",
    "name": "Mamografía bilateral",
    "officialName": "MAMOGRAFÍA BILATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 23500,
    "priceBs": "289.94"
  },
  {
    "code": "04-01-110",
    "name": "Mamografía unilateral",
    "officialName": "MAMOGRAFÍA UNILATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 13800,
    "priceBs": "170.27"
  },
  {
    "code": "04-01-130",
    "name": "Mamografía proyección complementaria (axilar u otras)",
    "officialName": "MAMOGRAFÍA PROYECCIÓN COMPLEMENTARIA (AXILAR U OTRAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 5040,
    "priceBs": "62.18"
  },
  {
    "code": "04-01-011",
    "name": "Marcación preoperatoria de lesiones de la mama",
    "officialName": "MARCACIÓN PREOPERATORIA DE LESIONES DE LA MAMA",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 32260,
    "priceBs": "398.03"
  },
  {
    "code": "04-01-012",
    "name": "Radiografía de mama, pieza operatoria",
    "officialName": "RADIOGRAFÍA DE MAMA, PIEZA OPERATORIA",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 9470,
    "priceBs": "116.84"
  },
  {
    "code": "04-01-013",
    "name": "Radiografía de abdomen simple",
    "officialName": "RADIOGRAFÍA DE ABDOMEN SIMPLE",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 10130,
    "priceBs": "124.98"
  },
  {
    "code": "04-01-014",
    "name": "Radiografía de abdomen simple, proyección complementaria (lateral y/o oblicua)",
    "officialName": "RADIOGRAFÍA DE ABDOMEN SIMPLE, PROYECCIÓN COMPLEMENTARIA (LATERAL Y/O OBLICUA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 7300,
    "priceBs": "90.07"
  },
  {
    "code": "04-01-015",
    "name": "Colangiografía intra o postoperatoria (por sonda t, o similar)",
    "officialName": "COLANGIOGRAFÍA INTRA O POSTOPERATORIA (POR SONDA T, O SIMILAR)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 23620,
    "priceBs": "291.43"
  },
  {
    "code": "04-01-018",
    "name": "Enema baritado del colon (incluye llene y control post-vaciamiento)",
    "officialName": "ENEMA BARITADO DEL COLON (INCLUYE LLENE Y CONTROL POST-VACIAMIENTO)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 48390,
    "priceBs": "597.04"
  },
  {
    "code": "04-01-019",
    "name": "Enema baritado del colon o intestino delgado, doble contraste",
    "officialName": "ENEMA BARITADO DEL COLON O INTESTINO DELGADO, DOBLE CONTRASTE",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 46710,
    "priceBs": "576.31"
  },
  {
    "code": "04-01-020",
    "name": "Esofagograma (incluye pesquisa de cuerpo extraño) (proc.aut.)",
    "officialName": "ESOFAGOGRAMA (INCLUYE PESQUISA DE CUERPO EXTRAÑO) (PROC.AUT.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 22160,
    "priceBs": "273.41"
  },
  {
    "code": "04-01-021",
    "name": "Radiografía de esófago, estómago y duodeno, relleno y/o doble contraste",
    "officialName": "RADIOGRAFÍA DE ESÓFAGO, ESTÓMAGO Y DUODENO, RELLENO Y/O DOBLE CONTRASTE",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 41090,
    "priceBs": "506.97"
  },
  {
    "code": "04-01-022",
    "name": "Estudio radiológico de deglución faríngea",
    "officialName": "ESTUDIO RADIOLÓGICO DE DEGLUCIÓN FARÍNGEA",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 18470,
    "priceBs": "227.88"
  },
  {
    "code": "04-01-023",
    "name": "Estudio radiológico del intestino delgado",
    "officialName": "ESTUDIO RADIOLÓGICO DEL INTESTINO DELGADO",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 34200,
    "priceBs": "421.96"
  },
  {
    "code": "04-01-024",
    "name": "Radiografía de esófago, estómago y duodeno, simple en niños",
    "officialName": "RADIOGRAFÍA DE ESÓFAGO, ESTÓMAGO Y DUODENO, SIMPLE EN NIÑOS",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 34060,
    "priceBs": "420.23"
  },
  {
    "code": "04-01-073",
    "name": "Videofluoroscopia para estudio de deglución",
    "officialName": "VIDEOFLUOROSCOPIA PARA ESTUDIO DE DEGLUCIÓN",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 121310,
    "priceBs": "1496.73"
  },
  {
    "code": "04-01-027",
    "name": "Pielografía de eliminación o descendente: incluye renal y vesical simples previas, 3 placas post inyección de medio de contraste, controles de pie y cistografía pre y post miccional.",
    "officialName": "PIELOGRAFÍA DE ELIMINACIÓN O DESCENDENTE: INCLUYE RENAL Y VESICAL SIMPLES PREVIAS, 3 PLACAS POST INYECCIÓN DE MEDIO DE CONTRASTE, CONTROLES DE PIE Y CISTOGRAFÍA PRE Y POST MICCIONAL.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 43520,
    "priceBs": "536.95"
  },
  {
    "code": "04-01-028",
    "name": "Radiografía renal simple (proc. aut.)",
    "officialName": "RADIOGRAFÍA RENAL SIMPLE (PROC. AUT.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 9320,
    "priceBs": "114.99"
  },
  {
    "code": "04-01-029",
    "name": "Radiografía vesical simple o perivesical (proc. aut.)",
    "officialName": "RADIOGRAFÍA VESICAL SIMPLE O PERIVESICAL (PROC. AUT.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8030,
    "priceBs": "99.07"
  },
  {
    "code": "04-01-031",
    "name": "Radiografía de cavidades perinasales, órbitas, articulaciones temporomandibulares, huesos propios de la nariz, malar, maxilar, arco cigomático y cara",
    "officialName": "RADIOGRAFÍA DE CAVIDADES PERINASALES, ÓRBITAS, ARTICULACIONES TEMPOROMANDIBULARES, HUESOS PROPIOS DE LA NARIZ, MALAR, MAXILAR, ARCO CIGOMÁTICO Y CARA",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 10970,
    "priceBs": "135.35"
  },
  {
    "code": "04-01-032",
    "name": "Radiografía de cráneo frontal y lateral",
    "officialName": "RADIOGRAFÍA DE CRÁNEO FRONTAL Y LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11470,
    "priceBs": "141.52"
  },
  {
    "code": "04-01-033",
    "name": "Radiografía de cráneo proyección especial de base de cráneo (towne)",
    "officialName": "RADIOGRAFÍA DE CRÁNEO PROYECCIÓN ESPECIAL DE BASE DE CRÁNEO (TOWNE)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8040,
    "priceBs": "99.20"
  },
  {
    "code": "04-01-035",
    "name": "Radiografía de oído, unilateral o bilateral",
    "officialName": "RADIOGRAFÍA DE OÍDO, UNILATERAL O BILATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 13880,
    "priceBs": "171.25"
  },
  {
    "code": "04-01-040",
    "name": "Radiografía de silla turca frontal y lateral",
    "officialName": "RADIOGRAFÍA DE SILLA TURCA FRONTAL Y LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 12820,
    "priceBs": "158.17"
  },
  {
    "code": "04-01-042",
    "name": "Radiografía de columna cervical o atlas-axis (frontal y lateral)",
    "officialName": "RADIOGRAFÍA DE COLUMNA CERVICAL O ATLAS-AXIS (FRONTAL Y LATERAL)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11050,
    "priceBs": "136.34"
  },
  {
    "code": "04-01-043",
    "name": "Radiografía de columna cervical (frontal, lateral y oblicuas)",
    "officialName": "RADIOGRAFÍA DE COLUMNA CERVICAL (FRONTAL, LATERAL Y OBLICUAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 18600,
    "priceBs": "229.49"
  },
  {
    "code": "04-01-044",
    "name": "Radiografía de columna cervical flexión y extensión (dinámicas)",
    "officialName": "RADIOGRAFÍA DE COLUMNA CERVICAL FLEXIÓN Y EXTENSIÓN (DINÁMICAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 10430,
    "priceBs": "128.69"
  },
  {
    "code": "04-01-045",
    "name": "Radiografía de columna dorsal o dorsolumbar localizada, parrilla costal (frontal y lateral)",
    "officialName": "RADIOGRAFÍA DE COLUMNA DORSAL O DORSOLUMBAR LOCALIZADA, PARRILLA COSTAL (FRONTAL Y LATERAL)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 12870,
    "priceBs": "158.79"
  },
  {
    "code": "04-01-046",
    "name": "Radiografía columna lumbar o lumbosacra ( frontal, lateral y focalizada en el 5° espacio)",
    "officialName": "RADIOGRAFÍA COLUMNA LUMBAR O LUMBOSACRA ( FRONTAL, LATERAL Y FOCALIZADA EN EL 5° ESPACIO)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 19050,
    "priceBs": "235.04"
  },
  {
    "code": "04-01-047",
    "name": "Radiografía columna lumbar o lumbosacra flexión y extensión (dinámicas)",
    "officialName": "RADIOGRAFÍA COLUMNA LUMBAR O LUMBOSACRA FLEXIÓN Y EXTENSIÓN (DINÁMICAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 15490,
    "priceBs": "191.12"
  },
  {
    "code": "04-01-048",
    "name": "Radiografía columna lumbar o lumbosacra, oblicuas adicionales",
    "officialName": "RADIOGRAFÍA COLUMNA LUMBAR O LUMBOSACRA, OBLICUAS ADICIONALES",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 10430,
    "priceBs": "128.69"
  },
  {
    "code": "04-01-049",
    "name": "Radiografía de columna total, panorámica con folio graduado frontal o lateral",
    "officialName": "RADIOGRAFÍA DE COLUMNA TOTAL, PANORÁMICA CON FOLIO GRADUADO FRONTAL O LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 14250,
    "priceBs": "175.82"
  },
  {
    "code": "04-01-051",
    "name": "Radiografía de pelvis, cadera o coxofemoral",
    "officialName": "RADIOGRAFÍA DE PELVIS, CADERA O COXOFEMORAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8470,
    "priceBs": "104.50"
  },
  {
    "code": "04-01-151",
    "name": "Radiografía de pelvis, cadera o coxofemoral de RN, lactante o niño menor de 6 años.",
    "officialName": "RADIOGRAFÍA DE PELVIS, CADERA O COXOFEMORAL DE RN, LACTANTE O NIÑO MENOR DE 6 AÑOS.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8080,
    "priceBs": "99.69"
  },
  {
    "code": "04-01-052",
    "name": "Radiografía de pelvis, cadera o coxofemoral, proyecciones especiales; (rotación interna, abducción, lateral, lawenstein u otras)",
    "officialName": "RADIOGRAFÍA DE PELVIS, CADERA O COXOFEMORAL, PROYECCIONES ESPECIALES; (ROTACIÓN INTERNA, ABDUCCIÓN, LATERAL, LAWENSTEIN U OTRAS)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 7720,
    "priceBs": "95.25"
  },
  {
    "code": "04-01-053",
    "name": "Radiografía de sacrocoxis o articulaciones sacroilíacas.",
    "officialName": "RADIOGRAFÍA DE SACROCOXIS O ARTICULACIONES SACROILÍACAS.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11620,
    "priceBs": "143.37"
  },
  {
    "code": "04-01-054",
    "name": "Radiografía de brazo, antebrazo, codo, muñeca, mano, dedos, pie (frontal y lateral)",
    "officialName": "RADIOGRAFÍA DE BRAZO, ANTEBRAZO, CODO, MUÑECA, MANO, DEDOS, PIE (FRONTAL Y LATERAL)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 9640,
    "priceBs": "118.94"
  },
  {
    "code": "04-01-055",
    "name": "Radiografía de clavícula.",
    "officialName": "RADIOGRAFÍA DE CLAVÍCULA.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11280,
    "priceBs": "139.17"
  },
  {
    "code": "04-01-056",
    "name": "Radiografía edad ósea: carpo y mano",
    "officialName": "RADIOGRAFÍA EDAD ÓSEA: CARPO Y MANO",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8040,
    "priceBs": "99.20"
  },
  {
    "code": "04-01-057",
    "name": "Radiografía edad ósea : rodilla frontal",
    "officialName": "RADIOGRAFÍA EDAD ÓSEA : RODILLA FRONTAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8390,
    "priceBs": "103.52"
  },
  {
    "code": "04-01-058",
    "name": "Estudio radiológico de escafoides",
    "officialName": "ESTUDIO RADIOLÓGICO DE ESCAFOIDES",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 12610,
    "priceBs": "155.58"
  },
  {
    "code": "04-01-059",
    "name": "Estudio radiológico de muñeca o tobillo frontal lateral y oblicuas",
    "officialName": "ESTUDIO RADIOLÓGICO DE MUÑECA O TOBILLO FRONTAL LATERAL Y OBLICUAS",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 10900,
    "priceBs": "134.48"
  },
  {
    "code": "04-01-060",
    "name": "Radiografía de hombro, fémur, rodilla, pierna, costilla o esternón frontal y lateral",
    "officialName": "RADIOGRAFÍA DE HOMBRO, FÉMUR, RODILLA, PIERNA, COSTILLA O ESTERNÓN FRONTAL Y LATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 11400,
    "priceBs": "140.65"
  },
  {
    "code": "04-01-062",
    "name": "Radiografía de proyecciones especiales oblicuas u otras en hombro, brazo, codo, rodilla, rótulas, sesamoideos, axial de ambas rótulas o similares",
    "officialName": "RADIOGRAFÍA DE PROYECCIONES ESPECIALES OBLICUAS U OTRAS EN HOMBRO, BRAZO, CODO, RODILLA, RÓTULAS, SESAMOIDEOS, AXIAL DE AMBAS RÓTULAS O SIMILARES",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 7930,
    "priceBs": "97.84"
  },
  {
    "code": "04-01-063",
    "name": "Radiografía de túnel intercondíleo o radio-carpiano",
    "officialName": "RADIOGRAFÍA DE TÚNEL INTERCONDÍLEO O RADIO-CARPIANO",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 7720,
    "priceBs": "95.25"
  },
  {
    "code": "04-01-064",
    "name": "Apoyo fluoroscópico a procedimientos intraoperatorios y/o biopsia (no incluye el proc.)",
    "officialName": "APOYO FLUOROSCÓPICO A PROCEDIMIENTOS INTRAOPERATORIOS Y/O BIOPSIA (NO INCLUYE EL PROC.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 9370,
    "priceBs": "115.61"
  },
  {
    "code": "04-02-005",
    "name": "Galactografía, unilateral",
    "officialName": "GALACTOGRAFÍA, UNILATERAL",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 12020,
    "priceBs": "148.30"
  },
  {
    "code": "04-02-008",
    "name": "Colangiopancreatografía endoscópica (a.c.18-01-018; 5-7 exp)",
    "officialName": "COLANGIOPANCREATOGRAFÍA ENDOSCÓPICA (A.C.18-01-018; 5-7 EXP)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 31600,
    "priceBs": "389.88"
  },
  {
    "code": "04-02-009",
    "name": "Fistulografía (a.c. 18-01-020) (3 exp.)",
    "officialName": "FISTULOGRAFÍA (A.C. 18-01-020) (3 EXP.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 8610,
    "priceBs": "106.23"
  },
  {
    "code": "04-02-011",
    "name": "Histerosalpingografía (a.c. 20-01-013) (4 exp.; incluye prueba de cotte tardía)",
    "officialName": "HISTEROSALPINGOGRAFÍA (A.C. 20-01-013) (4 EXP.; INCLUYE PRUEBA DE COTTE TARDÍA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 24550,
    "priceBs": "302.90"
  },
  {
    "code": "04-02-012",
    "name": "Pielografía ascendente (a.c. 19-01-015) (3 exp.)",
    "officialName": "PIELOGRAFÍA ASCENDENTE (A.C. 19-01-015) (3 EXP.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 28110,
    "priceBs": "346.82"
  },
  {
    "code": "04-02-014",
    "name": "Uretro y/o cistouretrografía miccional retrógrada (a.c. 19-01-016) ( 5 exp.)",
    "officialName": "URETRO Y/O CISTOURETROGRAFÍA MICCIONAL RETRÓGRADA (A.C. 19-01-016) ( 5 EXP.)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 26330,
    "priceBs": "324.86"
  },
  {
    "code": "04-02-015",
    "name": "Artrografía facetaria",
    "officialName": "ARTROGRAFÍA FACETARIA",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 38830,
    "priceBs": "479.09"
  },
  {
    "code": "04-02-019",
    "name": "Angiografía selectiva de carótida externa o interna (a.c 17-01-061 al 17-01-069, según corresponda)",
    "officialName": "ANGIOGRAFÍA SELECTIVA DE CARÓTIDA EXTERNA O INTERNA (A.C 17-01-061 AL 17-01-069, SEGÚN CORRESPONDA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 43490,
    "priceBs": "536.58"
  },
  {
    "code": "04-02-020",
    "name": "Angiografía selectiva medular (a.c 17-01-061 al 17-01-069, según corresponda)",
    "officialName": "ANGIOGRAFÍA SELECTIVA MEDULAR (A.C 17-01-061 AL 17-01-069, SEGÚN CORRESPONDA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 44870,
    "priceBs": "553.61"
  },
  {
    "code": "04-02-022",
    "name": "Angioplastia intraluminal coronaria. procedimiento radiológico. (a.c.17-01-031)",
    "officialName": "ANGIOPLASTIA INTRALUMINAL CORONARIA. PROCEDIMIENTO RADIOLÓGICO. (A.C.17-01-031)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 70520,
    "priceBs": "870.08"
  },
  {
    "code": "04-02-023",
    "name": "Angioplastia intraluminal periférica. procedimiento radiológico. (a.c. 17-01-032)",
    "officialName": "ANGIOPLASTIA INTRALUMINAL PERIFÉRICA. PROCEDIMIENTO RADIOLÓGICO. (A.C. 17-01-032)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 49120,
    "priceBs": "606.05"
  },
  {
    "code": "04-02-024",
    "name": "Aortografía con AOT o cineangiografía (a.c. 17-01-022)",
    "officialName": "AORTOGRAFÍA CON AOT O CINEANGIOGRAFÍA (A.C. 17-01-022)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 51490,
    "priceBs": "635.29"
  },
  {
    "code": "04-02-025",
    "name": "Arteriografía de miembros superiores o inferiores unilateral (a.c.17-01-023)",
    "officialName": "ARTERIOGRAFÍA DE MIEMBROS SUPERIORES O INFERIORES UNILATERAL (A.C.17-01-023)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 32540,
    "priceBs": "401.48"
  },
  {
    "code": "04-02-027",
    "name": "Arteriografía selectiva con AOT o cineangiografía (pulmonar, renal, tronco celíaco o similar) c/u. (a.c 17-01-061 al 17-01-069, según corresponda)",
    "officialName": "ARTERIOGRAFÍA SELECTIVA CON AOT O CINEANGIOGRAFÍA (PULMONAR, RENAL, TRONCO CELÍACO O SIMILAR) C/U. (A.C 17-01-061 AL 17-01-069, SEGÚN CORRESPONDA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 60480,
    "priceBs": "746.21"
  },
  {
    "code": "04-02-029",
    "name": "Arteriografía de vasos del cuello ( carótidas y vertebrales) (a.c. 11-01-013)",
    "officialName": "ARTERIOGRAFÍA DE VASOS DEL CUELLO ( CARÓTIDAS Y VERTEBRALES) (A.C. 11-01-013)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 44210,
    "priceBs": "545.47"
  },
  {
    "code": "04-02-030",
    "name": "Cinecoronariografía (a.c. 17-01-019)",
    "officialName": "CINECORONARIOGRAFÍA (A.C. 17-01-019)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 54990,
    "priceBs": "678.47"
  },
  {
    "code": "04-02-031",
    "name": "Embolización o balonización (a.c. de la angiografía correspondiente) (incluye control radiológico inmediato)",
    "officialName": "EMBOLIZACIÓN O BALONIZACIÓN (A.C. DE LA ANGIOGRAFÍA CORRESPONDIENTE) (INCLUYE CONTROL RADIOLÓGICO INMEDIATO)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 34520,
    "priceBs": "425.91"
  },
  {
    "code": "04-02-032",
    "name": "Instalación de catéter o sonda intracardíaca, control por radiólogo de (a.c. 17-01-020, 17-01-021, 17-01-011 o 17-01-014, según corresponda)",
    "officialName": "INSTALACIÓN DE CATÉTER O SONDA INTRACARDÍACA, CONTROL POR RADIÓLOGO DE (A.C. 17-01-020, 17-01-021, 17-01-011 O 17-01-014, SEGÚN CORRESPONDA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 24120,
    "priceBs": "297.59"
  },
  {
    "code": "04-02-033",
    "name": "Ventriculografía derecha y/o izquierda (a.c. 17-01-011, 17-01-020 ó 17-01-021 ó 17-01-041 ó 17-01-42 ó 17-01-43, según corresponda)",
    "officialName": "VENTRICULOGRAFÍA DERECHA Y/O IZQUIERDA (A.C. 17-01-011, 17-01-020 Ó 17-01-021 Ó 17-01-041 Ó 17-01-42 Ó 17-01-43, SEGÚN CORRESPONDA)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 54990,
    "priceBs": "678.47"
  },
  {
    "code": "04-02-035",
    "name": "Cavografía (a.c. 17-01-025)",
    "officialName": "CAVOGRAFÍA (A.C. 17-01-025)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 31100,
    "priceBs": "383.71"
  },
  {
    "code": "04-02-038",
    "name": "Flebografía extremidad inferior o superior, unilateral (a.c. 17-01-026) cada extremidad.",
    "officialName": "FLEBOGRAFÍA EXTREMIDAD INFERIOR O SUPERIOR, UNILATERAL (A.C. 17-01-026) CADA EXTREMIDAD.",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 27510,
    "priceBs": "339.42"
  },
  {
    "code": "04-02-041",
    "name": "Flebografía selectiva de venas hepáticas, renales, gonadales, pélvicas. (a.c. 17-01-027)",
    "officialName": "FLEBOGRAFÍA SELECTIVA DE VENAS HEPÁTICAS, RENALES, GONADALES, PÉLVICAS. (A.C. 17-01-027)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 31100,
    "priceBs": "383.71"
  },
  {
    "code": "04-02-050",
    "name": "Mielografía por punción lumbar con contraste hidrosoluble (a.c. 11-01-025)",
    "officialName": "MIELOGRAFÍA POR PUNCIÓN LUMBAR CON CONTRASTE HIDROSOLUBLE (A.C. 11-01-025)",
    "section": "EXAMENES RADIOLOGICOS",
    "valueClp": 37760,
    "priceBs": "465.89"
  },
  {
    "code": "04-03-001",
    "name": "Tomografía computarizada de cráneo encefálica",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE CRÁNEO ENCEFÁLICA",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 69710,
    "priceBs": "860.09"
  },
  {
    "code": "04-03-002",
    "name": "Tomografía computarizada de hipotálamo-hipófisis",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE HIPOTÁLAMO-HIPÓFISIS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 73360,
    "priceBs": "905.12"
  },
  {
    "code": "04-03-003",
    "name": "Tomografía computarizada de fosa posterior",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE FOSA POSTERIOR",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 63010,
    "priceBs": "777.42"
  },
  {
    "code": "04-03-006",
    "name": "Tomografía computarizada de temporal-oído",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE TEMPORAL-OÍDO",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 60500,
    "priceBs": "746.45"
  },
  {
    "code": "04-03-007",
    "name": "Tomografía computarizada de órbitas maxilofacial",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE ÓRBITAS MAXILOFACIAL",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 80900,
    "priceBs": "998.15"
  },
  {
    "code": "04-03-008",
    "name": "Tomografía computarizada de columna cervical",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE COLUMNA CERVICAL",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 88620,
    "priceBs": "1093.40"
  },
  {
    "code": "04-03-018",
    "name": "Tomografía computarizada de columna dorsal. incluye mínimo 6 espacios",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE COLUMNA DORSAL. INCLUYE MÍNIMO 6 ESPACIOS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 77650,
    "priceBs": "958.05"
  },
  {
    "code": "04-03-019",
    "name": "Tomografía computarizada de columna lumbar",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE COLUMNA LUMBAR",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 77650,
    "priceBs": "958.05"
  },
  {
    "code": "04-03-012",
    "name": "Tomografía computarizada de cuello, partes blandas",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE CUELLO, PARTES BLANDAS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 65490,
    "priceBs": "808.02"
  },
  {
    "code": "04-03-013",
    "name": "Tomografía computarizada de tórax. incluye además: esternón, clavículas, articulación acromioclavicular, escápula, costillas, articulación esternoclavicular. incluye todo el tórax o cada segmento o articulación. incluye bilateralidad",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE TÓRAX. INCLUYE ADEMÁS: ESTERNÓN, CLAVÍCULAS, ARTICULACIÓN ACROMIOCLAVICULAR, ESCÁPULA, COSTILLAS, ARTICULACIÓN ESTERNOCLAVICULAR. INCLUYE TODO EL TÓRAX O CADA SEGMENTO O ARTICULACIÓN. INCLUYE BILATERALIDAD",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 103440,
    "priceBs": "1276.25"
  },
  {
    "code": "04-03-014",
    "name": "Tomografía computarizada de abdomen (hígado, vías y vesícula biliar, páncreas, bazo, suprarrenales y riñones)",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE ABDOMEN (HÍGADO, VÍAS Y VESÍCULA BILIAR, PÁNCREAS, BAZO, SUPRARRENALES Y RIÑONES)",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 62280,
    "priceBs": "768.41"
  },
  {
    "code": "04-03-016",
    "name": "Tomografía computarizada de pelvis (además incluye sacro, coxis, caderas, huesos pélvicos, articulaciones sacro ilíacas). bilateral",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE PELVIS (ADEMÁS INCLUYE SACRO, COXIS, CADERAS, HUESOS PÉLVICOS, ARTICULACIONES SACRO ILÍACAS). BILATERAL",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 63870,
    "priceBs": "788.03"
  },
  {
    "code": "04-03-020",
    "name": "Tomografía computarizada de abdomen y pelvis",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE ABDOMEN Y PELVIS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 101650,
    "priceBs": "1254.16"
  },
  {
    "code": "04-03-021",
    "name": "Tomografía computarizada pielografía",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA PIELOGRAFÍA",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 26770,
    "priceBs": "330.29"
  },
  {
    "code": "04-03-022",
    "name": "Tomografía computarizada urografía",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA UROGRAFÍA",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 59800,
    "priceBs": "737.82"
  },
  {
    "code": "04-03-023",
    "name": "Tomografía computarizada de colonoscopía virtual. no incluye instalación de sonda",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE COLONOSCOPÍA VIRTUAL. NO INCLUYE INSTALACIÓN DE SONDA",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 51050,
    "priceBs": "629.86"
  },
  {
    "code": "04-03-024",
    "name": "Tomografía computarizada planificación radioterapia",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA PLANIFICACIÓN RADIOTERAPIA",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 69270,
    "priceBs": "854.66"
  },
  {
    "code": "04-03-025",
    "name": "Tomografía computarizada de calcio coronario",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE CALCIO CORONARIO",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 34140,
    "priceBs": "421.22"
  },
  {
    "code": "04-03-104",
    "name": "Tomografía computarizada angio de cuello",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE CUELLO",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 69430,
    "priceBs": "856.63"
  },
  {
    "code": "04-03-105",
    "name": "Tomografía computarizada angio de pelvis",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE PELVIS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 50630,
    "priceBs": "624.68"
  },
  {
    "code": "04-03-106",
    "name": "Tomografía computarizada de angio cardíaco. mínimo 64 cortes",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA DE ANGIO CARDÍACO. MÍNIMO 64 CORTES",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 66370,
    "priceBs": "818.88"
  },
  {
    "code": "04-03-017",
    "name": "Tomografía computarizada musculoesquelética por zona anatómica. por cada segmento o articulación: muslo, pierna, rodillas, antebrazo, codo, muñeca, mano, hombro, pie, tobillo u otros. bilateral sólo para rodillas",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA MUSCULOESQUELÉTICA POR ZONA ANATÓMICA. POR CADA SEGMENTO O ARTICULACIÓN: MUSLO, PIERNA, RODILLAS, ANTEBRAZO, CODO, MUÑECA, MANO, HOMBRO, PIE, TOBILLO U OTROS. BILATERAL SÓLO PARA RODILLAS",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 55760,
    "priceBs": "687.97"
  },
  {
    "code": "04-03-101",
    "name": "Tomografía computarizada angio de encéfalo",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE ENCÉFALO",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 84490,
    "priceBs": "1042.44"
  },
  {
    "code": "04-03-102",
    "name": "Tomografía computarizada angio de tórax",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE TÓRAX",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 127200,
    "priceBs": "1569.40"
  },
  {
    "code": "04-03-103",
    "name": "Tomografía computarizada angio de abdomen",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE ABDOMEN",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 117770,
    "priceBs": "1453.05"
  },
  {
    "code": "04-03-107",
    "name": "Tomografía computarizada angio de extremidades inferiores (bilateral)",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE EXTREMIDADES INFERIORES (BILATERAL)",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 96100,
    "priceBs": "1185.69"
  },
  {
    "code": "04-03-108",
    "name": "Tomografía computarizada angio de extremidad superior (unilateral)",
    "officialName": "TOMOGRAFÍA COMPUTARIZADA ANGIO DE EXTREMIDAD SUPERIOR (UNILATERAL)",
    "section": "TOMOGRAFIA COMPUTARIZADA",
    "valueClp": 98450,
    "priceBs": "1214.68"
  },
  {
    "code": "04-04-002",
    "name": "Ecografía obstétrica",
    "officialName": "ECOGRAFÍA OBSTÉTRICA",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 8730,
    "priceBs": "107.71"
  },
  {
    "code": "04-04-003",
    "name": "Ecografía abdominal (incluye hígado, vía biliar, vesícula, páncreas, riñones, bazo, retroperitoneo y grandes vasos)",
    "officialName": "ECOGRAFÍA ABDOMINAL (INCLUYE HÍGADO, VÍA BILIAR, VESÍCULA, PÁNCREAS, RIÑONES, BAZO, RETROPERITONEO Y GRANDES VASOS)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 27570,
    "priceBs": "340.16"
  },
  {
    "code": "04-04-004",
    "name": "Ecografía como apoyo a cirugía, o a procedimiento (de tórax, muscular, partes blandas, etc.)",
    "officialName": "ECOGRAFÍA COMO APOYO A CIRUGÍA, O A PROCEDIMIENTO (DE TÓRAX, MUSCULAR, PARTES BLANDAS, ETC.)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 17040,
    "priceBs": "210.24"
  },
  {
    "code": "04-04-005",
    "name": "Ecografía transvaginal o transrectal",
    "officialName": "ECOGRAFÍA TRANSVAGINAL O TRANSRECTAL",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 15400,
    "priceBs": "190.01"
  },
  {
    "code": "04-04-006",
    "name": "Ecografía ginecológica, pelviana femenina u obstétrica con estudio fetal",
    "officialName": "ECOGRAFÍA GINECOLÓGICA, PELVIANA FEMENINA U OBSTÉTRICA CON ESTUDIO FETAL",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 14670,
    "priceBs": "181.00"
  },
  {
    "code": "04-04-007",
    "name": "Ecografía transvaginal para seguimiento de ovulación, procedimiento completo (6-8 sesiones )",
    "officialName": "ECOGRAFÍA TRANSVAGINAL PARA SEGUIMIENTO DE OVULACIÓN, PROCEDIMIENTO COMPLETO (6-8 SESIONES )",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 21410,
    "priceBs": "264.16"
  },
  {
    "code": "04-04-008",
    "name": "Ecografía para seguimiento de ovulación, procedimiento completo (6 a 8 sesiones)",
    "officialName": "ECOGRAFÍA PARA SEGUIMIENTO DE OVULACIÓN, PROCEDIMIENTO COMPLETO (6 A 8 SESIONES)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 23980,
    "priceBs": "295.87"
  },
  {
    "code": "04-04-009",
    "name": "Ecografía pélvica masculina (incluye vejiga y próstata)",
    "officialName": "ECOGRAFÍA PÉLVICA MASCULINA (INCLUYE VEJIGA Y PRÓSTATA)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 15330,
    "priceBs": "189.14"
  },
  {
    "code": "04-04-010",
    "name": "Ecografía renal (bilateral), o de bazo",
    "officialName": "ECOGRAFÍA RENAL (BILATERAL), O DE BAZO",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 19110,
    "priceBs": "235.78"
  },
  {
    "code": "04-04-011",
    "name": "Ecografía encefálica (RN o lactante)",
    "officialName": "ECOGRAFÍA ENCEFÁLICA (RN O LACTANTE)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 20630,
    "priceBs": "254.53"
  },
  {
    "code": "04-04-012",
    "name": "Ecografía mamaria bilateral (incluye doppler)",
    "officialName": "ECOGRAFÍA MAMARIA BILATERAL (INCLUYE DOPPLER)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 19210,
    "priceBs": "237.01"
  },
  {
    "code": "04-04-013",
    "name": "Ecografía ocular, unilateral o bilateral.",
    "officialName": "ECOGRAFÍA OCULAR, UNILATERAL O BILATERAL.",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 22290,
    "priceBs": "275.02"
  },
  {
    "code": "04-04-014",
    "name": "Ecografía testicular (unilateral o bilateral) (incluye doppler)",
    "officialName": "ECOGRAFÍA TESTICULAR (UNILATERAL O BILATERAL) (INCLUYE DOPPLER)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 18960,
    "priceBs": "233.93"
  },
  {
    "code": "04-04-015",
    "name": "Ecografía tiroidea (incluye doppler)",
    "officialName": "ECOGRAFÍA TIROIDEA (INCLUYE DOPPLER)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 19210,
    "priceBs": "237.01"
  },
  {
    "code": "04-04-016",
    "name": "Ecografía partes blandas o musculoesquelética (cada zona anatómica)",
    "officialName": "ECOGRAFÍA PARTES BLANDAS O MUSCULOESQUELÉTICA (CADA ZONA ANATÓMICA)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 19210,
    "priceBs": "237.01"
  },
  {
    "code": "04-04-118",
    "name": "Ecografía vascular (arterial y venosa) periférica (bilateral)",
    "officialName": "ECOGRAFÍA VASCULAR (ARTERIAL Y VENOSA) PERIFÉRICA (BILATERAL)",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 63040,
    "priceBs": "777.79"
  },
  {
    "code": "04-04-119",
    "name": "Ecografía doppler de vasos del cuello",
    "officialName": "ECOGRAFÍA DOPPLER DE VASOS DEL CUELLO",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 59530,
    "priceBs": "734.48"
  },
  {
    "code": "04-04-120",
    "name": "Ecografía transcraneana",
    "officialName": "ECOGRAFÍA TRANSCRANEANA",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 63040,
    "priceBs": "777.79"
  },
  {
    "code": "04-04-121",
    "name": "Ecografía abdominal o de vasos testiculares",
    "officialName": "ECOGRAFÍA ABDOMINAL O DE VASOS TESTICULARES",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 64960,
    "priceBs": "801.48"
  },
  {
    "code": "04-04-122",
    "name": "Ecografía doppler de vasos placentarios",
    "officialName": "ECOGRAFÍA DOPPLER DE VASOS PLACENTARIOS",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 63040,
    "priceBs": "777.79"
  },
  {
    "code": "04-04-218",
    "name": "Elastografía hepática",
    "officialName": "ELASTOGRAFÍA HEPÁTICA",
    "section": "ULTRASONOGRAFIA",
    "valueClp": 199030,
    "priceBs": "2455.64"
  },
  {
    "code": "04-05-001",
    "name": "Resonancia magnética cráneo encefálica u oídos, bilateral",
    "officialName": "RESONANCIA MAGNÉTICA CRÁNEO ENCEFÁLICA U OÍDOS, BILATERAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-002",
    "name": "Resonancia magnética de hipotálamo - hipófisis",
    "officialName": "RESONANCIA MAGNÉTICA DE HIPOTÁLAMO - HIPÓFISIS",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 224230,
    "priceBs": "2766.56"
  },
  {
    "code": "04-05-003",
    "name": "Resonancia magnética de órbitas",
    "officialName": "RESONANCIA MAGNÉTICA DE ÓRBITAS",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 201000,
    "priceBs": "2479.95"
  },
  {
    "code": "04-05-004",
    "name": "Resonancia magnética de articulaciones temporomandibulares",
    "officialName": "RESONANCIA MAGNÉTICA DE ARTICULACIONES TEMPOROMANDIBULARES",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 216130,
    "priceBs": "2666.63"
  },
  {
    "code": "04-05-005",
    "name": "Resonancia magnética de columna cervical",
    "officialName": "RESONANCIA MAGNÉTICA DE COLUMNA CERVICAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-006",
    "name": "Resonancia magnética de columna dorsal",
    "officialName": "RESONANCIA MAGNÉTICA DE COLUMNA DORSAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 223960,
    "priceBs": "2763.23"
  },
  {
    "code": "04-05-007",
    "name": "Resonancia magnética de columna lumbar",
    "officialName": "RESONANCIA MAGNÉTICA DE COLUMNA LUMBAR",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-017",
    "name": "Resonancia magnética angiografía de encéfalo",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE ENCÉFALO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 230760,
    "priceBs": "2847.13"
  },
  {
    "code": "04-05-018",
    "name": "Resonancia magnética angiografía de cuello",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE CUELLO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 237300,
    "priceBs": "2927.82"
  },
  {
    "code": "04-05-019",
    "name": "Resonancia magnética angiografía de tórax",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE TÓRAX",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 233510,
    "priceBs": "2881.06"
  },
  {
    "code": "04-05-020",
    "name": "Resonancia magnética angiografía de abdomen",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE ABDOMEN",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 218070,
    "priceBs": "2690.56"
  },
  {
    "code": "04-05-021",
    "name": "Resonancia magnética angiografía de pelvis",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE PELVIS",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 224230,
    "priceBs": "2766.56"
  },
  {
    "code": "04-05-022",
    "name": "Resonancia magnética angiografía de extremidad superior unilateral",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE EXTREMIDAD SUPERIOR UNILATERAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 221610,
    "priceBs": "2734.24"
  },
  {
    "code": "04-05-023",
    "name": "Resonancia magnética angiografía de extremidad inferior bilateral",
    "officialName": "RESONANCIA MAGNÉTICA ANGIOGRAFÍA DE EXTREMIDAD INFERIOR BILATERAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-009",
    "name": "Resonancia magnética de tórax ( corazón, esternón, clavículas, articulación acromioclavicular, escápula, costillas o articulación esternoclavicular). toda la pared torácica o cada segmento o articulación. bilateral",
    "officialName": "RESONANCIA MAGNÉTICA DE TÓRAX ( CORAZÓN, ESTERNÓN, CLAVÍCULAS, ARTICULACIÓN ACROMIOCLAVICULAR, ESCÁPULA, COSTILLAS O ARTICULACIÓN ESTERNOCLAVICULAR). TODA LA PARED TORÁCICA O CADA SEGMENTO O ARTICULACIÓN. BILATERAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 230760,
    "priceBs": "2847.13"
  },
  {
    "code": "04-05-010",
    "name": "Resonancia magnética de abdomen",
    "officialName": "RESONANCIA MAGNÉTICA DE ABDOMEN",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-011",
    "name": "Resonancia magnética de pelvis. incluye: osteoarticular de sacroiliacas u osteoarticular de sacrocoxis u osteoarticular de huesos pélvicos u órganos pelvianos (incluye genitales internos y gastrointestinal)",
    "officialName": "RESONANCIA MAGNÉTICA DE PELVIS. INCLUYE: OSTEOARTICULAR DE SACROILIACAS U OSTEOARTICULAR DE SACROCOXIS U OSTEOARTICULAR DE HUESOS PÉLVICOS U ÓRGANOS PELVIANOS (INCLUYE GENITALES INTERNOS Y GASTROINTESTINAL)",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 215350,
    "priceBs": "2657.00"
  },
  {
    "code": "04-05-012",
    "name": "Resonancia magnética de abdomen y pelvis",
    "officialName": "RESONANCIA MAGNÉTICA DE ABDOMEN Y PELVIS",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 322990,
    "priceBs": "3985.07"
  },
  {
    "code": "04-05-098",
    "name": "Colangioresonancia",
    "officialName": "COLANGIORESONANCIA",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 144250,
    "priceBs": "1779.77"
  },
  {
    "code": "04-05-013",
    "name": "Resonancia magnética de rodilla",
    "officialName": "RESONANCIA MAGNÉTICA DE RODILLA",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 176560,
    "priceBs": "2178.41"
  },
  {
    "code": "04-05-024",
    "name": "Resonancia magnética de mano o muñeca",
    "officialName": "RESONANCIA MAGNÉTICA DE MANO O MUÑECA",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 189210,
    "priceBs": "2334.48"
  },
  {
    "code": "04-05-025",
    "name": "Resonancia magnética de antebrazo o brazo",
    "officialName": "RESONANCIA MAGNÉTICA DE ANTEBRAZO O BRAZO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 180930,
    "priceBs": "2232.33"
  },
  {
    "code": "04-05-026",
    "name": "Resonancia magnética de codo",
    "officialName": "RESONANCIA MAGNÉTICA DE CODO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 183850,
    "priceBs": "2268.35"
  },
  {
    "code": "04-05-027",
    "name": "Resonancia magnética de hombro",
    "officialName": "RESONANCIA MAGNÉTICA DE HOMBRO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 176560,
    "priceBs": "2178.41"
  },
  {
    "code": "04-05-028",
    "name": "Resonancia magnética de pie, antepie o tobillo",
    "officialName": "RESONANCIA MAGNÉTICA DE PIE, ANTEPIE O TOBILLO",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 176560,
    "priceBs": "2178.41"
  },
  {
    "code": "04-05-029",
    "name": "Resonancia magnética de pierna",
    "officialName": "RESONANCIA MAGNÉTICA DE PIERNA",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 181710,
    "priceBs": "2241.95"
  },
  {
    "code": "04-05-030",
    "name": "Resonancia magnética de muslo o cadera. unilateral",
    "officialName": "RESONANCIA MAGNÉTICA DE MUSLO O CADERA. UNILATERAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 183850,
    "priceBs": "2268.35"
  },
  {
    "code": "04-05-031",
    "name": "Resonancia magnética de mama (bilateral)",
    "officialName": "RESONANCIA MAGNÉTICA DE MAMA (BILATERAL)",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 176560,
    "priceBs": "2178.41"
  },
  {
    "code": "04-05-032",
    "name": "Resonancia magnética fetal",
    "officialName": "RESONANCIA MAGNÉTICA FETAL",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 211900,
    "priceBs": "2614.44"
  },
  {
    "code": "04-05-016",
    "name": "Resonancia columna total (cervical, dorsal, lumbar)",
    "officialName": "RESONANCIA COLUMNA TOTAL (CERVICAL, DORSAL, LUMBAR)",
    "section": "RESONANCIA MAGNÉTICA",
    "valueClp": 381050,
    "priceBs": "4701.42"
  }
];
