/* ============================================================================
    Las fichas clínicas estándar, portadas del backend.

    **GENERADO por `scripts/gen-chart-templates-fixture.mjs`. No editar a mano.**
    La fuente son los 43 JSON de
    `mantra-core-health-api/src/common/seed/data/clinical-forms/`, con su
    procedencia —norma, organismo, URL y licencia— tal como la declara cada uno.

    Regenerar con `yarn mock:chart-templates`.
    ========================================================================== */

/** La procedencia de una ficha, tal como la declara su JSON. */
export interface ProcedenciaDeFicha {
  readonly sourceTitle: string;
  readonly organization: string;
  readonly url: string;
  readonly license: string;
  readonly sourceVersion?: string;
  readonly retrievedAt: string;
  readonly note?: string;
}

/**
 * Cuándo se muestra un campo: si el campo `field` (por código, dentro de la
 * misma ficha) vale `equals`. Es `enableWhen` de FHIR con `=` y `SHOW`.
 */
export interface CondicionDeFicha {
  readonly field: string;
  readonly equals: string | boolean | readonly (string | boolean)[];
}

/** Un campo de la ficha. `options` sólo viene en los de lista cerrada. */
export interface CampoDeFicha {
  readonly code: string;
  readonly name: string;
  readonly dataType: string;
  readonly required: boolean;
  readonly section?: string;
  readonly options?: readonly string[];
  readonly multiple?: boolean;
  readonly allowOther?: boolean;
  readonly description?: string;
  readonly showWhen?: CondicionDeFicha;
}

/** Una ficha clínica estándar. */
export interface FichaEstandar {
  readonly code: string;
  readonly name: string;
  /** Versión de la ficha en el catálogo: sube cuando cambia su esquema. */
  readonly version: number;
  /** Código de `VS_MEDICAL_SPECIALTY`, o `TRANSVERSAL`. */
  readonly specialty: string;
  readonly provenance?: ProcedenciaDeFicha;
  readonly fields: readonly CampoDeFicha[];
}

