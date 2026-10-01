import {
  FONASA_IMAGEN,
  FONASA_LABORATORIO,
  type PrestacionFonasa,
} from './fonasa-aranceles.generated';
import { ANALISIS_INLASA } from './inlasa-aranceles.generated';
import { TARIFA_INLASA } from './inlasa';

/* ============================================================================
    Precio de referencia de cada prueba y estudio de la maqueta.

    El corpus de laboratorios es real pero no recogió tarifas: sin esto, sus
    1 035 pruebas viajaban sin precio. El orden de las fuentes es fijo:

    1. **INLASA 2026** (Bolivia), el arancel del laboratorio estatal de
       referencia, en bolivianos.
    2. **FONASA 2026** (Chile, Modalidad Libre Elección), convertido a
       bolivianos con los tipos de cambio oficiales del 01/10/2026
       (`fonasa-aranceles.generated.ts`), sólo donde INLASA no tiene la prueba.
       Para imagenología es la única fuente: Bolivia no publica un arancel.

    La tabla es **explícita y revisada a mano**, como `EQUIVALENCIA_INLASA`:
    entra una prueba sólo cuando el código de la fuente es LA MISMA prueba. Se
    descartaron a propósito los parecidos que no lo son —calcio iónico ≠ calcio
    total, troponina T ≠ «troponina», NIPT ≠ FISH, bilirrubina directa ≠ total,
    factor V Leiden (mutación) ≠ actividad del factor V—. Una prueba sin
    equivalente queda sin precio: no se adivina uno.
    ========================================================================== */

type Fuente = 'INLASA' | 'FONASA';