export const FICHAS_ESTANDAR: readonly FichaEstandar[] = [
  {
    "code": "ANEST_VALORACION_PREANESTESICA",
    "name": "Valoración preanestésica",
    "version": 2,
    "specialty": "ANESTESIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico preoperatorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, antecedentes patológicos, alergias, medicación habitual, examen físico dirigido, diagnóstico y conducta. Son agregados propios de la especialidad el procedimiento previsto, el ayuno en horas, la evaluación de la vía aérea (Mallampati, apertura bucal, movilidad cervical), las piezas dentarias en riesgo, las experiencias anestésicas previas y sus complicaciones, la clasificación ASA registrada como texto libre y el plan anestésico propuesto. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación ASA, Mallampati, distancia tiromentoniana de Patil."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de la valoración",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "procedimiento_previsto",
        "name": "Procedimiento previsto",
        "dataType": "string",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "tipo_de_cirugia",
        "name": "Tipo de cirugía",
        "dataType": "string",
        "required": false,
        "section": "Procedimiento",
        "options": [
          "Programada",
          "Urgencia"
        ],
        "multiple": false
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Comorbilidades",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes",
          "Cardiopatía",
          "Asma o EPOC",
          "Apnea del sueño",
          "Enfermedad renal",
          "Hepatopatía",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Látex",
          "Alimentos",
          "Antisépticos"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "Alergias — detalle y reacción",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes"
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "farmacos_a_suspender",
        "name": "Fármacos que requieren manejo perioperatorio",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Anticoagulantes",
          "Antiagregantes",
          "Hipoglucemiantes o insulina",
          "IECA o ARA II",
          "Corticoides",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "habitos_toxicos",
        "name": "Hábitos tóxicos",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "anestesias_previas",
        "name": "Anestesias previas",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "experiencias_anestesicas_previas",
        "name": "¿Cuáles y cuándo?",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "anestesias_previas",
          "equals": true
        }
      },
      {
        "code": "hubo_complicaciones",
        "name": "¿Hubo complicaciones?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "anestesias_previas",
          "equals": true
        }
      },
      {
        "code": "complicaciones_anestesicas_previas",
        "name": "¿Cuáles? (vía aérea difícil, náuseas, hipertermia maligna, despertar prolongado)",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "hubo_complicaciones",
          "equals": true
        }
      },
      {
        "code": "hipertermia_maligna_familiar",
        "name": "Familiar con hipertermia maligna o complicación anestésica grave",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "hipertermia_quien",
        "name": "¿Quién y qué pasó?",
        "dataType": "string",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "hipertermia_maligna_familiar",
          "equals": true
        }
      },
      {
        "code": "ayuno_en_horas",
        "name": "Ayuno (horas)",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "description": "Sólidos 6–8 h; líquidos claros 2 h."
      },
      {
        "code": "apnea_sintomas",
        "name": "Sospecha de apnea del sueño",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Ronquido fuerte",
          "Somnolencia diurna",
          "Apneas observadas por otra persona",
          "Obesidad",
          "Cuello ancho",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "via_aerea_mallampati",
        "name": "Mallampati",
        "dataType": "string",
        "required": true,
        "section": "Vía aérea",
        "options": [
          "Clase I — paladar blando, fauces, úvula y pilares visibles",
          "Clase II — paladar blando, fauces y úvula",
          "Clase III — paladar blando y base de la úvula",
          "Clase IV — sólo paladar duro"
        ],
        "multiple": false
      },
      {
        "code": "apertura_bucal",
        "name": "Apertura bucal (distancia interincisiva)",
        "dataType": "string",
        "required": false,
        "section": "Vía aérea",
        "options": [
          "Mayor a 3 cm",
          "Entre 2 y 3 cm",
          "Menor a 2 cm"
        ],
        "multiple": false
      },
      {
        "code": "distancia_tiromentoniana",
        "name": "Distancia tiromentoniana (Patil)",
        "dataType": "string",
        "required": false,
        "section": "Vía aérea",
        "options": [
          "Mayor a 6,5 cm",
          "Entre 6 y 6,5 cm",
          "Menor a 6 cm"
        ],
        "multiple": false
      },
      {
        "code": "movilidad_cervical",
        "name": "Movilidad cervical",
        "dataType": "string",
        "required": false,
        "section": "Vía aérea",
        "options": [
          "Normal",
          "Limitada",
          "Muy limitada"
        ],
        "multiple": false
      },
      {
        "code": "protesis_dental",
        "name": "Prótesis o piezas dentarias flojas",
        "dataType": "boolean",
        "required": false,
        "section": "Vía aérea"
      },
      {
        "code": "piezas_dentarias_en_riesgo",
        "name": "¿Cuáles?",
        "dataType": "text",
        "required": true,
        "section": "Vía aérea",
        "showWhen": {
          "field": "protesis_dental",
          "equals": true
        }
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "examen_cardiorrespiratorio",
        "name": "Examen cardiorrespiratorio",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "capacidad_funcional",
        "name": "Capacidad funcional",
        "dataType": "string",
        "required": false,
        "section": "Evaluación",
        "options": [
          "4 METs o más (sube 2 pisos sin parar)",
          "Menos de 4 METs",
          "No evaluable"
        ],
        "multiple": false
      },
      {
        "code": "laboratorio_relevante",
        "name": "Laboratorio y ECG relevantes",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "clasificacion_asa",
        "name": "Clasificación ASA",
        "dataType": "string",
        "required": true,
        "section": "Evaluación",
        "options": [
          "ASA I — sano",
          "ASA II — enfermedad sistémica leve",
          "ASA III — enfermedad sistémica grave",
          "ASA IV — enfermedad sistémica grave, amenaza constante para la vida",
          "ASA V — moribundo, no sobrevive sin la operación",
          "ASA VI — muerte encefálica, donante de órganos"
        ],
        "multiple": false
      },
      {
        "code": "asa_urgencia",
        "name": "Modificador E (urgencia)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "tecnica_propuesta",
        "name": "Técnica anestésica propuesta",
        "dataType": "string",
        "required": false,
        "section": "Conclusión",
        "options": [
          "General",
          "Regional neuroaxial",
          "Bloqueo periférico",
          "Sedación",
          "Local con monitoreo"
        ],
        "multiple": false
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan anestésico propuesto",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      }
    ]
  },
  {
    "code": "BIOQ_INFORME_BASE",
    "name": "Informe de laboratorio bioquímico",
    "version": 2,
    "specialty": "BIOQUIMICA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro e informe de exámenes auxiliares de laboratorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale el molde común del documento clínico: motivo o indicación del estudio, resultado de lo observado, conclusión y conducta o recomendación. Son agregados propios de la especialidad los ítems de la fase preanalítica (tipo de muestra, condiciones de la toma, ayuno, fecha y hora de toma, medicación en curso) y la distinción entre determinaciones solicitadas, resultados en prosa, valores fuera del rango de referencia y observaciones preanalíticas. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Indicación",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "text",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "determinaciones_solicitadas",
        "name": "Determinaciones solicitadas",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "tipo_de_muestra",
        "name": "Tipo de muestra",
        "dataType": "string",
        "required": true,
        "section": "Fase preanalítica",
        "options": [
          "Sangre venosa",
          "Sangre capilar",
          "Orina",
          "Heces",
          "Esputo",
          "Líquido cefalorraquídeo",
          "Hisopado",
          "Otro líquido biológico"
        ],
        "multiple": false
      },
      {
        "code": "condiciones_de_la_toma",
        "name": "Condiciones de la toma",
        "dataType": "text",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "ayuno",
        "name": "En ayunas",
        "dataType": "boolean",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "horas_de_ayuno",
        "name": "Horas de ayuno",
        "dataType": "integer",
        "required": true,
        "section": "Fase preanalítica",
        "showWhen": {
          "field": "ayuno",
          "equals": true
        }
      },
      {
        "code": "fecha_de_toma",
        "name": "Fecha de toma",
        "dataType": "date",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "hora_de_toma",
        "name": "Hora de toma",
        "dataType": "string",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "medicacion_en_curso",
        "name": "Medicación en curso",
        "dataType": "text",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "aspecto_muestra",
        "name": "Estado de la muestra",
        "dataType": "string",
        "required": false,
        "section": "Fase preanalítica",
        "options": [
          "Adecuada",
          "Hemolizada",
          "Lipémica",
          "Ictérica",
          "Coagulada",
          "Volumen insuficiente"
        ],
        "multiple": false
      },
      {
        "code": "estado_de_la_muestra",
        "name": "Interferencia esperada",
        "dataType": "text",
        "required": true,
        "section": "Fase preanalítica",
        "showWhen": {
          "field": "aspecto_muestra",
          "equals": [
            "Hemolizada",
            "Lipémica",
            "Ictérica",
            "Coagulada",
            "Volumen insuficiente"
          ]
        }
      },
      {
        "code": "observaciones_preanaliticas",
        "name": "Observaciones preanalíticas",
        "dataType": "text",
        "required": false,
        "section": "Fase preanalítica"
      },
      {
        "code": "metodo_analitico",
        "name": "Método analítico",
        "dataType": "text",
        "required": false,
        "section": "Resultados"
      },
      {
        "code": "resultados",
        "name": "Resultados con unidades y valores de referencia",
        "dataType": "text",
        "required": true,
        "section": "Resultados"
      },
      {
        "code": "hay_fuera_de_rango",
        "name": "Hay valores fuera de rango",
        "dataType": "boolean",
        "required": false,
        "section": "Resultados"
      },
      {
        "code": "valores_fuera_de_rango",
        "name": "¿Cuáles?",
        "dataType": "text",
        "required": true,
        "section": "Resultados",
        "showWhen": {
          "field": "hay_fuera_de_rango",
          "equals": true
        }
      },
      {
        "code": "valor_critico",
        "name": "Alguno es un valor crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Resultados",
        "showWhen": {
          "field": "hay_fuera_de_rango",
          "equals": true
        }
      },
      {
        "code": "valor_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Resultados",
        "showWhen": {
          "field": "valor_critico",
          "equals": true
        }
      },
      {
        "code": "comparacion_con_estudios_previos",
        "name": "Comparación con estudios previos",
        "dataType": "text",
        "required": false,
        "section": "Resultados"
      },
      {
        "code": "diagnostico",
        "name": "Interpretación",
        "dataType": "text",
        "required": true,
        "section": "Resultados"
      },
      {
        "code": "conducta",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Resultados"
      }
    ]
  },
  {
    "code": "CARDIO_FICHA_BASE",
    "name": "Ficha cardiológica — versión general base",
    "version": 2,
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, evaluación cardiovascular",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen cardiovascular del formato oficial. No incluye ninguna escala de sociedad científica. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clase funcional NYHA, escala de Levine, criterios de Framingham."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "dolor_toracico",
        "name": "Dolor torácico",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares"
      },
      {
        "code": "dolor_toracico_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Opresivo",
          "Punzante",
          "Urente (ardor)",
          "Cólico",
          "Pulsátil",
          "Sordo",
          "Lancinante",
          "Eléctrico o en descarga"
        ],
        "multiple": false,
        "allowOther": true,
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "dolor_toracico_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas cardiovasculares",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Características del dolor — otras observaciones",
        "dataType": "text",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "dolor_toracico",
          "equals": true
        }
      },
      {
        "code": "disnea",
        "name": "Disnea",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares"
      },
      {
        "code": "nyha_clase_funcional",
        "name": "Clase funcional NYHA",
        "dataType": "string",
        "required": true,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Clase I — sin limitación de la actividad física",
          "Clase II — limitación leve: síntomas con la actividad ordinaria",
          "Clase III — limitación marcada: síntomas con actividad menor a la ordinaria",
          "Clase IV — síntomas en reposo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "disnea",
          "equals": true
        }
      },
      {
        "code": "disnea_tipo",
        "name": "Tipo de disnea",
        "dataType": "json",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "De esfuerzo",
          "Ortopnea",
          "Disnea paroxística nocturna",
          "En reposo"
        ],
        "multiple": true,
        "showWhen": {
          "field": "disnea",
          "equals": true
        }
      },
      {
        "code": "palpitaciones",
        "name": "Palpitaciones",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares"
      },
      {
        "code": "arritmia_inicio_fin",
        "name": "Inicio y fin de las palpitaciones",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Súbitos",
          "Graduales"
        ],
        "multiple": false,
        "showWhen": {
          "field": "palpitaciones",
          "equals": true
        }
      },
      {
        "code": "arritmia_ritmo",
        "name": "Ritmo referido o palpado",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Regular",
          "Irregular"
        ],
        "multiple": false,
        "showWhen": {
          "field": "palpitaciones",
          "equals": true
        }
      },
      {
        "code": "arritmia_sincope",
        "name": "Se acompañó de síncope",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "palpitaciones",
          "equals": true
        }
      },
      {
        "code": "arritmia_ecg",
        "name": "ECG — ritmo registrado",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "palpitaciones",
          "equals": true
        }
      },
      {
        "code": "sincope",
        "name": "Síncope",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares"
      },
      {
        "code": "sincope_contexto",
        "name": "Contexto",
        "dataType": "json",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "De pie prolongado o calor",
          "Tras orinar, toser o defecar",
          "Durante el esfuerzo",
          "En decúbito",
          "Sin desencadenante"
        ],
        "multiple": true,
        "showWhen": {
          "field": "sincope",
          "equals": true
        }
      },
      {
        "code": "sincope_prodromos",
        "name": "Pródromos (mareo, visión borrosa, sudoración)",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "sincope",
          "equals": true
        }
      },
      {
        "code": "sincope_palpitaciones_previas",
        "name": "Palpitaciones previas",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "sincope",
          "equals": true
        }
      },
      {
        "code": "sincope_duracion_segundos",
        "name": "Duración de la pérdida de conciencia (segundos)",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "showWhen": {
          "field": "sincope",
          "equals": true
        }
      },
      {
        "code": "edema_de_miembros_inferiores",
        "name": "Edema de miembros inferiores",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas cardiovasculares"
      },
      {
        "code": "edema_grado",
        "name": "Edema (fóvea)",
        "dataType": "string",
        "required": true,
        "section": "Síntomas cardiovasculares",
        "options": [
          "+ (2 mm)",
          "++ (4 mm)",
          "+++ (6 mm)",
          "++++ (8 mm)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "edema_de_miembros_inferiores",
          "equals": true
        }
      },
      {
        "code": "edema_lateralidad",
        "name": "Lateralidad",
        "dataType": "string",
        "required": false,
        "section": "Síntomas cardiovasculares",
        "options": [
          "Bilateral",
          "Unilateral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "edema_de_miembros_inferiores",
          "equals": true
        }
      },
      {
        "code": "hipertension_arterial",
        "name": "Hipertensión arterial",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "hta_tratamiento",
        "name": "¿Qué tratamiento recibe?",
        "dataType": "string",
        "required": false,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "hipertension_arterial",
          "equals": true
        }
      },
      {
        "code": "diabetes",
        "name": "Diabetes",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "diabetes",
          "equals": true
        }
      },
      {
        "code": "dislipidemia",
        "name": "Dislipidemia",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "ldl",
        "name": "Último colesterol LDL (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "dislipidemia",
          "equals": true
        }
      },
      {
        "code": "tabaquismo",
        "name": "Tabaquismo",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "paquetes_anio",
        "name": "Paquetes-año",
        "dataType": "integer",
        "required": false,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "tabaquismo",
          "equals": true
        }
      },
      {
        "code": "antecedente_familiar_coronario",
        "name": "Familiar de primer grado con enfermedad coronaria precoz",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "familiar_coronario_quien",
        "name": "¿Quién y a qué edad?",
        "dataType": "string",
        "required": true,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "antecedente_familiar_coronario",
          "equals": true
        }
      },
      {
        "code": "chagas_riesgo",
        "name": "Vivió en zona endémica de Chagas",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Factores de riesgo",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Factores de riesgo",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Factores de riesgo"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Factores de riesgo",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "ruidos_cardiacos",
        "name": "Ruidos cardíacos",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "hay_soplo",
        "name": "Soplo",
        "dataType": "boolean",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "soplo_grado_levine",
        "name": "Intensidad (Levine)",
        "dataType": "string",
        "required": true,
        "section": "Examen físico",
        "options": [
          "I/VI",
          "II/VI",
          "III/VI",
          "IV/VI",
          "V/VI",
          "VI/VI"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hay_soplo",
          "equals": true
        }
      },
      {
        "code": "soplo_tiempo",
        "name": "Tiempo",
        "dataType": "string",
        "required": false,
        "section": "Examen físico",
        "options": [
          "Sistólico",
          "Diastólico",
          "Continuo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hay_soplo",
          "equals": true
        }
      },
      {
        "code": "soplos",
        "name": "Foco e irradiación",
        "dataType": "text",
        "required": false,
        "section": "Examen físico",
        "showWhen": {
          "field": "hay_soplo",
          "equals": true
        }
      },
      {
        "code": "pulsos_perifericos",
        "name": "Pulsos periféricos",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "ecg_hallazgos",
        "name": "ECG — hallazgos",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Síndrome coronario o angina",
          "Insuficiencia cardíaca",
          "Hipertensión arterial",
          "Arritmia",
          "Cardiopatía chagásica",
          "Valvulopatía"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "dt_tipo",
        "name": "Tipo de dolor torácico",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Típico: retroesternal, con el esfuerzo, cede con reposo o nitratos",
          "Atípico: cumple dos de los tres criterios",
          "No anginoso: cumple uno o ninguno"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome coronario o angina"
        }
      },
      {
        "code": "dt_acompanantes",
        "name": "Acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Diaforesis",
          "Náuseas o vómitos",
          "Disnea",
          "Síncope o presíncope",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome coronario o angina"
        }
      },
      {
        "code": "dt_ecg",
        "name": "ECG de 12 derivaciones — hallazgo principal",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome coronario o angina"
        }
      },
      {
        "code": "ic_signos",
        "name": "Signos y síntomas (Framingham)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ortopnea",
          "Disnea paroxística nocturna",
          "Ingurgitación yugular",
          "Crepitantes pulmonares",
          "Tercer ruido (galope)",
          "Edema de miembros inferiores",
          "Hepatomegalia"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "ic_edema_grado",
        "name": "Edema (fóvea)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin edema",
          "+ (2 mm)",
          "++ (4 mm)",
          "+++ (6 mm)",
          "++++ (8 mm)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "ic_peso_seco",
        "name": "Peso de referencia (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Toma la medicación todos los días",
          "Olvida dosis",
          "Abandonó el tratamiento",
          "Sin tratamiento todavía"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "arr_tipo",
        "name": "Ritmo documentado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fibrilación auricular",
          "Flutter auricular",
          "Taquicardia supraventricular",
          "Extrasístoles",
          "Bloqueo AV",
          "No documentado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Arritmia"
        }
      },
      {
        "code": "arr_anticoagulado",
        "name": "Recibe anticoagulación",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Arritmia"
        }
      },
      {
        "code": "chagas_serologia",
        "name": "Serología para Chagas",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "Pendiente",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cardiopatía chagásica"
        }
      },
      {
        "code": "chagas_compromiso",
        "name": "Compromiso orgánico",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cardíaco (arritmia, bloqueo, insuficiencia)",
          "Digestivo (megaesófago, megacolon)",
          "Sin compromiso aparente"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cardiopatía chagásica"
        }
      },
      {
        "code": "chagas_tratamiento_previo",
        "name": "Recibió benznidazol o nifurtimox",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cardiopatía chagásica"
        }
      },
      {
        "code": "chagas_vivienda_endemica",
        "name": "Vivió en vivienda con vinchucas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cardiopatía chagásica"
        }
      },
      {
        "code": "valv_valvula",
        "name": "Válvula comprometida",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Valvulopatía"
        }
      },
      {
        "code": "valv_eco",
        "name": "Ecocardiograma — hallazgo principal",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Valvulopatía"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "CARDIO_RIESGO_CV_OMS",
    "name": "Evaluación del riesgo cardiovascular (OMS/OPS)",
    "version": 2,
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Prevención de las enfermedades cardiovasculares: directrices para la evaluación y el manejo del riesgo cardiovascular",
      "organization": "Organización Panamericana de la Salud / Organización Mundial de la Salud (OPS/OMS)",
      "url": "https://www.paho.org/sites/default/files/2023-10/directrices-evaluacion-manejo-riesgo-cv-oms.pdf",
      "license": "CC BY-NC-SA 3.0 IGO (publicación OPS/OMS)",
      "sourceVersion": "Tablas OMS 2019 · HEARTS en las Américas",
      "retrievedAt": "2026-08-14",
      "note": "Captura las variables de entrada de las tablas de predicción. El cálculo del riesgo lo hace la calculadora OPS: https://www.paho.org/en/paho-cardiovascular-risk-calculator v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "edad",
        "name": "Edad (años)",
        "dataType": "integer",
        "required": true,
        "section": "Datos para la tabla OMS/OPS",
        "description": "Las tablas cubren de 40 a 74 años."
      },
      {
        "code": "sexo",
        "name": "Sexo",
        "dataType": "string",
        "required": true,
        "section": "Datos para la tabla OMS/OPS",
        "options": [
          "Mujer",
          "Hombre"
        ],
        "multiple": false
      },
      {
        "code": "fumador_actual",
        "name": "Fumador actual (o dejó hace menos de un año)",
        "dataType": "boolean",
        "required": true,
        "section": "Datos para la tabla OMS/OPS"
      },
      {
        "code": "diabetes",
        "name": "Diabetes",
        "dataType": "boolean",
        "required": true,
        "section": "Datos para la tabla OMS/OPS"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Datos para la tabla OMS/OPS"
      },
      {
        "code": "colesterol_disponible",
        "name": "¿Hay colesterol total medido?",
        "dataType": "boolean",
        "required": false,
        "section": "Datos para la tabla OMS/OPS"
      },
      {
        "code": "colesterol_total",
        "name": "Colesterol total (mmol/L)",
        "dataType": "decimal",
        "required": true,
        "section": "Datos para la tabla OMS/OPS",
        "showWhen": {
          "field": "colesterol_disponible",
          "equals": true
        }
      },
      {
        "code": "indice_masa_corporal",
        "name": "Índice de masa corporal (kg/m²)",
        "dataType": "decimal",
        "required": true,
        "section": "Datos para la tabla OMS/OPS",
        "description": "La tabla sin laboratorio usa el IMC.",
        "showWhen": {
          "field": "colesterol_disponible",
          "equals": false
        }
      },
      {
        "code": "riesgo_a_10_anios",
        "name": "Riesgo a 10 años (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado"
      },
      {
        "code": "categoria_de_riesgo",
        "name": "Categoría de riesgo",
        "dataType": "string",
        "required": true,
        "section": "Resultado",
        "options": [
          "< 5 %",
          "5 % a < 10 %",
          "10 % a < 20 %",
          "20 % a < 30 %",
          "≥ 30 %"
        ],
        "multiple": false
      },
      {
        "code": "recomendaciones",
        "name": "Recomendaciones",
        "dataType": "text",
        "required": false,
        "section": "Resultado"
      }
    ]
  },
  {
    "code": "CIRGEN_EVALUACION_BASE",
    "name": "Evaluación de cirugía general",
    "version": 2,
    "specialty": "CIRUGIA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos del abdomen",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico dirigido, diagnóstico y conducta. Son agregados propios de la especialidad los ítems quirúrgicos: características del dolor abdominal, tránsito intestinal, hernias, cirugías previas, riesgo quirúrgico descrito en prosa e indicación quirúrgica propuesta. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación ASA, escala de Alvarado."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "dolor_abdominal",
        "name": "Dolor abdominal",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "dolor_abdominal_localizacion",
        "name": "Dolor — ¿dónde se localiza?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Opresivo",
          "Punzante",
          "Urente (ardor)",
          "Cólico",
          "Pulsátil",
          "Sordo",
          "Lancinante",
          "Eléctrico o en descarga"
        ],
        "multiple": false,
        "allowOther": true,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_abdominal_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Dolor — otras observaciones",
        "dataType": "text",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "nauseas_o_vomitos",
        "name": "Náuseas o vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "transito_intestinal",
        "name": "Tránsito intestinal",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Conservado",
          "Constipación",
          "Diarrea",
          "Sin gases ni heces (obstrucción)"
        ],
        "multiple": false
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "temperatura_maxima",
        "name": "Temperatura máxima (°C)",
        "dataType": "decimal",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "tuvo_cirugias",
        "name": "¿Tuvo cirugías previas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "cirugias_previas",
        "name": "¿Cuáles y en qué año?",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tuvo_cirugias",
          "equals": true
        }
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_del_abdomen",
        "name": "Examen del abdomen",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "signos_peritoneales",
        "name": "Signos peritoneales",
        "dataType": "json",
        "required": true,
        "section": "Examen",
        "options": [
          "Defensa",
          "Rebote (Blumberg)",
          "Rovsing",
          "Psoas",
          "Murphy",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "hay_hernia",
        "name": "Hernia",
        "dataType": "boolean",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "hernia_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Examen",
        "options": [
          "Inguinal",
          "Crural",
          "Umbilical",
          "Epigástrica",
          "Incisional"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hay_hernia",
          "equals": true
        }
      },
      {
        "code": "hernia_estado",
        "name": "Estado",
        "dataType": "string",
        "required": true,
        "section": "Examen",
        "options": [
          "Reductible",
          "Incarcerada",
          "Estrangulada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hay_hernia",
          "equals": true
        }
      },
      {
        "code": "hernias",
        "name": "Hernia — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen",
        "showWhen": {
          "field": "hay_hernia",
          "equals": true
        }
      },
      {
        "code": "examenes_complementarios",
        "name": "Exámenes complementarios",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Apendicitis aguda",
          "Colecistitis o colelitiasis",
          "Hernia de pared abdominal",
          "Obstrucción intestinal",
          "Abdomen agudo inespecífico",
          "Patología anorrectal"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "alvarado",
        "name": "Escala de Alvarado",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Migración del dolor a fosa ilíaca derecha",
          "Anorexia",
          "Náuseas o vómitos",
          "Dolor en fosa ilíaca derecha (2)",
          "Rebote",
          "Fiebre > 37,3 °C",
          "Leucocitosis > 10 000 (2)",
          "Desviación a la izquierda"
        ],
        "multiple": true,
        "description": "7 o más puntos: probable apendicitis.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Apendicitis aguda"
        }
      },
      {
        "code": "murphy_cirugia",
        "name": "Signo de Murphy",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Colecistitis o colelitiasis"
        }
      },
      {
        "code": "eco_vesicula",
        "name": "Ecografía — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Colecistitis o colelitiasis"
        }
      },
      {
        "code": "hernia_dolor_cronico",
        "name": "Dolor crónico en la hernia",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hernia de pared abdominal"
        }
      },
      {
        "code": "obstruccion_signos",
        "name": "Signos",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Distensión",
          "Vómitos fecaloides",
          "Ruidos aumentados metálicos",
          "Silencio abdominal",
          "Cicatriz previa"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Obstrucción intestinal"
        }
      },
      {
        "code": "abdomen_agudo_imagen",
        "name": "Imagen solicitada",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Abdomen agudo inespecífico"
        }
      },
      {
        "code": "anorrectal_tipo",
        "name": "Sospecha",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Hemorroides",
          "Fisura",
          "Absceso",
          "Fístula"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Patología anorrectal"
        }
      },
      {
        "code": "riesgo_asa",
        "name": "Riesgo anestésico ASA",
        "dataType": "string",
        "required": false,
        "section": "Plan quirúrgico",
        "options": [
          "ASA I",
          "ASA II",
          "ASA III",
          "ASA IV",
          "ASA V"
        ],
        "multiple": false
      },
      {
        "code": "riesgo_quirurgico",
        "name": "Riesgo quirúrgico — detalle",
        "dataType": "text",
        "required": false,
        "section": "Plan quirúrgico"
      },
      {
        "code": "indicacion_quirurgica_propuesta",
        "name": "Indicación quirúrgica propuesta",
        "dataType": "text",
        "required": false,
        "section": "Plan quirúrgico"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Plan quirúrgico"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Plan quirúrgico",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "DERMA_EXAMEN_BASE",
    "name": "Examen dermatológico — versión general base",
    "version": 2,
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen de piel y faneras",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la descripción semiológica de la lesión elemental, su distribución y su evolución. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: fototipos de Fitzpatrick, regla ABCDE del melanoma."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "prurito",
        "name": "Prurito",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "prurito_intensidad",
        "name": "Intensidad del prurito (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "prurito",
          "equals": true
        }
      },
      {
        "code": "prurito_nocturno",
        "name": "Empeora de noche",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "prurito",
          "equals": true
        }
      },
      {
        "code": "dolor_local",
        "name": "Dolor local",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "lesion_elemental",
        "name": "Lesión elemental",
        "dataType": "string",
        "required": true,
        "section": "Lesión",
        "options": [
          "Mácula",
          "Pápula",
          "Placa",
          "Nódulo",
          "Vesícula",
          "Ampolla",
          "Pústula",
          "Habón",
          "Escama",
          "Costra",
          "Úlcera",
          "Cicatriz"
        ],
        "multiple": false
      },
      {
        "code": "descripcion_de_la_lesion",
        "name": "Descripción (color, bordes, superficie)",
        "dataType": "text",
        "required": true,
        "section": "Lesión"
      },
      {
        "code": "localizacion",
        "name": "Localización",
        "dataType": "text",
        "required": true,
        "section": "Lesión"
      },
      {
        "code": "distribucion",
        "name": "Distribución",
        "dataType": "string",
        "required": false,
        "section": "Lesión",
        "options": [
          "Localizada",
          "Generalizada",
          "Simétrica",
          "Dermatómica",
          "Fotoexpuesta",
          "Flexural"
        ],
        "multiple": false
      },
      {
        "code": "numero_de_lesiones",
        "name": "Número de lesiones",
        "dataType": "integer",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "tamano_mayor_mm",
        "name": "Tamaño de la mayor (mm)",
        "dataType": "decimal",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "fototipo",
        "name": "Fototipo de Fitzpatrick",
        "dataType": "string",
        "required": false,
        "section": "Lesión",
        "options": [
          "I",
          "II",
          "III",
          "IV",
          "V",
          "VI"
        ],
        "multiple": false
      },
      {
        "code": "compromiso_de_mucosas",
        "name": "Compromiso de mucosas",
        "dataType": "boolean",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "mucosas_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Lesión",
        "options": [
          "Oral",
          "Genital",
          "Conjuntival",
          "Nasal"
        ],
        "multiple": true,
        "showWhen": {
          "field": "compromiso_de_mucosas",
          "equals": true
        }
      },
      {
        "code": "compromiso_de_faneras",
        "name": "Compromiso de pelo o uñas",
        "dataType": "boolean",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "faneras_cuales",
        "name": "¿Qué?",
        "dataType": "json",
        "required": true,
        "section": "Lesión",
        "options": [
          "Caída de pelo",
          "Uñas"
        ],
        "multiple": true,
        "showWhen": {
          "field": "compromiso_de_faneras",
          "equals": true
        }
      },
      {
        "code": "factores_desencadenantes",
        "name": "Factores desencadenantes",
        "dataType": "text",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Lesión pigmentada (descartar melanoma)",
          "Dermatitis (atópica o de contacto)",
          "Psoriasis",
          "Acné",
          "Micosis superficial",
          "Leishmaniasis cutánea",
          "Carcinoma de piel no melanoma"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "abcde",
        "name": "Criterios ABCDE",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Asimetría",
          "Bordes irregulares",
          "Color heterogéneo",
          "Diámetro > 6 mm",
          "Evolución (cambió)"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión pigmentada (descartar melanoma)"
        }
      },
      {
        "code": "dermatoscopia",
        "name": "Dermatoscopía realizada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión pigmentada (descartar melanoma)"
        }
      },
      {
        "code": "atopia",
        "name": "Antecedente de atopia",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dermatitis (atópica o de contacto)"
        }
      },
      {
        "code": "dermatitis_contactante",
        "name": "Posible contactante",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dermatitis (atópica o de contacto)"
        }
      },
      {
        "code": "pasi",
        "name": "PASI",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Psoriasis"
        }
      },
      {
        "code": "superficie_corporal",
        "name": "Superficie corporal afectada (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Psoriasis"
        }
      },
      {
        "code": "psoriasis_artritis",
        "name": "Dolor articular",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Psoriasis"
        }
      },
      {
        "code": "acne_grado",
        "name": "Grado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Comedoniano",
          "Papulopustuloso leve",
          "Papulopustuloso moderado",
          "Noduloquístico"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Acné"
        }
      },
      {
        "code": "micosis_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Tiña corporal",
          "Tiña pedis",
          "Onicomicosis",
          "Pitiriasis versicolor",
          "Candidiasis"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Micosis superficial"
        }
      },
      {
        "code": "koh",
        "name": "KOH o cultivo realizado",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Micosis superficial"
        }
      },
      {
        "code": "leish_cutanea_lesiones",
        "name": "Número de úlceras",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Leishmaniasis cutánea"
        }
      },
      {
        "code": "leish_mucosa",
        "name": "Compromiso nasal o bucal",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Leishmaniasis cutánea"
        }
      },
      {
        "code": "leish_procedencia",
        "name": "Zona donde se expuso",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Leishmaniasis cutánea"
        }
      },
      {
        "code": "cpnm_tipo",
        "name": "Sospecha",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Basocelular",
          "Espinocelular",
          "Queratosis actínica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Carcinoma de piel no melanoma"
        }
      },
      {
        "code": "cpnm_biopsia",
        "name": "Biopsia indicada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Carcinoma de piel no melanoma"
        }
      },
      {
        "code": "estudios_solicitados",
        "name": "Estudios solicitados",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "EMERG_ATENCION_BASE",
    "name": "Atención en emergencia",
    "version": 2,
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro de la atención de urgencias y emergencias",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, tiempo de evolución, antecedentes, alergias, medicación, signos vitales, diagnóstico y conducta. Son agregados propios de la especialidad la hora de llegada, la forma de llegada, la evaluación inicial y el nivel de prioridad asignado, que se registra como texto libre tal como lo escriba el profesional. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de coma de Glasgow, escala de Cincinnati, guía de dengue OPS/OMS 2016, qSOFA (Sepsis-3)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Llegada"
      },
      {
        "code": "hora_de_llegada",
        "name": "Hora de llegada",
        "dataType": "string",
        "required": true,
        "section": "Llegada"
      },
      {
        "code": "forma_de_llegada",
        "name": "Forma de llegada",
        "dataType": "string",
        "required": false,
        "section": "Llegada",
        "options": [
          "Por sus medios",
          "Ambulancia",
          "Traído por terceros",
          "Policía"
        ],
        "multiple": false
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Llegada"
      },
      {
        "code": "nivel_de_prioridad_asignado",
        "name": "Prioridad asignada en el triaje del establecimiento",
        "dataType": "string",
        "required": false,
        "section": "Llegada"
      },
      {
        "code": "evaluacion_inicial",
        "name": "Evaluación inicial",
        "dataType": "text",
        "required": true,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "via_aerea",
        "name": "A — vía aérea",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "Permeable",
          "Comprometida"
        ],
        "multiple": false
      },
      {
        "code": "respiracion",
        "name": "B — respiración",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "Adecuada",
          "Dificultad respiratoria",
          "Apnea"
        ],
        "multiple": false
      },
      {
        "code": "circulacion",
        "name": "C — circulación",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "Estable",
          "Signos de shock",
          "Hemorragia activa"
        ],
        "multiple": false
      },
      {
        "code": "estado_de_conciencia",
        "name": "D — conciencia (AVPU)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "Alerta",
          "Responde a la voz",
          "Responde al dolor",
          "No responde"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_ocular",
        "name": "Glasgow — apertura ocular",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "4 — espontánea",
          "3 — a la voz",
          "2 — al dolor",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_verbal",
        "name": "Glasgow — respuesta verbal",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "5 — orientada",
          "4 — confusa",
          "3 — palabras inapropiadas",
          "2 — sonidos incomprensibles",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_motora",
        "name": "Glasgow — respuesta motora",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "options": [
          "6 — obedece órdenes",
          "5 — localiza el dolor",
          "4 — retira al dolor",
          "3 — flexión anormal",
          "2 — extensión",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg, sistólica/diastólica)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "description": "Por ejemplo: 120/80."
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "dolor_presente",
        "name": "Dolor",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación primaria (ABCDE)"
      },
      {
        "code": "dolor_intensidad",
        "name": "Intensidad (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación primaria (ABCDE)",
        "showWhen": {
          "field": "dolor_presente",
          "equals": true
        }
      },
      {
        "code": "dolor_localizacion",
        "name": "Localización",
        "dataType": "string",
        "required": false,
        "section": "Evaluación primaria (ABCDE)",
        "showWhen": {
          "field": "dolor_presente",
          "equals": true
        }
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes (SAMPLE)"
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes (SAMPLE)"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes (SAMPLE)",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes (SAMPLE)",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes (SAMPLE)"
      },
      {
        "code": "medicacion_actual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes (SAMPLE)",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "ultima_ingesta",
        "name": "Última ingesta (hora)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes (SAMPLE)"
      },
      {
        "code": "embarazo_emergencia",
        "name": "¿Embarazo posible?",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes (SAMPLE)",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor torácico agudo",
          "Accidente cerebrovascular",
          "Politraumatismo",
          "Dificultad respiratoria",
          "Sepsis",
          "Dengue con signos de alarma",
          "Convulsión",
          "Intoxicación"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "dt_tipo",
        "name": "Tipo de dolor torácico",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Típico: retroesternal, con el esfuerzo, cede con reposo o nitratos",
          "Atípico: cumple dos de los tres criterios",
          "No anginoso: cumple uno o ninguno"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dolor torácico agudo"
        }
      },
      {
        "code": "dt_acompanantes",
        "name": "Acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Diaforesis",
          "Náuseas o vómitos",
          "Disnea",
          "Síncope o presíncope",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dolor torácico agudo"
        }
      },
      {
        "code": "dt_ecg",
        "name": "ECG de 12 derivaciones — hallazgo principal",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dolor torácico agudo"
        }
      },
      {
        "code": "troponina",
        "name": "Troponina",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dolor torácico agudo"
        }
      },
      {
        "code": "acv_cincinnati",
        "name": "Escala de Cincinnati",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Asimetría facial",
          "Caída de un brazo",
          "Alteración del habla",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "acv_hora_inicio",
        "name": "Hora de inicio o de la última vez visto bien",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "acv_glasgow",
        "name": "Escala de Glasgow (3–15)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "trauma_mecanismo",
        "name": "Mecanismo de alta energía",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Politraumatismo"
        }
      },
      {
        "code": "trauma_lesiones",
        "name": "Lesiones",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Craneoencefálica",
          "Torácica",
          "Abdominal",
          "Pélvica",
          "Extremidades",
          "Columna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Politraumatismo"
        }
      },
      {
        "code": "dr_causa",
        "name": "Causa probable",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Asma o EPOC",
          "Neumonía",
          "Insuficiencia cardíaca",
          "Anafilaxia",
          "Embolia pulmonar"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dificultad respiratoria"
        }
      },
      {
        "code": "qsofa_emerg",
        "name": "qSOFA",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Frecuencia respiratoria ≥ 22",
          "Alteración del estado mental",
          "PAS ≤ 100 mmHg"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sepsis"
        }
      },
      {
        "code": "lactato",
        "name": "Lactato (mmol/L)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sepsis"
        }
      },
      {
        "code": "dengue_dias_de_fiebre",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue con signos de alarma"
        }
      },
      {
        "code": "dengue_signos_de_alarma",
        "name": "Signos de alarma (OPS/OMS)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor abdominal intenso y continuo",
          "Vómitos persistentes",
          "Acumulación de líquidos (ascitis, derrame)",
          "Sangrado de mucosas",
          "Letargia o irritabilidad",
          "Hepatomegalia mayor a 2 cm",
          "Aumento del hematocrito con caída de plaquetas",
          "Hipotensión postural",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue con signos de alarma"
        }
      },
      {
        "code": "dengue_torniquete",
        "name": "Prueba del torniquete",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue con signos de alarma"
        }
      },
      {
        "code": "dengue_grupo",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Grupo A — sin signos de alarma",
          "Grupo B — con signos de alarma o condición asociada",
          "Grupo C — dengue grave"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue con signos de alarma"
        }
      },
      {
        "code": "convulsion_tipo",
        "name": "Tipo de crisis",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Tónico-clónica generalizada",
          "Focal sin pérdida de conciencia",
          "Focal con alteración de conciencia",
          "Ausencia",
          "No definido"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Convulsión"
        }
      },
      {
        "code": "convulsion_duracion_minutos",
        "name": "Duración (minutos)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Convulsión"
        }
      },
      {
        "code": "convulsion_primera",
        "name": "Es la primera crisis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Convulsión"
        }
      },
      {
        "code": "convulsion_desencadenantes",
        "name": "Posibles desencadenantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fiebre",
          "Falta de sueño",
          "Alcohol",
          "Abandono de la medicación",
          "Ninguno conocido"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Convulsión"
        }
      },
      {
        "code": "intox_sustancia",
        "name": "Sustancia y cantidad",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Intoxicación"
        }
      },
      {
        "code": "intox_hora",
        "name": "Hora de exposición",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Intoxicación"
        }
      },
      {
        "code": "intox_via",
        "name": "Vía",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Oral",
          "Inhalatoria",
          "Cutánea",
          "Parenteral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Intoxicación"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y conducta"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y conducta",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      },
      {
        "code": "destino",
        "name": "Destino",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico y conducta",
        "options": [
          "Alta",
          "Observación",
          "Internación",
          "Terapia intensiva",
          "Referencia a otro establecimiento",
          "Quirófano"
        ],
        "multiple": false
      }
    ]
  },
  {
    "code": "ENDO_EVALUACION_BASE",
    "name": "Evaluación endocrinológica",
    "version": 2,
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico con registro antropométrico",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, examen físico con peso y talla, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis dirigida de síntomas tiroideos y de alteración de la glucemia (poliuria, polidipsia, polifagia), el registro del cambio de peso y del perímetro abdominal, y el examen de tiroides, piel y anexos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: categorías TI-RADS."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "antecedentes_metabolicos_familiares",
        "name": "Antecedentes metabólicos familiares (diabetes, tiroides, obesidad)",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "poliuria",
        "name": "Poliuria",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "polidipsia",
        "name": "Polidipsia",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "polifagia",
        "name": "Polifagia",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "tendencia_de_peso",
        "name": "Cambio de peso",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Estable",
          "Aumentó",
          "Bajó"
        ],
        "multiple": false
      },
      {
        "code": "cambio_de_peso",
        "name": "¿Cuántos kg y en cuánto tiempo?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "tendencia_de_peso",
          "equals": [
            "Aumentó",
            "Bajó"
          ]
        }
      },
      {
        "code": "sintomas_tiroideos_marcados",
        "name": "Síntomas tiroideos",
        "dataType": "json",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Intolerancia al frío",
          "Intolerancia al calor",
          "Palpitaciones",
          "Temblor",
          "Constipación",
          "Caída de cabello",
          "Bocio referido",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sintomas_tiroideos",
        "name": "Síntomas tiroideos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "talla",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "perimetro_abdominal",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "bocio_oms",
        "name": "Bocio (clasificación OMS)",
        "dataType": "string",
        "required": false,
        "section": "Examen físico",
        "options": [
          "Grado 0 — no palpable",
          "Grado 1 — palpable, no visible",
          "Grado 2 — visible con el cuello en posición normal"
        ],
        "multiple": false
      },
      {
        "code": "examen_de_tiroides",
        "name": "Examen de tiroides — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "signos_cutaneos",
        "name": "Piel",
        "dataType": "json",
        "required": false,
        "section": "Examen físico",
        "options": [
          "Acantosis nigricans",
          "Estrías violáceas",
          "Hirsutismo",
          "Mixedema",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "piel_y_anexos",
        "name": "Piel y anexos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Diabetes mellitus",
          "Hipotiroidismo",
          "Hipertiroidismo",
          "Nódulo tiroideo",
          "Obesidad y síndrome metabólico",
          "Dislipidemia"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus"
        }
      },
      {
        "code": "tsh",
        "name": "TSH (mUI/L)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipotiroidismo"
        }
      },
      {
        "code": "t4l",
        "name": "T4 libre (ng/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipotiroidismo"
        }
      },
      {
        "code": "tsh_hiper",
        "name": "TSH (mUI/L)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertiroidismo"
        }
      },
      {
        "code": "oftalmopatia",
        "name": "Oftalmopatía",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertiroidismo"
        }
      },
      {
        "code": "nodulo_tirads",
        "name": "Ecografía — categoría TI-RADS",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Nódulo tiroideo"
        }
      },
      {
        "code": "nodulo_puncion",
        "name": "Punción con aguja fina indicada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Nódulo tiroideo"
        }
      },
      {
        "code": "sm_criterios",
        "name": "Criterios de síndrome metabólico",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Perímetro abdominal aumentado",
          "Triglicéridos ≥ 150 mg/dL",
          "HDL bajo",
          "PA ≥ 130/85",
          "Glucemia en ayunas ≥ 100 mg/dL"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Obesidad y síndrome metabólico"
        }
      },
      {
        "code": "ldl_endo",
        "name": "LDL (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dislipidemia"
        }
      },
      {
        "code": "trigliceridos",
        "name": "Triglicéridos (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dislipidemia"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "ENFER_VALORACION_BASE",
    "name": "Valoración de enfermería",
    "version": 2,
    "specialty": "ENFERMERIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro de funciones vitales y notas de enfermería",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se toman la estructura común (motivo de la valoración, antecedentes, examen, diagnóstico y conducta) y el registro de funciones vitales de la nota de enfermería. Son agregados propios de la especialidad el dolor referido en escala de 0 a 10, el estado de la piel, la presencia de accesos vasculares, la descripción en prosa del riesgo de caídas, el grado de autonomía, las necesidades identificadas y las intervenciones realizadas. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de atención",
        "dataType": "text",
        "required": true,
        "section": "Motivo"
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false,
        "section": "Motivo"
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Motivo",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias_referidas",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Motivo",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo"
      },
      {
        "code": "medicacion_actual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Motivo",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg, sistólica/diastólica)",
        "dataType": "string",
        "required": true,
        "section": "Signos vitales",
        "description": "Por ejemplo: 120/80."
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "temperatura_c",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "dolor_intensidad_referida",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "conciencia",
        "name": "Estado de conciencia",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "Alerta",
          "Somnoliento",
          "Confuso",
          "Estupor",
          "Coma"
        ],
        "multiple": false
      },
      {
        "code": "estado_de_conciencia",
        "name": "Conciencia — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración"
      },
      {
        "code": "piel_integridad",
        "name": "Integridad de la piel",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "Íntegra",
          "Lesión por presión",
          "Herida",
          "Quemadura"
        ],
        "multiple": false
      },
      {
        "code": "upp_estadio",
        "name": "Estadio (si es lesión por presión)",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "No aplica",
          "Estadio 1",
          "Estadio 2",
          "Estadio 3",
          "Estadio 4",
          "No estadificable"
        ],
        "multiple": false,
        "showWhen": {
          "field": "piel_integridad",
          "equals": [
            "Lesión por presión",
            "Herida",
            "Quemadura"
          ]
        }
      },
      {
        "code": "estado_de_la_piel",
        "name": "Localización y descripción",
        "dataType": "text",
        "required": true,
        "section": "Valoración",
        "showWhen": {
          "field": "piel_integridad",
          "equals": [
            "Lesión por presión",
            "Herida",
            "Quemadura"
          ]
        }
      },
      {
        "code": "riesgo_lesion_presion",
        "name": "Riesgo de lesión por presión (escala del establecimiento)",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "Sin riesgo",
          "Bajo",
          "Moderado",
          "Alto"
        ],
        "multiple": false
      },
      {
        "code": "accesos_vasculares",
        "name": "Accesos vasculares o dispositivos",
        "dataType": "boolean",
        "required": false,
        "section": "Valoración"
      },
      {
        "code": "dispositivos",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Valoración",
        "options": [
          "Vía periférica",
          "Catéter central",
          "Sonda vesical",
          "Sonda nasogástrica",
          "Drenaje",
          "Ostomía"
        ],
        "multiple": true,
        "showWhen": {
          "field": "accesos_vasculares",
          "equals": true
        }
      },
      {
        "code": "dispositivos_fecha",
        "name": "Fecha de colocación",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "showWhen": {
          "field": "accesos_vasculares",
          "equals": true
        }
      },
      {
        "code": "riesgo_caidas_nivel",
        "name": "Riesgo de caídas (escala del establecimiento)",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "Bajo",
          "Medio",
          "Alto"
        ],
        "multiple": false
      },
      {
        "code": "riesgo_de_caidas",
        "name": "Riesgo de caídas — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración"
      },
      {
        "code": "autonomia_nivel",
        "name": "Autonomía",
        "dataType": "string",
        "required": false,
        "section": "Valoración",
        "options": [
          "Independiente",
          "Ayuda parcial",
          "Dependiente"
        ],
        "multiple": false
      },
      {
        "code": "autonomia",
        "name": "Autonomía — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración"
      },
      {
        "code": "necesidades_identificadas",
        "name": "Necesidades identificadas (Henderson)",
        "dataType": "text",
        "required": false,
        "section": "Valoración"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico de enfermería (NANDA)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico enfermero y plan"
      },
      {
        "code": "conducta",
        "name": "Intervenciones y evaluación",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico enfermero y plan"
      }
    ]
  },
  {
    "code": "FISIO_EVALUACION_BASE",
    "name": "Evaluación kinesiológica",
    "version": 2,
    "specialty": "FISIOTERAPIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico regional y plan de trabajo",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común: motivo de consulta, tiempo de evolución, antecedentes, examen físico dirigido a la región afectada, diagnóstico y conducta. Son agregados propios de la especialidad la intensidad de dolor referida por el paciente en escala de 0 a 10, la zona afectada, la descripción en prosa del rango de movimiento, la fuerza muscular, la marcha, la limitación funcional y los objetivos de rehabilitación. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de disnea mMRC, índice de Barthel, escala de fuerza MRC."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "zona_afectada",
        "name": "Zona afectada",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "mecanismo_de_lesion",
        "name": "Mecanismo de lesión",
        "dataType": "text",
        "required": false,
        "section": "Motivo de consulta"
      },
      {
        "code": "derivado_por_medico",
        "name": "Viene derivado por un médico",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo de consulta"
      },
      {
        "code": "diagnostico_medico",
        "name": "Diagnóstico médico de derivación",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "showWhen": {
          "field": "derivado_por_medico",
          "equals": true
        }
      },
      {
        "code": "dolor_intensidad_referida",
        "name": "Intensidad del dolor (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Dolor"
      },
      {
        "code": "dolor_caracter_fisio",
        "name": "Carácter",
        "dataType": "string",
        "required": false,
        "section": "Dolor",
        "options": [
          "Mecánico",
          "Inflamatorio",
          "Neuropático",
          "Mixto"
        ],
        "multiple": false
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Dolor — detalle",
        "dataType": "text",
        "required": false,
        "section": "Dolor"
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false,
        "section": "Dolor"
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false,
        "section": "Dolor"
      },
      {
        "code": "inspeccion_y_palpacion",
        "name": "Inspección y palpación",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "rango_de_movimiento",
        "name": "Rango de movimiento (goniometría)",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "fuerza_mrc_fisio",
        "name": "Fuerza (MRC, peor segmento)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación",
        "options": [
          "5",
          "4",
          "3",
          "2",
          "1",
          "0"
        ],
        "multiple": false
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular — detalle",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "marcha",
        "name": "Marcha",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "postura_y_equilibrio",
        "name": "Postura y equilibrio",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "limitacion_funcional",
        "name": "Limitación funcional",
        "dataType": "text",
        "required": false,
        "section": "Evaluación"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Lumbalgia",
          "Cervicalgia",
          "Posquirúrgico o posfractura",
          "Secuela neurológica (ACV, lesión medular)",
          "Lesión deportiva",
          "Rehabilitación respiratoria"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "lumbalgia_banderas_rojas",
        "name": "Banderas rojas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Edad menor a 20 o mayor a 55 años",
          "Traumatismo importante",
          "Fiebre",
          "Pérdida de peso no explicada",
          "Antecedente de cáncer",
          "Déficit neurológico progresivo",
          "Alteración de esfínteres o anestesia en silla de montar",
          "Ninguna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "lumbalgia_ciatica",
        "name": "Dolor irradiado por debajo de la rodilla",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "lumbalgia_lasegue",
        "name": "Signo de Lasègue",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positivo",
          "Negativo",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "cervical_irradiada",
        "name": "Irradiada al brazo",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cervicalgia"
        }
      },
      {
        "code": "cervical_mareo",
        "name": "Mareo o cefalea asociada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cervicalgia"
        }
      },
      {
        "code": "posqx_cirugia",
        "name": "Cirugía o fractura y fecha",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Posquirúrgico o posfractura"
        }
      },
      {
        "code": "posqx_carga",
        "name": "Carga permitida",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin carga",
          "Parcial",
          "Total"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Posquirúrgico o posfractura"
        }
      },
      {
        "code": "barthel",
        "name": "Barthel",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Independiente (100)",
          "Dependencia leve (91–99)",
          "Moderada (61–90)",
          "Grave (21–60)",
          "Total (0–20)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Secuela neurológica (ACV, lesión medular)"
        }
      },
      {
        "code": "deporte_lesion",
        "name": "Deporte y gesto lesivo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión deportiva"
        }
      },
      {
        "code": "disnea_mmrc_fisio",
        "name": "mMRC",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "0",
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Rehabilitación respiratoria"
        }
      },
      {
        "code": "caminata_6min",
        "name": "Prueba de caminata de 6 minutos (m)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Rehabilitación respiratoria"
        }
      },
      {
        "code": "objetivos_de_rehabilitacion",
        "name": "Objetivos de rehabilitación",
        "dataType": "text",
        "required": false,
        "section": "Plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico kinésico",
        "dataType": "text",
        "required": true,
        "section": "Plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento (sesiones, técnicas)",
        "dataType": "text",
        "required": false,
        "section": "Plan"
      }
    ]
  },
  {
    "code": "GASTRO_EVALUACION_BASE",
    "name": "Evaluación gastroenterológica",
    "version": 2,
    "specialty": "GASTROENTEROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, funciones biológicas y examen del abdomen",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta y el apartado de funciones biológicas y examen del abdomen: motivo, tiempo de evolución, antecedentes, examen, diagnóstico y conducta. Son agregados propios de la especialidad el desglose de las características del dolor abdominal, el hábito intestinal, los signos de hemorragia digestiva y el examen del abdomen separado en inspección, auscultación, palpación y tacto rectal. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), escala de Bristol."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "dolor_abdominal",
        "name": "Dolor abdominal",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "dolor_abdominal_localizacion",
        "name": "Dolor — ¿dónde se localiza?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Síntomas digestivos",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Síntomas digestivos",
        "options": [
          "Opresivo",
          "Punzante",
          "Urente (ardor)",
          "Cólico",
          "Pulsátil",
          "Sordo",
          "Lancinante",
          "Eléctrico o en descarga"
        ],
        "multiple": false,
        "allowOther": true,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "dolor_abdominal_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas digestivos",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Síntomas digestivos",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_abdominal_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Dolor — otras observaciones",
        "dataType": "text",
        "required": false,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "bristol",
        "name": "Forma de las heces (escala de Bristol)",
        "dataType": "string",
        "required": false,
        "section": "Síntomas digestivos",
        "options": [
          "Tipo 1 — bolitas duras",
          "Tipo 2 — salchicha grumosa",
          "Tipo 3 — salchicha con grietas",
          "Tipo 4 — salchicha lisa",
          "Tipo 5 — trozos blandos",
          "Tipo 6 — pastosa",
          "Tipo 7 — líquida"
        ],
        "multiple": false
      },
      {
        "code": "deposiciones_por_dia",
        "name": "Deposiciones por día",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "habito_intestinal",
        "name": "Hábito intestinal — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "nauseas_o_vomitos",
        "name": "Náuseas o vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "pirosis_o_reflujo",
        "name": "Pirosis o reflujo",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "hubo_hemorragia",
        "name": "Hemorragia digestiva",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "hemorragia_tipo",
        "name": "¿Cómo se manifestó?",
        "dataType": "json",
        "required": true,
        "section": "Síntomas digestivos",
        "options": [
          "Hematemesis",
          "Melena",
          "Hematoquecia",
          "Sangre oculta en heces"
        ],
        "multiple": true,
        "showWhen": {
          "field": "hubo_hemorragia",
          "equals": true
        }
      },
      {
        "code": "hemorragia_digestiva",
        "name": "Hemorragia — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas digestivos",
        "showWhen": {
          "field": "hubo_hemorragia",
          "equals": true
        }
      },
      {
        "code": "ictericia",
        "name": "Ictericia",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas digestivos"
      },
      {
        "code": "ictericia_acompanantes",
        "name": "Acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Síntomas digestivos",
        "options": [
          "Coluria",
          "Acolia",
          "Prurito",
          "Fiebre",
          "Dolor en hipocondrio derecho"
        ],
        "multiple": true,
        "showWhen": {
          "field": "ictericia",
          "equals": true
        }
      },
      {
        "code": "signos_de_alarma_digestivos",
        "name": "Signos de alarma",
        "dataType": "json",
        "required": true,
        "section": "Síntomas digestivos",
        "options": [
          "Pérdida de peso",
          "Disfagia",
          "Anemia",
          "Vómitos persistentes",
          "Masa palpable",
          "Edad > 50 con síntomas nuevos",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "antecedentes_digestivos",
        "name": "Antecedentes digestivos",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "inspeccion_del_abdomen",
        "name": "Inspección",
        "dataType": "text",
        "required": false,
        "section": "Examen del abdomen"
      },
      {
        "code": "auscultacion_del_abdomen",
        "name": "Auscultación",
        "dataType": "text",
        "required": false,
        "section": "Examen del abdomen"
      },
      {
        "code": "palpacion_del_abdomen",
        "name": "Palpación",
        "dataType": "text",
        "required": true,
        "section": "Examen del abdomen"
      },
      {
        "code": "tacto_rectal",
        "name": "Tacto rectal",
        "dataType": "text",
        "required": false,
        "section": "Examen del abdomen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dispepsia o gastritis",
          "Enfermedad por reflujo gastroesofágico",
          "Enfermedad diarreica",
          "Síndrome de intestino irritable",
          "Hemorragia digestiva",
          "Hepatopatía o ictericia",
          "Colelitiasis o colecistitis"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "helicobacter",
        "name": "Prueba de Helicobacter pylori realizada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dispepsia o gastritis"
        }
      },
      {
        "code": "aines",
        "name": "Consume AINE",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dispepsia o gastritis"
        }
      },
      {
        "code": "erge_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Pirosis",
          "Regurgitación",
          "Tos crónica",
          "Disfonía",
          "Dolor torácico no cardíaco"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad por reflujo gastroesofágico"
        }
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica"
        }
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica"
        }
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica"
        }
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica"
        }
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica"
        }
      },
      {
        "code": "sii_caracteristicas",
        "name": "Dolor abdominal recurrente: características",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Mejora o empeora con la defecación",
          "Se asocia a cambio en la frecuencia",
          "Se asocia a cambio en la forma de las heces"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome de intestino irritable"
        }
      },
      {
        "code": "sii_meses",
        "name": "Meses de evolución",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome de intestino irritable"
        }
      },
      {
        "code": "hd_estabilidad",
        "name": "Estabilidad hemodinámica",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Estable",
          "Taquicardia",
          "Hipotensión o shock"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hemorragia digestiva"
        }
      },
      {
        "code": "hd_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hemorragia digestiva"
        }
      },
      {
        "code": "hep_estigmas",
        "name": "Estigmas de hepatopatía",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Arañas vasculares",
          "Eritema palmar",
          "Ascitis",
          "Encefalopatía",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hepatopatía o ictericia"
        }
      },
      {
        "code": "hep_serologias",
        "name": "Serologías virales",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hepatopatía o ictericia"
        }
      },
      {
        "code": "murphy",
        "name": "Signo de Murphy positivo",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Colelitiasis o colecistitis"
        }
      },
      {
        "code": "colico_posprandial",
        "name": "Dolor posprandial en hipocondrio derecho",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Colelitiasis o colecistitis"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "GERIA_VALORACION_BASE",
    "name": "Valoración geriátrica",
    "version": 2,
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen del adulto mayor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la autonomía en actividades de la vida diaria, el antecedente de caídas, el recuento de fármacos en uso, la descripción en prosa del estado cognitivo y del ánimo, la continencia y el soporte social. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: SRQ-20 (OMS), índice de Katz, escala de Lawton, fenotipo de fragilidad de Fried, criterios de Beers/STOPP."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias_detalle",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "katz_dependiente",
        "name": "Actividades básicas en las que necesita ayuda (Katz)",
        "dataType": "json",
        "required": false,
        "section": "Valoración funcional",
        "options": [
          "Bañarse",
          "Vestirse",
          "Usar el baño",
          "Movilizarse",
          "Continencia",
          "Alimentarse",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "autonomia_actividades_basicas",
        "name": "Actividades básicas — detalle",
        "dataType": "text",
        "required": true,
        "section": "Valoración funcional"
      },
      {
        "code": "lawton_dependiente",
        "name": "Actividades instrumentales en las que necesita ayuda (Lawton)",
        "dataType": "json",
        "required": false,
        "section": "Valoración funcional",
        "options": [
          "Usar el teléfono",
          "Hacer compras",
          "Preparar la comida",
          "Tareas de la casa",
          "Lavar la ropa",
          "Usar transporte",
          "Manejar su medicación",
          "Manejar su dinero",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "autonomia_actividades_instrumentales",
        "name": "Actividades instrumentales — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración funcional"
      },
      {
        "code": "velocidad_de_marcha",
        "name": "Velocidad de marcha en 4 m (m/s)",
        "dataType": "decimal",
        "required": false,
        "section": "Valoración funcional",
        "description": "Menos de 0,8 m/s: riesgo de fragilidad."
      },
      {
        "code": "marcha_y_equilibrio",
        "name": "Marcha y equilibrio",
        "dataType": "text",
        "required": false,
        "section": "Valoración funcional"
      },
      {
        "code": "caidas_en_el_ultimo_ano",
        "name": "Caídas en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Valoración funcional"
      },
      {
        "code": "numero_de_farmacos_en_uso",
        "name": "Número de fármacos en uso",
        "dataType": "integer",
        "required": false,
        "section": "Fármacos"
      },
      {
        "code": "farmacos_en_uso",
        "name": "Fármacos en uso",
        "dataType": "text",
        "required": false,
        "section": "Fármacos"
      },
      {
        "code": "farmacos_inapropiados",
        "name": "Algún fármaco potencialmente inapropiado (Beers/STOPP)",
        "dataType": "boolean",
        "required": false,
        "section": "Fármacos"
      },
      {
        "code": "farmacos_inapropiados_cuales",
        "name": "¿Cuál?",
        "dataType": "string",
        "required": true,
        "section": "Fármacos",
        "showWhen": {
          "field": "farmacos_inapropiados",
          "equals": true
        }
      },
      {
        "code": "prueba_cognitiva",
        "name": "Prueba cognitiva aplicada y puntaje",
        "dataType": "string",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "estado_cognitivo",
        "name": "Estado cognitivo — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "animo_bajo",
        "name": "Ánimo bajo o pérdida de interés en el último mes",
        "dataType": "boolean",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "estado_de_animo",
        "name": "Estado de ánimo — detalle",
        "dataType": "text",
        "required": true,
        "section": "Valoración mental y social",
        "showWhen": {
          "field": "animo_bajo",
          "equals": true
        }
      },
      {
        "code": "incontinencia",
        "name": "Incontinencia",
        "dataType": "json",
        "required": false,
        "section": "Valoración mental y social",
        "options": [
          "Urinaria de esfuerzo",
          "Urinaria de urgencia",
          "Fecal",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "continencia",
        "name": "Continencia — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "perdida_de_peso",
        "name": "Pérdida de peso no intencionada",
        "dataType": "boolean",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "perdida_de_peso_kg_geria",
        "name": "¿Cuántos kg en los últimos 6 meses?",
        "dataType": "decimal",
        "required": true,
        "section": "Valoración mental y social",
        "showWhen": {
          "field": "perdida_de_peso",
          "equals": true
        }
      },
      {
        "code": "alimentacion_y_peso",
        "name": "Alimentación y peso",
        "dataType": "text",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "deficit_sensorial",
        "name": "Déficit sensorial",
        "dataType": "json",
        "required": false,
        "section": "Valoración mental y social",
        "options": [
          "Visual",
          "Auditivo",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "vision_y_audicion",
        "name": "Visión y audición — detalle",
        "dataType": "text",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "vive",
        "name": "Con quién vive",
        "dataType": "string",
        "required": false,
        "section": "Valoración mental y social",
        "options": [
          "Solo",
          "Con pareja",
          "Con hijos o familiares",
          "En un hogar o residencia"
        ],
        "multiple": false
      },
      {
        "code": "soporte_social",
        "name": "Soporte social",
        "dataType": "text",
        "required": false,
        "section": "Valoración mental y social"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Síndrome de fragilidad",
          "Caídas",
          "Deterioro cognitivo o demencia",
          "Delirium",
          "Polifarmacia",
          "Depresión del adulto mayor"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "fried",
        "name": "Criterios de Fried",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Pérdida de peso no intencionada",
          "Agotamiento",
          "Debilidad (prensión)",
          "Marcha lenta",
          "Baja actividad física"
        ],
        "multiple": true,
        "description": "3 o más: frágil · 1–2: prefrágil.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome de fragilidad"
        }
      },
      {
        "code": "caidas_riesgo",
        "name": "Factores de riesgo",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Alteración de la marcha",
          "Hipotensión ortostática",
          "Psicofármacos",
          "Déficit visual",
          "Riesgos en el hogar"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Caídas"
        }
      },
      {
        "code": "caidas_fractura",
        "name": "Fractura en alguna caída",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Caídas"
        }
      },
      {
        "code": "demencia_prueba",
        "name": "Prueba y puntaje",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Deterioro cognitivo o demencia"
        }
      },
      {
        "code": "demencia_conducta",
        "name": "Síntomas conductuales",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Deterioro cognitivo o demencia"
        }
      },
      {
        "code": "delirium_rasgos",
        "name": "Rasgos de delirium",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Inicio agudo y curso fluctuante",
          "Inatención",
          "Pensamiento desorganizado",
          "Alteración del nivel de conciencia"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Delirium"
        }
      },
      {
        "code": "polifarmacia_revision",
        "name": "Fármacos a suspender o ajustar",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Polifarmacia"
        }
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): marque las preguntas que respondió «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "¿Tiene frecuentes dolores de cabeza?",
          "¿Tiene mal apetito?",
          "¿Duerme mal?",
          "¿Se asusta con facilidad?",
          "¿Sufre de temblor de manos?",
          "¿Se siente nervioso, tenso o aburrido?",
          "¿Sufre de mala digestión?",
          "¿No puede pensar con claridad?",
          "¿Se siente triste?",
          "¿Llora usted con mucha frecuencia?",
          "¿Tiene dificultad en disfrutar sus actividades diarias?",
          "¿Tiene dificultad para tomar decisiones?",
          "¿Tiene dificultad en hacer su trabajo?",
          "¿Es incapaz de desempeñar un papel útil en su vida?",
          "¿Ha perdido interés en las cosas?",
          "¿Siente que usted es una persona inútil?",
          "¿Ha tenido la idea de acabar con su vida?",
          "¿Se siente cansado todo el tiempo?",
          "¿Tiene sensaciones desagradables en su estómago?",
          "¿Se cansa con facilidad?"
        ],
        "multiple": true,
        "description": "8 o más respuestas positivas: probable trastorno mental común. La pregunta 17 positiva exige evaluar riesgo suicida.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Depresión del adulto mayor"
        }
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total de respuestas «sí» (0–20)",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Depresión del adulto mayor"
        }
      },
      {
        "code": "ideacion_suicida",
        "name": "Ideación suicida actual",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Depresión del adulto mayor"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "GINOBS_CONTROL_PRENATAL",
    "name": "Control prenatal — Historia Clínica Perinatal (CLAP/SMR)",
    "version": 2,
    "specialty": "GINECOLOGIA_OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Historia Clínica Perinatal — Sistema Informático Perinatal (SIP)",
      "organization": "Centro Latinoamericano de Perinatología, Salud de la Mujer y Reproductiva (CLAP/SMR) — OPS/OMS",
      "url": "https://iris.paho.org/handle/10665.2/17048",
      "license": "Publicación OPS/OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "Historia clínica perinatal simplificada",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la sección de control prenatal. El formulario completo cubre además parto, puerperio y recién nacido. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "fecha_ultima_menstruacion",
        "name": "Fecha de última menstruación",
        "dataType": "date",
        "required": true,
        "section": "Embarazo actual"
      },
      {
        "code": "fecha_probable_de_parto",
        "name": "Fecha probable de parto",
        "dataType": "date",
        "required": false,
        "section": "Embarazo actual"
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true,
        "section": "Embarazo actual"
      },
      {
        "code": "embarazo_planificado",
        "name": "Embarazo planificado",
        "dataType": "boolean",
        "required": false,
        "section": "Embarazo actual"
      },
      {
        "code": "gestas_previas",
        "name": "Gestas previas",
        "dataType": "integer",
        "required": true,
        "section": "Antecedentes obstétricos"
      },
      {
        "code": "partos_previos",
        "name": "Partos vaginales",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes obstétricos"
      },
      {
        "code": "cesareas_previas",
        "name": "Cesáreas",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes obstétricos"
      },
      {
        "code": "abortos_previos",
        "name": "Abortos",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes obstétricos"
      },
      {
        "code": "antecedentes_obstetricos_riesgo",
        "name": "Antecedentes de riesgo",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes obstétricos",
        "options": [
          "Preeclampsia",
          "Diabetes gestacional",
          "Hemorragia posparto",
          "Parto prematuro",
          "Muerte fetal",
          "Ninguno"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "altura_uterina_cm",
        "name": "Altura uterina (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presentacion_fetal",
        "name": "Presentación fetal",
        "dataType": "string",
        "required": false,
        "section": "Examen",
        "options": [
          "Cefálica",
          "Podálica",
          "Transversa",
          "No evaluable"
        ],
        "multiple": false
      },
      {
        "code": "frecuencia_cardiaca_fetal",
        "name": "Frecuencia cardíaca fetal (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "movimientos_fetales",
        "name": "Movimientos fetales",
        "dataType": "boolean",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "edema",
        "name": "Edema",
        "dataType": "boolean",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "edema_localizacion_hcp",
        "name": "Localización",
        "dataType": "string",
        "required": true,
        "section": "Examen",
        "options": [
          "Miembros inferiores",
          "Manos y cara",
          "Generalizado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "edema",
          "equals": true
        }
      },
      {
        "code": "proteinuria",
        "name": "Proteinuria (tira)",
        "dataType": "string",
        "required": false,
        "section": "Examen",
        "options": [
          "Negativa",
          "Trazas",
          "+",
          "++",
          "+++"
        ],
        "multiple": false
      },
      {
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Laboratorio y prevención"
      },
      {
        "code": "tamizajes",
        "name": "Tamizajes realizados",
        "dataType": "json",
        "required": false,
        "section": "Laboratorio y prevención",
        "options": [
          "VIH",
          "Sífilis",
          "Hepatitis B",
          "Chagas",
          "Glucemia",
          "Grupo y factor Rh",
          "Urocultivo"
        ],
        "multiple": true
      },
      {
        "code": "tamizaje_positivo",
        "name": "Algún tamizaje positivo",
        "dataType": "boolean",
        "required": false,
        "section": "Laboratorio y prevención"
      },
      {
        "code": "tamizaje_positivo_detalle",
        "name": "¿Cuál y qué conducta?",
        "dataType": "text",
        "required": true,
        "section": "Laboratorio y prevención",
        "showWhen": {
          "field": "tamizaje_positivo",
          "equals": true
        }
      },
      {
        "code": "vacuna_antitetanica",
        "name": "Vacuna dT",
        "dataType": "boolean",
        "required": false,
        "section": "Laboratorio y prevención"
      },
      {
        "code": "suplemento_hierro_folatos",
        "name": "Hierro y ácido fólico",
        "dataType": "boolean",
        "required": false,
        "section": "Laboratorio y prevención"
      },
      {
        "code": "signos_de_alarma_obstetricos",
        "name": "Signos de alarma referidos",
        "dataType": "json",
        "required": true,
        "section": "Signos de alarma",
        "options": [
          "Sangrado vaginal",
          "Pérdida de líquido",
          "Cefalea intensa o visión borrosa",
          "Dolor en epigastrio",
          "Disminución de movimientos fetales",
          "Contracciones antes de las 37 semanas",
          "Fiebre",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "preeclampsia_sospecha",
        "name": "PA ≥ 140/90 con estos síntomas (sospecha de preeclampsia)",
        "dataType": "boolean",
        "required": true,
        "section": "Signos de alarma",
        "showWhen": {
          "field": "signos_de_alarma_obstetricos",
          "equals": [
            "Cefalea intensa o visión borrosa",
            "Dolor en epigastrio"
          ]
        }
      },
      {
        "code": "riesgo_detectado",
        "name": "Riesgo detectado",
        "dataType": "text",
        "required": false,
        "section": "Signos de alarma"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Signos de alarma"
      }
    ]
  },
  {
    "code": "HEMATO_EVALUACION_BASE",
    "name": "Evaluación hematológica",
    "version": 2,
    "specialty": "HEMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, medicación, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad los ítems del síndrome anémico, los sangrados, las adenopatías con su localización, la esplenomegalia y las transfusiones previas. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "astenia",
        "name": "Astenia",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "palidez",
        "name": "Palidez",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "fiebre_dias_hemato",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "tuvo_sangrados",
        "name": "Sangrados",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "sangrado_tipo",
        "name": "¿Dónde?",
        "dataType": "json",
        "required": true,
        "section": "Síntomas",
        "options": [
          "Encías",
          "Epistaxis",
          "Equimosis fáciles",
          "Petequias",
          "Menstruación abundante",
          "Digestivo",
          "Urinario"
        ],
        "multiple": true,
        "showWhen": {
          "field": "tuvo_sangrados",
          "equals": true
        }
      },
      {
        "code": "sangrados",
        "name": "Sangrados — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "tuvo_sangrados",
          "equals": true
        }
      },
      {
        "code": "transfusiones_previas",
        "name": "Transfusiones previas",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "detalle_de_transfusiones_previas",
        "name": "¿Cuántas, cuándo y hubo reacción?",
        "dataType": "text",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "transfusiones_previas",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "medicacion_actual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "antecedentes_familiares_hematologicos",
        "name": "Antecedentes familiares hematológicos",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "adenopatias",
        "name": "Adenopatías",
        "dataType": "boolean",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "localizacion_de_las_adenopatias",
        "name": "¿Dónde y de qué tamaño?",
        "dataType": "string",
        "required": true,
        "section": "Examen físico",
        "showWhen": {
          "field": "adenopatias",
          "equals": true
        }
      },
      {
        "code": "esplenomegalia",
        "name": "Esplenomegalia",
        "dataType": "boolean",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "hepatomegalia",
        "name": "Hepatomegalia",
        "dataType": "boolean",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "estudios_de_laboratorio_recientes",
        "name": "Laboratorio reciente (hemograma, frotis)",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Anemia ferropénica",
          "Anemia megaloblástica",
          "Trombocitopenia",
          "Trastorno de la coagulación",
          "Sospecha de leucemia o linfoma",
          "Policitemia"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "anemia_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "Ajustar por altitud de residencia.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia ferropénica"
        }
      },
      {
        "code": "anemia_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Astenia",
          "Disnea de esfuerzo",
          "Palpitaciones",
          "Pica",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia ferropénica"
        }
      },
      {
        "code": "anemia_perdidas",
        "name": "Posibles pérdidas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Menstruación abundante",
          "Sangrado digestivo",
          "Parasitosis",
          "Ninguna conocida"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia ferropénica"
        }
      },
      {
        "code": "anemia_vcm",
        "name": "VCM y ferritina, si se conocen",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia ferropénica"
        }
      },
      {
        "code": "vcm_mega",
        "name": "VCM (fL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia megaloblástica"
        }
      },
      {
        "code": "b12",
        "name": "Vitamina B12 (pg/mL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia megaloblástica"
        }
      },
      {
        "code": "mega_neuro",
        "name": "Síntomas neurológicos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia megaloblástica"
        }
      },
      {
        "code": "plaquetas",
        "name": "Plaquetas (/µL)",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trombocitopenia"
        }
      },
      {
        "code": "trombo_sangrado_activo",
        "name": "Sangrado activo",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trombocitopenia"
        }
      },
      {
        "code": "tp_inr",
        "name": "TP / INR",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno de la coagulación"
        }
      },
      {
        "code": "ttpa",
        "name": "TTPa",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno de la coagulación"
        }
      },
      {
        "code": "anticoagulado",
        "name": "Recibe anticoagulantes",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno de la coagulación"
        }
      },
      {
        "code": "sintomas_b",
        "name": "Síntomas B",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fiebre",
          "Sudoración nocturna",
          "Pérdida de más del 10 % del peso"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de leucemia o linfoma"
        }
      },
      {
        "code": "blastos",
        "name": "Blastos en el frotis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de leucemia o linfoma"
        }
      },
      {
        "code": "hematocrito",
        "name": "Hematocrito (%)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "Interpretar según la altitud de residencia.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Policitemia"
        }
      },
      {
        "code": "residencia_altitud",
        "name": "Altitud de residencia (m s. n. m.)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Policitemia"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "INFECTO_EVALUACION_BASE",
    "name": "Evaluación infectológica",
    "version": 2,
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes epidemiológicos y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes epidemiológicos, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la descripción del patrón febril, el foco clínico probable, los antecedentes de viajes y exposiciones, el estado de vacunación y los tratamientos antimicrobianos previos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: guía de dengue OPS/OMS 2016, qSOFA (Sepsis-3)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Fiebre y foco"
      },
      {
        "code": "dias_de_fiebre",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Fiebre y foco",
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "patron_febril_tipo",
        "name": "Patrón",
        "dataType": "string",
        "required": false,
        "section": "Fiebre y foco",
        "options": [
          "Continua",
          "Intermitente",
          "Recurrente",
          "Vespertina"
        ],
        "multiple": false,
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "patron_febril",
        "name": "Patrón febril — detalle",
        "dataType": "text",
        "required": false,
        "section": "Fiebre y foco",
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Fiebre y foco"
      },
      {
        "code": "sintomas_acompanantes",
        "name": "Síntomas acompañantes",
        "dataType": "text",
        "required": false,
        "section": "Fiebre y foco"
      },
      {
        "code": "foco_probable",
        "name": "Foco clínico probable",
        "dataType": "string",
        "required": false,
        "section": "Fiebre y foco",
        "options": [
          "Respiratorio",
          "Urinario",
          "Digestivo",
          "Piel y partes blandas",
          "Sistema nervioso",
          "Sin foco aparente"
        ],
        "multiple": false
      },
      {
        "code": "foco_clinico_probable",
        "name": "Foco — detalle",
        "dataType": "text",
        "required": false,
        "section": "Fiebre y foco"
      },
      {
        "code": "viajo",
        "name": "Viajó en las últimas 4 semanas",
        "dataType": "boolean",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "viajes_recientes",
        "name": "¿A dónde y cuándo?",
        "dataType": "text",
        "required": true,
        "section": "Epidemiología",
        "showWhen": {
          "field": "viajo",
          "equals": true
        }
      },
      {
        "code": "exposiciones_marcadas",
        "name": "Exposiciones",
        "dataType": "json",
        "required": false,
        "section": "Epidemiología",
        "options": [
          "Zona de dengue, zika o chikungunya",
          "Zona de malaria",
          "Zona de leishmaniasis",
          "Agua o barro (leptospirosis)",
          "Animales o roedores",
          "Relaciones sexuales sin protección",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "exposiciones_de_riesgo",
        "name": "Exposiciones — detalle",
        "dataType": "text",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "contacto_con_caso_similar",
        "name": "Contacto con un caso similar",
        "dataType": "boolean",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "contacto_quien",
        "name": "¿Quién y con qué diagnóstico?",
        "dataType": "string",
        "required": true,
        "section": "Epidemiología",
        "showWhen": {
          "field": "contacto_con_caso_similar",
          "equals": true
        }
      },
      {
        "code": "estado_de_vacunacion",
        "name": "Estado de vacunación",
        "dataType": "text",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "uso_antimicrobianos",
        "name": "Recibió antibióticos o antiparasitarios",
        "dataType": "boolean",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "antimicrobianos_previos",
        "name": "¿Cuál, dosis y días?",
        "dataType": "text",
        "required": true,
        "section": "Epidemiología",
        "showWhen": {
          "field": "uso_antimicrobianos",
          "equals": true
        }
      },
      {
        "code": "inmunosupresion",
        "name": "Inmunosupresión",
        "dataType": "json",
        "required": false,
        "section": "Epidemiología",
        "options": [
          "VIH",
          "Diabetes",
          "Corticoides",
          "Quimioterapia",
          "Trasplante",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "condiciones_de_inmunosupresion",
        "name": "Inmunosupresión — detalle",
        "dataType": "text",
        "required": false,
        "section": "Epidemiología"
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes previos",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dengue",
          "Chikungunya o zika",
          "Malaria",
          "Leishmaniasis",
          "Tuberculosis",
          "VIH",
          "Infección de piel y partes blandas",
          "Sepsis"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "dengue_signos_de_alarma",
        "name": "Signos de alarma (OPS/OMS)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor abdominal intenso y continuo",
          "Vómitos persistentes",
          "Acumulación de líquidos (ascitis, derrame)",
          "Sangrado de mucosas",
          "Letargia o irritabilidad",
          "Hepatomegalia mayor a 2 cm",
          "Aumento del hematocrito con caída de plaquetas",
          "Hipotensión postural",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue"
        }
      },
      {
        "code": "dengue_torniquete",
        "name": "Prueba del torniquete",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue"
        }
      },
      {
        "code": "dengue_grupo",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Grupo A — sin signos de alarma",
          "Grupo B — con signos de alarma o condición asociada",
          "Grupo C — dengue grave"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue"
        }
      },
      {
        "code": "chik_artralgia",
        "name": "Artralgias intensas",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Chikungunya o zika"
        }
      },
      {
        "code": "zika_embarazo",
        "name": "Embarazo en curso",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Chikungunya o zika"
        }
      },
      {
        "code": "chik_exantema",
        "name": "Exantema",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Chikungunya o zika"
        }
      },
      {
        "code": "malaria_gota_gruesa",
        "name": "Gota gruesa",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva — P. vivax",
          "Positiva — P. falciparum",
          "Negativa",
          "Pendiente"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Malaria"
        }
      },
      {
        "code": "leish_forma",
        "name": "Forma",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cutánea",
          "Mucosa",
          "Visceral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Leishmaniasis"
        }
      },
      {
        "code": "leish_lesiones",
        "name": "Número de lesiones",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Leishmaniasis"
        }
      },
      {
        "code": "tbc_dias_de_tos",
        "name": "Días de tos con expectoración",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "15 días o más: sintomático respiratorio, pedir baciloscopía.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis"
        }
      },
      {
        "code": "tbc_sintomas",
        "name": "Síntomas acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fiebre vespertina",
          "Sudoración nocturna",
          "Pérdida de peso",
          "Hemoptisis",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis"
        }
      },
      {
        "code": "tbc_contacto",
        "name": "Contacto con un caso de tuberculosis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis"
        }
      },
      {
        "code": "tbc_baciloscopia",
        "name": "Baciloscopía",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "Pedida",
          "No pedida"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis"
        }
      },
      {
        "code": "vih_cd4",
        "name": "CD4 (células/µL)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "VIH"
        }
      },
      {
        "code": "vih_carga_viral",
        "name": "Carga viral",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "VIH"
        }
      },
      {
        "code": "vih_tar",
        "name": "En terapia antirretroviral",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "VIH"
        }
      },
      {
        "code": "ppb_signos",
        "name": "Signos",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Eritema",
          "Calor",
          "Absceso fluctuante",
          "Crepitación",
          "Necrosis"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección de piel y partes blandas"
        }
      },
      {
        "code": "ppb_sistemico",
        "name": "Compromiso sistémico",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección de piel y partes blandas"
        }
      },
      {
        "code": "qsofa",
        "name": "qSOFA",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Frecuencia respiratoria ≥ 22",
          "Alteración del estado mental",
          "PAS ≤ 100 mmHg"
        ],
        "multiple": true,
        "description": "2 o más: alto riesgo.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sepsis"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "MEDEP_EVALUACION_BASE",
    "name": "Evaluación de medicina deportiva",
    "version": 2,
    "specialty": "MEDICINA_DEPORTIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen por aparatos y sistemas",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, examen físico por aparatos, diagnóstico y conducta. Son agregados propios de la especialidad el deporte practicado y su nivel, la carga de entrenamiento semanal, las lesiones deportivas previas, el examen dirigido del aparato locomotor, los antecedentes cardiovasculares con el antecedente familiar de muerte súbita, y la aptitud propuesta redactada en prosa. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo y práctica"
      },
      {
        "code": "deporte_practicado",
        "name": "Deporte practicado",
        "dataType": "string",
        "required": true,
        "section": "Motivo y práctica"
      },
      {
        "code": "nivel_de_practica",
        "name": "Nivel",
        "dataType": "string",
        "required": false,
        "section": "Motivo y práctica",
        "options": [
          "Recreativo",
          "Competitivo amateur",
          "Federado",
          "Profesional"
        ],
        "multiple": false
      },
      {
        "code": "carga_entrenamiento_semanal_horas",
        "name": "Entrenamiento semanal (horas)",
        "dataType": "integer",
        "required": false,
        "section": "Motivo y práctica"
      },
      {
        "code": "lesiones_previas",
        "name": "Lesiones previas",
        "dataType": "text",
        "required": false,
        "section": "Motivo y práctica"
      },
      {
        "code": "dolor_actual",
        "name": "Dolor actual",
        "dataType": "text",
        "required": false,
        "section": "Motivo y práctica"
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Motivo y práctica"
      },
      {
        "code": "sintomas_esfuerzo",
        "name": "Síntomas con el esfuerzo",
        "dataType": "json",
        "required": true,
        "section": "Tamizaje cardiovascular",
        "options": [
          "Dolor torácico",
          "Síncope",
          "Disnea desproporcionada",
          "Palpitaciones",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sintomas_de_esfuerzo",
        "name": "¿Cuándo y cómo? (requiere estudio antes de autorizar)",
        "dataType": "text",
        "required": true,
        "section": "Tamizaje cardiovascular",
        "showWhen": {
          "field": "sintomas_esfuerzo",
          "equals": [
            "Dolor torácico",
            "Síncope",
            "Disnea desproporcionada",
            "Palpitaciones"
          ]
        }
      },
      {
        "code": "antecedente_familiar_muerte_subita",
        "name": "Familiar con muerte súbita antes de los 50 años",
        "dataType": "boolean",
        "required": true,
        "section": "Tamizaje cardiovascular"
      },
      {
        "code": "antecedentes_cardiovasculares",
        "name": "Antecedentes cardiovasculares",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje cardiovascular"
      },
      {
        "code": "soplo_deporte",
        "name": "Soplo en el examen",
        "dataType": "boolean",
        "required": false,
        "section": "Tamizaje cardiovascular"
      },
      {
        "code": "ecg_deporte",
        "name": "ECG de reposo — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje cardiovascular"
      },
      {
        "code": "suplementos_y_medicacion",
        "name": "Suplementos y medicación",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_general",
        "name": "Examen general",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_cardiorrespiratorio",
        "name": "Examen cardiorrespiratorio",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_aparato_locomotor",
        "name": "Examen del aparato locomotor",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "exploraciones_complementarias",
        "name": "Exploraciones complementarias",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "aptitud",
        "name": "Aptitud deportiva",
        "dataType": "string",
        "required": false,
        "section": "Conclusión",
        "options": [
          "Apto",
          "Apto con restricciones",
          "No apto temporal",
          "No apto"
        ],
        "multiple": false
      },
      {
        "code": "aptitud_propuesta",
        "name": "¿Qué restricción y hasta cuándo?",
        "dataType": "text",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "aptitud",
          "equals": [
            "Apto con restricciones",
            "No apto temporal",
            "No apto"
          ]
        }
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      }
    ]
  },
  {
    "code": "MEDFAM_CONSULTA_BASE",
    "name": "Consulta de medicina familiar",
    "version": 2,
    "specialty": "MEDICINA_FAMILIAR",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico de la atención ambulatoria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, enfermedad actual, antecedentes personales y familiares, examen físico, diagnóstico y conducta. Son agregados propios de medicina familiar los campos de composición del grupo familiar, condiciones de la vivienda y convivencia, red de apoyo, ocupación y hábitos, y el seguimiento de controles preventivos e inmunizaciones. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), SRQ-20 (OMS), APGAR familiar de Smilkstein."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias_detalle",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "antecedentes_familiares_marcados",
        "name": "Antecedentes familiares (padres, hermanos, hijos)",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Cardiopatía isquémica antes de los 55 (H) o 65 (M) años",
          "Accidente cerebrovascular",
          "Cáncer",
          "Enfermedad mental",
          "Ninguno conocido"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Parentesco y edad al diagnóstico."
      },
      {
        "code": "etapa_ciclo_vital",
        "name": "Etapa del ciclo vital familiar",
        "dataType": "string",
        "required": false,
        "section": "Familia y entorno",
        "options": [
          "Formación (pareja sin hijos)",
          "Expansión (hijos pequeños)",
          "Consolidación (hijos escolares o adolescentes)",
          "Contracción (los hijos se van)",
          "Disolución (adultos mayores solos)"
        ],
        "multiple": false
      },
      {
        "code": "composicion_grupo_familiar",
        "name": "Composición del grupo familiar (familiograma)",
        "dataType": "text",
        "required": false,
        "section": "Familia y entorno"
      },
      {
        "code": "numero_convivientes",
        "name": "Número de convivientes",
        "dataType": "integer",
        "required": false,
        "section": "Familia y entorno"
      },
      {
        "code": "apgar_familiar",
        "name": "APGAR familiar (Smilkstein)",
        "dataType": "string",
        "required": false,
        "section": "Familia y entorno",
        "options": [
          "Funcional (7 a 10)",
          "Disfunción leve (4 a 6)",
          "Disfunción grave (0 a 3)"
        ],
        "multiple": false
      },
      {
        "code": "condiciones_vivienda_marcadas",
        "name": "Vivienda",
        "dataType": "json",
        "required": false,
        "section": "Familia y entorno",
        "options": [
          "Agua potable",
          "Alcantarillado",
          "Piso de tierra",
          "Hacinamiento",
          "Vinchucas en la vivienda",
          "Cocina a leña dentro de la casa"
        ],
        "multiple": true
      },
      {
        "code": "condiciones_de_vivienda",
        "name": "Condiciones de vivienda — detalle",
        "dataType": "text",
        "required": false,
        "section": "Familia y entorno"
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo",
        "dataType": "text",
        "required": false,
        "section": "Familia y entorno"
      },
      {
        "code": "ocupacion",
        "name": "Ocupación",
        "dataType": "string",
        "required": false,
        "section": "Familia y entorno"
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Hábitos y prevención",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos y prevención",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos y prevención",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos y prevención",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos y prevención",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos y prevención",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos y prevención",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Hábitos y prevención"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Hábitos y prevención",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "habitos",
        "name": "Otros hábitos (alimentación, actividad física, sueño)",
        "dataType": "text",
        "required": false,
        "section": "Hábitos y prevención"
      },
      {
        "code": "controles_preventivos_al_dia",
        "name": "Controles preventivos al día",
        "dataType": "json",
        "required": false,
        "section": "Hábitos y prevención",
        "options": [
          "Vacunas",
          "Papanicolaou o IVAA",
          "Mamografía",
          "Glucemia",
          "Presión arterial",
          "Salud bucal"
        ],
        "multiple": true
      },
      {
        "code": "controles_preventivos",
        "name": "Controles preventivos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Hábitos y prevención"
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg, sistólica/diastólica)",
        "dataType": "string",
        "required": false,
        "section": "Examen físico",
        "description": "Por ejemplo: 120/80."
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_fisico_general",
        "name": "Examen físico general",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_por_aparatos",
        "name": "Examen por aparatos",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Infección respiratoria alta",
          "Enfermedad diarreica aguda",
          "Hipertensión arterial",
          "Diabetes mellitus tipo 2",
          "Infección urinaria",
          "Trastorno mental común (ansiedad, depresión)",
          "Enfermedad de Chagas"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "centor_fiebre",
        "name": "Fiebre mayor a 38 °C",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta"
        }
      },
      {
        "code": "centor_sin_tos",
        "name": "Ausencia de tos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta"
        }
      },
      {
        "code": "centor_adenopatias",
        "name": "Adenopatías cervicales anteriores dolorosas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta"
        }
      },
      {
        "code": "centor_exudado",
        "name": "Exudado o tumefacción amigdalina",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta"
        }
      },
      {
        "code": "ira_rinorrea",
        "name": "Rinorrea",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ausente",
          "Acuosa",
          "Purulenta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta"
        }
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Toma la medicación todos los días",
          "Olvida dosis",
          "Abandonó el tratamiento",
          "Sin tratamiento todavía"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "itu_sintomas",
        "name": "Síntomas urinarios",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Urgencia miccional",
          "Hematuria",
          "Dolor suprapúbico"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_fiebre_o_lumbar",
        "name": "Fiebre o dolor lumbar (sospecha de pielonefritis)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_punopercusion",
        "name": "Puñopercusión lumbar",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No evaluada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_embarazo",
        "name": "¿Embarazo posible?",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): marque las preguntas que respondió «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "¿Tiene frecuentes dolores de cabeza?",
          "¿Tiene mal apetito?",
          "¿Duerme mal?",
          "¿Se asusta con facilidad?",
          "¿Sufre de temblor de manos?",
          "¿Se siente nervioso, tenso o aburrido?",
          "¿Sufre de mala digestión?",
          "¿No puede pensar con claridad?",
          "¿Se siente triste?",
          "¿Llora usted con mucha frecuencia?",
          "¿Tiene dificultad en disfrutar sus actividades diarias?",
          "¿Tiene dificultad para tomar decisiones?",
          "¿Tiene dificultad en hacer su trabajo?",
          "¿Es incapaz de desempeñar un papel útil en su vida?",
          "¿Ha perdido interés en las cosas?",
          "¿Siente que usted es una persona inútil?",
          "¿Ha tenido la idea de acabar con su vida?",
          "¿Se siente cansado todo el tiempo?",
          "¿Tiene sensaciones desagradables en su estómago?",
          "¿Se cansa con facilidad?"
        ],
        "multiple": true,
        "description": "8 o más respuestas positivas: probable trastorno mental común. La pregunta 17 positiva exige evaluar riesgo suicida.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno mental común (ansiedad, depresión)"
        }
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total de respuestas «sí» (0–20)",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno mental común (ansiedad, depresión)"
        }
      },
      {
        "code": "ideacion_suicida",
        "name": "Ideación suicida actual",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno mental común (ansiedad, depresión)"
        }
      },
      {
        "code": "chagas_serologia",
        "name": "Serología para Chagas",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "Pendiente",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad de Chagas"
        }
      },
      {
        "code": "chagas_compromiso",
        "name": "Compromiso orgánico",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cardíaco (arritmia, bloqueo, insuficiencia)",
          "Digestivo (megaesófago, megacolon)",
          "Sin compromiso aparente"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad de Chagas"
        }
      },
      {
        "code": "chagas_tratamiento_previo",
        "name": "Recibió benznidazol o nifurtimox",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad de Chagas"
        }
      },
      {
        "code": "chagas_vivienda_endemica",
        "name": "Vivió en vivienda con vinchucas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad de Chagas"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento y seguimiento familiar",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "MEDGEN_CONSULTA_BASE",
    "name": "Consulta de medicina general",
    "version": 2,
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta ambulatoria: motivo, tiempo de evolución, relato de la enfermedad actual, antecedentes personales y familiares, funciones biológicas, examen físico general y por aparatos, diagnóstico y conducta. Son agregados propios de la ficha el desglose de los signos vitales en campos separados (presión, frecuencia cardíaca, temperatura, peso y talla) para poder registrarlos como valores numéricos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), CURB-65 (British Thoracic Society), guía de dengue OPS/OMS 2016."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales patológicos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "tuvo_cirugias",
        "name": "¿Tuvo cirugías previas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_quirurgicos",
        "name": "¿Cuáles y en qué año?",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tuvo_cirugias",
          "equals": true
        }
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "antecedentes_familiares_marcados",
        "name": "Antecedentes familiares (padres, hermanos, hijos)",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Cardiopatía isquémica antes de los 55 (H) o 65 (M) años",
          "Accidente cerebrovascular",
          "Cáncer",
          "Enfermedad mental",
          "Ninguno conocido"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Parentesco y edad al diagnóstico."
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Hábitos",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "funciones_biologicas",
        "name": "Funciones biológicas (apetito, sed, sueño, orina, deposiciones)",
        "dataType": "text",
        "required": false,
        "section": "Revisión por sistemas"
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg, sistólica/diastólica)",
        "dataType": "string",
        "required": false,
        "section": "Examen físico",
        "description": "Por ejemplo: 120/80."
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "talla",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_fisico_general",
        "name": "Examen físico general",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_por_aparatos",
        "name": "Examen por aparatos y sistemas",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Infección respiratoria alta (resfrío, faringoamigdalitis)",
          "Neumonía adquirida en la comunidad",
          "Enfermedad diarreica aguda",
          "Infección urinaria",
          "Hipertensión arterial",
          "Diabetes mellitus tipo 2",
          "Dengue o síndrome febril agudo",
          "Lumbalgia"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "centor_fiebre",
        "name": "Fiebre mayor a 38 °C",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta (resfrío, faringoamigdalitis)"
        }
      },
      {
        "code": "centor_sin_tos",
        "name": "Ausencia de tos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta (resfrío, faringoamigdalitis)"
        }
      },
      {
        "code": "centor_adenopatias",
        "name": "Adenopatías cervicales anteriores dolorosas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta (resfrío, faringoamigdalitis)"
        }
      },
      {
        "code": "centor_exudado",
        "name": "Exudado o tumefacción amigdalina",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta (resfrío, faringoamigdalitis)"
        }
      },
      {
        "code": "ira_rinorrea",
        "name": "Rinorrea",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ausente",
          "Acuosa",
          "Purulenta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección respiratoria alta (resfrío, faringoamigdalitis)"
        }
      },
      {
        "code": "neumonia_crepitantes",
        "name": "Crepitantes o soplo tubario localizados",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía adquirida en la comunidad"
        }
      },
      {
        "code": "curb65",
        "name": "Criterios CURB-65 presentes",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Confusión de reciente aparición",
          "Urea > 42 mg/dL (BUN > 19 mg/dL)",
          "Frecuencia respiratoria ≥ 30 rpm",
          "PAS < 90 o PAD ≤ 60 mmHg",
          "Edad ≥ 65 años",
          "Ninguno"
        ],
        "multiple": true,
        "description": "0–1: ambulatorio · 2: valorar internación · 3 o más: neumonía grave.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía adquirida en la comunidad"
        }
      },
      {
        "code": "neumonia_expectoracion",
        "name": "Expectoración purulenta",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía adquirida en la comunidad"
        }
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "itu_sintomas",
        "name": "Síntomas urinarios",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Urgencia miccional",
          "Hematuria",
          "Dolor suprapúbico"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_fiebre_o_lumbar",
        "name": "Fiebre o dolor lumbar (sospecha de pielonefritis)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_punopercusion",
        "name": "Puñopercusión lumbar",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No evaluada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_embarazo",
        "name": "¿Embarazo posible?",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Toma la medicación todos los días",
          "Olvida dosis",
          "Abandonó el tratamiento",
          "Sin tratamiento todavía"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus tipo 2"
        }
      },
      {
        "code": "dengue_dias_de_fiebre",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue o síndrome febril agudo"
        }
      },
      {
        "code": "dengue_signos_de_alarma",
        "name": "Signos de alarma (OPS/OMS)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor abdominal intenso y continuo",
          "Vómitos persistentes",
          "Acumulación de líquidos (ascitis, derrame)",
          "Sangrado de mucosas",
          "Letargia o irritabilidad",
          "Hepatomegalia mayor a 2 cm",
          "Aumento del hematocrito con caída de plaquetas",
          "Hipotensión postural",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue o síndrome febril agudo"
        }
      },
      {
        "code": "dengue_torniquete",
        "name": "Prueba del torniquete",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue o síndrome febril agudo"
        }
      },
      {
        "code": "dengue_grupo",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Grupo A — sin signos de alarma",
          "Grupo B — con signos de alarma o condición asociada",
          "Grupo C — dengue grave"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dengue o síndrome febril agudo"
        }
      },
      {
        "code": "lumbalgia_banderas_rojas",
        "name": "Banderas rojas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Edad menor a 20 o mayor a 55 años",
          "Traumatismo importante",
          "Fiebre",
          "Pérdida de peso no explicada",
          "Antecedente de cáncer",
          "Déficit neurológico progresivo",
          "Alteración de esfínteres o anestesia en silla de montar",
          "Ninguna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "lumbalgia_ciatica",
        "name": "Dolor irradiado por debajo de la rodilla",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "lumbalgia_lasegue",
        "name": "Signo de Lasègue",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positivo",
          "Negativo",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia"
        }
      },
      {
        "code": "examenes_auxiliares",
        "name": "Exámenes auxiliares solicitados",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "MEDINT_EVALUACION_BASE",
    "name": "Evaluación de medicina interna — versión general base",
    "version": 2,
    "specialty": "MEDICINA_INTERNA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, historia clínica de consulta externa",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la evaluación integral del adulto: comorbilidades, polifarmacia y revisión por sistemas. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), CURB-65 (British Thoracic Society), clase funcional NYHA, criterios de Framingham."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Comorbilidades",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Cardiopatía",
          "EPOC o asma",
          "Enfermedad renal crónica",
          "Hepatopatía",
          "Cáncer",
          "Enfermedad de Chagas",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "comorbilidades",
        "name": "Comorbilidades — detalle y grado de control",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual (nombre, dosis, frecuencia)",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes"
      },
      {
        "code": "cantidad_de_farmacos",
        "name": "Cantidad de fármacos en uso",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "description": "5 o más: polifarmacia."
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "habitos_toxicos",
        "name": "Hábitos tóxicos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "estado_funcional",
        "name": "Estado funcional",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Independiente",
          "Requiere ayuda para actividades instrumentales",
          "Requiere ayuda para actividades básicas",
          "Postrado"
        ],
        "multiple": false
      },
      {
        "code": "perdida_de_peso_reciente",
        "name": "Pérdida de peso reciente",
        "dataType": "boolean",
        "required": false,
        "section": "Revisión por sistemas"
      },
      {
        "code": "perdida_de_peso_kg",
        "name": "¿Cuántos kg y en cuánto tiempo?",
        "dataType": "decimal",
        "required": true,
        "section": "Revisión por sistemas",
        "showWhen": {
          "field": "perdida_de_peso_reciente",
          "equals": true
        }
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Revisión por sistemas"
      },
      {
        "code": "fiebre_dias",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Revisión por sistemas",
        "showWhen": {
          "field": "fiebre",
          "equals": true
        }
      },
      {
        "code": "revision_por_sistemas",
        "name": "Revisión por sistemas — hallazgos",
        "dataType": "text",
        "required": false,
        "section": "Revisión por sistemas"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_fisico_dirigido",
        "name": "Examen físico dirigido",
        "dataType": "text",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "laboratorio_relevante",
        "name": "Laboratorio relevante",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Insuficiencia cardíaca",
          "Diabetes mellitus descompensada",
          "Hipertensión arterial",
          "Neumonía",
          "Anemia",
          "Síndrome febril prolongado",
          "Enfermedad renal crónica"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "ic_clase_nyha",
        "name": "Clase funcional NYHA",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Clase I — sin limitación de la actividad física",
          "Clase II — limitación leve: síntomas con la actividad ordinaria",
          "Clase III — limitación marcada: síntomas con actividad menor a la ordinaria",
          "Clase IV — síntomas en reposo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "ic_signos",
        "name": "Signos y síntomas (Framingham)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ortopnea",
          "Disnea paroxística nocturna",
          "Ingurgitación yugular",
          "Crepitantes pulmonares",
          "Tercer ruido (galope)",
          "Edema de miembros inferiores",
          "Hepatomegalia"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "ic_edema_grado",
        "name": "Edema (fóvea)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin edema",
          "+ (2 mm)",
          "++ (4 mm)",
          "+++ (6 mm)",
          "++++ (8 mm)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "ic_peso_seco",
        "name": "Peso de referencia (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia cardíaca"
        }
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus descompensada"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus descompensada"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus descompensada"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus descompensada"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes mellitus descompensada"
        }
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Toma la medicación todos los días",
          "Olvida dosis",
          "Abandonó el tratamiento",
          "Sin tratamiento todavía"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipertensión arterial"
        }
      },
      {
        "code": "neumonia_crepitantes",
        "name": "Crepitantes o soplo tubario localizados",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "curb65",
        "name": "Criterios CURB-65 presentes",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Confusión de reciente aparición",
          "Urea > 42 mg/dL (BUN > 19 mg/dL)",
          "Frecuencia respiratoria ≥ 30 rpm",
          "PAS < 90 o PAD ≤ 60 mmHg",
          "Edad ≥ 65 años",
          "Ninguno"
        ],
        "multiple": true,
        "description": "0–1: ambulatorio · 2: valorar internación · 3 o más: neumonía grave.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "neumonia_expectoracion",
        "name": "Expectoración purulenta",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "anemia_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "Ajustar por altitud de residencia.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Astenia",
          "Disnea de esfuerzo",
          "Palpitaciones",
          "Pica",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_perdidas",
        "name": "Posibles pérdidas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Menstruación abundante",
          "Sangrado digestivo",
          "Parasitosis",
          "Ninguna conocida"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_vcm",
        "name": "VCM y ferritina, si se conocen",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia"
        }
      },
      {
        "code": "sfp_estudios",
        "name": "Estudios ya realizados",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Hemocultivos",
          "Urocultivo",
          "Serología VIH",
          "Baciloscopía",
          "Imágenes",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome febril prolongado"
        }
      },
      {
        "code": "erc_creatinina",
        "name": "Creatinina (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "erc_tfg",
        "name": "Filtrado glomerular estimado (mL/min/1,73 m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "problemas_activos",
        "name": "Lista de problemas activos",
        "dataType": "text",
        "required": true,
        "section": "Problemas y plan"
      },
      {
        "code": "plan_por_problema",
        "name": "Plan por problema",
        "dataType": "text",
        "required": true,
        "section": "Problemas y plan"
      }
    ]
  },
  {
    "code": "MEDINT_UCI_EVALUACION",
    "name": "Evaluación en medicina intensiva",
    "version": 2,
    "specialty": "MEDICINA_INTENSIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, notas de evolución y registro de la atención hospitalaria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, fecha de ingreso, signos vitales, evolución, diagnóstico y conducta. Son agregados propios de la especialidad el motivo de ingreso a la unidad, los días de estancia, el soporte ventilatorio, el soporte vasoactivo, la sedación, el balance hídrico y la evolución del turno. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: CURB-65 (British Thoracic Society), escala de coma de Glasgow, KDIGO, RASS, definición de Berlín del SDRA."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de la evaluación",
        "dataType": "text",
        "required": true,
        "section": "Ingreso"
      },
      {
        "code": "motivo_de_ingreso_a_la_unidad",
        "name": "Motivo de ingreso a la unidad",
        "dataType": "text",
        "required": true,
        "section": "Ingreso"
      },
      {
        "code": "fecha_de_ingreso_a_la_unidad",
        "name": "Fecha de ingreso a la unidad",
        "dataType": "date",
        "required": false,
        "section": "Ingreso"
      },
      {
        "code": "dias_de_estancia_en_la_unidad",
        "name": "Días de estancia",
        "dataType": "integer",
        "required": false,
        "section": "Ingreso"
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia",
        "dataType": "string",
        "required": false,
        "section": "Neurológico",
        "options": [
          "Alerta",
          "Somnoliento",
          "Estupor",
          "Coma",
          "Sedado"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_ocular",
        "name": "Glasgow — apertura ocular",
        "dataType": "string",
        "required": false,
        "section": "Neurológico",
        "options": [
          "4 — espontánea",
          "3 — a la voz",
          "2 — al dolor",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_verbal",
        "name": "Glasgow — respuesta verbal",
        "dataType": "string",
        "required": false,
        "section": "Neurológico",
        "options": [
          "5 — orientada",
          "4 — confusa",
          "3 — palabras inapropiadas",
          "2 — sonidos incomprensibles",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_motora",
        "name": "Glasgow — respuesta motora",
        "dataType": "string",
        "required": false,
        "section": "Neurológico",
        "options": [
          "6 — obedece órdenes",
          "5 — localiza el dolor",
          "4 — retira al dolor",
          "3 — flexión anormal",
          "2 — extensión",
          "1 — ninguna"
        ],
        "multiple": false
      },
      {
        "code": "sedacion",
        "name": "Sedación",
        "dataType": "boolean",
        "required": false,
        "section": "Neurológico"
      },
      {
        "code": "rass",
        "name": "RASS",
        "dataType": "string",
        "required": true,
        "section": "Neurológico",
        "options": [
          "+2 agitado",
          "+1 inquieto",
          "0 alerta y calmo",
          "−1 somnoliento",
          "−2 sedación leve",
          "−3 sedación moderada",
          "−4 sedación profunda",
          "−5 no despierta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "sedacion",
          "equals": true
        }
      },
      {
        "code": "delirium",
        "name": "Delirium (evaluación positiva)",
        "dataType": "boolean",
        "required": false,
        "section": "Neurológico"
      },
      {
        "code": "delirium_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Neurológico",
        "options": [
          "Hiperactivo",
          "Hipoactivo",
          "Mixto"
        ],
        "multiple": false,
        "showWhen": {
          "field": "delirium",
          "equals": true
        }
      },
      {
        "code": "soporte_ventilatorio",
        "name": "Soporte ventilatorio",
        "dataType": "boolean",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "modo_ventilatorio",
        "name": "Modo",
        "dataType": "string",
        "required": true,
        "section": "Respiratorio y hemodinámico",
        "options": [
          "Oxígeno por cánula",
          "Alto flujo",
          "Ventilación no invasiva",
          "Ventilación mecánica invasiva"
        ],
        "multiple": false,
        "showWhen": {
          "field": "soporte_ventilatorio",
          "equals": true
        }
      },
      {
        "code": "descripcion_del_soporte_ventilatorio",
        "name": "Parámetros (FiO₂, PEEP, volumen)",
        "dataType": "text",
        "required": false,
        "section": "Respiratorio y hemodinámico",
        "showWhen": {
          "field": "soporte_ventilatorio",
          "equals": true
        }
      },
      {
        "code": "pafi",
        "name": "PaO₂/FiO₂",
        "dataType": "decimal",
        "required": false,
        "section": "Respiratorio y hemodinámico",
        "showWhen": {
          "field": "soporte_ventilatorio",
          "equals": true
        }
      },
      {
        "code": "soporte_vasoactivo",
        "name": "Soporte vasoactivo",
        "dataType": "boolean",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "vasoactivos",
        "name": "Fármacos",
        "dataType": "json",
        "required": true,
        "section": "Respiratorio y hemodinámico",
        "options": [
          "Noradrenalina",
          "Adrenalina",
          "Vasopresina",
          "Dobutamina",
          "Dopamina"
        ],
        "multiple": true,
        "showWhen": {
          "field": "soporte_vasoactivo",
          "equals": true
        }
      },
      {
        "code": "descripcion_del_soporte_vasoactivo",
        "name": "Dosis",
        "dataType": "text",
        "required": false,
        "section": "Respiratorio y hemodinámico",
        "showWhen": {
          "field": "soporte_vasoactivo",
          "equals": true
        }
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg, sistólica/diastólica)",
        "dataType": "string",
        "required": false,
        "section": "Respiratorio y hemodinámico",
        "description": "Por ejemplo: 120/80."
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "lactato_uci",
        "name": "Lactato (mmol/L)",
        "dataType": "decimal",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "balance_hidrico_del_turno",
        "name": "Balance hídrico del turno (mL)",
        "dataType": "string",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "diuresis_ml_kg_h",
        "name": "Diuresis (mL/kg/h)",
        "dataType": "decimal",
        "required": false,
        "section": "Respiratorio y hemodinámico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Shock séptico",
          "Síndrome de distrés respiratorio agudo",
          "Neumonía grave",
          "Insuficiencia renal aguda",
          "Posoperatorio de alto riesgo",
          "Coma o daño neurológico agudo"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "foco_sepsis",
        "name": "Foco",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Shock séptico"
        }
      },
      {
        "code": "hemocultivos",
        "name": "Hemocultivos tomados",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Shock séptico"
        }
      },
      {
        "code": "antibiotico_hora",
        "name": "Antibiótico y hora de inicio",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Shock séptico"
        }
      },
      {
        "code": "sdra_berlin",
        "name": "Gravedad (Berlín)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Leve (PaO₂/FiO₂ 200–300)",
          "Moderado (100–200)",
          "Grave (< 100)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome de distrés respiratorio agudo"
        }
      },
      {
        "code": "prono",
        "name": "Ventilación en prono",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome de distrés respiratorio agudo"
        }
      },
      {
        "code": "neumonia_crepitantes",
        "name": "Crepitantes o soplo tubario localizados",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía grave"
        }
      },
      {
        "code": "curb65",
        "name": "Criterios CURB-65 presentes",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Confusión de reciente aparición",
          "Urea > 42 mg/dL (BUN > 19 mg/dL)",
          "Frecuencia respiratoria ≥ 30 rpm",
          "PAS < 90 o PAD ≤ 60 mmHg",
          "Edad ≥ 65 años",
          "Ninguno"
        ],
        "multiple": true,
        "description": "0–1: ambulatorio · 2: valorar internación · 3 o más: neumonía grave.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía grave"
        }
      },
      {
        "code": "neumonia_expectoracion",
        "name": "Expectoración purulenta",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía grave"
        }
      },
      {
        "code": "kdigo_lra",
        "name": "Estadio KDIGO",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "1",
          "2",
          "3"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia renal aguda"
        }
      },
      {
        "code": "terapia_reemplazo",
        "name": "Terapia de reemplazo renal",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Insuficiencia renal aguda"
        }
      },
      {
        "code": "cirugia_realizada",
        "name": "Cirugía realizada",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Posoperatorio de alto riesgo"
        }
      },
      {
        "code": "sangrado_postop",
        "name": "Sangrado activo",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Posoperatorio de alto riesgo"
        }
      },
      {
        "code": "pupilas_simetricas",
        "name": "Pupilas simétricas y reactivas",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Coma o daño neurológico agudo"
        }
      },
      {
        "code": "tac_cerebro",
        "name": "TAC de cerebro",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Coma o daño neurológico agudo"
        }
      },
      {
        "code": "evolucion_del_turno",
        "name": "Evolución del turno",
        "dataType": "text",
        "required": true,
        "section": "Evolución y plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Evolución y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Evolución y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "NEFRO_EVALUACION_BASE",
    "name": "Evaluación nefrológica",
    "version": 2,
    "specialty": "NEFROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato genitourinario",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el interrogatorio dirigido de diuresis, edemas y hematuria, el antecedente de litiasis, la presión arterial registrada en consulta y la referencia a estudios de función renal previos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: KDIGO."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "tiene_edemas",
        "name": "Edemas",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "edema_localizacion",
        "name": "Localización",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "options": [
          "Palpebral",
          "Miembros inferiores",
          "Generalizado (anasarca)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tiene_edemas",
          "equals": true
        }
      },
      {
        "code": "edemas",
        "name": "Edemas — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "tiene_edemas",
          "equals": true
        }
      },
      {
        "code": "volumen_de_diuresis",
        "name": "Diuresis",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Normal",
          "Disminuida (oliguria)",
          "Aumentada (poliuria)",
          "Anuria"
        ],
        "multiple": false
      },
      {
        "code": "diuresis",
        "name": "Diuresis — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "nicturia",
        "name": "Nicturia",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "hematuria",
        "name": "Hematuria",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "espuma_en_la_orina",
        "name": "Espuma en la orina",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "dolor_lumbar",
        "name": "Dolor lumbar",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "antecedente_de_litiasis",
        "name": "Antecedente de litiasis",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_de_hipertension_o_diabetes",
        "name": "Hipertensión o diabetes — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "nefrotoxicos",
        "name": "Nefrotóxicos",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "AINE",
          "Contraste yodado reciente",
          "Aminoglucósidos",
          "Medicina tradicional o hierbas",
          "Ninguno"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "medicacion_nefrotoxica",
        "name": "Medicación nefrotóxica — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Enfermedad renal crónica",
          "Lesión renal aguda",
          "Síndrome nefrótico",
          "Síndrome nefrítico",
          "Litiasis renal",
          "Infección urinaria"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "creatinina",
        "name": "Creatinina (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "tfg",
        "name": "Filtrado glomerular estimado (mL/min/1,73 m²)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "erc_estadio_kdigo",
        "name": "Estadio KDIGO",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "G1 (≥ 90)",
          "G2 (60–89)",
          "G3a (45–59)",
          "G3b (30–44)",
          "G4 (15–29)",
          "G5 (< 15)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "albuminuria",
        "name": "Albuminuria",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "A1 (< 30 mg/g)",
          "A2 (30–300 mg/g)",
          "A3 (> 300 mg/g)",
          "No medida"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad renal crónica"
        }
      },
      {
        "code": "lra_causa",
        "name": "Causa probable",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Prerrenal",
          "Renal intrínseca",
          "Posrenal (obstructiva)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión renal aguda"
        }
      },
      {
        "code": "lra_creatinina_basal",
        "name": "Creatinina basal (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión renal aguda"
        }
      },
      {
        "code": "proteinuria_24h",
        "name": "Proteinuria de 24 h (g)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome nefrótico"
        }
      },
      {
        "code": "albumina_serica",
        "name": "Albúmina sérica (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome nefrótico"
        }
      },
      {
        "code": "nefritico_hta",
        "name": "Hipertensión",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome nefrítico"
        }
      },
      {
        "code": "nefritico_infeccion_previa",
        "name": "Infección faríngea o cutánea reciente",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Síndrome nefrítico"
        }
      },
      {
        "code": "litiasis_colico",
        "name": "Cólico renal",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Litiasis renal"
        }
      },
      {
        "code": "litiasis_imagen",
        "name": "Imagen — tamaño y ubicación del lito",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Litiasis renal"
        }
      },
      {
        "code": "itu_sintomas",
        "name": "Síntomas urinarios",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Urgencia miccional",
          "Hematuria",
          "Dolor suprapúbico"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_fiebre_o_lumbar",
        "name": "Fiebre o dolor lumbar (sospecha de pielonefritis)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_punopercusion",
        "name": "Puñopercusión lumbar",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No evaluada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "itu_embarazo",
        "name": "¿Embarazo posible?",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "funcion_renal_previa",
        "name": "Función renal previa",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "NEUMO_EVALUACION_BASE",
    "name": "Evaluación neumológica",
    "version": 2,
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato respiratorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen por aparatos, diagnóstico y conducta. Son agregados propios de la especialidad la descripción dirigida de disnea, tos, expectoración y hemoptisis, el antecedente de tabaquismo, la auscultación pulmonar y la saturación de oxígeno. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: CURB-65 (British Thoracic Society), escala de disnea mMRC, control del asma GINA, escala de fuerza MRC."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "tiene_disnea",
        "name": "Disnea",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas respiratorios"
      },
      {
        "code": "disnea_mmrc",
        "name": "Disnea (escala mMRC)",
        "dataType": "string",
        "required": true,
        "section": "Síntomas respiratorios",
        "options": [
          "Grado 0 — disnea sólo con ejercicio intenso",
          "Grado 1 — al caminar rápido o subir una pendiente",
          "Grado 2 — camina más despacio que sus pares o se detiene en llano",
          "Grado 3 — se detiene a los 100 metros o a los pocos minutos",
          "Grado 4 — no sale de casa o se ahoga al vestirse"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tiene_disnea",
          "equals": true
        }
      },
      {
        "code": "disnea",
        "name": "Disnea — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas respiratorios",
        "showWhen": {
          "field": "tiene_disnea",
          "equals": true
        }
      },
      {
        "code": "tiene_tos",
        "name": "Tos",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas respiratorios"
      },
      {
        "code": "tos_dias",
        "name": "Días de tos",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas respiratorios",
        "showWhen": {
          "field": "tiene_tos",
          "equals": true
        }
      },
      {
        "code": "tos_tipo",
        "name": "Tipo de tos",
        "dataType": "string",
        "required": false,
        "section": "Síntomas respiratorios",
        "options": [
          "Seca",
          "Productiva"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tiene_tos",
          "equals": true
        }
      },
      {
        "code": "tos",
        "name": "Tos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas respiratorios",
        "showWhen": {
          "field": "tiene_tos",
          "equals": true
        }
      },
      {
        "code": "expectoracion_aspecto",
        "name": "Aspecto de la expectoración",
        "dataType": "string",
        "required": false,
        "section": "Síntomas respiratorios",
        "options": [
          "Mucosa",
          "Purulenta",
          "Hemoptoica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tos_tipo",
          "equals": "Productiva"
        }
      },
      {
        "code": "expectoracion",
        "name": "Expectoración — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas respiratorios",
        "showWhen": {
          "field": "tos_tipo",
          "equals": "Productiva"
        }
      },
      {
        "code": "hemoptisis",
        "name": "Hemoptisis",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas respiratorios"
      },
      {
        "code": "hemoptisis_volumen",
        "name": "Volumen",
        "dataType": "string",
        "required": true,
        "section": "Síntomas respiratorios",
        "options": [
          "Esputo hemoptoico",
          "Menos de 100 mL/24 h",
          "Más de 100 mL/24 h (masiva)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hemoptisis",
          "equals": true
        }
      },
      {
        "code": "dolor_toracico",
        "name": "Dolor torácico",
        "dataType": "text",
        "required": false,
        "section": "Síntomas respiratorios"
      },
      {
        "code": "sibilancias",
        "name": "Sibilancias",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas respiratorios"
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Exposiciones y antecedentes",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "paquetes_anio",
        "name": "Paquetes-año",
        "dataType": "integer",
        "required": true,
        "section": "Exposiciones y antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": [
            "Exfumador",
            "Fumador actual"
          ]
        }
      },
      {
        "code": "tabaquismo",
        "name": "Tabaquismo — detalle",
        "dataType": "text",
        "required": false,
        "section": "Exposiciones y antecedentes"
      },
      {
        "code": "exposiciones",
        "name": "Exposiciones",
        "dataType": "json",
        "required": false,
        "section": "Exposiciones y antecedentes",
        "options": [
          "Humo de leña o biomasa",
          "Polvo de minería",
          "Sílice o asbesto",
          "Aves o palomas",
          "Contacto con tuberculosis",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "exposicion_ocupacional_o_ambiental",
        "name": "Exposición ocupacional o ambiental — detalle",
        "dataType": "text",
        "required": false,
        "section": "Exposiciones y antecedentes"
      },
      {
        "code": "antecedentes_respiratorios",
        "name": "Antecedentes respiratorios",
        "dataType": "text",
        "required": false,
        "section": "Exposiciones y antecedentes"
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Exposiciones y antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Exposiciones y antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Exposiciones y antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "auscultacion_pulmonar",
        "name": "Auscultación pulmonar",
        "dataType": "text",
        "required": true,
        "section": "Examen físico"
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes previos (espirometría, imágenes)",
        "dataType": "text",
        "required": false,
        "section": "Examen físico"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Asma",
          "EPOC",
          "Neumonía",
          "Tuberculosis pulmonar",
          "Enfermedad pulmonar intersticial",
          "Apnea obstructiva del sueño"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "asma_control_4_semanas",
        "name": "En las últimas 4 semanas (GINA)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Síntomas diurnos más de 2 veces por semana",
          "Despertares nocturnos por asma",
          "Uso de rescate más de 2 veces por semana",
          "Limitación de la actividad",
          "Ninguno"
        ],
        "multiple": true,
        "description": "Ninguno: controlada · 1–2: parcialmente controlada · 3–4: no controlada.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Asma"
        }
      },
      {
        "code": "asma_crisis_anio",
        "name": "Crisis que requirieron urgencias en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Asma"
        }
      },
      {
        "code": "asma_tratamiento_actual",
        "name": "Inhaladores que usa",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Asma"
        }
      },
      {
        "code": "epoc_exacerbaciones_anio",
        "name": "Exacerbaciones en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "EPOC"
        }
      },
      {
        "code": "epoc_paquetes_anio",
        "name": "Tabaquismo acumulado (paquetes-año)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "EPOC"
        }
      },
      {
        "code": "epoc_exposicion_biomasa",
        "name": "Exposición a humo de leña o biomasa",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "EPOC"
        }
      },
      {
        "code": "neumonia_crepitantes",
        "name": "Crepitantes o soplo tubario localizados",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "curb65",
        "name": "Criterios CURB-65 presentes",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Confusión de reciente aparición",
          "Urea > 42 mg/dL (BUN > 19 mg/dL)",
          "Frecuencia respiratoria ≥ 30 rpm",
          "PAS < 90 o PAD ≤ 60 mmHg",
          "Edad ≥ 65 años",
          "Ninguno"
        ],
        "multiple": true,
        "description": "0–1: ambulatorio · 2: valorar internación · 3 o más: neumonía grave.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "neumonia_expectoracion",
        "name": "Expectoración purulenta",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neumonía"
        }
      },
      {
        "code": "tbc_dias_de_tos",
        "name": "Días de tos con expectoración",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "15 días o más: sintomático respiratorio, pedir baciloscopía.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis pulmonar"
        }
      },
      {
        "code": "tbc_sintomas",
        "name": "Síntomas acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fiebre vespertina",
          "Sudoración nocturna",
          "Pérdida de peso",
          "Hemoptisis",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis pulmonar"
        }
      },
      {
        "code": "tbc_contacto",
        "name": "Contacto con un caso de tuberculosis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis pulmonar"
        }
      },
      {
        "code": "tbc_baciloscopia",
        "name": "Baciloscopía",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "Pedida",
          "No pedida"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tuberculosis pulmonar"
        }
      },
      {
        "code": "epi_velcro",
        "name": "Crepitantes tipo «velcro»",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad pulmonar intersticial"
        }
      },
      {
        "code": "epi_hipocratismo",
        "name": "Hipocratismo digital",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad pulmonar intersticial"
        }
      },
      {
        "code": "apnea_sintomas",
        "name": "Síntomas y factores de apnea del sueño",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ronquido fuerte",
          "Somnolencia diurna",
          "Apneas observadas por otra persona",
          "Hipertensión",
          "Obesidad",
          "Cuello ancho"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Apnea obstructiva del sueño"
        }
      },
      {
        "code": "somnolencia_diurna_veces_semana",
        "name": "Veces por semana que se duerme sin querer de día",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Apnea obstructiva del sueño"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "NEURO_EVALUACION_BASE",
    "name": "Evaluación neurológica",
    "version": 2,
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del sistema nervioso",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta y el apartado de examen del sistema nervioso: motivo, tiempo de evolución, antecedentes, examen, diagnóstico y conducta. Son agregados propios de la especialidad el desglose del examen neurológico en campos separados (estado de conciencia, pares craneales, fuerza muscular, sensibilidad, reflejos, coordinación y marcha) y la anamnesis dirigida de cefalea y episodios convulsivos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de coma de Glasgow, escala de Cincinnati, banderas rojas SNOOP, escala de fuerza MRC, maniobra de Dix-Hallpike."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "antecedentes_neurologicos",
        "name": "Antecedentes neurológicos",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "cefalea",
        "name": "Cefalea",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "caracteristicas_cefalea",
        "name": "Cefalea — localización, carácter, frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "cefalea",
          "equals": true
        }
      },
      {
        "code": "convulsiones",
        "name": "Convulsiones",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "descripcion_convulsiones",
        "name": "Descripción de las crisis (testigos)",
        "dataType": "text",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "convulsiones",
          "equals": true
        }
      },
      {
        "code": "mareo_o_vertigo",
        "name": "Mareo o vértigo",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "vertigo_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "options": [
          "Vértigo rotatorio",
          "Inestabilidad",
          "Presíncope"
        ],
        "multiple": false,
        "showWhen": {
          "field": "mareo_o_vertigo",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "glasgow",
        "name": "Escala de Glasgow (3–15)",
        "dataType": "integer",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia y orientación",
        "dataType": "text",
        "required": true,
        "section": "Examen neurológico"
      },
      {
        "code": "lenguaje",
        "name": "Lenguaje",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "pares_craneales",
        "name": "Pares craneales",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "fuerza_mrc",
        "name": "Fuerza (escala MRC, peor segmento)",
        "dataType": "string",
        "required": false,
        "section": "Examen neurológico",
        "options": [
          "5 — normal",
          "4 — vence algo de resistencia",
          "3 — vence la gravedad",
          "2 — sin gravedad",
          "1 — contracción sin movimiento",
          "0 — sin contracción"
        ],
        "multiple": false
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular — detalle por segmento",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "sensibilidad",
        "name": "Sensibilidad",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "reflejos_osteotendinosos",
        "name": "Reflejos osteotendinosos",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "coordinacion_y_marcha",
        "name": "Coordinación y marcha",
        "dataType": "text",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "signos_meningeos",
        "name": "Signos meníngeos",
        "dataType": "boolean",
        "required": false,
        "section": "Examen neurológico"
      },
      {
        "code": "signos_meningeos_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Examen neurológico",
        "options": [
          "Rigidez de nuca",
          "Kernig",
          "Brudzinski"
        ],
        "multiple": true,
        "showWhen": {
          "field": "signos_meningeos",
          "equals": true
        }
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Accidente cerebrovascular",
          "Cefalea primaria",
          "Epilepsia o crisis convulsiva",
          "Deterioro cognitivo",
          "Enfermedad de Parkinson",
          "Neuropatía periférica",
          "Vértigo"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "acv_cincinnati",
        "name": "Escala de Cincinnati",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Asimetría facial",
          "Caída de un brazo",
          "Alteración del habla",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "acv_hora_inicio",
        "name": "Hora de inicio o de la última vez visto bien",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "acv_glucemia",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Accidente cerebrovascular"
        }
      },
      {
        "code": "cefalea_snoop",
        "name": "Banderas rojas (SNOOP)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Síntomas sistémicos (fiebre, pérdida de peso)",
          "Déficit neurológico focal o confusión",
          "Inicio súbito, en trueno",
          "Inicio después de los 50 años",
          "Cambio de patrón o empeora con Valsalva o posición",
          "Ninguna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cefalea primaria"
        }
      },
      {
        "code": "cefalea_tipo",
        "name": "Fenotipo",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Migraña sin aura",
          "Migraña con aura",
          "Tensional",
          "En racimos",
          "Por abuso de analgésicos",
          "No definido"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cefalea primaria"
        }
      },
      {
        "code": "cefalea_dias_mes",
        "name": "Días de cefalea por mes",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Cefalea primaria"
        }
      },
      {
        "code": "convulsion_tipo",
        "name": "Tipo de crisis",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Tónico-clónica generalizada",
          "Focal sin pérdida de conciencia",
          "Focal con alteración de conciencia",
          "Ausencia",
          "No definido"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Epilepsia o crisis convulsiva"
        }
      },
      {
        "code": "convulsion_duracion_minutos",
        "name": "Duración (minutos)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Epilepsia o crisis convulsiva"
        }
      },
      {
        "code": "convulsion_primera",
        "name": "Es la primera crisis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Epilepsia o crisis convulsiva"
        }
      },
      {
        "code": "convulsion_desencadenantes",
        "name": "Posibles desencadenantes",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fiebre",
          "Falta de sueño",
          "Alcohol",
          "Abandono de la medicación",
          "Ninguno conocido"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Epilepsia o crisis convulsiva"
        }
      },
      {
        "code": "cognitivo_prueba",
        "name": "Prueba cognitiva aplicada y puntaje",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Deterioro cognitivo"
        }
      },
      {
        "code": "cognitivo_funcional",
        "name": "Repercusión funcional",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ninguna",
          "En actividades instrumentales",
          "En actividades básicas"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Deterioro cognitivo"
        }
      },
      {
        "code": "parkinson_signos",
        "name": "Signos",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Bradicinesia",
          "Temblor de reposo",
          "Rigidez",
          "Inestabilidad postural"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Enfermedad de Parkinson"
        }
      },
      {
        "code": "neuropatia_patron",
        "name": "Patrón",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "En guante y calcetín",
          "Mononeuropatía",
          "Multineuritis"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neuropatía periférica"
        }
      },
      {
        "code": "neuropatia_diabetes",
        "name": "Diabetes asociada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Neuropatía periférica"
        }
      },
      {
        "code": "dix_hallpike",
        "name": "Maniobra de Dix-Hallpike",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Vértigo"
        }
      },
      {
        "code": "vertigo_signos_centrales",
        "name": "Signos centrales (diplopía, disartria, ataxia)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Vértigo"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "NUTRI_EVALUACION_BASE",
    "name": "Evaluación nutricional",
    "version": 2,
    "specialty": "NUTRICION",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y registro de medidas antropométricas",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común (motivo, tiempo de evolución, antecedentes, examen con medidas antropométricas, diagnóstico y conducta) y el registro de peso y talla. Son agregados propios de la especialidad los hábitos alimentarios, el número de comidas al día, las intolerancias y alergias alimentarias, el consumo de líquidos, la actividad física y el objetivo nutricional acordado en consulta. Los valores se registran tal como se miden: la ficha no calcula ni interpreta índices. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "medicacion_y_suplementos",
        "name": "Medicación y suplementos",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tiene_intolerancias",
        "name": "Intolerancias alimentarias",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "intolerancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Lactosa",
          "Gluten",
          "Fructosa"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_intolerancias",
          "equals": true
        }
      },
      {
        "code": "intolerancias_alimentarias",
        "name": "Detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tiene_intolerancias",
          "equals": true
        }
      },
      {
        "code": "tiene_alergias_alimentarias",
        "name": "Alergias alimentarias",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "alergias_alimentarias",
        "name": "¿A qué alimento y qué reacción?",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tiene_alergias_alimentarias",
          "equals": true
        }
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Antropometría"
      },
      {
        "code": "talla_m",
        "name": "Talla (m)",
        "dataType": "decimal",
        "required": true,
        "section": "Antropometría"
      },
      {
        "code": "imc_calculado",
        "name": "IMC (kg/m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Antropometría"
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Antropometría"
      },
      {
        "code": "tendencia_de_peso",
        "name": "Cambio de peso reciente",
        "dataType": "string",
        "required": false,
        "section": "Antropometría",
        "options": [
          "Estable",
          "Aumentó",
          "Bajó"
        ],
        "multiple": false
      },
      {
        "code": "cambio_de_peso_referido",
        "name": "¿Cuántos kg y en cuánto tiempo?",
        "dataType": "text",
        "required": true,
        "section": "Antropometría",
        "showWhen": {
          "field": "tendencia_de_peso",
          "equals": [
            "Aumentó",
            "Bajó"
          ]
        }
      },
      {
        "code": "numero_de_comidas_al_dia",
        "name": "Comidas al día",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "habitos_alimentarios",
        "name": "Recordatorio de 24 horas",
        "dataType": "text",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "consumo_frecuente",
        "name": "Consumo frecuente",
        "dataType": "json",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Bebidas azucaradas",
          "Frituras",
          "Comida rápida",
          "Frutas y verduras",
          "Lácteos",
          "Legumbres"
        ],
        "multiple": true
      },
      {
        "code": "consumo_de_liquidos",
        "name": "Consumo de líquidos",
        "dataType": "text",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "habito_intestinal",
        "name": "Hábito intestinal",
        "dataType": "text",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "actividad_fisica_nivel",
        "name": "Actividad física",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Sedentario",
          "Menos de 150 min/semana",
          "150 min/semana o más"
        ],
        "multiple": false
      },
      {
        "code": "actividad_fisica",
        "name": "Actividad física — detalle",
        "dataType": "text",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sobrepeso u obesidad",
          "Desnutrición o riesgo nutricional",
          "Diabetes o resistencia a la insulina",
          "Dislipidemia",
          "Anemia nutricional",
          "Embarazo o lactancia"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "obesidad_grado",
        "name": "Grado (IMC)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sobrepeso (25–29,9)",
          "Obesidad I (30–34,9)",
          "Obesidad II (35–39,9)",
          "Obesidad III (≥ 40)"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sobrepeso u obesidad"
        }
      },
      {
        "code": "riesgo_nutricional",
        "name": "Señales de riesgo nutricional",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "IMC menor a 20",
          "Pérdida de más del 5 % del peso en 3 a 6 meses",
          "Enfermedad aguda con poca o ninguna ingesta por más de 5 días"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Desnutrición o riesgo nutricional"
        }
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes o resistencia a la insulina"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes o resistencia a la insulina"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes o resistencia a la insulina"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes o resistencia a la insulina"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes o resistencia a la insulina"
        }
      },
      {
        "code": "ldl_nutri",
        "name": "LDL (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dislipidemia"
        }
      },
      {
        "code": "tg_nutri",
        "name": "Triglicéridos (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Dislipidemia"
        }
      },
      {
        "code": "anemia_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "Ajustar por altitud de residencia.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia nutricional"
        }
      },
      {
        "code": "anemia_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Astenia",
          "Disnea de esfuerzo",
          "Palpitaciones",
          "Pica",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia nutricional"
        }
      },
      {
        "code": "anemia_perdidas",
        "name": "Posibles pérdidas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Menstruación abundante",
          "Sangrado digestivo",
          "Parasitosis",
          "Ninguna conocida"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia nutricional"
        }
      },
      {
        "code": "anemia_vcm",
        "name": "VCM y ferritina, si se conocen",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Anemia nutricional"
        }
      },
      {
        "code": "nutri_embarazo_semanas",
        "name": "Semanas de gestación o meses de lactancia",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Embarazo o lactancia"
        }
      },
      {
        "code": "objetivo_nutricional",
        "name": "Objetivo nutricional",
        "dataType": "text",
        "required": false,
        "section": "Plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico nutricional",
        "dataType": "text",
        "required": true,
        "section": "Plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan alimentario",
        "dataType": "text",
        "required": false,
        "section": "Plan"
      }
    ]
  },
  {
    "code": "OBST_CONTROL_BASE",
    "name": "Control obstétrico",
    "version": 2,
    "specialty": "OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, historia clínica materno perinatal y registro de la atención prenatal",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcriben la estructura común (motivo, antecedentes, examen, diagnóstico y conducta) y los campos del registro prenatal: fecha de última menstruación, edad gestacional, fórmula obstétrica, altura uterina, latidos fetales y presión arterial. Son agregados propios de la especialidad los movimientos fetales referidos, la presencia de edemas, las molestias referidas y el registro de controles previos. Los valores se anotan tal como se miden: la ficha no calcula fechas probables ni interpreta resultados. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo"
      },
      {
        "code": "fecha_ultima_menstruacion",
        "name": "Fecha de última menstruación",
        "dataType": "date",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true,
        "section": "Embarazo"
      },
      {
        "code": "gestas",
        "name": "Gestas",
        "dataType": "integer",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "partos",
        "name": "Partos",
        "dataType": "integer",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "cesareas",
        "name": "Cesáreas",
        "dataType": "integer",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "abortos",
        "name": "Abortos",
        "dataType": "integer",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "controles_previos",
        "name": "Controles previos",
        "dataType": "text",
        "required": false,
        "section": "Embarazo"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "altura_uterina_cm",
        "name": "Altura uterina (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "latidos_fetales",
        "name": "Latidos fetales (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "movimientos_fetales",
        "name": "Movimientos fetales",
        "dataType": "boolean",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "tiene_edemas",
        "name": "Edemas",
        "dataType": "boolean",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "edema_localizacion_obst",
        "name": "Localización",
        "dataType": "string",
        "required": true,
        "section": "Examen",
        "options": [
          "Miembros inferiores",
          "Manos y cara",
          "Generalizado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tiene_edemas",
          "equals": true
        }
      },
      {
        "code": "edemas",
        "name": "Edemas — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen",
        "showWhen": {
          "field": "tiene_edemas",
          "equals": true
        }
      },
      {
        "code": "signos_de_alarma_obstetricos",
        "name": "Signos de alarma",
        "dataType": "json",
        "required": true,
        "section": "Examen",
        "options": [
          "Sangrado vaginal",
          "Pérdida de líquido",
          "Cefalea intensa o visión borrosa",
          "Dolor en epigastrio",
          "Disminución de movimientos fetales",
          "Contracciones antes de las 37 semanas",
          "Fiebre",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "molestias_referidas",
        "name": "Molestias referidas",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Embarazo normal",
          "Trastorno hipertensivo del embarazo",
          "Amenaza de parto prematuro",
          "Hemorragia del embarazo",
          "Diabetes gestacional",
          "Infección urinaria en el embarazo"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "proteinuria_obst",
        "name": "Proteinuria",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Negativa",
          "+",
          "++",
          "+++"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno hipertensivo del embarazo"
        }
      },
      {
        "code": "preeclampsia_grave",
        "name": "Criterios de gravedad",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "PA ≥ 160/110",
          "Cefalea o alteración visual",
          "Dolor en epigastrio",
          "Plaquetas < 100 000",
          "Oliguria",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno hipertensivo del embarazo"
        }
      },
      {
        "code": "contracciones_hora",
        "name": "Contracciones por hora",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Amenaza de parto prematuro"
        }
      },
      {
        "code": "cervix",
        "name": "Cuello: dilatación y borramiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Amenaza de parto prematuro"
        }
      },
      {
        "code": "hemorragia_trimestre",
        "name": "Trimestre",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Primero",
          "Segundo",
          "Tercero"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hemorragia del embarazo"
        }
      },
      {
        "code": "hemorragia_dolor",
        "name": "Con dolor",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hemorragia del embarazo"
        }
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes gestacional"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes gestacional"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes gestacional"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes gestacional"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Diabetes gestacional"
        }
      },
      {
        "code": "itu_obst",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Fiebre",
          "Dolor lumbar",
          "Asintomática con urocultivo positivo"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria en el embarazo"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "ODONTO_ANAMNESIS",
    "name": "Anamnesis y antecedentes odontológicos",
    "version": 2,
    "specialty": "ODONTOLOGIA",
    "provenance": {
      "sourceTitle": "Oral health surveys: basic methods — 5th edition (cuestionario de salud bucodental)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548649",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "5.ª edición, 2013",
      "retrievedAt": "2026-08-14",
      "note": "La estructura del cuestionario de antecedentes médicos y de las molestias bucales viene del cuestionario de salud bucodental de la OMS. Son agregados propios, tomados de la práctica de consultorio, los ítems de problemas con la anestesia, el bruxismo y la última visita dental. Los antecedentes que no tienen ítem propio —asma, enfermedades infecciosas, tratamientos previos y hábitos de higiene— se anotan en prosa en «Detalle de antecedentes»: la ficha es de admisión y se mantiene corta a propósito. No repite el odontograma, que vive en otra plantilla. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "alergia_a_medicamentos",
        "name": "Alergia a medicamentos",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "alergia_odonto_cual",
        "name": "¿A cuál?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes médicos",
        "options": [
          "Penicilina",
          "AINE",
          "Anestésico local",
          "Látex"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "alergia_a_medicamentos",
          "equals": true
        }
      },
      {
        "code": "consume_medicamentos",
        "name": "Consume medicamentos",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "medicamentos_odonto_riesgo",
        "name": "¿Alguno de estos?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes médicos",
        "options": [
          "Anticoagulantes",
          "Antiagregantes",
          "Bifosfonatos",
          "Corticoides",
          "Ninguno de estos"
        ],
        "multiple": true,
        "showWhen": {
          "field": "consume_medicamentos",
          "equals": true
        }
      },
      {
        "code": "medicamentos_odonto_cuales",
        "name": "¿Cuáles toma?",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes médicos",
        "showWhen": {
          "field": "consume_medicamentos",
          "equals": true
        }
      },
      {
        "code": "problemas_con_anestesia",
        "name": "Problemas con anestesia dental",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "anestesia_problema",
        "name": "¿Qué pasó?",
        "dataType": "string",
        "required": true,
        "section": "Antecedentes médicos",
        "showWhen": {
          "field": "problemas_con_anestesia",
          "equals": true
        }
      },
      {
        "code": "problemas_de_sangrado",
        "name": "Sangra mucho tras extracciones o heridas",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "enfermedad_cardiovascular",
        "name": "Enfermedad cardiovascular",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "cardio_odonto",
        "name": "¿Cuál?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes médicos",
        "options": [
          "Valvulopatía o prótesis valvular",
          "Endocarditis previa",
          "Cardiopatía isquémica",
          "Arritmia"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "enfermedad_cardiovascular",
          "equals": true
        }
      },
      {
        "code": "hipertension_arterial",
        "name": "Hipertensión arterial",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "hta_controlada_odonto",
        "name": "¿Está controlada?",
        "dataType": "string",
        "required": true,
        "section": "Antecedentes médicos",
        "options": [
          "Sí",
          "No",
          "No sabe"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hipertension_arterial",
          "equals": true
        }
      },
      {
        "code": "diabetes",
        "name": "Diabetes",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "dm_controlada_odonto",
        "name": "¿Está controlada?",
        "dataType": "string",
        "required": true,
        "section": "Antecedentes médicos",
        "options": [
          "Sí",
          "No",
          "No sabe"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diabetes",
          "equals": true
        }
      },
      {
        "code": "embarazo",
        "name": "Embarazo",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "embarazo_semanas_odonto",
        "name": "Semanas de gestación",
        "dataType": "integer",
        "required": true,
        "section": "Antecedentes médicos",
        "showWhen": {
          "field": "embarazo",
          "equals": true
        }
      },
      {
        "code": "fuma",
        "name": "Fuma",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "cigarrillos_por_dia_odonto",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": true,
        "section": "Antecedentes médicos",
        "showWhen": {
          "field": "fuma",
          "equals": true
        }
      },
      {
        "code": "detalle_de_antecedentes",
        "name": "Detalle de antecedentes",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes médicos"
      },
      {
        "code": "molestia_o_dolor_bucal",
        "name": "Molestia o dolor bucal",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes bucales"
      },
      {
        "code": "dolor_dental_tipo",
        "name": "Tipo de dolor",
        "dataType": "string",
        "required": true,
        "section": "Antecedentes bucales",
        "options": [
          "Provocado (frío, dulce)",
          "Espontáneo",
          "Nocturno",
          "Al masticar"
        ],
        "multiple": false,
        "showWhen": {
          "field": "molestia_o_dolor_bucal",
          "equals": true
        }
      },
      {
        "code": "dolor_dental_intensidad",
        "name": "Intensidad (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes bucales",
        "showWhen": {
          "field": "molestia_o_dolor_bucal",
          "equals": true
        }
      },
      {
        "code": "sangrado_de_encias",
        "name": "Sangrado de encías",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes bucales"
      },
      {
        "code": "movilidad_dentaria",
        "name": "Movilidad dentaria",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes bucales"
      },
      {
        "code": "bruxismo",
        "name": "Bruxismo",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes bucales"
      },
      {
        "code": "frecuencia_cepillado",
        "name": "Cepillado por día",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes bucales",
        "options": [
          "Ninguno",
          "1 vez",
          "2 veces",
          "3 o más veces"
        ],
        "multiple": false
      },
      {
        "code": "ultima_visita_dental",
        "name": "Última visita al odontólogo",
        "dataType": "date",
        "required": false,
        "section": "Antecedentes bucales"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan"
      }
    ]
  },
  {
    "code": "ODONTO_ODONTOGRAMA_OMS",
    "name": "Odontograma y evaluación bucodental (OMS)",
    "version": 3,
    "specialty": "ODONTOLOGIA",
    "provenance": {
      "sourceTitle": "Oral health surveys: basic methods — 5th edition (formularios de evaluación bucodental)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548649",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "5.ª edición, 2013",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de los ítems del formulario de evaluación. Desde la v2 el estado por pieza se registra en `odontograma_fdi`, un mapa de pieza FDI a código de estado de la OMS (0-9, T) que dibuja el control de odontograma; `estado_por_pieza` queda como observaciones en prosa y dejó de ser obligatorio. Las respuestas capturadas con la v1 se siguen leyendo tal cual. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "dolor_dental",
        "name": "Dolor dental",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "dolor_dental_pieza",
        "name": "¿Qué pieza duele? (FDI)",
        "dataType": "string",
        "required": true,
        "showWhen": {
          "field": "dolor_dental",
          "equals": true
        }
      },
      {
        "code": "odontograma_fdi",
        "name": "Odontograma (estado por pieza, notación FDI)",
        "dataType": "json",
        "required": false
      },
      {
        "code": "estado_por_pieza",
        "name": "Observaciones del estado dentario",
        "dataType": "text",
        "required": false
      },
      {
        "code": "dientes_cariados",
        "name": "Dientes cariados (C)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "dientes_perdidos",
        "name": "Dientes perdidos (P)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "dientes_obturados",
        "name": "Dientes obturados (O)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "indice_cpod",
        "name": "Índice CPO-D",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "estado_gingival",
        "name": "Estado gingival",
        "dataType": "text",
        "required": false
      },
      {
        "code": "presencia_de_calculo",
        "name": "Presencia de cálculo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "fluorosis_del_esmalte",
        "name": "Fluorosis del esmalte",
        "dataType": "string",
        "required": false,
        "options": [
          "Normal",
          "Cuestionable",
          "Muy leve",
          "Leve",
          "Moderada",
          "Grave"
        ],
        "multiple": false
      },
      {
        "code": "erosion_dental",
        "name": "Erosión dental",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "traumatismo_dental",
        "name": "Traumatismo dental",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "traumatismo_piezas",
        "name": "¿Qué piezas? (FDI)",
        "dataType": "string",
        "required": true,
        "showWhen": {
          "field": "traumatismo_dental",
          "equals": true
        }
      },
      {
        "code": "lesiones_de_mucosa_oral",
        "name": "Lesiones de la mucosa oral",
        "dataType": "text",
        "required": false
      },
      {
        "code": "uso_de_protesis",
        "name": "Uso de prótesis",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "protesis_tipo",
        "name": "Tipo de prótesis",
        "dataType": "string",
        "required": true,
        "options": [
          "Parcial removible",
          "Total removible",
          "Fija",
          "Sobre implantes"
        ],
        "multiple": false,
        "showWhen": {
          "field": "uso_de_protesis",
          "equals": true
        }
      },
      {
        "code": "urgencia_de_intervencion",
        "name": "Urgencia de intervención",
        "dataType": "string",
        "required": true,
        "options": [
          "No necesita tratamiento",
          "Tratamiento preventivo o de rutina",
          "Tratamiento inmediato (dolor o infección)",
          "Derivación para evaluación completa"
        ],
        "multiple": false
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "OFTALMO_EXAMEN_BASE",
    "name": "Examen oftalmológico — versión general base",
    "version": 2,
    "specialty": "OFTALMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, formatos especiales por especialidad",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del examen oftalmológico básico (agudeza visual, presión intraocular, segmento anterior y posterior). v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: optotipos de Snellen."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "sintomas_oculares",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Motivo de consulta",
        "options": [
          "Baja de visión",
          "Ojo rojo",
          "Dolor ocular",
          "Fotofobia",
          "Secreción",
          "Visión doble",
          "Moscas volantes o destellos",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "usa_correccion_optica",
        "name": "Usa corrección óptica",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo de consulta"
      },
      {
        "code": "correccion_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "options": [
          "Lentes",
          "Lentes de contacto"
        ],
        "multiple": false,
        "showWhen": {
          "field": "usa_correccion_optica",
          "equals": true
        }
      },
      {
        "code": "agudeza_visual_od",
        "name": "Agudeza visual sin corrección OD",
        "dataType": "string",
        "required": true,
        "section": "Agudeza visual (Snellen)",
        "description": "Fracción de Snellen, por ejemplo 20/40."
      },
      {
        "code": "agudeza_visual_oi",
        "name": "Agudeza visual sin corrección OI",
        "dataType": "string",
        "required": true,
        "section": "Agudeza visual (Snellen)"
      },
      {
        "code": "agudeza_visual_corregida_od",
        "name": "Agudeza visual corregida OD",
        "dataType": "string",
        "required": false,
        "section": "Agudeza visual (Snellen)"
      },
      {
        "code": "agudeza_visual_corregida_oi",
        "name": "Agudeza visual corregida OI",
        "dataType": "string",
        "required": false,
        "section": "Agudeza visual (Snellen)"
      },
      {
        "code": "presion_intraocular_od",
        "name": "Presión intraocular OD (mmHg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "presion_intraocular_oi",
        "name": "Presión intraocular OI (mmHg)",
        "dataType": "decimal",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "reflejos_pupilares",
        "name": "Reflejos pupilares",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "motilidad_ocular",
        "name": "Motilidad ocular",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "segmento_anterior_od",
        "name": "Segmento anterior OD",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "segmento_anterior_oi",
        "name": "Segmento anterior OI",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "fondo_de_ojo_od",
        "name": "Fondo de ojo OD",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "fondo_de_ojo_oi",
        "name": "Fondo de ojo OI",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Vicio de refracción",
          "Catarata",
          "Glaucoma",
          "Retinopatía diabética o hipertensiva",
          "Conjuntivitis",
          "Pterigión",
          "Ojo rojo con signos de alarma"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "refraccion_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Miopía",
          "Hipermetropía",
          "Astigmatismo",
          "Presbicia"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Vicio de refracción"
        }
      },
      {
        "code": "catarata_ojo",
        "name": "Ojo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "OD",
          "OI",
          "Ambos"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Catarata"
        }
      },
      {
        "code": "catarata_limita",
        "name": "Limita las actividades diarias",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Catarata"
        }
      },
      {
        "code": "excavacion",
        "name": "Relación copa/disco",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Glaucoma"
        }
      },
      {
        "code": "campimetria",
        "name": "Campimetría alterada",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Glaucoma"
        }
      },
      {
        "code": "retinopatia_grado",
        "name": "Grado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sin retinopatía",
          "No proliferativa leve",
          "No proliferativa moderada",
          "No proliferativa grave",
          "Proliferativa",
          "Edema macular"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Retinopatía diabética o hipertensiva"
        }
      },
      {
        "code": "conjuntivitis_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Viral",
          "Bacteriana",
          "Alérgica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Conjuntivitis"
        }
      },
      {
        "code": "conjuntivitis_bav",
        "name": "Baja de visión o dolor (descartar otra causa)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Conjuntivitis"
        }
      },
      {
        "code": "pterigion_grado",
        "name": "Grado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "I",
          "II",
          "III",
          "IV"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Pterigión"
        }
      },
      {
        "code": "ojo_rojo_alarma",
        "name": "Signos de alarma",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor intenso",
          "Baja de visión",
          "Pupila arreactiva",
          "Opacidad corneal",
          "Trauma"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Ojo rojo con signos de alarma"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "ONCO_EVALUACION_BASE",
    "name": "Evaluación oncológica",
    "version": 2,
    "specialty": "ONCOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico y notas de evolución",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el diagnóstico oncológico y su fecha, el estadio registrado como texto libre, los tratamientos oncológicos recibidos, el estado funcional ECOG como número y la pérdida de peso. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: ECOG, CTCAE (NCI)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "diagnostico_oncologico_conocido",
        "name": "Diagnóstico oncológico conocido",
        "dataType": "string",
        "required": false,
        "section": "Enfermedad oncológica"
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico",
        "dataType": "date",
        "required": false,
        "section": "Enfermedad oncológica"
      },
      {
        "code": "estadio_clinico",
        "name": "Estadio clínico (TNM)",
        "dataType": "string",
        "required": false,
        "section": "Enfermedad oncológica"
      },
      {
        "code": "tratamientos_recibidos",
        "name": "Tratamientos recibidos",
        "dataType": "json",
        "required": false,
        "section": "Enfermedad oncológica",
        "options": [
          "Cirugía",
          "Quimioterapia",
          "Radioterapia",
          "Hormonoterapia",
          "Inmunoterapia",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "tratamientos_oncologicos_recibidos",
        "name": "Tratamientos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Enfermedad oncológica"
      },
      {
        "code": "fecha_del_ultimo_tratamiento",
        "name": "Fecha del último tratamiento",
        "dataType": "date",
        "required": false,
        "section": "Enfermedad oncológica"
      },
      {
        "code": "ecog",
        "name": "Estado funcional ECOG",
        "dataType": "string",
        "required": true,
        "section": "Estado actual",
        "options": [
          "0 — totalmente activo",
          "1 — síntomas, ambulatorio, trabajo liviano",
          "2 — ambulatorio, autocuidado, no trabaja; en cama < 50 % del día",
          "3 — autocuidado limitado; en cama > 50 % del día",
          "4 — totalmente dependiente, postrado"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_actuales",
        "name": "Síntomas actuales",
        "dataType": "text",
        "required": true,
        "section": "Estado actual"
      },
      {
        "code": "dolor",
        "name": "Dolor",
        "dataType": "boolean",
        "required": false,
        "section": "Estado actual"
      },
      {
        "code": "dolor_onco_localizacion",
        "name": "Dolor — ¿dónde se localiza?",
        "dataType": "string",
        "required": true,
        "section": "Estado actual",
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Estado actual",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Estado actual",
        "options": [
          "Opresivo",
          "Punzante",
          "Urente (ardor)",
          "Cólico",
          "Pulsátil",
          "Sordo",
          "Lancinante",
          "Eléctrico o en descarga"
        ],
        "multiple": false,
        "allowOther": true,
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Estado actual",
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Estado actual",
        "showWhen": {
          "field": "dolor_onco_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Estado actual",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Estado actual",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "dolor_onco_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Estado actual",
        "showWhen": {
          "field": "dolor",
          "equals": true
        }
      },
      {
        "code": "perdida_de_peso",
        "name": "Pérdida de peso",
        "dataType": "boolean",
        "required": false,
        "section": "Estado actual"
      },
      {
        "code": "perdida_peso_porcentaje",
        "name": "Porcentaje del peso perdido en 6 meses",
        "dataType": "decimal",
        "required": true,
        "section": "Estado actual",
        "showWhen": {
          "field": "perdida_de_peso",
          "equals": true
        }
      },
      {
        "code": "peso_actual_kg",
        "name": "Peso actual (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Estado actual"
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false,
        "section": "Estado actual"
      },
      {
        "code": "antecedentes_familiares_oncologicos",
        "name": "Antecedentes familiares oncológicos",
        "dataType": "text",
        "required": false,
        "section": "Estado actual"
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "estudios_complementarios",
        "name": "Estudios complementarios",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Sospecha de neoplasia (estudio inicial)",
          "Toxicidad del tratamiento",
          "Progresión de enfermedad",
          "Control de síntomas y cuidados paliativos",
          "Emergencia oncológica"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "neo_alarma",
        "name": "Signos de alarma",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Masa palpable",
          "Adenopatía dura o fija",
          "Sangrado no explicado",
          "Pérdida de peso",
          "Síntomas B"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de neoplasia (estudio inicial)"
        }
      },
      {
        "code": "neo_biopsia",
        "name": "Biopsia — estado",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de neoplasia (estudio inicial)"
        }
      },
      {
        "code": "toxicidad",
        "name": "Toxicidad",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Neutropenia febril",
          "Mucositis",
          "Náuseas y vómitos",
          "Diarrea",
          "Neuropatía",
          "Cardiotoxicidad"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Toxicidad del tratamiento"
        }
      },
      {
        "code": "ctcae_grado",
        "name": "Grado CTCAE",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Toxicidad del tratamiento"
        }
      },
      {
        "code": "progresion_sitio",
        "name": "Sitio de progresión",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Progresión de enfermedad"
        }
      },
      {
        "code": "paliativos_sintomas",
        "name": "Síntomas a controlar",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Dolor",
          "Disnea",
          "Náuseas",
          "Constipación",
          "Delirio",
          "Ansiedad"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Control de síntomas y cuidados paliativos"
        }
      },
      {
        "code": "voluntades",
        "name": "Conversación sobre voluntades anticipadas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Control de síntomas y cuidados paliativos"
        }
      },
      {
        "code": "emergencia_onco",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Compresión medular",
          "Síndrome de vena cava superior",
          "Hipercalcemia",
          "Síndrome de lisis tumoral",
          "Neutropenia febril"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Emergencia oncológica"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "ORL_EVALUACION_BASE",
    "name": "Evaluación otorrinolaringológica",
    "version": 2,
    "specialty": "OTORRINOLARINGOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen de cabeza y cuello",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen dirigido, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis otológica (hipoacusia, lado afectado, otalgia, otorrea, acúfenos, vértigo), la nasal y faringolaríngea (obstrucción nasal, epistaxis, odinofagia, disfonía) y la otoscopia y la rinoscopia anterior descritas en prosa. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación ARIA, maniobra de Dix-Hallpike."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "hipoacusia",
        "name": "Hipoacusia",
        "dataType": "boolean",
        "required": false,
        "section": "Oído"
      },
      {
        "code": "lado_afectado",
        "name": "Lado afectado",
        "dataType": "string",
        "required": true,
        "section": "Oído",
        "options": [
          "Derecho",
          "Izquierdo",
          "Bilateral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hipoacusia",
          "equals": true
        }
      },
      {
        "code": "hipoacusia_inicio",
        "name": "Inicio",
        "dataType": "string",
        "required": false,
        "section": "Oído",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hipoacusia",
          "equals": true
        }
      },
      {
        "code": "otalgia",
        "name": "Otalgia",
        "dataType": "boolean",
        "required": false,
        "section": "Oído"
      },
      {
        "code": "otalgia_lado",
        "name": "Lado",
        "dataType": "string",
        "required": true,
        "section": "Oído",
        "options": [
          "Derecho",
          "Izquierdo",
          "Bilateral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "otalgia",
          "equals": true
        }
      },
      {
        "code": "otorrea",
        "name": "Otorrea",
        "dataType": "boolean",
        "required": false,
        "section": "Oído"
      },
      {
        "code": "otorrea_aspecto",
        "name": "Aspecto",
        "dataType": "string",
        "required": true,
        "section": "Oído",
        "options": [
          "Serosa",
          "Purulenta",
          "Hemática"
        ],
        "multiple": false,
        "showWhen": {
          "field": "otorrea",
          "equals": true
        }
      },
      {
        "code": "acufenos",
        "name": "Acúfenos",
        "dataType": "boolean",
        "required": false,
        "section": "Oído"
      },
      {
        "code": "acufenos_lado",
        "name": "Lado",
        "dataType": "string",
        "required": true,
        "section": "Oído",
        "options": [
          "Derecho",
          "Izquierdo",
          "Bilateral"
        ],
        "multiple": false,
        "showWhen": {
          "field": "acufenos",
          "equals": true
        }
      },
      {
        "code": "acufenos_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": false,
        "section": "Oído",
        "options": [
          "Continuo",
          "Pulsátil"
        ],
        "multiple": false,
        "showWhen": {
          "field": "acufenos",
          "equals": true
        }
      },
      {
        "code": "vertigo",
        "name": "Vértigo",
        "dataType": "boolean",
        "required": false,
        "section": "Oído"
      },
      {
        "code": "obstruccion_nasal",
        "name": "Obstrucción nasal",
        "dataType": "boolean",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "epistaxis",
        "name": "Epistaxis",
        "dataType": "boolean",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "epistaxis_frecuencia",
        "name": "Frecuencia",
        "dataType": "string",
        "required": true,
        "section": "Nariz y garganta",
        "options": [
          "Episodio único",
          "Recurrente"
        ],
        "multiple": false,
        "showWhen": {
          "field": "epistaxis",
          "equals": true
        }
      },
      {
        "code": "odinofagia",
        "name": "Odinofagia",
        "dataType": "boolean",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "disfonia",
        "name": "Disfonía",
        "dataType": "boolean",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "disfonia_semanas",
        "name": "Semanas de evolución",
        "dataType": "integer",
        "required": true,
        "section": "Nariz y garganta",
        "description": "Más de 3 semanas en fumador: laringoscopía.",
        "showWhen": {
          "field": "disfonia",
          "equals": true
        }
      },
      {
        "code": "antecedentes_otorrinolaringologicos",
        "name": "Antecedentes otorrinolaringológicos",
        "dataType": "text",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Nariz y garganta"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Nariz y garganta",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "alergias",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Nariz y garganta",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "otoscopia",
        "name": "Otoscopía",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "rinoscopia_anterior",
        "name": "Rinoscopía anterior",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examen_de_cuello",
        "name": "Examen de cuello",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Otitis media aguda",
          "Otitis externa",
          "Faringoamigdalitis",
          "Rinosinusitis",
          "Rinitis alérgica",
          "Hipoacusia súbita",
          "Vértigo periférico"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "oma_abombamiento",
        "name": "Membrana timpánica abombada",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Otitis media aguda"
        }
      },
      {
        "code": "oma_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Otitis media aguda"
        }
      },
      {
        "code": "oe_dolor_trago",
        "name": "Dolor a la presión del trago",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Otitis externa"
        }
      },
      {
        "code": "oe_diabetes",
        "name": "Diabetes (riesgo de otitis maligna)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Otitis externa"
        }
      },
      {
        "code": "centor_fiebre_orl",
        "name": "Fiebre > 38 °C",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Faringoamigdalitis"
        }
      },
      {
        "code": "centor_exudado_orl",
        "name": "Exudado amigdalino",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Faringoamigdalitis"
        }
      },
      {
        "code": "centor_adenopatias_orl",
        "name": "Adenopatías cervicales dolorosas",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Faringoamigdalitis"
        }
      },
      {
        "code": "centor_sin_tos_orl",
        "name": "Ausencia de tos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Faringoamigdalitis"
        }
      },
      {
        "code": "rinosinusitis_dias",
        "name": "Días de evolución",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "description": "Más de 10 días o empeoramiento tras mejoría: bacteriana probable.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Rinosinusitis"
        }
      },
      {
        "code": "rinosinusitis_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Rinorrea purulenta",
          "Dolor facial",
          "Hiposmia",
          "Fiebre"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Rinosinusitis"
        }
      },
      {
        "code": "rinitis_aria",
        "name": "Clasificación ARIA",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Intermitente leve",
          "Intermitente moderada-grave",
          "Persistente leve",
          "Persistente moderada-grave"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Rinitis alérgica"
        }
      },
      {
        "code": "audiometria",
        "name": "Audiometría",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hipoacusia súbita"
        }
      },
      {
        "code": "dix_hallpike_orl",
        "name": "Dix-Hallpike",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Vértigo periférico"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "PATOL_INFORME_BASE",
    "name": "Informe de anatomía patológica",
    "version": 2,
    "specialty": "PATOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, informe de exámenes auxiliares y estudios anatomopatológicos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común del documento clínico: motivo o indicación del estudio, descripción de lo observado, conclusión diagnóstica y conducta o recomendación. Son agregados propios de la especialidad la trazabilidad de la muestra (tipo, procedencia anatómica, fecha de toma, tipo de fijación, estado de la muestra) y la separación entre descripción macroscópica, descripción microscópica y técnicas especiales. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_clinico_presuntivo",
        "name": "Diagnóstico clínico presuntivo",
        "dataType": "text",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "tipo_de_muestra",
        "name": "Tipo de muestra",
        "dataType": "string",
        "required": true,
        "section": "Solicitud",
        "options": [
          "Biopsia",
          "Pieza quirúrgica",
          "Citología",
          "Punción aspirativa con aguja fina",
          "Autopsia"
        ],
        "multiple": false
      },
      {
        "code": "procedencia_anatomica",
        "name": "Procedencia anatómica",
        "dataType": "string",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "procedimiento_de_obtencion",
        "name": "Procedimiento de obtención",
        "dataType": "string",
        "required": false,
        "section": "Solicitud",
        "options": [
          "Biopsia incisional",
          "Biopsia escisional",
          "Endoscopía",
          "Punción",
          "Resección quirúrgica",
          "Raspado"
        ],
        "multiple": false
      },
      {
        "code": "fecha_de_toma",
        "name": "Fecha de toma",
        "dataType": "date",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "fecha_de_recepcion",
        "name": "Fecha de recepción",
        "dataType": "date",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "numero_de_frascos",
        "name": "Número de frascos",
        "dataType": "integer",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "tipo_de_fijacion",
        "name": "Fijación",
        "dataType": "string",
        "required": false,
        "section": "Solicitud",
        "options": [
          "Formol al 10 %",
          "Alcohol",
          "En fresco",
          "Otra"
        ],
        "multiple": false
      },
      {
        "code": "estado_muestra",
        "name": "Estado de la muestra",
        "dataType": "string",
        "required": false,
        "section": "Solicitud",
        "options": [
          "Adecuada",
          "Insuficiente",
          "Mal fijada",
          "Rechazada"
        ],
        "multiple": false
      },
      {
        "code": "estado_de_la_muestra",
        "name": "¿Por qué?",
        "dataType": "text",
        "required": true,
        "section": "Solicitud",
        "showWhen": {
          "field": "estado_muestra",
          "equals": [
            "Insuficiente",
            "Mal fijada",
            "Rechazada"
          ]
        }
      },
      {
        "code": "descripcion_macroscopica",
        "name": "Descripción macroscópica",
        "dataType": "text",
        "required": true,
        "section": "Informe"
      },
      {
        "code": "descripcion_microscopica",
        "name": "Descripción microscópica",
        "dataType": "text",
        "required": true,
        "section": "Informe"
      },
      {
        "code": "hubo_tecnicas_especiales",
        "name": "Se usaron técnicas especiales",
        "dataType": "boolean",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "tecnicas_especiales",
        "name": "¿Cuáles? (inmunohistoquímica, tinciones)",
        "dataType": "text",
        "required": true,
        "section": "Informe",
        "showWhen": {
          "field": "hubo_tecnicas_especiales",
          "equals": true
        }
      },
      {
        "code": "estudio_comparativo_previo",
        "name": "Estudio comparativo previo",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "malignidad",
        "name": "Malignidad",
        "dataType": "string",
        "required": false,
        "section": "Informe",
        "options": [
          "Benigno",
          "Displasia o lesión precursora",
          "Maligno",
          "Indeterminado"
        ],
        "multiple": false
      },
      {
        "code": "margenes",
        "name": "Márgenes",
        "dataType": "string",
        "required": true,
        "section": "Informe",
        "showWhen": {
          "field": "malignidad",
          "equals": "Maligno"
        }
      },
      {
        "code": "grado_histologico",
        "name": "Grado histológico",
        "dataType": "string",
        "required": false,
        "section": "Informe",
        "showWhen": {
          "field": "malignidad",
          "equals": "Maligno"
        }
      },
      {
        "code": "observaciones",
        "name": "Observaciones",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico anatomopatológico",
        "dataType": "text",
        "required": true,
        "section": "Informe"
      },
      {
        "code": "conducta",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      }
    ]
  },
  {
    "code": "PEDIA_CONTROL_NINO_SANO",
    "name": "Control de niño sano",
    "version": 2,
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, atención integral del niño",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del control periódico. Las curvas de crecimiento van en su propio formulario (PEDIA_CURVAS_CRECIMIENTO_OMS). v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true,
        "section": "Datos del control"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Datos del control"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": true,
        "section": "Datos del control"
      },
      {
        "code": "perimetro_cefalico_cm",
        "name": "Perímetro cefálico (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Datos del control"
      },
      {
        "code": "estado_nutricional",
        "name": "Estado nutricional (curvas OMS)",
        "dataType": "string",
        "required": false,
        "section": "Datos del control",
        "options": [
          "Normal",
          "Riesgo de desnutrición",
          "Desnutrición aguda moderada",
          "Desnutrición aguda grave",
          "Talla baja",
          "Sobrepeso",
          "Obesidad"
        ],
        "multiple": false
      },
      {
        "code": "lactancia_materna_exclusiva",
        "name": "Lactancia materna exclusiva (menores de 6 meses)",
        "dataType": "boolean",
        "required": false,
        "section": "Alimentación"
      },
      {
        "code": "alimentacion_tipo",
        "name": "Alimentación",
        "dataType": "string",
        "required": false,
        "section": "Alimentación",
        "options": [
          "Lactancia exclusiva",
          "Lactancia y fórmula",
          "Fórmula",
          "Lactancia y alimentación complementaria",
          "Dieta familiar"
        ],
        "multiple": false
      },
      {
        "code": "alimentacion",
        "name": "Alimentación — detalle",
        "dataType": "text",
        "required": false,
        "section": "Alimentación"
      },
      {
        "code": "suplementos",
        "name": "Recibe suplementos",
        "dataType": "boolean",
        "required": false,
        "section": "Alimentación"
      },
      {
        "code": "suplementos_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Alimentación",
        "options": [
          "Hierro",
          "Vitamina A",
          "Chispitas nutricionales",
          "Zinc"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "suplementos",
          "equals": true
        }
      },
      {
        "code": "vacunas_al_dia",
        "name": "Vacunas al día según el esquema nacional",
        "dataType": "boolean",
        "required": true,
        "section": "Vacunas y desarrollo"
      },
      {
        "code": "vacunas_faltantes",
        "name": "¿Cuáles faltan?",
        "dataType": "json",
        "required": true,
        "section": "Vacunas y desarrollo",
        "options": [
          "BCG",
          "Pentavalente",
          "Antipolio",
          "Rotavirus",
          "Neumococo",
          "SRP",
          "Fiebre amarilla",
          "Influenza",
          "Varicela"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "vacunas_al_dia",
          "equals": false
        }
      },
      {
        "code": "desarrollo_global",
        "name": "Desarrollo psicomotor para la edad",
        "dataType": "string",
        "required": false,
        "section": "Vacunas y desarrollo",
        "options": [
          "Adecuado",
          "Con alerta",
          "Con retraso"
        ],
        "multiple": false
      },
      {
        "code": "desarrollo_areas",
        "name": "¿En qué áreas?",
        "dataType": "json",
        "required": true,
        "section": "Vacunas y desarrollo",
        "options": [
          "Motor grueso",
          "Motor fino",
          "Lenguaje",
          "Social"
        ],
        "multiple": true,
        "showWhen": {
          "field": "desarrollo_global",
          "equals": [
            "Con alerta",
            "Con retraso"
          ]
        }
      },
      {
        "code": "desarrollo_motor",
        "name": "Motor — detalle",
        "dataType": "text",
        "required": false,
        "section": "Vacunas y desarrollo",
        "showWhen": {
          "field": "desarrollo_global",
          "equals": [
            "Con alerta",
            "Con retraso"
          ]
        }
      },
      {
        "code": "desarrollo_del_lenguaje",
        "name": "Lenguaje — detalle",
        "dataType": "text",
        "required": false,
        "section": "Vacunas y desarrollo",
        "showWhen": {
          "field": "desarrollo_global",
          "equals": [
            "Con alerta",
            "Con retraso"
          ]
        }
      },
      {
        "code": "desarrollo_social",
        "name": "Social — detalle",
        "dataType": "text",
        "required": false,
        "section": "Vacunas y desarrollo",
        "showWhen": {
          "field": "desarrollo_global",
          "equals": [
            "Con alerta",
            "Con retraso"
          ]
        }
      },
      {
        "code": "agudeza_visual",
        "name": "Tamizaje visual",
        "dataType": "string",
        "required": false,
        "section": "Vacunas y desarrollo",
        "options": [
          "Normal",
          "Alterado",
          "No realizado"
        ],
        "multiple": false
      },
      {
        "code": "tamizaje_auditivo",
        "name": "Tamizaje auditivo",
        "dataType": "string",
        "required": false,
        "section": "Vacunas y desarrollo",
        "options": [
          "Normal",
          "Alterado",
          "No realizado"
        ],
        "multiple": false
      },
      {
        "code": "salud_bucal",
        "name": "Salud bucal",
        "dataType": "text",
        "required": false,
        "section": "Vacunas y desarrollo"
      },
      {
        "code": "signos_de_peligro",
        "name": "Signos generales de peligro",
        "dataType": "json",
        "required": true,
        "section": "Signos de peligro (AIEPI)",
        "options": [
          "No puede beber ni tomar el pecho",
          "Vomita todo",
          "Convulsiones",
          "Letárgico o inconsciente",
          "Ninguno"
        ],
        "multiple": true,
        "description": "Cualquiera presente: referencia urgente."
      },
      {
        "code": "signos_de_alarma",
        "name": "Otros signos de alarma — detalle",
        "dataType": "text",
        "required": false,
        "section": "Signos de peligro (AIEPI)"
      },
      {
        "code": "motivo_agregado",
        "name": "Motivo agregado al control",
        "dataType": "string",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "options": [
          "Niño sano, sin otro motivo",
          "Infección respiratoria aguda",
          "Enfermedad diarreica aguda",
          "Anemia",
          "Desnutrición"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "centor_fiebre",
        "name": "Fiebre mayor a 38 °C",
        "dataType": "boolean",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "centor_sin_tos",
        "name": "Ausencia de tos",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "centor_adenopatias",
        "name": "Adenopatías cervicales anteriores dolorosas",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "centor_exudado",
        "name": "Exudado o tumefacción amigdalina",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "ira_rinorrea",
        "name": "Rinorrea",
        "dataType": "string",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "options": [
          "Ausente",
          "Acuosa",
          "Purulenta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "fr_por_minuto",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "description": "Respiración rápida: ≥ 50 de 2 a 11 meses; ≥ 40 de 1 a 4 años.",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "tiraje",
        "name": "Tiraje subcostal",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Infección respiratoria aguda"
        }
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false,
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Enfermedad diarreica aguda"
        }
      },
      {
        "code": "anemia_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "description": "Ajustar por altitud de residencia.",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "options": [
          "Astenia",
          "Disnea de esfuerzo",
          "Palpitaciones",
          "Pica",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_perdidas",
        "name": "Posibles pérdidas",
        "dataType": "json",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "options": [
          "Menstruación abundante",
          "Sangrado digestivo",
          "Parasitosis",
          "Ninguna conocida"
        ],
        "multiple": true,
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Anemia"
        }
      },
      {
        "code": "anemia_vcm",
        "name": "VCM y ferritina, si se conocen",
        "dataType": "string",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Anemia"
        }
      },
      {
        "code": "z_peso_talla",
        "name": "Puntaje Z peso/talla",
        "dataType": "decimal",
        "required": true,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Desnutrición"
        }
      },
      {
        "code": "edema_bilateral",
        "name": "Edema bilateral (kwashiorkor)",
        "dataType": "boolean",
        "required": false,
        "section": "Motivo agregado y observaciones",
        "showWhen": {
          "field": "motivo_agregado",
          "equals": "Desnutrición"
        }
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Próximo control"
      }
    ]
  },
  {
    "code": "PEDIA_CURVAS_CRECIMIENTO_OMS",
    "name": "Curvas de crecimiento (patrones OMS)",
    "version": 2,
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Patrones de crecimiento infantil de la OMS (WHO Child Growth Standards)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/es/news-room/questions-and-answers/item/child-growth-standards",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "OMS 2006 (0–5 años) y OMS 2007 (5–19 años)",
      "retrievedAt": "2026-08-14",
      "note": "Registra las mediciones y sus puntuaciones Z. Las tablas de referencia no se transcriben: se consultan en la fuente. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "fecha_de_medicion",
        "name": "Fecha de medición",
        "dataType": "date",
        "required": true,
        "section": "Medición"
      },
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true,
        "section": "Medición"
      },
      {
        "code": "sexo",
        "name": "Sexo",
        "dataType": "string",
        "required": true,
        "section": "Medición",
        "options": [
          "Niña",
          "Niño"
        ],
        "multiple": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Medición"
      },
      {
        "code": "talla_cm",
        "name": "Longitud o talla (cm)",
        "dataType": "decimal",
        "required": true,
        "section": "Medición"
      },
      {
        "code": "posicion_medicion",
        "name": "Medido",
        "dataType": "string",
        "required": false,
        "section": "Medición",
        "options": [
          "Acostado (longitud)",
          "De pie (talla)"
        ],
        "multiple": false
      },
      {
        "code": "perimetro_cefalico_cm",
        "name": "Perímetro cefálico (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Medición"
      },
      {
        "code": "imc",
        "name": "IMC (kg/m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Medición"
      },
      {
        "code": "z_peso_para_la_edad",
        "name": "Z peso para la edad",
        "dataType": "decimal",
        "required": false,
        "section": "Puntajes Z (patrones OMS)"
      },
      {
        "code": "z_talla_para_la_edad",
        "name": "Z talla para la edad",
        "dataType": "decimal",
        "required": false,
        "section": "Puntajes Z (patrones OMS)"
      },
      {
        "code": "z_peso_para_la_talla",
        "name": "Z peso para la talla",
        "dataType": "decimal",
        "required": false,
        "section": "Puntajes Z (patrones OMS)"
      },
      {
        "code": "z_imc_para_la_edad",
        "name": "Z IMC para la edad",
        "dataType": "decimal",
        "required": false,
        "section": "Puntajes Z (patrones OMS)"
      },
      {
        "code": "clasificacion_nutricional",
        "name": "Clasificación nutricional",
        "dataType": "string",
        "required": true,
        "section": "Puntajes Z (patrones OMS)",
        "options": [
          "Normal",
          "Desnutrición aguda moderada (Z −2 a −3)",
          "Desnutrición aguda grave (Z < −3)",
          "Talla baja (Z talla < −2)",
          "Riesgo de sobrepeso",
          "Sobrepeso (Z > 2)",
          "Obesidad (Z > 3)"
        ],
        "multiple": false
      }
    ]
  },
  {
    "code": "PSICO_EVALUACION_BASE",
    "name": "Evaluación psicológica",
    "version": 2,
    "specialty": "PSICOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes personales y familiares y examen mental",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se toma la estructura común de la historia clínica: motivo de consulta, tiempo de evolución, antecedentes personales y familiares, examen, diagnóstico y conducta. Son agregados propios de la especialidad la descripción en prosa del estado de ánimo y la ansiedad, el sueño, el apetito, la situación vital actual, la red de apoyo y el riesgo referido, tomados de la entrevista psicológica de consultorio. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), SRQ-20 (OMS)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "antecedentes_tratamiento_psicologico",
        "name": "Tratamiento psicológico previo",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_tratamiento_psiquiatrico",
        "name": "Tratamiento psiquiátrico previo",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_actual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "antecedentes_familiares_salud_mental",
        "name": "Antecedentes familiares de salud mental",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "situacion_vital_actual",
        "name": "Situación vital actual",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): preguntas respondidas «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "¿Tiene frecuentes dolores de cabeza?",
          "¿Tiene mal apetito?",
          "¿Duerme mal?",
          "¿Se asusta con facilidad?",
          "¿Sufre de temblor de manos?",
          "¿Se siente nervioso, tenso o aburrido?",
          "¿Sufre de mala digestión?",
          "¿No puede pensar con claridad?",
          "¿Se siente triste?",
          "¿Llora usted con mucha frecuencia?",
          "¿Tiene dificultad en disfrutar sus actividades diarias?",
          "¿Tiene dificultad para tomar decisiones?",
          "¿Tiene dificultad en hacer su trabajo?",
          "¿Es incapaz de desempeñar un papel útil en su vida?",
          "¿Ha perdido interés en las cosas?",
          "¿Siente que usted es una persona inútil?",
          "¿Ha tenido la idea de acabar con su vida?",
          "¿Se siente cansado todo el tiempo?",
          "¿Tiene sensaciones desagradables en su estómago?",
          "¿Se cansa con facilidad?"
        ],
        "multiple": true
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total (0–20)",
        "dataType": "integer",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "estado_de_animo",
        "name": "Estado de ánimo",
        "dataType": "text",
        "required": true,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "ansiedad",
        "name": "Ansiedad",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "sueno_calidad",
        "name": "Sueño",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "Normal",
          "Insomnio de conciliación",
          "Despertares",
          "Hipersomnia"
        ],
        "multiple": false
      },
      {
        "code": "sueno",
        "name": "Sueño — detalle",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "apetito",
        "name": "Apetito",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Tamizaje y áreas",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Tamizaje y áreas",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Tamizaje y áreas",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Tamizaje y áreas",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Tamizaje y áreas",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "consumo_de_sustancias",
        "name": "Consumo de sustancias — detalle",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo",
        "dataType": "text",
        "required": false,
        "section": "Tamizaje y áreas"
      },
      {
        "code": "riesgo_autolesion",
        "name": "Riesgo de autolesión",
        "dataType": "string",
        "required": true,
        "section": "Tamizaje y áreas",
        "options": [
          "Sin ideación",
          "Ideación sin plan",
          "Ideación con plan",
          "Intento reciente"
        ],
        "multiple": false
      },
      {
        "code": "riesgo_referido",
        "name": "Riesgo — detalle y derivación urgente",
        "dataType": "text",
        "required": true,
        "section": "Tamizaje y áreas",
        "showWhen": {
          "field": "riesgo_autolesion",
          "equals": [
            "Ideación con plan",
            "Intento reciente"
          ]
        }
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Trastorno mental común (ansiedad, depresión)",
          "Duelo",
          "Estrés postraumático",
          "Violencia",
          "Problemas de conducta en niños o adolescentes"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "tmc_predominio",
        "name": "Predominio",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Depresivo",
          "Ansioso",
          "Mixto",
          "Somático"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno mental común (ansiedad, depresión)"
        }
      },
      {
        "code": "tmc_meses",
        "name": "Meses de evolución",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno mental común (ansiedad, depresión)"
        }
      },
      {
        "code": "duelo_perdida",
        "name": "Pérdida y fecha",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Duelo"
        }
      },
      {
        "code": "duelo_complicado",
        "name": "Más de 12 meses con deterioro funcional",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Duelo"
        }
      },
      {
        "code": "tept",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Reexperimentación",
          "Evitación",
          "Hiperalerta",
          "Cambios negativos del ánimo"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Estrés postraumático"
        }
      },
      {
        "code": "violencia_tipo",
        "name": "Tipo",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Física",
          "Psicológica",
          "Sexual",
          "Económica"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Violencia"
        }
      },
      {
        "code": "violencia_riesgo_inminente",
        "name": "Riesgo inminente",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Violencia"
        }
      },
      {
        "code": "violencia_denuncia",
        "name": "Orientada a la denuncia (Ley 348)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Violencia"
        }
      },
      {
        "code": "conducta_contexto",
        "name": "Contexto escolar y familiar",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Problemas de conducta en niños o adolescentes"
        }
      },
      {
        "code": "observaciones_de_la_entrevista",
        "name": "Observaciones de la entrevista",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "PSIQ_EVALUACION_BASE",
    "name": "Evaluación de salud mental — versión general base",
    "version": 2,
    "specialty": "PSIQUIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, evaluación de salud mental",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del examen mental y la anamnesis psiquiátrica. Los instrumentos con puntaje (PHQ-9, GAD-7, Beck, MMSE) NO se cargaron: ver los pendientes de licencia en el README. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), SRQ-20 (OMS)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta"
      },
      {
        "code": "antecedentes_psiquiatricos",
        "name": "Antecedentes psiquiátricos",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "internaciones_previas",
        "name": "Internaciones psiquiátricas previas",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "internaciones_numero",
        "name": "¿Cuántas?",
        "dataType": "integer",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "internaciones_previas",
          "equals": true
        }
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_fumando",
        "name": "Años fumando",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Fumador actual"
        }
      },
      {
        "code": "anios_sin_fumar",
        "name": "Años desde que dejó de fumar",
        "dataType": "integer",
        "required": false,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tabaco",
          "equals": "Exfumador"
        }
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia consume alguna bebida alcohólica? (AUDIT-C 1)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false
      },
      {
        "code": "audit_c_cantidad",
        "name": "¿Cuántas consumiciones toma en un día de consumo normal? (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión? (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "audit_c_frecuencia",
          "equals": [
            "Una o menos veces al mes",
            "De 2 a 4 veces al mes",
            "De 2 a 3 veces a la semana",
            "4 o más veces a la semana"
          ]
        }
      },
      {
        "code": "otras_sustancias",
        "name": "¿Consume otras sustancias?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "otras_sustancias_cuales",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Hoja de coca (acullicu)",
          "Marihuana",
          "Cocaína o pasta base",
          "Sedantes sin receta"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "otras_sustancias",
          "equals": true
        }
      },
      {
        "code": "consumo_de_sustancias",
        "name": "Consumo de sustancias — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): preguntas respondidas «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Tamizaje",
        "options": [
          "¿Tiene frecuentes dolores de cabeza?",
          "¿Tiene mal apetito?",
          "¿Duerme mal?",
          "¿Se asusta con facilidad?",
          "¿Sufre de temblor de manos?",
          "¿Se siente nervioso, tenso o aburrido?",
          "¿Sufre de mala digestión?",
          "¿No puede pensar con claridad?",
          "¿Se siente triste?",
          "¿Llora usted con mucha frecuencia?",
          "¿Tiene dificultad en disfrutar sus actividades diarias?",
          "¿Tiene dificultad para tomar decisiones?",
          "¿Tiene dificultad en hacer su trabajo?",
          "¿Es incapaz de desempeñar un papel útil en su vida?",
          "¿Ha perdido interés en las cosas?",
          "¿Siente que usted es una persona inútil?",
          "¿Ha tenido la idea de acabar con su vida?",
          "¿Se siente cansado todo el tiempo?",
          "¿Tiene sensaciones desagradables en su estómago?",
          "¿Se cansa con facilidad?"
        ],
        "multiple": true
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total (0–20)",
        "dataType": "integer",
        "required": false,
        "section": "Tamizaje"
      },
      {
        "code": "aspecto_y_actitud",
        "name": "Aspecto y actitud",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "conciencia_y_orientacion",
        "name": "Conciencia y orientación",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "atencion_y_memoria",
        "name": "Atención y memoria",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "lenguaje",
        "name": "Lenguaje",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "pensamiento_curso_y_contenido",
        "name": "Pensamiento: curso y contenido",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "alucinaciones",
        "name": "Alteraciones de la sensopercepción",
        "dataType": "boolean",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "alucinaciones_tipo",
        "name": "¿Cuáles?",
        "dataType": "json",
        "required": true,
        "section": "Examen mental",
        "options": [
          "Auditivas",
          "Visuales",
          "Táctiles",
          "Olfativas"
        ],
        "multiple": true,
        "showWhen": {
          "field": "alucinaciones",
          "equals": true
        }
      },
      {
        "code": "sensopercepcion",
        "name": "Sensopercepción — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen mental",
        "showWhen": {
          "field": "alucinaciones",
          "equals": true
        }
      },
      {
        "code": "afecto_y_estado_de_animo",
        "name": "Afecto y estado de ánimo",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "insight",
        "name": "Juicio e insight",
        "dataType": "string",
        "required": false,
        "section": "Examen mental",
        "options": [
          "Conservado",
          "Parcial",
          "Ausente"
        ],
        "multiple": false
      },
      {
        "code": "juicio_e_insight",
        "name": "Juicio e insight — detalle",
        "dataType": "text",
        "required": false,
        "section": "Examen mental"
      },
      {
        "code": "riesgo_suicida",
        "name": "Riesgo suicida",
        "dataType": "string",
        "required": true,
        "section": "Riesgo",
        "options": [
          "Sin ideación",
          "Ideación sin plan",
          "Ideación con plan",
          "Intento reciente"
        ],
        "multiple": false
      },
      {
        "code": "suicidio_factores",
        "name": "Factores",
        "dataType": "json",
        "required": true,
        "section": "Riesgo",
        "options": [
          "Acceso a medios letales",
          "Intentos previos",
          "Vive solo",
          "Consumo de alcohol",
          "Desesperanza"
        ],
        "multiple": true,
        "showWhen": {
          "field": "riesgo_suicida",
          "equals": [
            "Ideación con plan",
            "Intento reciente"
          ]
        }
      },
      {
        "code": "suicidio_plan_seguridad",
        "name": "Plan de seguridad acordado",
        "dataType": "text",
        "required": true,
        "section": "Riesgo",
        "showWhen": {
          "field": "riesgo_suicida",
          "equals": [
            "Ideación con plan",
            "Intento reciente"
          ]
        }
      },
      {
        "code": "riesgo_de_heteroagresion",
        "name": "Riesgo de heteroagresión",
        "dataType": "string",
        "required": false,
        "section": "Riesgo",
        "options": [
          "Bajo",
          "Moderado",
          "Alto"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Episodio depresivo",
          "Trastorno de ansiedad",
          "Trastorno bipolar",
          "Psicosis",
          "Trastorno por consumo de alcohol",
          "Trastorno por consumo de otras sustancias"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "depresion_criterios",
        "name": "Síntomas (2 semanas o más)",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ánimo deprimido",
          "Anhedonia",
          "Alteración del sueño",
          "Alteración del apetito",
          "Fatiga",
          "Culpa o inutilidad",
          "Dificultad para concentrarse",
          "Enlentecimiento o agitación",
          "Ideas de muerte"
        ],
        "multiple": true,
        "description": "5 o más, incluido ánimo o anhedonia.",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Episodio depresivo"
        }
      },
      {
        "code": "ansiedad_tipo",
        "name": "Presentación",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Generalizada",
          "Crisis de pánico",
          "Fobia social",
          "Fobia específica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno de ansiedad"
        }
      },
      {
        "code": "ansiedad_meses",
        "name": "Meses de evolución",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno de ansiedad"
        }
      },
      {
        "code": "mania",
        "name": "Síntomas maníacos",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Ánimo elevado o irritable",
          "Menos necesidad de dormir",
          "Verborrea",
          "Fuga de ideas",
          "Grandiosidad",
          "Conductas de riesgo"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno bipolar"
        }
      },
      {
        "code": "psicosis_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Delirios",
          "Alucinaciones",
          "Discurso desorganizado",
          "Conducta desorganizada",
          "Síntomas negativos"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Psicosis"
        }
      },
      {
        "code": "psicosis_primer_episodio",
        "name": "Primer episodio",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Psicosis"
        }
      },
      {
        "code": "audit_total",
        "name": "AUDIT completo (0–40)",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno por consumo de alcohol"
        }
      },
      {
        "code": "abstinencia",
        "name": "Signos de abstinencia",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno por consumo de alcohol"
        }
      },
      {
        "code": "sustancia_principal",
        "name": "Sustancia principal",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno por consumo de otras sustancias"
        }
      },
      {
        "code": "sustancia_via_frecuencia",
        "name": "Vía y frecuencia",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Trastorno por consumo de otras sustancias"
        }
      },
      {
        "code": "impresion_diagnostica",
        "name": "Impresión diagnóstica (CIE-10)",
        "dataType": "text",
        "required": true,
        "section": "Impresión y plan"
      },
      {
        "code": "plan_terapeutico",
        "name": "Plan terapéutico",
        "dataType": "text",
        "required": true,
        "section": "Impresión y plan"
      }
    ]
  },
  {
    "code": "RADIO_INFORME_BASE",
    "name": "Informe de estudio por imágenes",
    "version": 2,
    "specialty": "RADIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, informe de exámenes auxiliares por imágenes",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale el molde común del documento clínico: motivo o indicación del estudio, descripción de lo observado, conclusión diagnóstica y conducta o recomendación. Son agregados propios de la especialidad los ítems de identificación técnica del estudio (estudio realizado, región anatómica, técnica y proyecciones, uso de medio de contraste, calidad del estudio) y la comparación con estudios previos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: categorías BI-RADS."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "estudio_realizado",
        "name": "Estudio realizado",
        "dataType": "string",
        "required": true,
        "section": "Solicitud",
        "options": [
          "Radiografía",
          "Ecografía",
          "Tomografía",
          "Resonancia magnética",
          "Mamografía",
          "Densitometría",
          "Fluoroscopía"
        ],
        "multiple": false
      },
      {
        "code": "region_anatomica",
        "name": "Región anatómica",
        "dataType": "string",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "fecha_del_estudio",
        "name": "Fecha del estudio",
        "dataType": "date",
        "required": false,
        "section": "Solicitud"
      },
      {
        "code": "tecnica_y_proyecciones",
        "name": "Técnica y proyecciones",
        "dataType": "text",
        "required": false,
        "section": "Técnica"
      },
      {
        "code": "uso_de_contraste",
        "name": "Uso de contraste",
        "dataType": "boolean",
        "required": false,
        "section": "Técnica"
      },
      {
        "code": "medio_de_contraste_utilizado",
        "name": "¿Qué contraste y por qué vía?",
        "dataType": "string",
        "required": true,
        "section": "Técnica",
        "showWhen": {
          "field": "uso_de_contraste",
          "equals": true
        }
      },
      {
        "code": "reaccion_al_contraste",
        "name": "Hubo reacción al contraste",
        "dataType": "boolean",
        "required": false,
        "section": "Técnica",
        "showWhen": {
          "field": "uso_de_contraste",
          "equals": true
        }
      },
      {
        "code": "calidad",
        "name": "Calidad del estudio",
        "dataType": "string",
        "required": false,
        "section": "Técnica",
        "options": [
          "Óptima",
          "Adecuada",
          "Limitada"
        ],
        "multiple": false
      },
      {
        "code": "calidad_del_estudio",
        "name": "¿Por qué es limitada?",
        "dataType": "text",
        "required": true,
        "section": "Técnica",
        "showWhen": {
          "field": "calidad",
          "equals": "Limitada"
        }
      },
      {
        "code": "hay_previos",
        "name": "Hay estudios previos para comparar",
        "dataType": "boolean",
        "required": false,
        "section": "Técnica"
      },
      {
        "code": "comparacion_estudios_previos",
        "name": "Comparación",
        "dataType": "text",
        "required": true,
        "section": "Técnica",
        "showWhen": {
          "field": "hay_previos",
          "equals": true
        }
      },
      {
        "code": "hallazgos",
        "name": "Hallazgos",
        "dataType": "text",
        "required": true,
        "section": "Informe"
      },
      {
        "code": "hallazgos_incidentales",
        "name": "Hallazgos incidentales",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "incidentes_durante_el_estudio",
        "name": "Incidentes durante el estudio",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "categoria_birads",
        "name": "BI-RADS (sólo mama)",
        "dataType": "string",
        "required": false,
        "section": "Informe",
        "options": [
          "No aplica",
          "0",
          "1",
          "2",
          "3",
          "4",
          "5",
          "6"
        ],
        "multiple": false
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Informe"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿Cuál, a quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Informe",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      },
      {
        "code": "diagnostico",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Informe"
      },
      {
        "code": "conducta",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Informe"
      }
    ]
  },
  {
    "code": "REUMA_EVALUACION_BASE",
    "name": "Evaluación reumatológica",
    "version": 2,
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato locomotor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la caracterización del dolor articular y su ritmo, la rigidez matinal en minutos, el detalle de las articulaciones comprometidas y la tumefacción, y el compromiso cutáneo asociado. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "dolor_articular",
        "name": "Dolor articular",
        "dataType": "text",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "ritmo_del_dolor",
        "name": "Ritmo del dolor",
        "dataType": "string",
        "required": false,
        "section": "Síntomas articulares",
        "options": [
          "Inflamatorio (empeora en reposo, rigidez matinal)",
          "Mecánico (empeora con el uso)",
          "Mixto"
        ],
        "multiple": false
      },
      {
        "code": "rigidez_matinal_minutos",
        "name": "Rigidez matinal (minutos)",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "articulaciones_comprometidas",
        "name": "Articulaciones comprometidas",
        "dataType": "text",
        "required": true,
        "section": "Síntomas articulares"
      },
      {
        "code": "patron_de_compromiso",
        "name": "Patrón de compromiso",
        "dataType": "string",
        "required": false,
        "section": "Síntomas articulares",
        "options": [
          "Monoarticular",
          "Oligoarticular (2–4)",
          "Poliarticular (5 o más)",
          "Axial"
        ],
        "multiple": false
      },
      {
        "code": "articulaciones_tumefactas",
        "name": "Número de articulaciones tumefactas",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "articulaciones_dolorosas",
        "name": "Número de articulaciones dolorosas",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "tumefaccion_articular",
        "name": "Tumefacción articular — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "limitacion_funcional",
        "name": "Limitación funcional",
        "dataType": "text",
        "required": false,
        "section": "Síntomas articulares"
      },
      {
        "code": "extraarticular",
        "name": "Manifestaciones",
        "dataType": "json",
        "required": false,
        "section": "Compromiso extraarticular",
        "options": [
          "Fotosensibilidad",
          "Eritema malar",
          "Úlceras orales",
          "Raynaud",
          "Ojo seco o boca seca",
          "Psoriasis",
          "Uveítis",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "compromiso_cutaneo",
        "name": "Compromiso cutáneo — detalle",
        "dataType": "text",
        "required": false,
        "section": "Compromiso extraarticular"
      },
      {
        "code": "sintomas_sistemicos",
        "name": "Síntomas sistémicos",
        "dataType": "text",
        "required": false,
        "section": "Compromiso extraarticular"
      },
      {
        "code": "antecedentes_familiares_reumatologicos",
        "name": "Antecedentes familiares reumatológicos",
        "dataType": "text",
        "required": false,
        "section": "Compromiso extraarticular"
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false,
        "section": "Compromiso extraarticular"
      },
      {
        "code": "examen_osteoarticular",
        "name": "Examen osteoarticular",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes previos (FR, anti-CCP, ANA, VSG, PCR)",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Artritis reumatoide",
          "Artrosis",
          "Gota",
          "Lupus eritematoso sistémico",
          "Espondiloartritis",
          "Fibromialgia"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "ar_fr_ccp",
        "name": "Factor reumatoide o anti-CCP positivo",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Artritis reumatoide"
        }
      },
      {
        "code": "ar_erosiones",
        "name": "Erosiones en radiografía",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Artritis reumatoide"
        }
      },
      {
        "code": "ar_das28",
        "name": "DAS28",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Artritis reumatoide"
        }
      },
      {
        "code": "artrosis_sitio",
        "name": "Articulaciones",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Rodilla",
          "Cadera",
          "Manos",
          "Columna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Artrosis"
        }
      },
      {
        "code": "artrosis_crepitacion",
        "name": "Crepitación",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Artrosis"
        }
      },
      {
        "code": "acido_urico",
        "name": "Ácido úrico (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Gota"
        }
      },
      {
        "code": "gota_tofos",
        "name": "Tofos",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Gota"
        }
      },
      {
        "code": "gota_podagra",
        "name": "Compromiso de la primera metatarsofalángica",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Gota"
        }
      },
      {
        "code": "les_ana",
        "name": "ANA positivo",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lupus eritematoso sistémico"
        }
      },
      {
        "code": "les_organos",
        "name": "Órganos comprometidos",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Piel",
          "Articulaciones",
          "Riñón",
          "Hematológico",
          "Serosas",
          "Neurológico"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lupus eritematoso sistémico"
        }
      },
      {
        "code": "espondilo_dolor_inflamatorio",
        "name": "Lumbalgia inflamatoria de más de 3 meses",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Espondiloartritis"
        }
      },
      {
        "code": "espondilo_hla_b27",
        "name": "HLA-B27 positivo",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Espondiloartritis"
        }
      },
      {
        "code": "fibro_iid",
        "name": "Índice de dolor generalizado (0–19)",
        "dataType": "integer",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Fibromialgia"
        }
      },
      {
        "code": "fibro_sss",
        "name": "Escala de gravedad de síntomas (0–12)",
        "dataType": "integer",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Fibromialgia"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  },
  {
    "code": "TRANSV_ANAMNESIS_GENERAL",
    "name": "Anamnesis / Historia clínica general",
    "version": 2,
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, formatos de historia clínica",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la estructura de anamnesis del formato oficial. No reproduce ningún instrumento con puntaje propietario. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_enfermedad",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Inicio, curso y síntomas acompañantes, en orden cronológico."
      },
      {
        "code": "antecedentes_cronicos",
        "name": "Enfermedades crónicas conocidas",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Asma",
          "EPOC",
          "Cardiopatía",
          "Enfermedad renal crónica",
          "Enfermedad tiroidea",
          "Cáncer",
          "Tuberculosis",
          "Enfermedad de Chagas",
          "Epilepsia",
          "VIH",
          "Ninguna"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Año de diagnóstico, tratamiento y si está controlada."
      },
      {
        "code": "tuvo_cirugias",
        "name": "¿Tuvo cirugías previas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "antecedentes_quirurgicos",
        "name": "¿Cuáles y en qué año?",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "tuvo_cirugias",
          "equals": true
        }
      },
      {
        "code": "tiene_alergias",
        "name": "¿Tiene alergias conocidas?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "tipo_de_alergia",
        "name": "¿A qué es alérgico?",
        "dataType": "json",
        "required": true,
        "section": "Antecedentes",
        "options": [
          "Medicamentos",
          "Alimentos",
          "Látex",
          "Picadura de insectos",
          "Polen, polvo o ácaros"
        ],
        "multiple": true,
        "allowOther": true,
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "antecedentes_alergicos",
        "name": "¿Cuál exactamente y qué reacción le produjo?",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Por ejemplo: penicilina → urticaria; AINE → broncoespasmo.",
        "showWhen": {
          "field": "tiene_alergias",
          "equals": true
        }
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "antecedentes_familiares_marcados",
        "name": "Antecedentes familiares (padres, hermanos, hijos)",
        "dataType": "json",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Hipertensión arterial",
          "Diabetes mellitus",
          "Cardiopatía isquémica antes de los 55 (H) o 65 (M) años",
          "Accidente cerebrovascular",
          "Cáncer",
          "Enfermedad mental",
          "Ninguno conocido"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares — detalle",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes",
        "description": "Parentesco y edad al diagnóstico."
      },
      {
        "code": "esquema_vacunas",
        "name": "Vacunas",
        "dataType": "string",
        "required": false,
        "section": "Antecedentes",
        "options": [
          "Completo",
          "Incompleto",
          "Desconocido"
        ],
        "multiple": false
      },
      {
        "code": "habito_tabaco",
        "name": "Fuma o fumó",
        "dataType": "boolean",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "tabaco",
        "name": "Consumo de tabaco",
        "dataType": "string",
        "required": true,
        "section": "Hábitos",
        "options": [
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false,
        "showWhen": {
          "field": "habito_tabaco",
          "equals": true
        }
      },
      {
        "code": "cigarrillos_por_dia",
        "name": "Cigarrillos por día",
        "dataType": "integer",
        "required": false,
        "section": "Hábitos",
        "showWhen": {
          "field": "habito_tabaco",
          "equals": true
        }
      },
      {
        "code": "habito_alcohol",
        "name": "Consume alcohol",
        "dataType": "boolean",
        "required": false,
        "section": "Hábitos"
      },
      {
        "code": "audit_c_frecuencia",
        "name": "¿Con qué frecuencia? (AUDIT-C 1)",
        "dataType": "string",
        "required": true,
        "section": "Hábitos",
        "options": [
          "Una o menos veces al mes",
          "De 2 a 4 veces al mes",
          "De 2 a 3 veces a la semana",
          "4 o más veces a la semana"
        ],
        "multiple": false,
        "showWhen": {
          "field": "habito_alcohol",
          "equals": true
        }
      },
      {
        "code": "audit_c_cantidad",
        "name": "Consumiciones en un día normal (AUDIT-C 2)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "1 o 2",
          "3 o 4",
          "5 o 6",
          "7 a 9",
          "10 o más"
        ],
        "multiple": false,
        "showWhen": {
          "field": "habito_alcohol",
          "equals": true
        }
      },
      {
        "code": "audit_c_seis_o_mas",
        "name": "6 o más bebidas en una ocasión (AUDIT-C 3)",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Nunca",
          "Menos de una vez al mes",
          "Mensualmente",
          "Semanalmente",
          "A diario o casi a diario"
        ],
        "multiple": false,
        "showWhen": {
          "field": "habito_alcohol",
          "equals": true
        }
      },
      {
        "code": "habito_actividad_fisica",
        "name": "Actividad física",
        "dataType": "string",
        "required": false,
        "section": "Hábitos",
        "options": [
          "Sedentario",
          "Menos de 150 minutos por semana",
          "150 minutos o más por semana"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_generales",
        "name": "Síntomas generales",
        "dataType": "json",
        "required": false,
        "section": "Revisión por sistemas",
        "options": [
          "Fiebre",
          "Pérdida de peso",
          "Astenia",
          "Sudoración nocturna",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "ros_positivos",
        "name": "Sistemas con síntomas",
        "dataType": "json",
        "required": false,
        "section": "Revisión por sistemas",
        "options": [
          "Respiratorio",
          "Cardiovascular",
          "Digestivo",
          "Urinario",
          "Neurológico",
          "Osteomuscular",
          "Piel",
          "Ginecológico",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "revision_por_sistemas",
        "name": "Revisión por sistemas — detalle de lo positivo",
        "dataType": "text",
        "required": false,
        "section": "Revisión por sistemas"
      },
      {
        "code": "impresion_diagnostica",
        "name": "Impresión diagnóstica",
        "dataType": "text",
        "required": true,
        "section": "Impresión y plan"
      },
      {
        "code": "plan_de_trabajo",
        "name": "Plan de trabajo",
        "dataType": "text",
        "required": false,
        "section": "Impresión y plan"
      }
    ]
  },
  {
    "code": "TRANSV_CONSENTIMIENTO_INFORMADO",
    "name": "Consentimiento informado",
    "version": 2,
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Modelo de consentimiento informado — Resolución 1738",
      "organization": "Ministerio de Salud y Protección Social de Colombia",
      "url": "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VS/ED/VSP/modelo-consentimiento-informado-resolucion-1738.pdf",
      "license": "Documento oficial de acceso público",
      "sourceVersion": "Resolución 1738",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de los campos del modelo oficial. El texto legal de cada procedimiento lo aporta la organización. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "procedimiento_propuesto",
        "name": "Procedimiento propuesto",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "diagnostico_que_lo_motiva",
        "name": "Diagnóstico que lo motiva",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "beneficios_esperados",
        "name": "Beneficios esperados",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "riesgos_y_complicaciones",
        "name": "Riesgos y complicaciones frecuentes y graves",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento"
      },
      {
        "code": "alternativas_disponibles",
        "name": "Alternativas disponibles",
        "dataType": "text",
        "required": false,
        "section": "Procedimiento"
      },
      {
        "code": "consecuencias_de_no_aceptar",
        "name": "Consecuencias de no aceptar",
        "dataType": "text",
        "required": false,
        "section": "Procedimiento"
      },
      {
        "code": "hubo_preguntas",
        "name": "¿El paciente hizo preguntas?",
        "dataType": "boolean",
        "required": false,
        "section": "Procedimiento"
      },
      {
        "code": "preguntas_del_paciente",
        "name": "¿Cuáles y qué se respondió?",
        "dataType": "text",
        "required": true,
        "section": "Procedimiento",
        "showWhen": {
          "field": "hubo_preguntas",
          "equals": true
        }
      },
      {
        "code": "acepta_el_procedimiento",
        "name": "Acepta el procedimiento",
        "dataType": "boolean",
        "required": true,
        "section": "Decisión"
      },
      {
        "code": "motivo_de_rechazo",
        "name": "Motivo del rechazo (disentimiento)",
        "dataType": "text",
        "required": true,
        "section": "Decisión",
        "showWhen": {
          "field": "acepta_el_procedimiento",
          "equals": false
        }
      },
      {
        "code": "otorgado_por_representante",
        "name": "Lo otorga un representante",
        "dataType": "boolean",
        "required": false,
        "section": "Decisión"
      },
      {
        "code": "nombre_del_representante",
        "name": "Nombre del representante",
        "dataType": "string",
        "required": true,
        "section": "Decisión",
        "showWhen": {
          "field": "otorgado_por_representante",
          "equals": true
        }
      },
      {
        "code": "representante_vinculo",
        "name": "Vínculo",
        "dataType": "string",
        "required": true,
        "section": "Decisión",
        "options": [
          "Padre o madre",
          "Tutor legal",
          "Cónyuge",
          "Hijo o hija",
          "Otro familiar"
        ],
        "multiple": false,
        "showWhen": {
          "field": "otorgado_por_representante",
          "equals": true
        }
      },
      {
        "code": "representante_motivo",
        "name": "Motivo",
        "dataType": "string",
        "required": true,
        "section": "Decisión",
        "options": [
          "Menor de edad",
          "Incapacidad para decidir",
          "Urgencia"
        ],
        "multiple": false,
        "showWhen": {
          "field": "otorgado_por_representante",
          "equals": true
        }
      },
      {
        "code": "fecha_de_otorgamiento",
        "name": "Fecha de otorgamiento",
        "dataType": "date",
        "required": true,
        "section": "Decisión"
      }
    ]
  },
  {
    "code": "TRANSV_EPICRISIS",
    "name": "Epicrisis / Resumen de egreso",
    "version": 2,
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Resolución 1995 de 1999 — normas para el manejo de la historia clínica: epicrisis y resumen de egreso",
      "organization": "Ministerio de Salud de Colombia",
      "url": "https://www.minsalud.gov.co/normatividad_nuevo/resoluci%C3%93n%201995%20de%201999.pdf",
      "license": "Norma estatal de acceso público",
      "sourceVersion": "1995 de 1999",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción del contenido mínimo que la norma exige en el resumen de egreso. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "fecha_de_ingreso",
        "name": "Fecha de ingreso",
        "dataType": "date",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "fecha_de_egreso",
        "name": "Fecha de egreso",
        "dataType": "date",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "motivo_de_ingreso",
        "name": "Motivo de ingreso",
        "dataType": "text",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "diagnostico_de_ingreso",
        "name": "Diagnóstico de ingreso",
        "dataType": "text",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "diagnostico_de_egreso",
        "name": "Diagnóstico de egreso (CIE-10)",
        "dataType": "text",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "resumen_de_la_evolucion",
        "name": "Resumen de la evolución",
        "dataType": "text",
        "required": true,
        "section": "Internación"
      },
      {
        "code": "hubo_procedimientos",
        "name": "Se realizaron procedimientos",
        "dataType": "boolean",
        "required": false,
        "section": "Internación"
      },
      {
        "code": "procedimientos_realizados",
        "name": "¿Cuáles y cuándo?",
        "dataType": "text",
        "required": true,
        "section": "Internación",
        "showWhen": {
          "field": "hubo_procedimientos",
          "equals": true
        }
      },
      {
        "code": "hallazgos_relevantes",
        "name": "Hallazgos relevantes",
        "dataType": "text",
        "required": false,
        "section": "Internación"
      },
      {
        "code": "hubo_complicaciones",
        "name": "Hubo complicaciones",
        "dataType": "boolean",
        "required": false,
        "section": "Internación"
      },
      {
        "code": "complicaciones",
        "name": "¿Cuáles?",
        "dataType": "text",
        "required": true,
        "section": "Internación",
        "showWhen": {
          "field": "hubo_complicaciones",
          "equals": true
        }
      },
      {
        "code": "condicion_al_egreso",
        "name": "Condición al egreso",
        "dataType": "string",
        "required": true,
        "section": "Egreso",
        "options": [
          "Alta médica — mejorado",
          "Alta médica — igual",
          "Alta voluntaria",
          "Referido a otro establecimiento",
          "Fallecido"
        ],
        "multiple": false
      },
      {
        "code": "referido_a",
        "name": "¿A qué establecimiento y por qué?",
        "dataType": "string",
        "required": true,
        "section": "Egreso",
        "showWhen": {
          "field": "condicion_al_egreso",
          "equals": "Referido a otro establecimiento"
        }
      },
      {
        "code": "tratamiento_al_egreso",
        "name": "Tratamiento al egreso",
        "dataType": "text",
        "required": true,
        "section": "Egreso"
      },
      {
        "code": "recomendaciones",
        "name": "Recomendaciones y signos de alarma explicados",
        "dataType": "text",
        "required": false,
        "section": "Egreso"
      },
      {
        "code": "control_ambulatorio",
        "name": "Fecha del control ambulatorio",
        "dataType": "date",
        "required": false,
        "section": "Egreso"
      }
    ]
  },
  {
    "code": "TRANSV_EXAMEN_FISICO",
    "name": "Examen físico general",
    "version": 2,
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen físico y funciones vitales",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la sección de funciones vitales y examen por aparatos del formato oficial. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Signos vitales"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Signos vitales"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": true,
        "section": "Signos vitales"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "temperatura",
        "name": "Temperatura axilar (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "saturacion_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Signos vitales"
      },
      {
        "code": "estado_general",
        "name": "Estado general",
        "dataType": "string",
        "required": false,
        "section": "Examen general",
        "options": [
          "Bueno",
          "Regular",
          "Malo"
        ],
        "multiple": false
      },
      {
        "code": "hidratacion",
        "name": "Hidratación",
        "dataType": "string",
        "required": false,
        "section": "Examen general",
        "options": [
          "Hidratado",
          "Deshidratación leve",
          "Deshidratación moderada a grave"
        ],
        "multiple": false
      },
      {
        "code": "coloracion",
        "name": "Coloración",
        "dataType": "json",
        "required": false,
        "section": "Examen general",
        "options": [
          "Normal",
          "Palidez",
          "Ictericia",
          "Cianosis"
        ],
        "multiple": true
      },
      {
        "code": "piel_y_faneras",
        "name": "Piel y faneras",
        "dataType": "text",
        "required": false,
        "section": "Examen general"
      },
      {
        "code": "cabeza_y_cuello",
        "name": "Cabeza y cuello",
        "dataType": "text",
        "required": false,
        "section": "Examen general"
      },
      {
        "code": "respiratorio_normal",
        "name": "Aparato respiratorio",
        "dataType": "string",
        "required": false,
        "section": "Examen por aparatos",
        "options": [
          "Normal",
          "Con hallazgos"
        ],
        "multiple": false
      },
      {
        "code": "aparato_respiratorio",
        "name": "¿Qué hallazgos?",
        "dataType": "text",
        "required": true,
        "section": "Examen por aparatos",
        "showWhen": {
          "field": "respiratorio_normal",
          "equals": "Con hallazgos"
        }
      },
      {
        "code": "cardiovascular_normal",
        "name": "Aparato cardiovascular",
        "dataType": "string",
        "required": false,
        "section": "Examen por aparatos",
        "options": [
          "Normal",
          "Con hallazgos"
        ],
        "multiple": false
      },
      {
        "code": "aparato_cardiovascular",
        "name": "¿Qué hallazgos?",
        "dataType": "text",
        "required": true,
        "section": "Examen por aparatos",
        "showWhen": {
          "field": "cardiovascular_normal",
          "equals": "Con hallazgos"
        }
      },
      {
        "code": "abdomen_normal",
        "name": "Abdomen",
        "dataType": "string",
        "required": false,
        "section": "Examen por aparatos",
        "options": [
          "Normal",
          "Con hallazgos"
        ],
        "multiple": false
      },
      {
        "code": "abdomen",
        "name": "¿Qué hallazgos?",
        "dataType": "text",
        "required": true,
        "section": "Examen por aparatos",
        "showWhen": {
          "field": "abdomen_normal",
          "equals": "Con hallazgos"
        }
      },
      {
        "code": "neurologico_normal",
        "name": "Sistema nervioso",
        "dataType": "string",
        "required": false,
        "section": "Examen por aparatos",
        "options": [
          "Normal",
          "Con hallazgos"
        ],
        "multiple": false
      },
      {
        "code": "sistema_nervioso",
        "name": "¿Qué hallazgos?",
        "dataType": "text",
        "required": true,
        "section": "Examen por aparatos",
        "showWhen": {
          "field": "neurologico_normal",
          "equals": "Con hallazgos"
        }
      },
      {
        "code": "locomotor_normal",
        "name": "Aparato locomotor",
        "dataType": "string",
        "required": false,
        "section": "Examen por aparatos",
        "options": [
          "Normal",
          "Con hallazgos"
        ],
        "multiple": false
      },
      {
        "code": "aparato_locomotor",
        "name": "¿Qué hallazgos?",
        "dataType": "text",
        "required": true,
        "section": "Examen por aparatos",
        "showWhen": {
          "field": "locomotor_normal",
          "equals": "Con hallazgos"
        }
      }
    ]
  },
  {
    "code": "TRAUMA_EVALUACION_BASE",
    "name": "Evaluación musculoesquelética — versión general base",
    "version": 2,
    "specialty": "TRAUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen del aparato locomotor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen locomotor del formato oficial. Las escalas funcionales de sociedades científicas quedaron fuera por licencia — ver README. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación de Gustilo, reglas de Ottawa, escala de fuerza MRC."
    },
    "fields": [
      {
        "code": "mecanismo_de_lesion",
        "name": "Mecanismo de la lesión",
        "dataType": "text",
        "required": true,
        "section": "Lesión"
      },
      {
        "code": "mecanismo_tipo",
        "name": "Tipo de mecanismo",
        "dataType": "string",
        "required": false,
        "section": "Lesión",
        "options": [
          "Caída de propia altura",
          "Caída de altura",
          "Accidente de tránsito",
          "Deportivo",
          "Sobreuso",
          "Sin traumatismo"
        ],
        "multiple": false
      },
      {
        "code": "fecha_de_la_lesion",
        "name": "Fecha de la lesión",
        "dataType": "date",
        "required": false,
        "section": "Lesión"
      },
      {
        "code": "segmento_afectado",
        "name": "Segmento afectado",
        "dataType": "string",
        "required": true,
        "section": "Lesión"
      },
      {
        "code": "lateralidad",
        "name": "Lateralidad",
        "dataType": "string",
        "required": false,
        "section": "Lesión",
        "options": [
          "Derecho",
          "Izquierdo",
          "Bilateral",
          "No aplica"
        ],
        "multiple": false
      },
      {
        "code": "dolor_en_reposo",
        "name": "Dolor en reposo",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "intensidad_del_dolor",
        "name": "Intensidad del dolor (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "impotencia_funcional",
        "name": "Impotencia funcional",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "deformidad",
        "name": "Deformidad",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "deformidad_descripcion",
        "name": "¿Cuál? (angulación, acortamiento, rotación)",
        "dataType": "string",
        "required": true,
        "section": "Dolor y función",
        "showWhen": {
          "field": "deformidad",
          "equals": true
        }
      },
      {
        "code": "edema_local",
        "name": "Edema local",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "equimosis",
        "name": "Equimosis",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "herida",
        "name": "Herida abierta",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función"
      },
      {
        "code": "gustilo",
        "name": "Fractura expuesta (Gustilo)",
        "dataType": "string",
        "required": true,
        "section": "Dolor y función",
        "options": [
          "No hay fractura",
          "Tipo I",
          "Tipo II",
          "Tipo III"
        ],
        "multiple": false,
        "showWhen": {
          "field": "herida",
          "equals": true
        }
      },
      {
        "code": "antitetanica",
        "name": "Vacuna antitetánica al día",
        "dataType": "boolean",
        "required": false,
        "section": "Dolor y función",
        "showWhen": {
          "field": "herida",
          "equals": true
        }
      },
      {
        "code": "rango_de_movilidad",
        "name": "Rango de movilidad",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular (MRC 0 a 5)",
        "dataType": "integer",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "estabilidad_articular",
        "name": "Estabilidad articular",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "neurovascular",
        "name": "Estado neurovascular distal",
        "dataType": "string",
        "required": true,
        "section": "Examen",
        "options": [
          "Conservado",
          "Alterado"
        ],
        "multiple": false
      },
      {
        "code": "neurovascular_alteracion",
        "name": "¿Qué está alterado?",
        "dataType": "json",
        "required": true,
        "section": "Examen",
        "options": [
          "Pulso",
          "Relleno capilar",
          "Sensibilidad",
          "Movilidad",
          "Dolor desproporcionado (síndrome compartimental)"
        ],
        "multiple": true,
        "showWhen": {
          "field": "neurovascular",
          "equals": "Alterado"
        }
      },
      {
        "code": "estado_neurovascular_distal",
        "name": "Estado neurovascular — detalle",
        "dataType": "text",
        "required": true,
        "section": "Examen"
      },
      {
        "code": "imagenes_solicitadas",
        "name": "Imágenes solicitadas",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "hallazgos_imagenologicos",
        "name": "Hallazgos imagenológicos",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Fractura",
          "Esguince",
          "Luxación",
          "Lesión meniscal o ligamentaria de rodilla",
          "Lumbalgia mecánica",
          "Tendinopatía"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "fractura_hueso",
        "name": "Hueso y segmento",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Fractura"
        }
      },
      {
        "code": "fractura_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Cerrada",
          "Expuesta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Fractura"
        }
      },
      {
        "code": "fractura_desplazamiento",
        "name": "Desplazamiento",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "No desplazada",
          "Desplazada",
          "Conminuta"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Fractura"
        }
      },
      {
        "code": "esguince_grado",
        "name": "Grado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "I — distensión",
          "II — rotura parcial",
          "III — rotura completa"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Esguince"
        }
      },
      {
        "code": "ottawa",
        "name": "Reglas de Ottawa positivas (tobillo/rodilla)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Esguince"
        }
      },
      {
        "code": "luxacion_articulacion",
        "name": "Articulación",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Luxación"
        }
      },
      {
        "code": "luxacion_reducida",
        "name": "Reducida",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Luxación"
        }
      },
      {
        "code": "rodilla_pruebas",
        "name": "Pruebas positivas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Lachman",
          "Cajón anterior",
          "McMurray",
          "Bostezo varo/valgo",
          "Ninguna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión meniscal o ligamentaria de rodilla"
        }
      },
      {
        "code": "rodilla_derrame",
        "name": "Derrame",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lesión meniscal o ligamentaria de rodilla"
        }
      },
      {
        "code": "lumbalgia_banderas_trauma",
        "name": "Banderas rojas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Déficit neurológico",
          "Alteración de esfínteres",
          "Fiebre",
          "Antecedente de cáncer",
          "Ninguna"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Lumbalgia mecánica"
        }
      },
      {
        "code": "tendon",
        "name": "Tendón afectado",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Tendinopatía"
        }
      },
      {
        "code": "conducta",
        "name": "Conducta (inmovilización, cirugía, rehabilitación)",
        "dataType": "text",
        "required": true,
        "section": "Conducta"
      }
    ]
  },
  {
    "code": "URO_EVALUACION_BASE",
    "name": "Evaluación urológica",
    "version": 2,
    "specialty": "UROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato genitourinario",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen dirigido, diagnóstico y conducta. Son agregados propios de la especialidad los síntomas del tracto urinario inferior (disuria, hematuria, nicturia, urgencia, características del chorro), los antecedentes de litiasis e infecciones urinarias, y el examen genital y el tacto rectal descritos en prosa. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Con las palabras del paciente."
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true,
        "section": "Motivo de consulta",
        "description": "Por ejemplo: 3 días, 2 semanas, 6 meses."
      },
      {
        "code": "stui",
        "name": "Síntomas del tracto urinario inferior",
        "dataType": "json",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Chorro débil",
          "Esfuerzo miccional",
          "Goteo terminal",
          "Vaciado incompleto",
          "Polaquiuria",
          "Urgencia",
          "Incontinencia",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sintomas_del_tracto_urinario_inferior",
        "name": "Síntomas urinarios — detalle",
        "dataType": "text",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "disuria",
        "name": "Disuria",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "hematuria",
        "name": "Hematuria",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "hematuria_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "options": [
          "Macroscópica",
          "Microscópica"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hematuria",
          "equals": true
        }
      },
      {
        "code": "hematuria_coagulos",
        "name": "Con coágulos",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "hematuria",
          "equals": true
        }
      },
      {
        "code": "nicturia",
        "name": "Nicturia (veces por noche)",
        "dataType": "integer",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "urgencia_miccional",
        "name": "Urgencia miccional",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "caracteristicas_del_chorro_miccional",
        "name": "Chorro miccional",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Normal",
          "Débil",
          "Entrecortado",
          "Bífido"
        ],
        "multiple": false
      },
      {
        "code": "dolor_lumbar",
        "name": "Dolor lumbar",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas"
      },
      {
        "code": "dolor_lumbar_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Opresivo",
          "Punzante",
          "Urente (ardor)",
          "Cólico",
          "Pulsátil",
          "Sordo",
          "Lancinante",
          "Eléctrico o en descarga"
        ],
        "multiple": false,
        "allowOther": true,
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_lumbar_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Síntomas",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Síntomas",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "dolor_lumbar_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Síntomas",
        "showWhen": {
          "field": "dolor_lumbar",
          "equals": true
        }
      },
      {
        "code": "antecedentes_de_litiasis",
        "name": "Antecedente de litiasis",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "infecciones_urinarias_previas",
        "name": "Infecciones urinarias previas",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "cirugias_urologicas_previas",
        "name": "Cirugías urológicas previas",
        "dataType": "text",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "toma_medicacion",
        "name": "¿Toma algún medicamento de forma habitual?",
        "dataType": "boolean",
        "required": false,
        "section": "Antecedentes"
      },
      {
        "code": "medicacion_habitual",
        "name": "¿Cuál? Nombre, dosis y frecuencia",
        "dataType": "text",
        "required": true,
        "section": "Antecedentes",
        "showWhen": {
          "field": "toma_medicacion",
          "equals": true
        }
      },
      {
        "code": "examen_genital",
        "name": "Examen genital",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "tacto_rectal",
        "name": "Tacto rectal",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "examenes_complementarios",
        "name": "Exámenes complementarios",
        "dataType": "text",
        "required": false,
        "section": "Examen"
      },
      {
        "code": "diagnostico_presuntivo",
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Hiperplasia prostática benigna",
          "Sospecha de cáncer de próstata",
          "Litiasis urinaria",
          "Infección urinaria",
          "Hematuria en estudio",
          "Disfunción eréctil"
        ],
        "multiple": false,
        "allowOther": true,
        "description": "Al elegirlo se abren las observaciones que ese cuadro exige registrar."
      },
      {
        "code": "volumen_prostatico",
        "name": "Volumen prostático estimado (mL)",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hiperplasia prostática benigna"
        }
      },
      {
        "code": "residuo_posmiccional",
        "name": "Residuo posmiccional (mL)",
        "dataType": "decimal",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hiperplasia prostática benigna"
        }
      },
      {
        "code": "retencion_previa",
        "name": "Retención urinaria previa",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hiperplasia prostática benigna"
        }
      },
      {
        "code": "psa",
        "name": "PSA total (ng/mL)",
        "dataType": "decimal",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de cáncer de próstata"
        }
      },
      {
        "code": "tacto_prostata",
        "name": "Tacto rectal",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Normal",
          "Nódulo",
          "Indurada",
          "No realizado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Sospecha de cáncer de próstata"
        }
      },
      {
        "code": "lito_tamano",
        "name": "Tamaño y ubicación del lito",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Litiasis urinaria"
        }
      },
      {
        "code": "lito_obstruccion",
        "name": "Hidronefrosis",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Litiasis urinaria"
        }
      },
      {
        "code": "lito_fiebre",
        "name": "Fiebre (urgencia)",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Litiasis urinaria"
        }
      },
      {
        "code": "itu_uro",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Fiebre",
          "Dolor perineal (prostatitis)"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "urocultivo",
        "name": "Urocultivo",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Infección urinaria"
        }
      },
      {
        "code": "hematuria_tabaco",
        "name": "Fumador o exfumador",
        "dataType": "boolean",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hematuria en estudio"
        }
      },
      {
        "code": "hematuria_imagen",
        "name": "Imagen y cistoscopía",
        "dataType": "string",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Hematuria en estudio"
        }
      },
      {
        "code": "de_inicio",
        "name": "Inicio",
        "dataType": "string",
        "required": true,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Gradual",
          "Brusco"
        ],
        "multiple": false,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Disfunción eréctil"
        }
      },
      {
        "code": "de_erecciones_matinales",
        "name": "Conserva erecciones matinales",
        "dataType": "boolean",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Disfunción eréctil"
        }
      },
      {
        "code": "de_factores",
        "name": "Factores asociados",
        "dataType": "json",
        "required": false,
        "section": "Diagnóstico presuntivo y observaciones",
        "options": [
          "Diabetes",
          "Hipertensión",
          "Tabaquismo",
          "Fármacos",
          "Ansiedad o depresión",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "diagnostico_presuntivo",
          "equals": "Disfunción eréctil"
        }
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Diagnóstico y plan"
      },
      {
        "code": "conducta",
        "name": "Conducta y plan",
        "dataType": "text",
        "required": false,
        "section": "Diagnóstico y plan",
        "description": "Tratamiento, estudios pedidos, educación, interconsultas y control."
      }
    ]
  }
];