/** Prueba del corpus (`test_*`) → análisis de INLASA o prestación de FONASA. */
export const EQUIVALENCIA_DE_PRUEBA: Readonly<Record<string, readonly [Fuente, string]>> = {
  test_000001: ['INLASA', 'LAC-030'], // Hemograma completo (biometría hemática)
  test_000002: ['FONASA', '03-01-038'], // Hemoglobina
  test_000003: ['FONASA', '03-01-036'], // Hematocrito
  test_000004: ['FONASA', '03-01-064'], // Recuento de eritrocitos
  test_000005: ['FONASA', '03-01-065'], // Recuento de leucocitos
  test_000006: ['FONASA', '03-01-069'], // Fórmula leucocitaria automatizada
  test_000009: ['FONASA', '03-01-066'], // Recuento absoluto de linfocitos
  test_000010: ['FONASA', '03-01-063'], // Recuento absoluto de eosinófilos
  test_000011: ['FONASA', '03-01-062'], // Recuento absoluto de basófilos
  test_000012: ['INLASA', 'LAC-047'], // Recuento de plaquetas
  test_000014: ['INLASA', 'LAC-048'], // Recuento de reticulocitos
  test_000017: ['INLASA', 'LAC-057'], // Velocidad de eritrosedimentación (VSG/VES)
  test_000022: ['FONASA', '03-01-040'], // Hemoglobina fetal (HbF)
  test_000023: ['FONASA', '03-01-044'], // Electroforesis de hemoglobina
  test_000027: ['FONASA', '03-01-017'], // Glucosa-6-fosfato deshidrogenasa (G6PD)
  test_000028: ['FONASA', '03-09-035'], // Hemosiderina urinaria
  test_000029: ['FONASA', '03-01-035'], // Haptoglobina
  test_000030: ['FONASA', '03-03-009'], // Eritropoyetina
  test_000038: ['INLASA', 'LAC-051'], // Tiempo de protrombina (TP)
  test_000040: ['INLASA', 'LAC-052'], // Tiempo de tromboplastina parcial activada (TTPa/APTT)
  test_000041: ['FONASA', '03-01-083'], // Tiempo de trombina (TT)
  test_000043: ['INLASA', 'LAC-015'], // Fibrinógeno
  test_000044: ['INLASA', 'LAC-017'], // Dímero D
  test_000046: ['FONASA', '03-01-011'], // Tiempo de coagulación
  test_000050: ['FONASA', '03-01-024'], // Actividad de factor V
  test_000058: ['FONASA', '03-01-097'], // Inhibidor de factor VIII
  test_000061: ['FONASA', '03-01-007'], // Anticoagulante lúpico - tamizaje
  test_000064: ['FONASA', '03-01-091'], // Proteína C funcional
  test_000067: ['FONASA', '03-01-008'], // Antitrombina III
  test_000068: ['FONASA', '03-01-093'], // Resistencia a proteína C activada
  test_000075: ['FONASA', '03-01-089'], // Factor von Willebrand antígeno
  test_000078: ['INLASA', 'LAC-025'], // Glucosa basal
  test_000085: ['INLASA', 'LAC-045'], // Prueba oral de tolerancia a la glucosa
  test_000086: ['INLASA', 'LAC-028'], // Hemoglobina glicosilada (HbA1c)
  test_000088: ['INLASA', 'LAC-038'], // Urea
  test_000089: ['INLASA', 'LAC-038'], // Nitrógeno ureico (BUN/NUS)
  test_000090: ['INLASA', 'LAC-014'], // Creatinina sérica
  test_000092: ['INLASA', 'LAC-001'], // Ácido úrico
  test_000093: ['FONASA', '03-02-032'], // Sodio
  test_000094: ['FONASA', '03-02-032'], // Potasio
  test_000095: ['FONASA', '03-02-032'], // Cloro
  test_000096: ['FONASA', '03-02-011'], // Bicarbonato/CO2 total
  test_000097: ['FONASA', '03-02-058'], // Osmolalidad sérica
  test_000098: ['INLASA', 'LAC-007'], // Calcio total
  test_000100: ['INLASA', 'LAC-022'], // Fósforo
  test_000101: ['FONASA', '03-02-056'], // Magnesio
  test_000102: ['INLASA', 'LAC-031'], // Hierro sérico
  test_000103: ['FONASA', '03-01-029'], // Capacidad total de fijación del hierro (TIBC)
  test_000106: ['INLASA', 'LAC-054'], // Transferrina
  test_000107: ['INLASA', 'LAC-020'], // Ferritina
  test_000108: ['INLASA', 'LAC-040'], // Proteínas totales
  test_000109: ['INLASA', 'LAC-003'], // Albúmina
  test_000113: ['FONASA', '03-05-025'], // Inmunofijación sérica
  test_000117: ['FONASA', '03-02-012'], // Bilirrubina total
  test_000122: ['INLASA', 'LAC-021'], // Fosfatasa alcalina
  test_000123: ['FONASA', '03-02-045'], // GGT
  test_000125: ['FONASA', '03-02-030'], // LDH total
  test_000126: ['FONASA', '03-02-031'], // LDH isoenzimas
  test_000127: ['INLASA', 'LAC-004'], // Amilasa
  test_000128: ['INLASA', 'LAC-073'], // Lipasa
  test_000129: ['FONASA', '03-02-021'], // Colinesterasa sérica
  test_000130: ['FONASA', '03-02-010'], // Amonio
  test_000131: ['FONASA', '03-02-004'], // Lactato
  test_000133: ['INLASA', 'LAC-011'], // CK total
  test_000135: ['INLASA', 'LAC-012'], // CK-MB actividad
  test_000136: ['INLASA', 'LAC-056'], // Troponina I
  test_000141: ['FONASA', '03-03-055'], // BNP
  test_000143: ['INLASA', 'LAC-010'], // Colesterol total
  test_000144: ['INLASA', 'LAC-009'], // HDL colesterol
  test_000148: ['INLASA', 'LAC-055'], // Triglicéridos
  test_000153: ['FONASA', '03-02-086'], // Homocisteína
  test_000155: ['FONASA', '03-02-019'], // Ceruloplasmina
  test_000156: ['FONASA', '03-05-001'], // Alfa-1-antitripsina
  test_000160: ['FONASA', '03-08-030'], // Fosfatasa ácida prostática
  test_000163: ['FONASA', '03-05-010'], // Beta-2 microglobulina
  test_000171: ['FONASA', '03-02-083'], // Carboxihemoglobina
  test_000172: ['FONASA', '03-01-054'], // Metahemoglobina
  test_000173: ['FONASA', '03-02-004'], // Lactato en gasometría
  test_000176: ['INLASA', 'LAC-071'], // TSH ultrasensible
  test_000177: ['INLASA', 'LAC-069'], // T4 libre
  test_000178: ['INLASA', 'LAC-070'], // T4 total
  test_000179: ['INLASA', 'LAC-067'], // T3 libre
  test_000180: ['INLASA', 'LAC-068'], // T3 total
  test_000181: ['FONASA', '03-03-025'], // Tiroglobulina
  test_000184: ['FONASA', '03-05-124'], // Anticuerpo anti-receptor de TSH (TRAb)
  test_000185: ['FONASA', '03-03-053'], // Calcitonina
  test_000186: ['INLASA', 'LAC-066'], // Parathormona intacta (PTH)
  test_000187: ['INLASA', 'LAC-072'], // 25-OH vitamina D
  test_000189: ['FONASA', '03-03-006'], // Cortisol sérico AM
  test_000190: ['FONASA', '03-03-006'], // Cortisol sérico PM
  test_000191: ['FONASA', '03-03-035'], // Cortisol libre urinario 24 h
  test_000192: ['FONASA', '03-03-056'], // Cortisol salival nocturno
  test_000193: ['FONASA', '03-03-001'], // ACTH
  test_000195: ['FONASA', '03-03-008'], // DHEA-S
  test_000196: ['FONASA', '03-03-002'], // Aldosterona
  test_000197: ['FONASA', '03-03-021'], // Renina directa
  test_000204: ['FONASA', '03-03-051'], // Catecolaminas urinarias
  test_000207: ['FONASA', '03-03-007'], // Hormona de crecimiento (GH)
  test_000210: ['INLASA', 'LAC-074'], // Prolactina
  test_000212: ['INLASA', 'LAC-063'], // FSH
  test_000213: ['INLASA', 'LAC-064'], // LH
  test_000214: ['INLASA', 'LAC-062'], // Estradiol
  test_000216: ['INLASA', 'LAC-065'], // Progesterona
  test_000217: ['FONASA', '03-03-029'], // 17-hidroxiprogesterona
  test_000218: ['INLASA', 'LAC-075'], // Testosterona total
  test_000219: ['FONASA', '03-03-023'], // Testosterona libre
  test_000221: ['FONASA', '03-03-046'], // SHBG
  test_000223: ['FONASA', '03-03-003'], // Androstenediona
  test_000224: ['INLASA', 'LAC-076'], // Hormona antimülleriana (AMH)
  test_000225: ['FONASA', '03-03-054'], // Inhibina B
  test_000226: ['INLASA', 'LAC-033'], // Insulina basal
  test_000231: ['FONASA', '03-03-052'], // Péptido C
  test_000233: ['FONASA', '03-03-012'], // Gastrina
  test_000239: ['FONASA', '03-05-031'], // Proteína C reactiva cuantitativa
  test_000241: ['INLASA', 'LINM-008'], // Antiestreptolisina O (ASO/ASTO)
  test_000256: ['INLASA', 'LINM-037'], // Anti-CCP
  test_000262: ['FONASA', '03-05-105'], // Beta-2 glicoproteína I IgG
  test_000263: ['FONASA', '03-05-105'], // Beta-2 glicoproteína I IgM
  test_000269: ['FONASA', '03-05-085'], // Anti-LKM-1
  test_000283: ['INLASA', 'LINM-009'], // Complemento C3
  test_000284: ['INLASA', 'LINM-010'], // Complemento C4
  test_000287: ['INLASA', 'LINM-023'], // Inmunoglobulina G
  test_000288: ['INLASA', 'LINM-024'], // Inmunoglobulina A
  test_000289: ['INLASA', 'LINM-022'], // Inmunoglobulina M
  test_000295: ['FONASA', '03-05-014'], // Crioglobulinas
  test_000297: ['FONASA', '03-05-035'], // Crioaglutininas
  test_000430: ['INLASA', 'LINM-030'], // VIH 1/2 prueba rápida
  test_000433: ['INLASA', 'LINM-007'], // Hepatitis A anticuerpos totales
  test_000434: ['FONASA', '03-06-074'], // Hepatitis A IgM
  test_000435: ['INLASA', 'LINM-016'], // HBsAg
  test_000436: ['INLASA', 'LINM-014'], // Anti-HBs
  test_000437: ['FONASA', '03-06-076'], // Anti-HBc total
  test_000438: ['INLASA', 'LINM-012'], // Anti-HBc IgM
  test_000439: ['INLASA', 'LINM-015'], // HBeAg
  test_000440: ['INLASA', 'LINM-013'], // Anti-HBe
  test_000441: ['FONASA', '03-06-081'], // Hepatitis C anticuerpos
  test_000446: ['INLASA', 'LINM-031'], // RPR
  test_000447: ['FONASA', '03-06-041'], // FTA-ABS
  test_000452: ['INLASA', 'LINM-038'], // Rubéola IgM
  test_000454: ['INLASA', 'LINM-026'], // CMV IgM
  test_000465: ['INLASA', 'LVIR-059'], // Parvovirus B19 IgM
  test_000466: ['INLASA', 'LVIR-058'], // Parvovirus B19 IgG
  test_000468: ['INLASA', 'LEP-026'], // Chagas HAI
  test_000471: ['FONASA', '03-06-033'], // Brucella aglutinación
  test_000474: ['FONASA', '03-06-037'], // Mycoplasma pneumoniae IgG
  test_000475: ['FONASA', '03-06-037'], // Mycoplasma pneumoniae IgM
  test_000478: ['INLASA', 'LVIR-027'], // Dengue NS1 antígeno
  test_000479: ['INLASA', 'LVIR-030'], // Dengue IgM
  test_000480: ['INLASA', 'LVIR-037'], // Dengue IgG
  test_000481: ['INLASA', 'LVIR-029'], // Zika IgM
  test_000482: ['INLASA', 'LVIR-028'], // Chikungunya IgM
  test_000491: ['INLASA', 'LVIR-031'], // Rotavirus antígeno
  test_000502: ['INLASA', 'LINM-003'], // HTLV-1/2 anticuerpos
  test_000503: ['INLASA', 'LVIR-026'], // Hantavirus IgM
  test_000504: ['INLASA', 'LVIR-025'], // Hantavirus IgG
  test_000505: ['INLASA', 'LBC-045'], // Urocultivo
  test_000508: ['INLASA', 'LBC-036'], // Hemocultivo seriado
  test_000509: ['INLASA', 'LBC-008'], // Coprocultivo
  test_000510: ['INLASA', 'LBC-011'], // Cultivo de esputo
  test_000511: ['INLASA', 'LBC-020'], // Cultivo de exudado faríngeo
  test_000512: ['INLASA', 'LBC-013'], // Cultivo de secreción vaginal
  test_000513: ['INLASA', 'LBC-014'], // Cultivo de secreción uretral
  test_000516: ['INLASA', 'LBC-015'], // Cultivo de líquido cefalorraquídeo
  test_000524: ['INLASA', 'LBC-012'], // Cultivo de secreción ocular
  test_000525: ['INLASA', 'LBC-022'], // Cultivo de secreción ótica
  test_000531: ['INLASA', 'LBC-044'], // Tinción de Gram
  test_000534: ['INLASA', 'LTB-001'], // Baciloscopía seriada para BAAR
  test_000535: ['FONASA', '03-06-002'], // Tinción de Ziehl-Neelsen
  test_000540: ['INLASA', 'LBC-018'], // Cultivo micológico
  test_000544: ['FONASA', '03-06-117'], // Cultivo para dermatofitos
  test_000546: ['FONASA', '03-06-028'], // Antifungigrama
  test_000552: ['INLASA', 'LEP-015'], // Coproparasitológico simple
  test_000553: ['INLASA', 'LEP-014'], // Coproparasitológico seriado 3 muestras
  test_000572: ['FONASA', '03-06-086'], // Carga viral VIH-1
  test_000573: ['FONASA', '03-06-084'], // Carga viral hepatitis B (HBV DNA)
  test_000577: ['FONASA', '03-06-088'], // BK virus carga viral
  test_000578: ['INLASA', 'LVIR-010'], // Adenovirus PCR cuantitativa
  test_000579: ['INLASA', 'LVIR-046'], // Parvovirus B19 PCR
  test_000580: ['INLASA', 'LVIR-001'], // SARS-CoV-2 RT-PCR
  test_000581: ['INLASA', 'LVIR-002'], // Influenza A RT-PCR
  test_000582: ['INLASA', 'LVIR-002'], // Influenza B RT-PCR
  test_000583: ['INLASA', 'LVIR-004'], // Virus sincitial respiratorio RT-PCR
  test_000588: ['INLASA', 'LVIR-051'], // Enterovirus PCR
  test_000589: ['INLASA', 'LVIR-053'], // Norovirus PCR
  test_000590: ['INLASA', 'LVIR-018'], // Rotavirus PCR
  test_000591: ['INLASA', 'LVIR-013'], // Dengue RT-PCR
  test_000592: ['INLASA', 'LVIR-014'], // Zika RT-PCR
  test_000593: ['INLASA', 'LVIR-012'], // Chikungunya RT-PCR
  test_000594: ['INLASA', 'LVIR-021'], // Mpox/viruela símica PCR
  test_000600: ['INLASA', 'LVIR-020'], // Panel gastrointestinal viral multiplex
  test_000604: ['INLASA', 'CGM-017'], // H. pylori y resistencia a claritromicina por PCR
  test_000610: ['INLASA', 'LVIR-045'], // Panel meningitis/encefalitis viral 1
  test_000611: ['INLASA', 'LVIR-045'], // Panel meningitis/encefalitis viral 2
  test_000674: ['FONASA', '03-05-118'], // HLA-B27 molecular
  test_000679: ['INLASA', 'CGM-018'], // AFP
  test_000680: ['INLASA', 'CGM-022'], // CEA
  test_000681: ['INLASA', 'LINM-018'], // PSA total
  test_000682: ['INLASA', 'LINM-017'], // PSA libre
  test_000684: ['INLASA', 'CGM-021'], // CA 125
  test_000685: ['INLASA', 'CGM-019'], // CA 15-3
  test_000686: ['INLASA', 'CGM-020'], // CA 19-9
  test_000693: ['FONASA', '03-05-098'], // Cromogranina A
  test_000711: ['FONASA', '03-02-084'], // Plomo en sangre
  test_000714: ['FONASA', '03-09-034'], // Arsénico en orina
  test_000717: ['FONASA', '03-02-020'], // Cobre en sangre
  test_000743: ['FONASA', '03-02-055'], // Litio
  test_000763: ['INLASA', 'LAC-019'], // Examen general de orina
  test_000767: ['FONASA', '03-09-016'], // Glucosa en orina
  test_000779: ['FONASA', '03-09-028'], // Proteína orina ocasional
  test_000780: ['FONASA', '03-09-028'], // Proteína orina 24 h
  test_000782: ['INLASA', 'LAC-013'], // Creatinina orina ocasional
  test_000783: ['INLASA', 'LAC-013'], // Creatinina orina 24 h
  test_000784: ['INLASA', 'LAC-016'], // Depuración de creatinina
  test_000785: ['INLASA', 'LAC-006'], // Calcio orina 24 h
  test_000786: ['FONASA', '03-09-008'], // Calcio orina ocasional
  test_000787: ['INLASA', 'LAC-002'], // Ácido úrico orina 24 h
  test_000794: ['FONASA', '03-09-020'], // Nitrógeno ureico orina 24 h
  test_000805: ['INLASA', 'LEP-013'], // Moco fecal
  test_000810: ['FONASA', '03-08-047'], // Esteatocrito ácido
  test_000811: ['FONASA', '03-08-007'], // Elastasa pancreática fecal
  test_000815: ['INLASA', 'LVIR-031'], // Rotavirus antígeno en heces
  test_000819: ['INLASA', 'LEP-014'], // Coproparasitológico seriado
  test_000820: ['INLASA', 'LEP-009'], // Amebas en fresco
  test_000821: ['INLASA', 'LEP-020'], // Test de Graham
  test_000857: ['FONASA', '03-08-031'], // Fructosa seminal
  test_000858: ['FONASA', '03-02-002'], // Ácido cítrico seminal
  test_000859: ['FONASA', '03-08-030'], // Fosfatasa ácida prostática seminal
  test_000861: ['INLASA', 'LAC-076'], // AMH
  test_000865: ['INLASA', 'LAC-065'], // Progesterona para ovulación
  test_000896: ['INLASA', 'LAC-042'], // Prueba de Coombs directa (DAT)
  test_000897: ['INLASA', 'LAC-043'], // Coombs indirecta (IAT)
  test_000899: ['FONASA', '03-01-051'], // Identificación de anticuerpos irregulares
  test_000914: ['FONASA', '03-05-119'], // Tipificación HLA-C
  test_000918: ['INLASA', 'GEN-002'], // Tipificación HLA alta resolución NGS
  test_000919: ['FONASA', '03-05-118'], // HLA-B27
  test_000923: ['FONASA', '03-05-111'], // Anticuerpos anti-HLA clase I
  test_000924: ['FONASA', '03-05-111'], // Anticuerpos anti-HLA clase II
  test_000958: ['FONASA', '03-02-036'], // Fenilalanina neonatal
  test_000959: ['FONASA', '03-02-043'], // Galactosa neonatal
  test_000985: ['INLASA', 'LAC-058'], // Vitamina B12
  test_000986: ['FONASA', '03-01-002'], // Ácido fólico sérico
  test_000997: ['FONASA', '03-02-020'], // Cobre
  test_001003: ['FONASA', '03-02-085'], // Prealbúmina
  test_001008: ['FONASA', '03-09-044'], // Perfil de ácidos orgánicos urinarios
  test_001011: ['FONASA', '03-02-084'], // Plomo en sangre ocupacional
  test_001015: ['FONASA', '03-02-021'], // Colinesterasa sérica ocupacional
  test_001017: ['FONASA', '03-02-083'], // Carboxihemoglobina ocupacional
  test_001018: ['FONASA', '03-01-054'], // Metahemoglobina ocupacional
  test_001028: ['INLASA', 'LAC-019'], // Examen general de orina ocupacional
  test_001030: ['INLASA', 'LAC-025'], // Glucosa ocupacional
  test_001031: ['INLASA', 'LAC-039'], // Perfil lipídico ocupacional
};

/** Estudio de imagen de la maqueta (`STUDY-*`) → prestación de FONASA (Grupo 04). */
export const EQUIVALENCIA_IMAGEN_FONASA: Readonly<Record<string, string>> = {
  'STUDY-RX-TORAX': '04-01-070', // Radiografía de tórax frontal y lateral
  'STUDY-RX-COLUMNA': '04-01-046', // Radiografía columna lumbar o lumbosacra
  'STUDY-ECO-ABD': '04-04-003', // Ecografía abdominal
  'STUDY-ECO-OBSTETRICA': '04-04-002', // Ecografía obstétrica
  'STUDY-RMN-RODILLA': '04-05-013', // Resonancia magnética de rodilla
  'STUDY-RMN-CEREBRO': '04-05-001', // Resonancia magnética cráneo encefálica
  'STUDY-TAC-CRANEO': '04-03-001', // Tomografía computarizada de cráneo encefálica
  'STUDY-TAC-ABDOMEN': '04-03-014', // Tomografía computarizada de abdomen
  'STUDY-MAMOGRAFIA': '04-01-010', // Mamografía bilateral
  // STUDY-DENSITOMETRIA: el Grupo 04 de FONASA no la trae. STUDY-ECG: no es imagen.
};

/** La tarifa con que se publica un precio de FONASA convertido: el rótulo lo distingue. */
export const TARIFA_FONASA = 'REFERENCIA_FONASA_2026_BOB';

/** Un precio de referencia listo para `prices[]`. */
export interface PrecioDeReferencia {
  readonly amount: string;
  readonly scheduleCode: string;
}

const INLASA_POR_CODIGO = new Map(ANALISIS_INLASA.map((a) => [a.code, a]));
const FONASA_POR_CODIGO = new Map<string, PrestacionFonasa>(
  [...FONASA_LABORATORIO, ...FONASA_IMAGEN].map((p) => [p.code, p]),
);

/** La prestación de FONASA de un estudio de imagen de la maqueta, si la tiene. */
export function prestacionDeImagen(studyCode: string): PrestacionFonasa | undefined {
  const codigo = EQUIVALENCIA_IMAGEN_FONASA[studyCode];
  return codigo === undefined ? undefined : FONASA_POR_CODIGO.get(codigo);
}

/** El precio de referencia de un estudio de imagen, o `null` si no tiene equivalente. */
export function precioDeImagen(studyCode: string): PrecioDeReferencia | null {
  const prestacion = prestacionDeImagen(studyCode);
  return prestacion === undefined
    ? null
    : { amount: prestacion.priceBs, scheduleCode: TARIFA_FONASA };
}

/** El precio de referencia de una prueba del corpus, o `null` si no tiene equivalente. */
export function precioDePrueba(testId: string): PrecioDeReferencia | null {
  const equivalencia = EQUIVALENCIA_DE_PRUEBA[testId];
  if (equivalencia === undefined) return null;
  const [fuente, codigo] = equivalencia;
  if (fuente === 'INLASA') {
    const precio = INLASA_POR_CODIGO.get(codigo)?.priceBs;
    if (precio == null)
      throw new Error(
        `EQUIVALENCIA_DE_PRUEBA: ${testId} → INLASA ${codigo}, que no existe o no tiene precio.`,
      );
    return { amount: precio, scheduleCode: TARIFA_INLASA };
  }
  const prestacion = FONASA_POR_CODIGO.get(codigo);
  if (prestacion === undefined)
    throw new Error(`EQUIVALENCIA_DE_PRUEBA: ${testId} → FONASA ${codigo}, que no existe.`);
  return { amount: prestacion.priceBs, scheduleCode: TARIFA_FONASA };
}
