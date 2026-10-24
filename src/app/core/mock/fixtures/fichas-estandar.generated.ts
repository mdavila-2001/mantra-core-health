/* ============================================================================
    Las fichas clínicas estándar, portadas del backend.

    **GENERADO por `scripts/gen-chart-templates-fixture.mjs`. No editar a mano.**
    La fuente son los 137 JSON de
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
  /**
   * La clase de ficha: la consulta inicial de la especialidad (`BASE`), el
   * control estándar de una condición (`SPECIFIC`) o una de toda consulta
   * (`GENERAL`).
   */
  readonly kind: 'BASE' | 'SPECIFIC' | 'GENERAL';
  /** Código de `VS_MEDICAL_SPECIALTY`, o `TRANSVERSAL`. */
  readonly specialty: string;
  readonly provenance?: ProcedenciaDeFicha;
  readonly fields: readonly CampoDeFicha[];
}

export const FICHAS_ESTANDAR: readonly FichaEstandar[] = [
  {
    "code": "ANEST_CTRL_RECUPERACION",
    "name": "Recuperación posanestésica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ANESTESIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Puntaje de Aldrete (publicado) para el alta de la sala de recuperación, dolor y náuseas."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "aldrete_actividad",
        "name": "Aldrete — actividad",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: recuperación posanestésica",
        "options": [
          "2 — mueve 4 extremidades",
          "1 — mueve 2",
          "0 — no mueve"
        ],
        "multiple": false
      },
      {
        "code": "aldrete_respiracion",
        "name": "Aldrete — respiración",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: recuperación posanestésica",
        "options": [
          "2 — respira y tose",
          "1 — disnea",
          "0 — apnea"
        ],
        "multiple": false
      },
      {
        "code": "aldrete_circulacion",
        "name": "Aldrete — circulación",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: recuperación posanestésica",
        "options": [
          "2 — PA ± 20 % del basal",
          "1 — ± 20–50 %",
          "0 — ± más de 50 %"
        ],
        "multiple": false
      },
      {
        "code": "aldrete_conciencia",
        "name": "Aldrete — conciencia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: recuperación posanestésica",
        "options": [
          "2 — despierto",
          "1 — responde al llamado",
          "0 — no responde"
        ],
        "multiple": false
      },
      {
        "code": "aldrete_saturacion",
        "name": "Aldrete — saturación",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: recuperación posanestésica",
        "options": [
          "2 — > 92 % al aire",
          "1 — necesita O₂",
          "0 — < 90 % con O₂"
        ],
        "multiple": false
      },
      {
        "code": "aldrete_total",
        "name": "Aldrete — total (alta con ≥ 9)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: recuperación posanestésica"
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: recuperación posanestésica"
      },
      {
        "code": "nauseas",
        "name": "Náuseas o vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: recuperación posanestésica"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ANEST_VALORACION_PREANESTESICA",
    "name": "Anestesiología — valoración preanestésica (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "name": "Bioquímica Clínica — informe general de laboratorio (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "BIOQ_INFORME_HEMOGRAMA",
    "name": "Informe de hemograma",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "BIOQUIMICA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Serie roja, blanca y plaquetas con valores de referencia; la hemoglobina se interpreta según la altitud."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Resultado: hemograma"
      },
      {
        "code": "hematocrito",
        "name": "Hematocrito (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "vcm",
        "name": "VCM (fL)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "hcm",
        "name": "HCM (pg)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "leucocitos",
        "name": "Leucocitos (/µL)",
        "dataType": "integer",
        "required": true,
        "section": "Resultado: hemograma"
      },
      {
        "code": "neutrofilos_pct",
        "name": "Neutrófilos (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "linfocitos_pct",
        "name": "Linfocitos (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "eosinofilos_pct",
        "name": "Eosinófilos (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "plaquetas",
        "name": "Plaquetas (/µL)",
        "dataType": "integer",
        "required": true,
        "section": "Resultado: hemograma"
      },
      {
        "code": "frotis",
        "name": "Frotis de sangre periférica",
        "dataType": "string",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "altitud",
        "name": "Altitud del laboratorio (m s. n. m.)",
        "dataType": "string",
        "required": false,
        "section": "Resultado: hemograma"
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "BIOQ_INFORME_ORINA",
    "name": "Informe de examen general de orina",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "BIOQUIMICA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Examen físico, químico (tira) y sedimento."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "aspecto",
        "name": "Aspecto",
        "dataType": "string",
        "required": false,
        "section": "Resultado: examen de orina",
        "options": [
          "Transparente",
          "Ligeramente turbio",
          "Turbio"
        ],
        "multiple": false
      },
      {
        "code": "densidad",
        "name": "Densidad",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: examen de orina"
      },
      {
        "code": "ph",
        "name": "pH",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: examen de orina"
      },
      {
        "code": "proteinas",
        "name": "Proteínas",
        "dataType": "string",
        "required": false,
        "section": "Resultado: examen de orina",
        "options": [
          "Negativo",
          "Trazas",
          "+",
          "++",
          "+++"
        ],
        "multiple": false
      },
      {
        "code": "glucosa",
        "name": "Glucosa",
        "dataType": "string",
        "required": false,
        "section": "Resultado: examen de orina",
        "options": [
          "Negativo",
          "+",
          "++",
          "+++"
        ],
        "multiple": false
      },
      {
        "code": "nitritos",
        "name": "Nitritos",
        "dataType": "string",
        "required": true,
        "section": "Resultado: examen de orina",
        "options": [
          "Negativo",
          "Positivo"
        ],
        "multiple": false
      },
      {
        "code": "leucocitos_tira",
        "name": "Esterasa leucocitaria",
        "dataType": "string",
        "required": false,
        "section": "Resultado: examen de orina",
        "options": [
          "Negativo",
          "+",
          "++",
          "+++"
        ],
        "multiple": false
      },
      {
        "code": "sedimento",
        "name": "Sedimento (leucocitos, hematíes, cilindros, cristales por campo)",
        "dataType": "string",
        "required": false,
        "section": "Resultado: examen de orina"
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "CARDIO_CTRL_CHAGAS",
    "name": "Control de cardiopatía chagásica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Enfermedad de Chagas (tripanosomiasis americana)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/chagas-disease",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Seguimiento de la enfermedad de Chagas crónica con compromiso cardíaco: serología, tratamiento antiparasitario, ECG y Holter."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad de Chagas",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "chagas_serologia",
        "name": "Serología para Chagas",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad de Chagas",
        "options": [
          "Positiva",
          "Negativa",
          "Pendiente",
          "No realizada"
        ],
        "multiple": false
      },
      {
        "code": "chagas_compromiso",
        "name": "Compromiso orgánico",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas",
        "options": [
          "Cardíaco (arritmia, bloqueo, insuficiencia)",
          "Digestivo (megaesófago, megacolon)",
          "Sin compromiso aparente"
        ],
        "multiple": true
      },
      {
        "code": "chagas_tratamiento_previo",
        "name": "Recibió benznidazol o nifurtimox",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas"
      },
      {
        "code": "chagas_vivienda_endemica",
        "name": "Vivió en vivienda con vinchucas",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas"
      },
      {
        "code": "ecg_chagas",
        "name": "ECG — hallazgo (bloqueo de rama derecha, hemibloqueo, extrasístoles)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas"
      },
      {
        "code": "holter",
        "name": "Holter — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas"
      },
      {
        "code": "fevi_chagas",
        "name": "Fracción de eyección (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas"
      },
      {
        "code": "sintomas_chagas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad de Chagas",
        "options": [
          "Palpitaciones",
          "Síncope",
          "Disnea",
          "Disfagia",
          "Constipación crónica",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Control de vinchucas en la vivienda",
          "Tamizaje de familiares",
          "Tamizaje en embarazo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "CARDIO_CTRL_FA",
    "name": "Control de fibrilación auricular y anticoagulación",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Estructura de la NT 022; riesgo embólico por CHA₂DS₂-VASc y de sangrado por HAS-BLED (puntajes publicados de uso libre)."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de fibrilación auricular",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "fa_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: fibrilación auricular",
        "options": [
          "Paroxística",
          "Persistente",
          "Permanente"
        ],
        "multiple": false
      },
      {
        "code": "fa_estrategia",
        "name": "Estrategia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: fibrilación auricular",
        "options": [
          "Control de frecuencia",
          "Control de ritmo"
        ],
        "multiple": false
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: fibrilación auricular"
      },
      {
        "code": "chads_vasc",
        "name": "CHA₂DS₂-VASc: factores presentes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: fibrilación auricular",
        "options": [
          "Insuficiencia cardíaca",
          "Hipertensión",
          "Edad ≥ 75 (2)",
          "Diabetes",
          "ACV o embolia previa (2)",
          "Enfermedad vascular",
          "Edad 65–74",
          "Sexo femenino"
        ],
        "multiple": true
      },
      {
        "code": "chads_vasc_puntaje",
        "name": "CHA₂DS₂-VASc — puntaje",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: fibrilación auricular"
      },
      {
        "code": "has_bled_puntaje",
        "name": "HAS-BLED — puntaje",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: fibrilación auricular"
      },
      {
        "code": "anticoagulante",
        "name": "Anticoagulación",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: fibrilación auricular",
        "options": [
          "Warfarina o acenocumarol",
          "Anticoagulante directo",
          "Sin anticoagulación"
        ],
        "multiple": false
      },
      {
        "code": "inr",
        "name": "Último INR",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: fibrilación auricular",
        "showWhen": {
          "field": "anticoagulante",
          "equals": "Warfarina o acenocumarol"
        }
      },
      {
        "code": "sangrado",
        "name": "Sangrado desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "sangrado_donde",
        "name": "¿Dónde y de qué gravedad?",
        "dataType": "string",
        "required": true,
        "section": "Complicaciones y daño de órgano",
        "showWhen": {
          "field": "sangrado",
          "equals": true
        }
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Frecuencia en reposo < 110 lpm",
          "INR entre 2 y 3 (si usa warfarina)",
          "Anticoagulado si CHA₂DS₂-VASc lo indica",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Signos de sangrado",
          "Interacciones con otros fármacos",
          "Controles de INR"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "CARDIO_CTRL_HTA",
    "name": "Control de hipertensión arterial",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "HEARTS: paquete técnico para el manejo de las enfermedades cardiovasculares en la atención primaria de salud",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/hearts-technical-package",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Estructura de la visita de control del módulo de hipertensión de HEARTS: cifras, adherencia, daño de órgano blanco y meta < 140/90 (< 130/80 en alto riesgo)."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de hipertensión arterial",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hipertensión arterial",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hipertensión arterial"
      },
      {
        "code": "hta_dano_organo",
        "name": "Daño de órgano blanco conocido",
        "dataType": "json",
        "required": false,
        "section": "Complicaciones y daño de órgano",
        "options": [
          "Hipertrofia ventricular izquierda",
          "Enfermedad renal crónica",
          "Retinopatía",
          "ACV previo",
          "Cardiopatía isquémica",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "creatinina",
        "name": "Última creatinina (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "ecg_hecho",
        "name": "ECG en el último año",
        "dataType": "boolean",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "PA < 140/90 mmHg",
          "PA < 130/80 mmHg (alto riesgo)",
          "No fuma",
          "IMC < 25",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dieta con menos sal",
          "Actividad física",
          "Dejar de fumar",
          "Reducir el alcohol",
          "Adherencia a la medicación",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "CARDIO_CTRL_IC",
    "name": "Control de insuficiencia cardíaca",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Estructura de la historia clínica de la NT 022; contenido de la visita de seguimiento: clase funcional NYHA, signos de congestión (criterios de Framingham), peso seco y fracción de eyección."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de insuficiencia cardíaca",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "ic_clase_nyha",
        "name": "Clase funcional NYHA",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: insuficiencia cardíaca",
        "options": [
          "Clase I — sin limitación de la actividad física",
          "Clase II — limitación leve: síntomas con la actividad ordinaria",
          "Clase III — limitación marcada: síntomas con actividad menor a la ordinaria",
          "Clase IV — síntomas en reposo"
        ],
        "multiple": false
      },
      {
        "code": "ic_signos",
        "name": "Signos y síntomas (Framingham)",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: insuficiencia cardíaca",
        "options": [
          "Ortopnea",
          "Disnea paroxística nocturna",
          "Ingurgitación yugular",
          "Crepitantes pulmonares",
          "Tercer ruido (galope)",
          "Edema de miembros inferiores",
          "Hepatomegalia"
        ],
        "multiple": true
      },
      {
        "code": "ic_edema_grado",
        "name": "Edema (fóvea)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: insuficiencia cardíaca",
        "options": [
          "Sin edema",
          "+ (2 mm)",
          "++ (4 mm)",
          "+++ (6 mm)",
          "++++ (8 mm)"
        ],
        "multiple": false
      },
      {
        "code": "ic_peso_seco",
        "name": "Peso de referencia (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "peso_hoy",
        "name": "Peso de hoy (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "fevi",
        "name": "Última fracción de eyección (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: insuficiencia cardíaca"
      },
      {
        "code": "fevi_tipo",
        "name": "Tipo según fracción de eyección",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: insuficiencia cardíaca",
        "options": [
          "Reducida (≤ 40 %)",
          "Levemente reducida (41–49 %)",
          "Preservada (≥ 50 %)",
          "Sin ecocardiograma"
        ],
        "multiple": false
      },
      {
        "code": "internaciones_ic_anio",
        "name": "Internaciones por insuficiencia cardíaca en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "potasio",
        "name": "Último potasio (mEq/L)",
        "dataType": "decimal",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "creatinina",
        "name": "Última creatinina (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin congestión",
          "Peso estable",
          "Recibe los cuatro pilares de tratamiento si la FE está reducida",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Pesarse todos los días",
          "Restricción de sal y líquidos",
          "Signos de alarma",
          "Adherencia a la medicación"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "CARDIO_CTRL_ISQUEMICA",
    "name": "Control de cardiopatía isquémica (después de un infarto o angina)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "HEARTS: paquete técnico para el manejo de las enfermedades cardiovasculares en la atención primaria de salud",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/hearts-technical-package",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Prevención secundaria según HEARTS: angina residual, metas de PA y LDL, antiagregación y estatina."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de cardiopatía isquémica",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "angina",
        "name": "Angina desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica"
      },
      {
        "code": "angina_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
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
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "showWhen": {
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: cardiopatía isquémica",
        "showWhen": {
          "field": "angina_irradiado",
          "equals": true
        }
      },
      {
        "code": "angina_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: cardiopatía isquémica",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "showWhen": {
          "field": "angina",
          "equals": true
        }
      },
      {
        "code": "angina_ccs",
        "name": "Clase de angina (CCS)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "options": [
          "I — sólo con esfuerzo intenso",
          "II — limitación leve",
          "III — limitación marcada",
          "IV — con mínima actividad o en reposo"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: cardiopatía isquémica"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: cardiopatía isquémica"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica"
      },
      {
        "code": "ldl",
        "name": "Último LDL (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica"
      },
      {
        "code": "prevencion_secundaria",
        "name": "Recibe",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "options": [
          "Aspirina u otro antiagregante",
          "Estatina",
          "Betabloqueante",
          "IECA o ARA II"
        ],
        "multiple": true
      },
      {
        "code": "rehabilitacion_cardiaca",
        "name": "Rehabilitación cardíaca",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cardiopatía isquémica",
        "options": [
          "Completa",
          "En curso",
          "No la hizo"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin angina",
          "PA < 130/80 mmHg",
          "LDL < 55 mg/dL",
          "No fuma",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dieta con menos sal",
          "Actividad física",
          "Dejar de fumar",
          "Reducir el alcohol",
          "Adherencia a la medicación",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "CARDIO_FICHA_BASE",
    "name": "Cardiología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, evaluación cardiovascular",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen cardiovascular del formato oficial. No incluye ninguna escala de sociedad científica. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clase funcional NYHA, escala de Levine."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "kind": "SPECIFIC",
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
    "code": "CIRGEN_CTRL_ABDOMEN_AGUDO",
    "name": "Abdomen agudo: evaluación quirúrgica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CIRUGIA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Semiología del dolor, signos peritoneales y escala de Alvarado (publicada)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "dolor_abdominal",
        "name": "Dolor abdominal",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: abdomen agudo"
      },
      {
        "code": "dolor_localizacion",
        "name": "Dolor — ¿dónde se localiza?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: abdomen agudo",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: abdomen agudo",
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
        "code": "dolor_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: abdomen agudo",
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
        "code": "dolor_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: abdomen agudo",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: abdomen agudo",
        "showWhen": {
          "field": "dolor_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: abdomen agudo",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "dolor_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: abdomen agudo",
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
        "code": "dolor_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: abdomen agudo",
        "showWhen": {
          "field": "dolor_abdominal",
          "equals": true
        }
      },
      {
        "code": "signos_peritoneales",
        "name": "Signos peritoneales",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: abdomen agudo",
        "options": [
          "Defensa",
          "Rebote",
          "Rovsing",
          "Psoas",
          "Murphy",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "alvarado",
        "name": "Escala de Alvarado",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: abdomen agudo",
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
        "multiple": true
      },
      {
        "code": "alvarado_puntaje",
        "name": "Alvarado — puntaje",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: abdomen agudo"
      },
      {
        "code": "imagen",
        "name": "Imagen — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: abdomen agudo"
      },
      {
        "code": "decision",
        "name": "Decisión",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: abdomen agudo",
        "options": [
          "Cirugía",
          "Observación",
          "Alta con signos de alarma"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "CIRGEN_CTRL_POSOPERATORIO",
    "name": "Control posoperatorio",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "CIRUGIA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Herida, dolor, tránsito y complicaciones graduadas por Clavien-Dindo (clasificación publicada de uso libre)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "cirugia_realizada",
        "name": "Cirugía realizada",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: posoperatorio"
      },
      {
        "code": "fecha_cirugia",
        "name": "Fecha de la cirugía",
        "dataType": "date",
        "required": false,
        "section": "Evaluación: posoperatorio"
      },
      {
        "code": "herida",
        "name": "Herida",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: posoperatorio",
        "options": [
          "Limpia y seca",
          "Eritema",
          "Secreción serosa",
          "Secreción purulenta",
          "Dehiscencia"
        ],
        "multiple": false
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: posoperatorio"
      },
      {
        "code": "transito",
        "name": "Tránsito intestinal",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: posoperatorio",
        "options": [
          "Conservado",
          "Sin gases ni heces"
        ],
        "multiple": false
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: posoperatorio"
      },
      {
        "code": "clavien_dindo",
        "name": "Complicación (Clavien-Dindo)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: posoperatorio",
        "options": [
          "Sin complicaciones",
          "I",
          "II",
          "IIIa",
          "IIIb",
          "IVa",
          "IVb",
          "V"
        ],
        "multiple": false
      },
      {
        "code": "retiro_puntos",
        "name": "Retiro de puntos hoy",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: posoperatorio"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "CIRGEN_EVALUACION_BASE",
    "name": "Cirugía General — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "CIRUGIA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos del abdomen",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico dirigido, diagnóstico y conducta. Son agregados propios de la especialidad los ítems quirúrgicos: características del dolor abdominal, tránsito intestinal, hernias, cirugías previas, riesgo quirúrgico descrito en prosa e indicación quirúrgica propuesta. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación ASA."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "DERMA_CTRL_LEISHMANIASIS",
    "name": "Control de leishmaniasis cutánea y mucosa",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Leishmaniasis",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/leishmaniasis",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Forma, número de lesiones, compromiso mucoso y respuesta al tratamiento."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de leishmaniasis",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "leish_forma",
        "name": "Forma",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: leishmaniasis",
        "options": [
          "Cutánea",
          "Mucosa",
          "Mucocutánea"
        ],
        "multiple": false
      },
      {
        "code": "leish_lesiones",
        "name": "Número de úlceras",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: leishmaniasis"
      },
      {
        "code": "leish_tamano",
        "name": "Tamaño de la mayor (mm)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: leishmaniasis"
      },
      {
        "code": "leish_mucosa",
        "name": "Compromiso nasal u oral",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: leishmaniasis"
      },
      {
        "code": "leish_procedencia",
        "name": "Zona de exposición",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: leishmaniasis"
      },
      {
        "code": "leish_confirmacion",
        "name": "Confirmación",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: leishmaniasis",
        "options": [
          "Frotis",
          "Biopsia",
          "PCR",
          "Sin confirmar"
        ],
        "multiple": false
      },
      {
        "code": "leish_respuesta",
        "name": "Respuesta al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: leishmaniasis",
        "options": [
          "Reepitelización completa",
          "Parcial",
          "Sin respuesta",
          "Todavía en tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Completar el tratamiento",
          "Control a los 3, 6 y 12 meses"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "DERMA_CTRL_LESION_PIGMENTADA",
    "name": "Evaluación de lesión pigmentada",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Regla ABCDE del melanoma y dermatoscopía."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "localizacion",
        "name": "Localización",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: lesión pigmentada"
      },
      {
        "code": "abcde",
        "name": "Criterios ABCDE",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: lesión pigmentada",
        "options": [
          "Asimetría",
          "Bordes irregulares",
          "Color heterogéneo",
          "Diámetro > 6 mm",
          "Evolución (cambió)",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "fototipo",
        "name": "Fototipo de Fitzpatrick",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lesión pigmentada",
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
        "code": "antecedente_melanoma",
        "name": "Antecedente personal o familiar de melanoma",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: lesión pigmentada"
      },
      {
        "code": "dermatoscopia",
        "name": "Dermatoscopía — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lesión pigmentada"
      },
      {
        "code": "conducta_lesion",
        "name": "Conducta",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lesión pigmentada",
        "options": [
          "Control",
          "Biopsia",
          "Extirpación"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Fotoprotección",
          "Autoexamen de la piel"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "DERMA_CTRL_PSORIASIS",
    "name": "Control de psoriasis",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Extensión (PASI y superficie corporal) y artritis psoriásica."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de psoriasis",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "pasi",
        "name": "PASI",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: psoriasis"
      },
      {
        "code": "superficie_corporal",
        "name": "Superficie corporal afectada (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: psoriasis"
      },
      {
        "code": "psoriasis_sitios",
        "name": "Sitios especiales",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: psoriasis",
        "options": [
          "Cuero cabelludo",
          "Uñas",
          "Genitales",
          "Palmas y plantas"
        ],
        "multiple": true
      },
      {
        "code": "dolor_articular",
        "name": "Dolor o tumefacción articular",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: psoriasis"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Mejoría del PASI ≥ 75 %",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Emolientes",
          "Desencadenantes",
          "Riesgo cardiovascular"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "DERMA_EXAMEN_BASE",
    "name": "Dermatología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen de piel y faneras",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la descripción semiológica de la lesión elemental, su distribución y su evolución. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: fototipos de Fitzpatrick."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "EMERG_ACV",
    "name": "Código ACV en emergencia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "NIH Stroke Scale",
      "organization": "National Institute of Neurological Disorders and Stroke (NINDS/NIH)",
      "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat/nih-stroke-scale",
      "license": "Dominio público (Gobierno de los EE. UU.)",
      "retrievedAt": "2026-10-02",
      "note": "Hora de inicio, Cincinnati, NIHSS, glucemia e imagen para decidir trombólisis."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "hora_inicio",
        "name": "Hora de inicio o de la última vez visto bien",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "cincinnati",
        "name": "Cincinnati",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular agudo",
        "options": [
          "Asimetría facial",
          "Caída de un brazo",
          "Alteración del habla"
        ],
        "multiple": true
      },
      {
        "code": "nihss",
        "name": "NIHSS (0–42)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "glucemia",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "tac",
        "name": "TAC de cerebro — hallazgo y hora",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular agudo"
      },
      {
        "code": "trombolisis",
        "name": "Trombólisis",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular agudo",
        "options": [
          "Indicada",
          "Contraindicada",
          "Fuera de ventana"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "EMERG_ATENCION_BASE",
    "name": "Medicina de Emergencia — atención inicial en emergencia (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro de la atención de urgencias y emergencias",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, tiempo de evolución, antecedentes, alergias, medicación, signos vitales, diagnóstico y conducta. Son agregados propios de la especialidad la hora de llegada, la forma de llegada, la evaluación inicial y el nivel de prioridad asignado, que se registra como texto libre tal como lo escriba el profesional. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de coma de Glasgow."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "EMERG_DOLOR_TORACICO",
    "name": "Dolor torácico agudo en emergencia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "ECG en menos de 10 minutos, troponina y estratificación con el puntaje HEART (publicado, de uso libre)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "dolor_actual",
        "name": "Dolor en este momento",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "dolor_inicio",
        "name": "Dolor — inicio",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dolor torácico",
        "options": [
          "Súbito",
          "Progresivo"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "dolor_caracter",
        "name": "Dolor — carácter",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dolor torácico",
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
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "dolor_irradiado",
        "name": "Dolor — ¿se irradia?",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: dolor torácico",
        "showWhen": {
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "dolor_irradiacion",
        "name": "¿Hacia dónde se irradia?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: dolor torácico",
        "showWhen": {
          "field": "dolor_irradiado",
          "equals": true
        }
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor — intensidad (0 a 10, escala numérica)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dolor torácico",
        "description": "0 = sin dolor; 10 = el peor dolor imaginable.",
        "showWhen": {
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "dolor_patron",
        "name": "Dolor — patrón temporal",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dolor torácico",
        "options": [
          "Continuo",
          "Intermitente",
          "Nocturno",
          "Con el esfuerzo",
          "Posprandial"
        ],
        "multiple": false,
        "showWhen": {
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "dolor_agravantes_atenuantes",
        "name": "Dolor — qué lo agrava y qué lo alivia",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: dolor torácico",
        "showWhen": {
          "field": "dolor_actual",
          "equals": true
        }
      },
      {
        "code": "hora_ecg",
        "name": "Hora del ECG",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "ecg_hallazgo",
        "name": "ECG — hallazgo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "ecg_st",
        "name": "Segmento ST",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dolor torácico",
        "options": [
          "Elevación (SCACEST: reperfusión ya)",
          "Depresión o T invertida",
          "Normal"
        ],
        "multiple": false
      },
      {
        "code": "troponina",
        "name": "Troponina y hora",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "heart_score",
        "name": "Puntaje HEART (0–10)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dolor torácico"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "EMERG_INTOXICACION",
    "name": "Intoxicación aguda",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Sustancia, tiempo, vía, toxíndrome e intención."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "sustancia",
        "name": "Sustancia y cantidad",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: intoxicación"
      },
      {
        "code": "hora_exposicion",
        "name": "Hora de la exposición",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: intoxicación"
      },
      {
        "code": "via",
        "name": "Vía",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: intoxicación",
        "options": [
          "Oral",
          "Inhalatoria",
          "Cutánea",
          "Parenteral"
        ],
        "multiple": false
      },
      {
        "code": "toxindrome",
        "name": "Toxíndrome",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: intoxicación",
        "options": [
          "Colinérgico (organofosforados)",
          "Anticolinérgico",
          "Simpaticomimético",
          "Opioide",
          "Sedante-hipnótico",
          "No definido"
        ],
        "multiple": false
      },
      {
        "code": "intencion",
        "name": "Intención",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: intoxicación",
        "options": [
          "Accidental",
          "Autolesión",
          "Laboral",
          "No se sabe"
        ],
        "multiple": false
      },
      {
        "code": "evaluacion_salud_mental",
        "name": "Interconsulta a salud mental pedida",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: intoxicación",
        "showWhen": {
          "field": "intencion",
          "equals": "Autolesión"
        }
      },
      {
        "code": "glasgow_ocular",
        "name": "Glasgow — apertura ocular",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: intoxicación",
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
        "section": "Evaluación: intoxicación",
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
        "section": "Evaluación: intoxicación",
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
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "EMERG_POLITRAUMA",
    "name": "Paciente politraumatizado: evaluación primaria",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Evaluación primaria ABCDE con control cervical y Glasgow."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "mecanismo",
        "name": "Mecanismo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: politraumatismo"
      },
      {
        "code": "via_aerea",
        "name": "A — vía aérea con control cervical",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: politraumatismo",
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
        "section": "Evaluación: politraumatismo",
        "options": [
          "Adecuada",
          "Neumotórax sospechado",
          "Dificultad respiratoria"
        ],
        "multiple": false
      },
      {
        "code": "circulacion",
        "name": "C — circulación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: politraumatismo",
        "options": [
          "Estable",
          "Hemorragia activa",
          "Shock"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_ocular",
        "name": "Glasgow — apertura ocular",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: politraumatismo",
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
        "section": "Evaluación: politraumatismo",
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
        "section": "Evaluación: politraumatismo",
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
        "code": "lesiones",
        "name": "Lesiones",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: politraumatismo",
        "options": [
          "Craneoencefálica",
          "Torácica",
          "Abdominal",
          "Pélvica",
          "Extremidades",
          "Columna"
        ],
        "multiple": true
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: politraumatismo"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: politraumatismo"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ENDO_CTRL_DISLIPIDEMIA",
    "name": "Control de dislipidemia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "HEARTS: paquete técnico para el manejo de las enfermedades cardiovasculares en la atención primaria de salud",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/hearts-technical-package",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Perfil lipídico y riesgo cardiovascular según el módulo de HEARTS."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de dislipidemia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "colesterol_total",
        "name": "Colesterol total (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: dislipidemia"
      },
      {
        "code": "ldl",
        "name": "LDL (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: dislipidemia"
      },
      {
        "code": "hdl",
        "name": "HDL (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: dislipidemia"
      },
      {
        "code": "trigliceridos",
        "name": "Triglicéridos (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: dislipidemia"
      },
      {
        "code": "riesgo_cv",
        "name": "Riesgo cardiovascular a 10 años (tabla OMS/OPS)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dislipidemia",
        "options": [
          "< 10 %",
          "10 % a < 20 %",
          "≥ 20 %",
          "Prevención secundaria"
        ],
        "multiple": false
      },
      {
        "code": "estatina",
        "name": "Recibe estatina",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: dislipidemia"
      },
      {
        "code": "mialgias",
        "name": "Mialgias con la estatina",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: dislipidemia",
        "showWhen": {
          "field": "estatina",
          "equals": true
        }
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "LDL en la meta según su riesgo",
          "Triglicéridos < 150 mg/dL",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Alimentación",
          "Actividad física"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ENDO_CTRL_DM2",
    "name": "Control de diabetes mellitus tipo 2",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "HEARTS-D: diagnóstico y manejo de la diabetes tipo 2",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/who-ucn-ncd-20.1",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Visita de control de HEARTS-D: glucemia y HbA1c, hipoglucemias, pie, ojo y riñón, y factores de riesgo cardiovascular."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de diabetes tipo 2",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: diabetes tipo 2",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: diabetes tipo 2",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes tipo 2"
      },
      {
        "code": "fondo_de_ojo",
        "name": "Fondo de ojo en el último año",
        "dataType": "string",
        "required": false,
        "section": "Complicaciones y daño de órgano",
        "options": [
          "Normal",
          "Retinopatía",
          "No realizado"
        ],
        "multiple": false
      },
      {
        "code": "albuminuria",
        "name": "Relación albúmina/creatinina en orina (mg/g)",
        "dataType": "decimal",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "tfg",
        "name": "Filtrado glomerular estimado (mL/min/1,73 m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "dm_complicaciones",
        "name": "Complicaciones conocidas",
        "dataType": "json",
        "required": false,
        "section": "Complicaciones y daño de órgano",
        "options": [
          "Neuropatía",
          "Pie diabético",
          "Retinopatía",
          "Nefropatía",
          "Cardiopatía isquémica",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "HbA1c < 7 %",
          "PA < 130/80 mmHg",
          "LDL < 100 mg/dL",
          "Pies sin lesiones",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Alimentación",
          "Actividad física",
          "Cuidado de los pies",
          "Reconocer y tratar una hipoglucemia",
          "Automonitoreo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ENDO_CTRL_OBESIDAD",
    "name": "Control de obesidad",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "Obesidad y sobrepeso",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/obesity",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Clasificación de la OMS por IMC y perímetro abdominal; seguimiento de comorbilidades."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de obesidad",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: obesidad"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: obesidad"
      },
      {
        "code": "imc",
        "name": "IMC (kg/m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: obesidad"
      },
      {
        "code": "obesidad_grado",
        "name": "Clasificación OMS",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: obesidad",
        "options": [
          "Sobrepeso (25–29,9)",
          "Obesidad I (30–34,9)",
          "Obesidad II (35–39,9)",
          "Obesidad III (≥ 40)"
        ],
        "multiple": false
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: obesidad"
      },
      {
        "code": "cambio_de_peso_kg",
        "name": "Cambio de peso desde el último control (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: obesidad"
      },
      {
        "code": "comorbilidades_obesidad",
        "name": "Comorbilidades",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: obesidad",
        "options": [
          "Diabetes o prediabetes",
          "Hipertensión",
          "Dislipidemia",
          "Apnea del sueño",
          "Hígado graso",
          "Artrosis",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Bajó al menos 5 % del peso",
          "Actividad física ≥ 150 min por semana",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Alimentación",
          "Actividad física",
          "Sueño"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ENDO_CTRL_TIROIDES",
    "name": "Control de hipotiroidismo o hipertiroidismo",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Seguimiento de la función tiroidea: TSH y T4 libre, síntomas y examen del cuello."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad tiroidea",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tiroides_condicion",
        "name": "Condición",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad tiroidea",
        "options": [
          "Hipotiroidismo",
          "Hipertiroidismo",
          "Nódulo tiroideo",
          "Bocio"
        ],
        "multiple": false
      },
      {
        "code": "tsh",
        "name": "TSH (mUI/L)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: enfermedad tiroidea"
      },
      {
        "code": "t4_libre",
        "name": "T4 libre (ng/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: enfermedad tiroidea"
      },
      {
        "code": "sintomas_tiroideos",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad tiroidea",
        "options": [
          "Cansancio",
          "Intolerancia al frío",
          "Intolerancia al calor",
          "Palpitaciones",
          "Temblor",
          "Cambio de peso",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: enfermedad tiroidea"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: enfermedad tiroidea"
      },
      {
        "code": "bocio_oms",
        "name": "Bocio (clasificación OMS)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad tiroidea",
        "options": [
          "Grado 0",
          "Grado 1",
          "Grado 2"
        ],
        "multiple": false
      },
      {
        "code": "tirads",
        "name": "Ecografía — categoría TI-RADS",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad tiroidea",
        "showWhen": {
          "field": "tiroides_condicion",
          "equals": "Nódulo tiroideo"
        }
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "TSH en rango",
          "Sin síntomas",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Tomar la levotiroxina en ayunas",
          "Embarazo: avisar para ajustar la dosis"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ENDO_EVALUACION_BASE",
    "name": "Endocrinología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico con registro antropométrico",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, examen físico con peso y talla, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis dirigida de síntomas tiroideos y de alteración de la glucemia (poliuria, polidipsia, polifagia), el registro del cambio de peso y del perímetro abdominal, y el examen de tiroides, piel y anexos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "ENFER_CTRL_HERIDAS",
    "name": "Curación y control de heridas",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ENFERMERIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Tipo, dimensiones, lecho, exudado, signos de infección y estadio de lesión por presión."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "tipo_herida",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: herida",
        "options": [
          "Quirúrgica",
          "Traumática",
          "Lesión por presión",
          "Úlcera venosa",
          "Pie diabético",
          "Quemadura"
        ],
        "multiple": false
      },
      {
        "code": "upp_estadio",
        "name": "Estadio",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: herida",
        "options": [
          "1",
          "2",
          "3",
          "4",
          "No estadificable"
        ],
        "multiple": false,
        "showWhen": {
          "field": "tipo_herida",
          "equals": "Lesión por presión"
        }
      },
      {
        "code": "dimensiones",
        "name": "Largo × ancho × profundidad (cm)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: herida"
      },
      {
        "code": "lecho",
        "name": "Lecho",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: herida",
        "options": [
          "Granulación",
          "Esfacelo",
          "Necrosis",
          "Epitelización"
        ],
        "multiple": false
      },
      {
        "code": "exudado",
        "name": "Exudado",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: herida",
        "options": [
          "Ninguno",
          "Escaso",
          "Moderado",
          "Abundante"
        ],
        "multiple": false
      },
      {
        "code": "infeccion",
        "name": "Signos de infección",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: herida",
        "options": [
          "Calor",
          "Rubor",
          "Dolor creciente",
          "Mal olor",
          "Secreción purulenta",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "aposito",
        "name": "Apósito utilizado",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: herida"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ENFER_VALORACION_BASE",
    "name": "Enfermería — valoración de enfermería (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "FISIO_CTRL_LUMBALGIA",
    "name": "Rehabilitación de lumbalgia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "FISIOTERAPIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Banderas rojas, dolor, función y progreso del ejercicio."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de lumbalgia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "lumbalgia_banderas_rojas",
        "name": "Banderas rojas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: lumbalgia",
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
        "multiple": true
      },
      {
        "code": "lumbalgia_ciatica",
        "name": "Dolor irradiado por debajo de la rodilla",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "lumbalgia_lasegue",
        "name": "Signo de Lasègue",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lumbalgia",
        "options": [
          "Positivo",
          "Negativo",
          "No evaluado"
        ],
        "multiple": false
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "sesion_numero",
        "name": "Sesión número",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "ejercicios",
        "name": "Ejercicios indicados",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dolor ≤ 3",
          "Volvió a sus actividades",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "FISIO_CTRL_NEUROLOGICA",
    "name": "Rehabilitación neurológica (secuela de ACV)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "FISIOTERAPIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Independencia por índice de Barthel (dominio público), marcha y equilibrio."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de secuela neurológica",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "barthel",
        "name": "Índice de Barthel (0–100)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: secuela neurológica"
      },
      {
        "code": "marcha",
        "name": "Marcha",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: secuela neurológica",
        "options": [
          "Independiente",
          "Con bastón",
          "Con andador",
          "No camina"
        ],
        "multiple": false
      },
      {
        "code": "fuerza_mrc",
        "name": "Fuerza del lado afectado (MRC)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: secuela neurológica",
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
        "code": "espasticidad",
        "name": "Espasticidad",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: secuela neurológica"
      },
      {
        "code": "sesion_numero",
        "name": "Sesión número",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: secuela neurológica"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "FISIO_EVALUACION_BASE",
    "name": "Fisioterapia y Rehabilitación — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "FISIOTERAPIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico regional y plan de trabajo",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común: motivo de consulta, tiempo de evolución, antecedentes, examen físico dirigido a la región afectada, diagnóstico y conducta. Son agregados propios de la especialidad la intensidad de dolor referida por el paciente en escala de 0 a 10, la zona afectada, la descripción en prosa del rango de movimiento, la fuerza muscular, la marcha, la limitación funcional y los objetivos de rehabilitación. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de fuerza MRC."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "GASTRO_CTRL_ERGE_DISPEPSIA",
    "name": "Control de reflujo gastroesofágico y dispepsia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GASTROENTEROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Síntomas típicos y atípicos, signos de alarma que indican endoscopía y estado de Helicobacter pylori."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de reflujo o dispepsia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "erge_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: reflujo o dispepsia",
        "options": [
          "Pirosis",
          "Regurgitación",
          "Dolor epigástrico",
          "Saciedad precoz",
          "Tos crónica",
          "Disfonía"
        ],
        "multiple": true
      },
      {
        "code": "dias_sintomas_semana",
        "name": "Días con síntomas por semana",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: reflujo o dispepsia"
      },
      {
        "code": "alarma_digestiva",
        "name": "Signos de alarma",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: reflujo o dispepsia",
        "options": [
          "Disfagia",
          "Pérdida de peso",
          "Anemia",
          "Vómitos persistentes",
          "Sangrado",
          "Edad > 50 con síntomas nuevos",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "helicobacter",
        "name": "Helicobacter pylori",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: reflujo o dispepsia",
        "options": [
          "Positivo, sin tratar",
          "Erradicado",
          "Negativo",
          "No estudiado"
        ],
        "multiple": false
      },
      {
        "code": "aines",
        "name": "Consume AINE",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: reflujo o dispepsia"
      },
      {
        "code": "endoscopia",
        "name": "Endoscopía — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: reflujo o dispepsia"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin síntomas",
          "H. pylori erradicado",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Cenar temprano",
          "Elevar la cabecera",
          "Evitar AINE",
          "Bajar de peso"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "GASTRO_CTRL_HEMORRAGIA",
    "name": "Hemorragia digestiva: evaluación inicial",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GASTROENTEROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Evaluación hemodinámica y puntaje de Glasgow-Blatchford (publicado, de uso libre) para decidir internación."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "hd_forma",
        "name": "Cómo se manifestó",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hemorragia digestiva",
        "options": [
          "Hematemesis",
          "Melena",
          "Hematoquecia"
        ],
        "multiple": true
      },
      {
        "code": "hd_estabilidad",
        "name": "Estado hemodinámico",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hemorragia digestiva",
        "options": [
          "Estable",
          "Taquicardia",
          "Hipotensión o shock"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "urea",
        "name": "Urea (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "glasgow_blatchford",
        "name": "Puntaje de Glasgow-Blatchford",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: hemorragia digestiva"
      },
      {
        "code": "hd_factores",
        "name": "Factores",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: hemorragia digestiva",
        "options": [
          "AINE",
          "Anticoagulantes",
          "Cirrosis",
          "Úlcera previa",
          "Alcohol"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Hemodinámicamente estable",
          "Endoscopía en menos de 24 h",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "GASTRO_CTRL_HEPATOPATIA",
    "name": "Control de hepatopatía crónica y cirrosis",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GASTROENTEROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Gravedad por Child-Pugh (puntaje publicado de uso libre), descompensaciones y tamizaje de hepatocarcinoma."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de hepatopatía crónica",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "hepatopatia_causa",
        "name": "Causa",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hepatopatía crónica",
        "options": [
          "Alcohol",
          "Hígado graso",
          "Hepatitis B",
          "Hepatitis C",
          "Autoinmune",
          "Otra o no establecida"
        ],
        "multiple": false
      },
      {
        "code": "child_pugh",
        "name": "Child-Pugh",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hepatopatía crónica",
        "options": [
          "A (5–6)",
          "B (7–9)",
          "C (10–15)"
        ],
        "multiple": false
      },
      {
        "code": "descompensaciones",
        "name": "Descompensaciones desde el último control",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: hepatopatía crónica",
        "options": [
          "Ascitis",
          "Encefalopatía",
          "Hemorragia variceal",
          "Ictericia",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "bilirrubina",
        "name": "Bilirrubina total (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hepatopatía crónica"
      },
      {
        "code": "albumina",
        "name": "Albúmina (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hepatopatía crónica"
      },
      {
        "code": "inr",
        "name": "INR",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hepatopatía crónica"
      },
      {
        "code": "ecografia_6_meses",
        "name": "Ecografía de tamizaje en los últimos 6 meses",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hepatopatía crónica",
        "options": [
          "Sí, sin nódulos",
          "Sí, con nódulo",
          "No"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Abstinencia de alcohol",
          "Tamizaje al día",
          "Vacunas de hepatitis A y B",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Abstinencia de alcohol",
          "Restricción de sal si hay ascitis",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "GASTRO_EVALUACION_BASE",
    "name": "Gastroenterología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "GERIA_CTRL_CAIDAS",
    "name": "Evaluación de caídas",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Atención integrada para las personas mayores (ICOPE): guía de evaluación y planes de atención",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/WHO-FWC-ALC-19.1",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Caídas, factores de riesgo modificables y consecuencias."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "caidas_anio",
        "name": "Caídas en el último año",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: caídas"
      },
      {
        "code": "caida_con_lesion",
        "name": "Alguna con lesión o fractura",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: caídas"
      },
      {
        "code": "caidas_riesgo",
        "name": "Factores de riesgo",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: caídas",
        "options": [
          "Alteración de la marcha",
          "Hipotensión ortostática",
          "Psicofármacos",
          "Déficit visual",
          "Riesgos en el hogar",
          "Incontinencia de urgencia"
        ],
        "multiple": true
      },
      {
        "code": "miedo_a_caer",
        "name": "Miedo a caer",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: caídas"
      },
      {
        "code": "timed_up_and_go",
        "name": "Prueba «levántate y anda» (segundos)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: caídas"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Adaptar el hogar",
          "Calzado",
          "Ejercicio de equilibrio"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "GERIA_CTRL_DEMENCIA",
    "name": "Control de demencia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Módulo de demencia de mhGAP: función, síntomas conductuales y apoyo al cuidador."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de demencia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "prueba_cognitiva",
        "name": "Prueba cognitiva y puntaje",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: demencia"
      },
      {
        "code": "demencia_funcion",
        "name": "Repercusión funcional",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: demencia",
        "options": [
          "Leve: actividades instrumentales",
          "Moderada: actividades básicas",
          "Grave: dependencia total"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_conductuales",
        "name": "Síntomas conductuales",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: demencia",
        "options": [
          "Agitación",
          "Agresividad",
          "Deambulación",
          "Alucinaciones",
          "Insomnio",
          "Depresión",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sobrecarga_cuidador",
        "name": "Sobrecarga del cuidador",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: demencia",
        "options": [
          "Baja",
          "Moderada",
          "Alta"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Apoyo al cuidador",
          "Seguridad en el hogar",
          "Rutinas"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "GERIA_CTRL_FRAGILIDAD",
    "name": "Control de fragilidad y capacidad intrínseca (ICOPE)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Atención integrada para las personas mayores (ICOPE): guía de evaluación y planes de atención",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/WHO-FWC-ALC-19.1",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Los dominios de capacidad intrínseca del tamizaje ICOPE: cognición, movilidad, nutrición, visión, audición y ánimo."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de fragilidad",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "icope_alterados",
        "name": "Dominios ICOPE con tamizaje alterado",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: fragilidad",
        "options": [
          "Cognición",
          "Movilidad (levantarse 5 veces de la silla)",
          "Nutrición (pérdida de peso o apetito)",
          "Visión",
          "Audición",
          "Síntomas depresivos",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "silla_5_veces_segundos",
        "name": "Levantarse 5 veces de la silla (segundos)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: fragilidad"
      },
      {
        "code": "velocidad_de_marcha",
        "name": "Velocidad de marcha en 4 m (m/s)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: fragilidad"
      },
      {
        "code": "fried",
        "name": "Criterios de Fried",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: fragilidad",
        "options": [
          "Pérdida de peso no intencionada",
          "Agotamiento",
          "Debilidad",
          "Marcha lenta",
          "Baja actividad física"
        ],
        "multiple": true
      },
      {
        "code": "numero_de_farmacos",
        "name": "Fármacos en uso",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: fragilidad"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Plan de atención por cada dominio alterado",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Ejercicio multicomponente",
          "Alimentación con proteínas",
          "Revisión de fármacos"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "GERIA_VALORACION_BASE",
    "name": "Geriatría — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen del adulto mayor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la autonomía en actividades de la vida diaria, el antecedente de caídas, el recuento de fármacos en uso, la descripción en prosa del estado cognitivo y del ánimo, la continencia y el soporte social. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: índice de Katz, escala de Lawton, criterios de Beers/STOPP."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "GINOBS_CONSULTA_GINECOLOGICA",
    "name": "Ginecología y obstetricia — consulta ginecológica (ficha base)",
    "version": 1,
    "kind": "BASE",
    "specialty": "GINECOLOGIA_OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Ficha base de ginecología: antecedentes gineco-obstétricos, ciclo, anticoncepción, tamizajes y examen."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "menarca",
        "name": "Menarca (edad)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "fum",
        "name": "Fecha de última menstruación",
        "dataType": "date",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "ciclo",
        "name": "Ciclo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: consulta ginecológica",
        "options": [
          "Regular",
          "Irregular",
          "Amenorrea",
          "Menopausia"
        ],
        "multiple": false
      },
      {
        "code": "gestas",
        "name": "Gestas",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "partos",
        "name": "Partos",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "cesareas",
        "name": "Cesáreas",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "abortos",
        "name": "Abortos",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "anticoncepcion",
        "name": "Anticoncepción",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: consulta ginecológica",
        "options": [
          "Ninguna",
          "Preservativo",
          "Hormonal",
          "DIU",
          "Implante",
          "Quirúrgica"
        ],
        "multiple": false
      },
      {
        "code": "ultimo_tamizaje_cervix",
        "name": "Último tamizaje de cuello uterino",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: consulta ginecológica",
        "options": [
          "Menos de 3 años",
          "3 a 5 años",
          "Más de 5 años",
          "Nunca"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_gineco",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: consulta ginecológica",
        "options": [
          "Flujo anormal",
          "Dolor pélvico",
          "Sangrado anormal",
          "Dispareunia",
          "Bulto en la mama",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "examen_ginecologico",
        "name": "Examen ginecológico y mamario",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: consulta ginecológica"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "GINOBS_CONTROL_PRENATAL",
    "name": "Control prenatal — Historia Clínica Perinatal (CLAP/SMR)",
    "version": 2,
    "kind": "SPECIFIC",
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
    "code": "GINOBS_CTRL_PUERPERIO",
    "name": "Control de puerperio",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GINECOLOGIA_OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Recomendaciones de la OMS sobre la atención materna y neonatal para una experiencia posnatal positiva (2022)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789240045989",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Contactos posnatales de la OMS: sangrado, infección, presión, lactancia, ánimo y anticoncepción."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "tipo_parto",
        "name": "Tipo de parto",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: puerperio",
        "options": [
          "Vaginal",
          "Cesárea"
        ],
        "multiple": false
      },
      {
        "code": "dias_posparto",
        "name": "Días posparto",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: puerperio"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: puerperio"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: puerperio"
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: puerperio"
      },
      {
        "code": "loquios",
        "name": "Loquios",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: puerperio",
        "options": [
          "Normales",
          "Abundantes",
          "Fétidos"
        ],
        "multiple": false
      },
      {
        "code": "involucion_uterina",
        "name": "Involución uterina",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: puerperio",
        "options": [
          "Adecuada",
          "Subinvolución"
        ],
        "multiple": false
      },
      {
        "code": "lactancia",
        "name": "Lactancia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: puerperio",
        "options": [
          "Exclusiva",
          "Mixta",
          "Sin lactancia"
        ],
        "multiple": false
      },
      {
        "code": "animo_puerperio",
        "name": "Ánimo",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: puerperio",
        "options": [
          "Tristeza persistente",
          "Ansiedad",
          "Ideas de hacerse daño",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "anticoncepcion_posparto",
        "name": "Anticoncepción",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: puerperio",
        "options": [
          "Elegida e iniciada",
          "Elegida, pendiente",
          "No desea"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "GINOBS_CTRL_TAMIZAJE_CERVIX",
    "name": "Tamizaje de cáncer de cuello uterino",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "GINECOLOGIA_OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Directriz de la OMS para el tamizaje y tratamiento de lesiones precancerosas del cuello uterino (2021)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789240030824",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Estrategia de la OMS: prueba de VPH o IVAA, resultado y tratamiento de lesiones."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "prueba_tamizaje",
        "name": "Prueba",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tamizaje de cuello uterino",
        "options": [
          "VPH",
          "IVAA",
          "Citología (Papanicolaou)"
        ],
        "multiple": false
      },
      {
        "code": "resultado_tamizaje",
        "name": "Resultado",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tamizaje de cuello uterino",
        "options": [
          "Negativo",
          "Positivo",
          "No concluyente"
        ],
        "multiple": false
      },
      {
        "code": "conducta_tamizaje",
        "name": "Conducta",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tamizaje de cuello uterino",
        "options": [
          "Tratamiento ablativo (crioterapia o termoablación)",
          "Escisión (LEEP)",
          "Colposcopía",
          "Derivación por sospecha de cáncer"
        ],
        "multiple": false,
        "showWhen": {
          "field": "resultado_tamizaje",
          "equals": "Positivo"
        }
      },
      {
        "code": "vih_positiva",
        "name": "Mujer con VIH (tamizaje más frecuente)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: tamizaje de cuello uterino"
      },
      {
        "code": "proximo_tamizaje",
        "name": "Próximo tamizaje",
        "dataType": "date",
        "required": false,
        "section": "Evaluación: tamizaje de cuello uterino"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "HEMATO_CTRL_ANEMIA",
    "name": "Control de anemia ferropénica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "HEMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Hemoglobina ajustada por altitud, causa y respuesta al hierro."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de anemia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "anemia_hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: anemia",
        "description": "Ajustar por altitud de residencia."
      },
      {
        "code": "anemia_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: anemia",
        "options": [
          "Astenia",
          "Disnea de esfuerzo",
          "Palpitaciones",
          "Pica",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "anemia_perdidas",
        "name": "Posibles pérdidas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: anemia",
        "options": [
          "Menstruación abundante",
          "Sangrado digestivo",
          "Parasitosis",
          "Ninguna conocida"
        ],
        "multiple": true
      },
      {
        "code": "anemia_vcm",
        "name": "VCM y ferritina, si se conocen",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anemia"
      },
      {
        "code": "ferritina",
        "name": "Ferritina (ng/mL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: anemia"
      },
      {
        "code": "vcm",
        "name": "VCM (fL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: anemia"
      },
      {
        "code": "altitud_residencia",
        "name": "Altitud de residencia (m s. n. m.)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anemia"
      },
      {
        "code": "reticulocitos",
        "name": "Reticulocitos (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: anemia"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Hemoglobina normal para su altitud",
          "Causa identificada",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Hierro con el estómago vacío y con vitamina C",
          "Alimentos con hierro"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "HEMATO_CTRL_ANTICOAGULACION",
    "name": "Control de anticoagulación oral",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "HEMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "INR en rango terapéutico, sangrados e interacciones."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de anticoagulación",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "indicacion_anticoagulacion",
        "name": "Indicación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: anticoagulación",
        "options": [
          "Fibrilación auricular",
          "Trombosis venosa profunda",
          "Embolia pulmonar",
          "Prótesis valvular",
          "Otra"
        ],
        "multiple": false
      },
      {
        "code": "inr",
        "name": "INR de hoy",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: anticoagulación"
      },
      {
        "code": "inr_meta",
        "name": "INR meta",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anticoagulación"
      },
      {
        "code": "sangrado",
        "name": "Sangrado desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: anticoagulación"
      },
      {
        "code": "sangrado_gravedad",
        "name": "Gravedad",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: anticoagulación",
        "options": [
          "Menor",
          "Mayor"
        ],
        "multiple": false,
        "showWhen": {
          "field": "sangrado",
          "equals": true
        }
      },
      {
        "code": "farmacos_nuevos",
        "name": "Fármacos o hierbas nuevos",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: anticoagulación"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "INR en rango",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dieta estable en verduras de hoja verde",
          "Signos de sangrado",
          "Avisar antes de procedimientos"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "HEMATO_EVALUACION_BASE",
    "name": "Hematología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "INFECTO_CTRL_DENGUE",
    "name": "Dengue: evaluación y seguimiento diario",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Dengue: guías para la atención de enfermos en la Región de las Américas, 2.ª ed.",
      "organization": "Organización Panamericana de la Salud (OPS/OMS)",
      "url": "https://www.paho.org/es/temas/dengue",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Clasificación en grupos A/B/C y signos de alarma de la guía de OPS; control diario en la fase crítica (días 3 a 7)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "dengue_dias_de_fiebre",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dengue"
      },
      {
        "code": "dengue_signos_de_alarma",
        "name": "Signos de alarma (OPS/OMS)",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: dengue",
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
        "multiple": true
      },
      {
        "code": "dengue_torniquete",
        "name": "Prueba del torniquete",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dengue",
        "options": [
          "Positiva",
          "Negativa",
          "No realizada"
        ],
        "multiple": false
      },
      {
        "code": "dengue_grupo",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: dengue",
        "options": [
          "Grupo A — sin signos de alarma",
          "Grupo B — con signos de alarma o condición asociada",
          "Grupo C — dengue grave"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dengue"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: dengue"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: dengue"
      },
      {
        "code": "hematocrito",
        "name": "Hematocrito (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: dengue"
      },
      {
        "code": "plaquetas",
        "name": "Plaquetas (/µL)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: dengue"
      },
      {
        "code": "hidratacion_oral",
        "name": "Tolera la hidratación oral",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: dengue",
        "options": [
          "Sí",
          "Parcialmente",
          "No"
        ],
        "multiple": false
      },
      {
        "code": "diuresis",
        "name": "Diuresis (mL/kg/h)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: dengue"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Sin signos de alarma",
          "Hematocrito estable",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Hidratación oral",
          "No tomar AINE ni aspirina",
          "Volver ya ante un signo de alarma",
          "Mosquitero y eliminar criaderos"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "INFECTO_CTRL_ITU",
    "name": "Infección urinaria: evaluación y control",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Cistitis frente a pielonefritis, factores de complicación y urocultivo."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "itu_sintomas",
        "name": "Síntomas urinarios",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: infección urinaria",
        "options": [
          "Disuria",
          "Polaquiuria",
          "Urgencia miccional",
          "Hematuria",
          "Dolor suprapúbico"
        ],
        "multiple": true
      },
      {
        "code": "itu_fiebre_o_lumbar",
        "name": "Fiebre o dolor lumbar (sospecha de pielonefritis)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: infección urinaria"
      },
      {
        "code": "itu_punopercusion",
        "name": "Puñopercusión lumbar",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: infección urinaria",
        "options": [
          "Positiva",
          "Negativa",
          "No evaluada"
        ],
        "multiple": false
      },
      {
        "code": "itu_embarazo",
        "name": "¿Embarazo posible?",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: infección urinaria",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false
      },
      {
        "code": "itu_complicada",
        "name": "Factores de complicación",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: infección urinaria",
        "options": [
          "Embarazo",
          "Varón",
          "Diabetes",
          "Sonda vesical",
          "Litiasis u obstrucción",
          "Inmunosupresión",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "urocultivo",
        "name": "Urocultivo y antibiograma",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: infección urinaria"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Asintomático al control",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "INFECTO_CTRL_MALARIA",
    "name": "Malaria: evaluación y seguimiento",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Directrices de la OMS sobre la malaria",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/teams/global-malaria-programme",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Especie, signos de gravedad de la OMS y control parasitológico."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "malaria_especie",
        "name": "Gota gruesa",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: malaria",
        "options": [
          "P. vivax",
          "P. falciparum",
          "Mixta",
          "Negativa"
        ],
        "multiple": false
      },
      {
        "code": "parasitemia",
        "name": "Parasitemia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: malaria"
      },
      {
        "code": "malaria_gravedad",
        "name": "Signos de gravedad",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: malaria",
        "options": [
          "Alteración de la conciencia",
          "Convulsiones",
          "Dificultad respiratoria",
          "Ictericia",
          "Anemia grave",
          "Sangrado",
          "Hipoglucemia",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "zona_exposicion",
        "name": "Zona donde se expuso",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: malaria"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Gota gruesa negativa al control",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Completar el tratamiento (primaquina en vivax)",
          "Mosquitero"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "INFECTO_CTRL_VIH",
    "name": "Control de VIH",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "VIH: directrices consolidadas de la OMS",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/hiv-aids",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Estadio clínico de la OMS, carga viral, CD4, adherencia a la terapia antirretroviral y profilaxis."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de VIH",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "estadio_oms_vih",
        "name": "Estadio clínico OMS",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: VIH",
        "options": [
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false
      },
      {
        "code": "carga_viral",
        "name": "Última carga viral (copias/mL)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: VIH"
      },
      {
        "code": "cd4",
        "name": "Último CD4 (células/µL)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: VIH"
      },
      {
        "code": "vih_tamizajes",
        "name": "Tamizajes al día",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: VIH",
        "options": [
          "Tuberculosis",
          "Sífilis",
          "Hepatitis B",
          "Cáncer de cuello uterino"
        ],
        "multiple": true
      },
      {
        "code": "profilaxis_cotrimoxazol",
        "name": "Recibe cotrimoxazol",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: VIH"
      },
      {
        "code": "vih_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: VIH",
        "options": [
          "Fiebre",
          "Pérdida de peso",
          "Diarrea crónica",
          "Tos",
          "Lesiones orales",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Carga viral indetectable",
          "Adherencia > 95 %",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Adherencia",
          "Prevención de la transmisión",
          "Pareja: prueba"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "INFECTO_EVALUACION_BASE",
    "name": "Infectología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes epidemiológicos y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes epidemiológicos, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la descripción del patrón febril, el foco clínico probable, los antecedentes de viajes y exposiciones, el estado de vacunación y los tratamientos antimicrobianos previos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "name": "Medicina Deportiva — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "MEDEP_PREPARTICIPATIVA",
    "name": "Evaluación preparticipativa deportiva",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_DEPORTIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Tamizaje cardiovascular para muerte súbita: síntomas con esfuerzo, antecedente familiar, examen y ECG."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_esfuerzo",
        "name": "Síntomas con el esfuerzo",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: aptitud deportiva",
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
        "code": "muerte_subita_familiar",
        "name": "Familiar con muerte súbita antes de los 50 años",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: aptitud deportiva"
      },
      {
        "code": "soplo",
        "name": "Soplo",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: aptitud deportiva"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: aptitud deportiva"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: aptitud deportiva"
      },
      {
        "code": "ecg",
        "name": "ECG de reposo — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: aptitud deportiva"
      },
      {
        "code": "aptitud",
        "name": "Aptitud",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: aptitud deportiva",
        "options": [
          "Apto",
          "Apto con restricciones",
          "No apto temporal",
          "No apto"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDFAM_CONSULTA_BASE",
    "name": "Medicina Familiar — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "MEDICINA_FAMILIAR",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico de la atención ambulatoria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, enfermedad actual, antecedentes personales y familiares, examen físico, diagnóstico y conducta. Son agregados propios de medicina familiar los campos de composición del grupo familiar, condiciones de la vivienda y convivencia, red de apoyo, ocupación y hábitos, y el seguimiento de controles preventivos e inmunizaciones. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS), APGAR familiar de Smilkstein."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "MEDFAM_CTRL_PLANIFICACION",
    "name": "Consejería en planificación familiar",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_FAMILIAR",
    "provenance": {
      "sourceTitle": "Criterios médicos de elegibilidad para el uso de anticonceptivos, 5.ª ed.",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549158",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Elegibilidad de cada método según los criterios médicos de la OMS (categorías 1 a 4)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "metodo_actual",
        "name": "Método actual",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anticoncepción",
        "options": [
          "Ninguno",
          "Preservativo",
          "Píldora combinada",
          "Inyectable",
          "Implante",
          "DIU de cobre",
          "DIU hormonal",
          "Ligadura o vasectomía"
        ],
        "multiple": false
      },
      {
        "code": "condiciones_mec",
        "name": "Condiciones que cambian la elegibilidad",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: anticoncepción",
        "options": [
          "Fuma y tiene 35 años o más",
          "Hipertensión",
          "Migraña con aura",
          "Antecedente de trombosis",
          "Lactancia < 6 semanas",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "metodo_elegido",
        "name": "Método elegido",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anticoncepción",
        "options": [
          "Preservativo",
          "Píldora combinada",
          "Píldora de progestágeno",
          "Inyectable",
          "Implante",
          "DIU de cobre",
          "DIU hormonal",
          "Ligadura o vasectomía",
          "Ninguno"
        ],
        "multiple": false
      },
      {
        "code": "categoria_mec",
        "name": "Categoría OMS del método elegido",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: anticoncepción",
        "options": [
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: anticoncepción"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: anticoncepción"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Uso correcto",
          "Doble protección con preservativo",
          "Anticoncepción de emergencia"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDFAM_CTRL_SALUD_MENTAL",
    "name": "Salud mental en atención primaria (mhGAP)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_FAMILIAR",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Tamizaje SRQ-20 de la OMS y evaluación de riesgo suicida según mhGAP."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de trastorno mental común",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): marque las preguntas que respondió «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: trastorno mental común",
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
        "description": "8 o más respuestas positivas: probable trastorno mental común. La pregunta 17 positiva exige evaluar riesgo suicida."
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total de respuestas «sí» (0–20)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: trastorno mental común"
      },
      {
        "code": "ideacion_suicida",
        "name": "Ideación suicida actual",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: trastorno mental común"
      },
      {
        "code": "funcionamiento",
        "name": "Funcionamiento en casa, trabajo o estudio",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: trastorno mental común",
        "options": [
          "Conservado",
          "Algo afectado",
          "Muy afectado"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Mejora del SRQ-20",
          "Sin ideación suicida",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Psicoeducación",
          "Activación conductual",
          "Red de apoyo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "MEDGEN_CONSULTA_BASE",
    "name": "Medicina General — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta ambulatoria: motivo, tiempo de evolución, relato de la enfermedad actual, antecedentes personales y familiares, funciones biológicas, examen físico general y por aparatos, diagnóstico y conducta. Son agregados propios de la ficha el desglose de los signos vitales en campos separados (presión, frecuencia cardíaca, temperatura, peso y talla) para poder registrarlos como valores numéricos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS)."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "MEDGEN_CTRL_ECNT",
    "name": "Control de hipertensión y diabetes en atención primaria (HEARTS)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "HEARTS: paquete técnico para el manejo de las enfermedades cardiovasculares en la atención primaria de salud",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/hearts-technical-package",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "La visita de control del programa HEARTS para hipertensión y diabetes en el primer nivel."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de hipertensión o diabetes",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "ecnt_condiciones",
        "name": "Condiciones en control",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes",
        "options": [
          "Hipertensión",
          "Diabetes tipo 2"
        ],
        "multiple": true
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes"
      },
      {
        "code": "dm_glucemia_capilar",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes",
        "showWhen": {
          "field": "ecnt_condiciones",
          "equals": "Diabetes tipo 2"
        }
      },
      {
        "code": "dm_hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hipertensión o diabetes",
        "showWhen": {
          "field": "ecnt_condiciones",
          "equals": "Diabetes tipo 2"
        }
      },
      {
        "code": "dm_sintomas",
        "name": "Síntomas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: hipertensión o diabetes",
        "options": [
          "Poliuria",
          "Polidipsia",
          "Pérdida de peso",
          "Visión borrosa",
          "Ninguno"
        ],
        "multiple": true,
        "showWhen": {
          "field": "ecnt_condiciones",
          "equals": "Diabetes tipo 2"
        }
      },
      {
        "code": "dm_pie",
        "name": "Examen del pie",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes",
        "options": [
          "Sensibilidad conservada (monofilamento)",
          "Sensibilidad disminuida",
          "Úlcera o lesión presente",
          "No evaluado"
        ],
        "multiple": false,
        "showWhen": {
          "field": "ecnt_condiciones",
          "equals": "Diabetes tipo 2"
        }
      },
      {
        "code": "dm_hipoglucemias",
        "name": "Episodios de hipoglucemia desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: hipertensión o diabetes",
        "showWhen": {
          "field": "ecnt_condiciones",
          "equals": "Diabetes tipo 2"
        }
      },
      {
        "code": "hta_organo_blanco",
        "name": "Síntomas de daño de órgano blanco",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hipertensión o diabetes",
        "options": [
          "Cefalea intensa",
          "Dolor torácico",
          "Disnea",
          "Alteración visual",
          "Déficit neurológico",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "hta_registros_domiciliarios",
        "name": "Registros de presión en domicilio (promedio)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hipertensión o diabetes"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hipertensión o diabetes"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "PA < 140/90 mmHg",
          "HbA1c < 7 %",
          "No fuma",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sal",
          "Actividad física",
          "Adherencia",
          "Pies (diabetes)"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "MEDGEN_CTRL_EDA",
    "name": "Enfermedad diarreica aguda en adultos",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Atención Integrada a las Enfermedades Prevalentes de la Infancia (AIEPI)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Estado de hidratación y planes A/B/C de la OMS."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: diarrea aguda",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diarrea aguda"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Sales de rehidratación oral",
          "Lavado de manos",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDGEN_CTRL_IRA",
    "name": "Infección respiratoria aguda en adultos",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Criterios de Centor/McIsaac para faringoamigdalitis y CURB-65 si se sospecha neumonía."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "centor_fiebre",
        "name": "Fiebre mayor a 38 °C",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "centor_sin_tos",
        "name": "Ausencia de tos",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "centor_adenopatias",
        "name": "Adenopatías cervicales anteriores dolorosas",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "centor_exudado",
        "name": "Exudado o tumefacción amigdalina",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "ira_rinorrea",
        "name": "Rinorrea",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda",
        "options": [
          "Ausente",
          "Acuosa",
          "Purulenta"
        ],
        "multiple": false
      },
      {
        "code": "centor_puntaje",
        "name": "Puntaje de Centor/McIsaac",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "crepitantes",
        "name": "Crepitantes (sospecha de neumonía)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: infección respiratoria aguda"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Hidratación y antipiréticos",
          "Antibiótico sólo si está indicado",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDGEN_CTRL_LUMBALGIA",
    "name": "Lumbalgia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Banderas rojas, componente radicular y función."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "lumbalgia_banderas_rojas",
        "name": "Banderas rojas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: lumbalgia",
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
        "multiple": true
      },
      {
        "code": "lumbalgia_ciatica",
        "name": "Dolor irradiado por debajo de la rodilla",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "lumbalgia_lasegue",
        "name": "Signo de Lasègue",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lumbalgia",
        "options": [
          "Positivo",
          "Negativo",
          "No evaluado"
        ],
        "multiple": false
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: lumbalgia"
      },
      {
        "code": "lumbalgia_duracion",
        "name": "Duración",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: lumbalgia",
        "options": [
          "Aguda (< 6 semanas)",
          "Subaguda (6–12 semanas)",
          "Crónica (> 12 semanas)"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Mantenerse activo",
          "Evitar reposo en cama"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDINT_CTRL_MULTIMORBILIDAD",
    "name": "Control de multimorbilidad y polifarmacia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_INTERNA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Revisión de problemas activos, fármacos (polifarmacia ≥ 5) y prioridades del paciente."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de multimorbilidad",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "condiciones_cronicas",
        "name": "Condiciones crónicas activas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: multimorbilidad",
        "options": [
          "Hipertensión",
          "Diabetes",
          "Insuficiencia cardíaca",
          "EPOC",
          "Enfermedad renal crónica",
          "Fibrilación auricular",
          "Depresión",
          "Artrosis"
        ],
        "multiple": true,
        "allowOther": true
      },
      {
        "code": "numero_de_farmacos",
        "name": "Fármacos en uso",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: multimorbilidad",
        "description": "5 o más: polifarmacia; revisar cada uno."
      },
      {
        "code": "problemas_con_farmacos",
        "name": "Problemas detectados",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: multimorbilidad",
        "options": [
          "Duplicación",
          "Interacción relevante",
          "Dosis no ajustada a la función renal",
          "Fármaco sin indicación vigente",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "farmacos_a_suspender",
        "name": "Fármacos a suspender o ajustar",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: multimorbilidad"
      },
      {
        "code": "prioridades_paciente",
        "name": "Qué es lo más importante para el paciente",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: multimorbilidad"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: multimorbilidad"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: multimorbilidad"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Lista actualizada de medicamentos",
          "Pastillero",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "MEDINT_CTRL_SFP",
    "name": "Síndrome febril prolongado",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_INTERNA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Estudio escalonado de la fiebre de origen desconocido."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "dias_de_fiebre",
        "name": "Días de fiebre",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: síndrome febril prolongado"
      },
      {
        "code": "sfp_sintomas",
        "name": "Acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: síndrome febril prolongado",
        "options": [
          "Pérdida de peso",
          "Sudoración nocturna",
          "Adenopatías",
          "Artralgias",
          "Lesiones de piel",
          "Soplo nuevo"
        ],
        "multiple": true
      },
      {
        "code": "sfp_estudios",
        "name": "Estudios realizados",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: síndrome febril prolongado",
        "options": [
          "Hemocultivos",
          "Urocultivo",
          "Serología VIH",
          "Baciloscopía",
          "Serología Chagas",
          "Gota gruesa",
          "Imágenes",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sfp_exposicion",
        "name": "Exposiciones y viajes",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: síndrome febril prolongado"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "MEDINT_EVALUACION_BASE",
    "name": "Medicina interna — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "MEDICINA_INTERNA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, historia clínica de consulta externa",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la evaluación integral del adulto: comorbilidades, polifarmacia y revisión por sistemas. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: AUDIT-C (OMS)."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "name": "Medicina Intensiva — evaluación de ingreso (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "MEDICINA_INTENSIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, notas de evolución y registro de la atención hospitalaria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, fecha de ingreso, signos vitales, evolución, diagnóstico y conducta. Son agregados propios de la especialidad el motivo de ingreso a la unidad, los días de estancia, el soporte ventilatorio, el soporte vasoactivo, la sedación, el balance hídrico y la evolución del turno. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de coma de Glasgow, RASS."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "NEFRO_CTRL_ERC",
    "name": "Control de enfermedad renal crónica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEFROLOGIA",
    "provenance": {
      "sourceTitle": "Guías de práctica clínica KDIGO",
      "organization": "Kidney Disease: Improving Global Outcomes (KDIGO)",
      "url": "https://kdigo.org/guidelines/",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Estadio por filtrado (G1–G5) y albuminuria (A1–A3) según las categorías KDIGO; control de PA, anemia y metabolismo mineral."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad renal crónica",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "creatinina",
        "name": "Creatinina (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "tfg",
        "name": "Filtrado glomerular estimado (mL/min/1,73 m²)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "erc_estadio_kdigo",
        "name": "Estadio por filtrado",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad renal crónica",
        "options": [
          "G1 (≥ 90)",
          "G2 (60–89)",
          "G3a (45–59)",
          "G3b (30–44)",
          "G4 (15–29)",
          "G5 (< 15)"
        ],
        "multiple": false
      },
      {
        "code": "albuminuria",
        "name": "Albuminuria",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica",
        "options": [
          "A1 (< 30 mg/g)",
          "A2 (30–300 mg/g)",
          "A3 (> 300 mg/g)",
          "No medida"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "potasio",
        "name": "Potasio (mEq/L)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica"
      },
      {
        "code": "erc_causa",
        "name": "Causa",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica",
        "options": [
          "Diabetes",
          "Hipertensión",
          "Glomerulopatía",
          "Poliquistosis",
          "Litiasis u obstructiva",
          "No establecida"
        ],
        "multiple": false
      },
      {
        "code": "terapia_renal",
        "name": "Terapia de reemplazo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad renal crónica",
        "options": [
          "No la necesita",
          "En preparación",
          "Hemodiálisis",
          "Diálisis peritoneal",
          "Trasplante"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "PA < 130/80 mmHg",
          "Recibe IECA o ARA II si hay albuminuria",
          "Evita nefrotóxicos",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Evitar AINE y medicina sin indicación",
          "Alimentación",
          "Ajuste de dosis de fármacos"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEFRO_CTRL_LITIASIS",
    "name": "Control de litiasis renal",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEFROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Episodios, tamaño y ubicación del lito, y estudio metabólico."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de litiasis renal",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "colicos_anio",
        "name": "Cólicos en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: litiasis renal"
      },
      {
        "code": "lito_tamano",
        "name": "Imagen: tamaño y ubicación del lito",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: litiasis renal"
      },
      {
        "code": "hidronefrosis",
        "name": "Hidronefrosis",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: litiasis renal"
      },
      {
        "code": "fiebre_litiasis",
        "name": "Fiebre (obstrucción infectada: urgencia)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: litiasis renal"
      },
      {
        "code": "lito_composicion",
        "name": "Composición",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: litiasis renal",
        "options": [
          "Oxalato de calcio",
          "Ácido úrico",
          "Estruvita",
          "Cistina",
          "Desconocida"
        ],
        "multiple": false
      },
      {
        "code": "estudio_metabolico",
        "name": "Estudio metabólico realizado",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: litiasis renal"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Diuresis > 2 litros por día",
          "Sin cólicos",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Tomar agua",
          "Menos sal y proteína animal"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEFRO_EVALUACION_BASE",
    "name": "Nefrología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "NEFROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato genitourinario",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el interrogatorio dirigido de diuresis, edemas y hematuria, el antecedente de litiasis, la presión arterial registrada en consulta y la referencia a estudios de función renal previos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "NEUMO_CTRL_ASMA",
    "name": "Control de asma",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Global Strategy for Asthma Management and Prevention",
      "organization": "Global Initiative for Asthma (GINA)",
      "url": "https://ginasthma.org/reports/",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Control de síntomas de las últimas 4 semanas y riesgo futuro según las categorías de GINA."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de asma",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "asma_control_4_semanas",
        "name": "En las últimas 4 semanas (GINA)",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: asma",
        "options": [
          "Síntomas diurnos más de 2 veces por semana",
          "Despertares nocturnos por asma",
          "Uso de rescate más de 2 veces por semana",
          "Limitación de la actividad",
          "Ninguno"
        ],
        "multiple": true,
        "description": "Ninguno: controlada · 1–2: parcialmente controlada · 3–4: no controlada."
      },
      {
        "code": "asma_crisis_anio",
        "name": "Crisis que requirieron urgencias en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "asma_tratamiento_actual",
        "name": "Inhaladores que usa",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "tecnica_inhalatoria",
        "name": "Técnica inhalatoria",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: asma",
        "options": [
          "Correcta",
          "Con errores",
          "No evaluada"
        ],
        "multiple": false
      },
      {
        "code": "pef",
        "name": "Flujo espiratorio máximo (L/min)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "vef1",
        "name": "VEF₁ (% del predicho)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "corticoides_orales",
        "name": "Recibió corticoides orales en el último año",
        "dataType": "boolean",
        "required": false,
        "section": "Complicaciones y daño de órgano"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Asma controlada",
          "Sin crisis en el año",
          "Técnica inhalatoria correcta",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Técnica inhalatoria",
          "Plan de acción escrito",
          "Evitar desencadenantes"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEUMO_CTRL_EPOC",
    "name": "Control de EPOC",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Global Strategy for the Diagnosis, Management and Prevention of COPD",
      "organization": "Global Initiative for Chronic Obstructive Lung Disease (GOLD)",
      "url": "https://goldcopd.org/",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Disnea (mMRC), exacerbaciones y grupo de manejo según las categorías GOLD; exposición a biomasa."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de EPOC",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "epoc_mmrc",
        "name": "Disnea (escala mMRC)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: EPOC",
        "options": [
          "Grado 0 — disnea sólo con ejercicio intenso",
          "Grado 1 — al caminar rápido o subir una pendiente",
          "Grado 2 — camina más despacio que sus pares o se detiene en llano",
          "Grado 3 — se detiene a los 100 metros o a los pocos minutos",
          "Grado 4 — no sale de casa o se ahoga al vestirse"
        ],
        "multiple": false
      },
      {
        "code": "epoc_exacerbaciones_anio",
        "name": "Exacerbaciones en el último año",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "epoc_internaciones_anio",
        "name": "Internaciones por exacerbación en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "vef1",
        "name": "VEF₁ posbroncodilatador (% del predicho)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "gold_grupo",
        "name": "Grupo GOLD",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: EPOC",
        "options": [
          "A",
          "B",
          "E"
        ],
        "multiple": false
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "tabaco",
        "name": "Tabaco",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: EPOC",
        "options": [
          "Nunca fumó",
          "Exfumador",
          "Fumador actual"
        ],
        "multiple": false
      },
      {
        "code": "epoc_biomasa",
        "name": "Exposición a humo de leña o biomasa",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "oxigeno_domiciliario",
        "name": "Usa oxígeno en domicilio",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: EPOC"
      },
      {
        "code": "tecnica_inhalatoria",
        "name": "Técnica inhalatoria",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: EPOC",
        "options": [
          "Correcta",
          "Con errores",
          "No evaluada"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin exacerbaciones",
          "No fuma",
          "Vacunas al día (influenza y neumococo)",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dejar de fumar",
          "Técnica inhalatoria",
          "Rehabilitación respiratoria",
          "Signos de exacerbación"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEUMO_CTRL_NEUMONIA",
    "name": "Neumonía adquirida en la comunidad: evaluación y control",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Gravedad por CURB-65 (British Thoracic Society) y respuesta al tratamiento a las 48–72 horas."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de neumonía",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "neumonia_crepitantes",
        "name": "Crepitantes o soplo tubario localizados",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "curb65",
        "name": "Criterios CURB-65 presentes",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: neumonía",
        "options": [
          "Confusión de reciente aparición",
          "Urea > 42 mg/dL (BUN > 19 mg/dL)",
          "Frecuencia respiratoria ≥ 30 rpm",
          "PAS < 90 o PAD ≤ 60 mmHg",
          "Edad ≥ 65 años",
          "Ninguno"
        ],
        "multiple": true,
        "description": "0–1: ambulatorio · 2: valorar internación · 3 o más: neumonía grave."
      },
      {
        "code": "neumonia_expectoracion",
        "name": "Expectoración purulenta",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "respuesta_48h",
        "name": "Respuesta a las 48–72 h",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: neumonía",
        "options": [
          "Mejoría",
          "Sin cambios",
          "Empeoramiento",
          "Todavía no corresponde"
        ],
        "multiple": false
      },
      {
        "code": "rx_torax",
        "name": "Radiografía de tórax — hallazgo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: neumonía"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Afebril",
          "Saturación ≥ 92 %",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Completar el antibiótico",
          "Signos de alarma"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEUMO_CTRL_TB",
    "name": "Control de tratamiento de tuberculosis",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Programa Mundial contra la Tuberculosis — directrices consolidadas",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/teams/global-tuberculosis-programme",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Seguimiento del tratamiento: fase, baciloscopías de control, adherencia (tratamiento directamente observado) y reacciones adversas."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de tuberculosis",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tbc_dias_de_tos",
        "name": "Días de tos con expectoración",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: tuberculosis",
        "description": "15 días o más: sintomático respiratorio, pedir baciloscopía."
      },
      {
        "code": "tbc_sintomas",
        "name": "Síntomas acompañantes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: tuberculosis",
        "options": [
          "Fiebre vespertina",
          "Sudoración nocturna",
          "Pérdida de peso",
          "Hemoptisis",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "tbc_contacto",
        "name": "Contacto con un caso de tuberculosis",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: tuberculosis"
      },
      {
        "code": "tbc_baciloscopia",
        "name": "Baciloscopía",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: tuberculosis",
        "options": [
          "Positiva",
          "Negativa",
          "Pedida",
          "No pedida"
        ],
        "multiple": false
      },
      {
        "code": "tb_fase",
        "name": "Fase del tratamiento",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tuberculosis",
        "options": [
          "Intensiva",
          "Continuación",
          "Terminado"
        ],
        "multiple": false
      },
      {
        "code": "tb_mes",
        "name": "Mes de tratamiento",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: tuberculosis"
      },
      {
        "code": "tb_taes",
        "name": "Tratamiento directamente observado",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: tuberculosis",
        "options": [
          "Diario sin faltas",
          "Con faltas",
          "No supervisado"
        ],
        "multiple": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: tuberculosis"
      },
      {
        "code": "vih_tb",
        "name": "Prueba de VIH",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: tuberculosis",
        "options": [
          "Negativa",
          "Positiva",
          "No realizada"
        ],
        "multiple": false
      },
      {
        "code": "ram_tb",
        "name": "Reacciones adversas",
        "dataType": "json",
        "required": false,
        "section": "Complicaciones y daño de órgano",
        "options": [
          "Hepatotoxicidad",
          "Erupción",
          "Neuropatía",
          "Alteración visual",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Baciloscopía negativa al final de la fase intensiva",
          "Sin faltas",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Adherencia",
          "Estudio de contactos",
          "Medidas de aislamiento respiratorio"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEUMO_EVALUACION_BASE",
    "name": "Neumología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato respiratorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen por aparatos, diagnóstico y conducta. Son agregados propios de la especialidad la descripción dirigida de disnea, tos, expectoración y hemoptisis, el antecedente de tabaquismo, la auscultación pulmonar y la saturación de oxígeno. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de disnea mMRC, escala de fuerza MRC."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "NEURO_CTRL_ACV",
    "name": "Accidente cerebrovascular: evaluación y seguimiento",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "NIH Stroke Scale",
      "organization": "National Institute of Neurological Disorders and Stroke (NINDS/NIH)",
      "url": "https://www.ninds.nih.gov/health-information/stroke/assess-and-treat/nih-stroke-scale",
      "license": "Dominio público (Gobierno de los EE. UU.)",
      "retrievedAt": "2026-10-02",
      "note": "Déficit por la escala NIHSS (dominio público), discapacidad por escala de Rankin modificada y prevención secundaria."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de accidente cerebrovascular",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "acv_cincinnati",
        "name": "Escala de Cincinnati",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular",
        "options": [
          "Asimetría facial",
          "Caída de un brazo",
          "Alteración del habla",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "acv_hora_inicio",
        "name": "Hora de inicio o de la última vez visto bien",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "acv_glasgow",
        "name": "Escala de Glasgow (3–15)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "acv_glucemia",
        "name": "Glucemia capilar (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "nihss",
        "name": "NIHSS (0–42)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "acv_tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular",
        "options": [
          "Isquémico",
          "Hemorrágico",
          "Accidente isquémico transitorio",
          "No establecido"
        ],
        "multiple": false
      },
      {
        "code": "rankin",
        "name": "Escala de Rankin modificada",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular",
        "options": [
          "0 — sin síntomas",
          "1 — sin discapacidad significativa",
          "2 — discapacidad leve",
          "3 — moderada",
          "4 — moderadamente grave",
          "5 — grave",
          "6 — fallecido"
        ],
        "multiple": false
      },
      {
        "code": "disfagia_tamizaje",
        "name": "Tamizaje de disfagia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular",
        "options": [
          "Normal",
          "Alterado",
          "No realizado"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: accidente cerebrovascular"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "PA < 130/80 mmHg",
          "Antiagregado o anticoagulado según causa",
          "Estatina",
          "En rehabilitación",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Reconocer un nuevo ACV (cara, brazo, habla: llamar ya)",
          "Adherencia",
          "Rehabilitación"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEURO_CTRL_CEFALEA",
    "name": "Control de cefalea primaria (migraña o tensional)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Fenotipo, frecuencia, uso de analgésicos y banderas rojas SNOOP."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de cefalea",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "cefalea_snoop",
        "name": "Banderas rojas (SNOOP)",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: cefalea",
        "options": [
          "Síntomas sistémicos (fiebre, pérdida de peso)",
          "Déficit neurológico focal o confusión",
          "Inicio súbito, en trueno",
          "Inicio después de los 50 años",
          "Cambio de patrón o empeora con Valsalva o posición",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "cefalea_tipo",
        "name": "Fenotipo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: cefalea",
        "options": [
          "Migraña sin aura",
          "Migraña con aura",
          "Tensional",
          "En racimos",
          "Por abuso de analgésicos",
          "No definido"
        ],
        "multiple": false
      },
      {
        "code": "cefalea_dias_mes",
        "name": "Días de cefalea por mes",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: cefalea"
      },
      {
        "code": "dias_analgesicos_mes",
        "name": "Días por mes que toma analgésicos",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: cefalea"
      },
      {
        "code": "cefalea_intensidad",
        "name": "Intensidad habitual (0 a 10)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: cefalea"
      },
      {
        "code": "profilaxis",
        "name": "Recibe tratamiento preventivo",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: cefalea"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Menos de 4 días de cefalea por mes",
          "Analgésicos menos de 10 días por mes",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Diario de cefalea",
          "Evitar abuso de analgésicos",
          "Sueño y desencadenantes"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEURO_CTRL_EPILEPSIA",
    "name": "Control de epilepsia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Módulo de epilepsia de mhGAP: frecuencia de crisis, adherencia, efectos adversos y situaciones especiales (embarazo)."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de epilepsia",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "convulsion_tipo",
        "name": "Tipo de crisis",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: epilepsia",
        "options": [
          "Tónico-clónica generalizada",
          "Focal sin pérdida de conciencia",
          "Focal con alteración de conciencia",
          "Ausencia",
          "No definido"
        ],
        "multiple": false
      },
      {
        "code": "convulsion_duracion_minutos",
        "name": "Duración (minutos)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: epilepsia"
      },
      {
        "code": "convulsion_desencadenantes",
        "name": "Posibles desencadenantes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: epilepsia",
        "options": [
          "Fiebre",
          "Falta de sueño",
          "Alcohol",
          "Abandono de la medicación",
          "Ninguno conocido"
        ],
        "multiple": true
      },
      {
        "code": "crisis_desde_ultimo_control",
        "name": "Crisis desde el último control",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: epilepsia"
      },
      {
        "code": "fecha_ultima_crisis",
        "name": "Fecha de la última crisis",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: epilepsia"
      },
      {
        "code": "embarazo_epilepsia",
        "name": "¿Embarazo o deseo de embarazo?",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: epilepsia",
        "options": [
          "Sí",
          "No",
          "No aplica"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin crisis",
          "Sin efectos adversos",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "No suspender la medicación",
          "Primeros auxilios en una crisis",
          "Riesgos: conducir, nadar, alturas"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEURO_CTRL_PARKINSON",
    "name": "Control de enfermedad de Parkinson",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Estadio de Hoehn y Yahr (publicado), fluctuaciones motoras y síntomas no motores."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad de Parkinson",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "hoehn_yahr",
        "name": "Estadio de Hoehn y Yahr",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad de Parkinson",
        "options": [
          "1 — unilateral",
          "2 — bilateral sin alteración del equilibrio",
          "3 — inestabilidad postural leve",
          "4 — discapacidad grave, camina con ayuda",
          "5 — silla de ruedas o cama"
        ],
        "multiple": false
      },
      {
        "code": "parkinson_motores",
        "name": "Problemas motores",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad de Parkinson",
        "options": [
          "Fluctuaciones (fin de dosis)",
          "Discinesias",
          "Congelamiento de la marcha",
          "Caídas"
        ],
        "multiple": true
      },
      {
        "code": "parkinson_no_motores",
        "name": "Síntomas no motores",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad de Parkinson",
        "options": [
          "Depresión",
          "Deterioro cognitivo",
          "Alucinaciones",
          "Constipación",
          "Hipotensión ortostática",
          "Trastorno del sueño"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Horarios de la levodopa",
          "Prevención de caídas",
          "Ejercicio"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NEURO_EVALUACION_BASE",
    "name": "Neurología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del sistema nervioso",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta y el apartado de examen del sistema nervioso: motivo, tiempo de evolución, antecedentes, examen, diagnóstico y conducta. Son agregados propios de la especialidad el desglose del examen neurológico en campos separados (estado de conciencia, pares craneales, fuerza muscular, sensibilidad, reflejos, coordinación y marcha) y la anamnesis dirigida de cefalea y episodios convulsivos. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: escala de coma de Glasgow, escala de fuerza MRC."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "NUTRI_CTRL_DIABETES",
    "name": "Plan alimentario en diabetes",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NUTRICION",
    "provenance": {
      "sourceTitle": "HEARTS-D: diagnóstico y manejo de la diabetes tipo 2",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/who-ucn-ncd-20.1",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Recordatorio, distribución de carbohidratos y glucemias."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de diabetes",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: diabetes"
      },
      {
        "code": "hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes"
      },
      {
        "code": "comidas_al_dia",
        "name": "Comidas al día",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: diabetes"
      },
      {
        "code": "recordatorio_24h",
        "name": "Recordatorio de 24 horas",
        "dataType": "text",
        "required": false,
        "section": "Evaluación: diabetes"
      },
      {
        "code": "hipoglucemias",
        "name": "Hipoglucemias",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diabetes"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Conteo de carbohidratos",
          "Horarios regulares",
          "Qué hacer en una hipoglucemia"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NUTRI_CTRL_OBESIDAD",
    "name": "Control nutricional de sobrepeso y obesidad",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "NUTRICION",
    "provenance": {
      "sourceTitle": "Obesidad y sobrepeso",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/obesity",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Antropometría, cambio de peso, hábitos y metas."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de sobrepeso u obesidad",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: sobrepeso u obesidad"
      },
      {
        "code": "imc",
        "name": "IMC (kg/m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: sobrepeso u obesidad"
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: sobrepeso u obesidad"
      },
      {
        "code": "cambio_de_peso_kg",
        "name": "Cambio desde el último control (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: sobrepeso u obesidad"
      },
      {
        "code": "consumo_frecuente",
        "name": "Consumo frecuente",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: sobrepeso u obesidad",
        "options": [
          "Bebidas azucaradas",
          "Frituras",
          "Comida rápida",
          "Frutas y verduras"
        ],
        "multiple": true
      },
      {
        "code": "actividad_fisica",
        "name": "Actividad física",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: sobrepeso u obesidad",
        "options": [
          "Sedentario",
          "Menos de 150 min por semana",
          "150 min o más"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Bajó 5 % del peso",
          "Sin bebidas azucaradas",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Plato saludable",
          "Porciones",
          "Actividad física"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "NUTRI_EVALUACION_BASE",
    "name": "Nutrición y Dietética — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "name": "Obstetricia — control obstétrico (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "OBST_CTRL_DIABETES_GESTACIONAL",
    "name": "Control de diabetes gestacional",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Recomendaciones de la OMS sobre atención prenatal para una experiencia positiva del embarazo (2016)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549912",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Glucemias de ayuno y posprandiales, crecimiento fetal y tratamiento."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de diabetes gestacional",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diabetes gestacional"
      },
      {
        "code": "glucemia_ayunas",
        "name": "Glucemia en ayunas (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: diabetes gestacional"
      },
      {
        "code": "glucemia_posprandial",
        "name": "Glucemia 1 h posprandial (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes gestacional"
      },
      {
        "code": "tratamiento_dg",
        "name": "Tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: diabetes gestacional",
        "options": [
          "Dieta",
          "Metformina",
          "Insulina"
        ],
        "multiple": false
      },
      {
        "code": "altura_uterina_cm",
        "name": "Altura uterina (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diabetes gestacional"
      },
      {
        "code": "ecografia_crecimiento",
        "name": "Ecografía — percentil de crecimiento",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: diabetes gestacional"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Ayunas < 95 mg/dL",
          "1 h posprandial < 140 mg/dL",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Alimentación",
          "Automonitoreo",
          "Tamizaje posparto a las 4–12 semanas"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "OBST_CTRL_HIPERTENSION",
    "name": "Trastorno hipertensivo del embarazo",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Recomendaciones de la OMS sobre atención prenatal para una experiencia positiva del embarazo (2016)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549912",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Presión, proteinuria y criterios de gravedad de preeclampsia; sulfato de magnesio y momento del parto."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de hipertensión en el embarazo",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión en el embarazo"
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión en el embarazo"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: hipertensión en el embarazo"
      },
      {
        "code": "proteinuria",
        "name": "Proteinuria",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hipertensión en el embarazo",
        "options": [
          "Negativa",
          "+",
          "++",
          "+++"
        ],
        "multiple": false
      },
      {
        "code": "criterios_gravedad",
        "name": "Criterios de gravedad",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hipertensión en el embarazo",
        "options": [
          "PA ≥ 160/110",
          "Cefalea o alteración visual",
          "Dolor en epigastrio",
          "Plaquetas < 100 000",
          "Transaminasas elevadas",
          "Oliguria",
          "Edema pulmonar",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "sulfato_magnesio",
        "name": "Recibe sulfato de magnesio",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: hipertensión en el embarazo"
      },
      {
        "code": "frecuencia_cardiaca_fetal",
        "name": "Frecuencia cardíaca fetal (lpm)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: hipertensión en el embarazo"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Signos de alarma",
          "Aspirina en dosis baja si corresponde"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "OBST_TRABAJO_DE_PARTO",
    "name": "Trabajo de parto (guía de cuidados de la OMS)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Guía de cuidados durante el trabajo de parto (WHO Labour Care Guide, 2020)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789240017566",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Variables de la Labour Care Guide de la OMS: bienestar materno y fetal y progreso del trabajo de parto."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "hora_evaluacion",
        "name": "Hora de la evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "dilatacion_cm",
        "name": "Dilatación (cm)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "descenso",
        "name": "Descenso",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: trabajo de parto",
        "options": [
          "5/5",
          "4/5",
          "3/5",
          "2/5",
          "1/5",
          "0/5"
        ],
        "multiple": false
      },
      {
        "code": "contracciones_10min",
        "name": "Contracciones en 10 minutos",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "frecuencia_cardiaca_fetal",
        "name": "Frecuencia cardíaca fetal (lpm)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "liquido_amniotico",
        "name": "Líquido amniótico",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: trabajo de parto",
        "options": [
          "Íntegras",
          "Claro",
          "Meconial",
          "Sanguinolento"
        ],
        "multiple": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "acompanante",
        "name": "Tiene acompañante de su elección",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: trabajo de parto"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ODONTO_ANAMNESIS",
    "name": "Odontología — anamnesis y consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "ODONTO_CTRL_PERIODONTAL",
    "name": "Evaluación periodontal",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ODONTOLOGIA",
    "provenance": {
      "sourceTitle": "Oral health surveys: basic methods, 5.ª ed.",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548649",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Índice periodontal comunitario (sangrado y bolsas) de los métodos de encuesta de salud bucal de la OMS."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad periodontal",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "sangrado_gingival",
        "name": "Sangrado al sondaje",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad periodontal",
        "options": [
          "Ausente",
          "Presente"
        ],
        "multiple": false
      },
      {
        "code": "bolsas",
        "name": "Bolsas periodontales",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad periodontal",
        "options": [
          "Sin bolsas",
          "4–5 mm",
          "6 mm o más"
        ],
        "multiple": false
      },
      {
        "code": "movilidad",
        "name": "Movilidad dentaria",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: enfermedad periodontal"
      },
      {
        "code": "factores_perio",
        "name": "Factores",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad periodontal",
        "options": [
          "Tabaco",
          "Diabetes",
          "Higiene deficiente",
          "Embarazo"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Técnica de cepillado",
          "Hilo dental",
          "Dejar de fumar"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ODONTO_ODONTOGRAMA_OMS",
    "name": "Odontograma y evaluación bucodental (OMS)",
    "version": 3,
    "kind": "SPECIFIC",
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
    "code": "OFTALMO_CTRL_GLAUCOMA",
    "name": "Control de glaucoma",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OFTALMOLOGIA",
    "provenance": {
      "sourceTitle": "Preferred Practice Pattern Guidelines",
      "organization": "American Academy of Ophthalmology (AAO)",
      "url": "https://www.aao.org/education/preferred-practice-pattern",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Presión intraocular, nervio óptico y campo visual."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de glaucoma",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "pio_od",
        "name": "Presión intraocular OD (mmHg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: glaucoma"
      },
      {
        "code": "pio_oi",
        "name": "Presión intraocular OI (mmHg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: glaucoma"
      },
      {
        "code": "copa_disco",
        "name": "Relación copa/disco OD/OI",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: glaucoma"
      },
      {
        "code": "campo_visual",
        "name": "Campo visual",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: glaucoma",
        "options": [
          "Sin cambios",
          "Progresión",
          "No realizado"
        ],
        "multiple": false
      },
      {
        "code": "angulo",
        "name": "Tipo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: glaucoma",
        "options": [
          "Ángulo abierto",
          "Ángulo cerrado"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Presión en la meta individual",
          "Campo visual estable",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Gotas todos los días",
          "Técnica de aplicación"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "OFTALMO_CTRL_RETINOPATIA",
    "name": "Control de retinopatía diabética",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OFTALMOLOGIA",
    "provenance": {
      "sourceTitle": "Preferred Practice Pattern Guidelines",
      "organization": "American Academy of Ophthalmology (AAO)",
      "url": "https://www.aao.org/education/preferred-practice-pattern",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Escala internacional de retinopatía diabética y edema macular (categorías de la AAO)."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "agudeza_visual_od",
        "name": "Agudeza visual OD",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: retinopatía diabética"
      },
      {
        "code": "agudeza_visual_oi",
        "name": "Agudeza visual OI",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: retinopatía diabética"
      },
      {
        "code": "retinopatia_od",
        "name": "Retinopatía OD",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: retinopatía diabética",
        "options": [
          "Sin retinopatía",
          "No proliferativa leve",
          "No proliferativa moderada",
          "No proliferativa grave",
          "Proliferativa"
        ],
        "multiple": false
      },
      {
        "code": "retinopatia_oi",
        "name": "Retinopatía OI",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: retinopatía diabética",
        "options": [
          "Sin retinopatía",
          "No proliferativa leve",
          "No proliferativa moderada",
          "No proliferativa grave",
          "Proliferativa"
        ],
        "multiple": false
      },
      {
        "code": "edema_macular",
        "name": "Edema macular",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: retinopatía diabética",
        "options": [
          "Ausente",
          "Presente sin compromiso central",
          "Presente con compromiso central"
        ],
        "multiple": false
      },
      {
        "code": "hba1c",
        "name": "Última HbA1c (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: retinopatía diabética"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "OFTALMO_EXAMEN_BASE",
    "name": "Oftalmología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "ONCO_CTRL_PALIATIVOS",
    "name": "Control de cuidados paliativos",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ONCOLOGIA",
    "provenance": {
      "sourceTitle": "ECOG Performance Status Scale",
      "organization": "ECOG-ACRIN Cancer Research Group",
      "url": "https://ecog-acrin.org/resources/ecog-performance-status/",
      "license": "De uso libre, citando la fuente",
      "retrievedAt": "2026-10-02",
      "note": "Intensidad de síntomas, dolor por la escala de la OMS y estado funcional."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de enfermedad avanzada",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "ecog",
        "name": "ECOG",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: enfermedad avanzada",
        "options": [
          "0",
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: enfermedad avanzada"
      },
      {
        "code": "escalon_analgesico",
        "name": "Escalón analgésico de la OMS",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad avanzada",
        "options": [
          "1 — no opioide",
          "2 — opioide débil",
          "3 — opioide fuerte"
        ],
        "multiple": false
      },
      {
        "code": "sintomas_paliativos",
        "name": "Síntomas que molestan",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: enfermedad avanzada",
        "options": [
          "Disnea",
          "Náuseas",
          "Constipación",
          "Insomnio",
          "Ansiedad",
          "Delirium",
          "Anorexia"
        ],
        "multiple": true
      },
      {
        "code": "voluntades",
        "name": "Se conversaron las voluntades anticipadas",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: enfermedad avanzada"
      },
      {
        "code": "lugar_preferido",
        "name": "Lugar donde prefiere ser atendido",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: enfermedad avanzada",
        "options": [
          "Domicilio",
          "Hospital",
          "No lo decidió"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dolor ≤ 3",
          "Síntomas controlados",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Opioides: uso y efectos",
          "Apoyo a la familia"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ONCO_CTRL_QUIMIOTERAPIA",
    "name": "Control previo a cada ciclo de quimioterapia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "ONCOLOGIA",
    "provenance": {
      "sourceTitle": "Common Terminology Criteria for Adverse Events (CTCAE)",
      "organization": "National Cancer Institute (NCI/NIH)",
      "url": "https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctc.htm",
      "license": "Dominio público (Gobierno de los EE. UU.)",
      "retrievedAt": "2026-10-02",
      "note": "Toxicidad graduada por CTCAE (NCI, dominio público) y estado funcional ECOG antes de autorizar el ciclo."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de tratamiento oncológico",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "esquema",
        "name": "Esquema y número de ciclo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tratamiento oncológico"
      },
      {
        "code": "ecog",
        "name": "ECOG",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tratamiento oncológico",
        "options": [
          "0",
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: tratamiento oncológico"
      },
      {
        "code": "neutrofilos",
        "name": "Neutrófilos (/µL)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: tratamiento oncológico"
      },
      {
        "code": "plaquetas",
        "name": "Plaquetas (/µL)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: tratamiento oncológico"
      },
      {
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: tratamiento oncológico"
      },
      {
        "code": "toxicidad",
        "name": "Toxicidad desde el último ciclo",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: tratamiento oncológico",
        "options": [
          "Náuseas y vómitos",
          "Mucositis",
          "Diarrea",
          "Neuropatía",
          "Fiebre con neutropenia",
          "Fatiga",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "toxicidad_grado",
        "name": "Peor grado CTCAE",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: tratamiento oncológico",
        "options": [
          "0",
          "1",
          "2",
          "3",
          "4"
        ],
        "multiple": false
      },
      {
        "code": "apto_ciclo",
        "name": "¿Se autoriza el ciclo?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tratamiento oncológico",
        "options": [
          "Sí",
          "Se difiere",
          "Se ajusta la dosis"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Fiebre: consultar de inmediato",
          "Higiene bucal",
          "Hidratación"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "ONCO_EVALUACION_BASE",
    "name": "Oncología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "ONCOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico y notas de evolución",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el diagnóstico oncológico y su fecha, el estadio registrado como texto libre, los tratamientos oncológicos recibidos, el estado funcional ECOG como número y la pérdida de peso. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: ECOG."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "ORL_CTRL_HIPOACUSIA",
    "name": "Hipoacusia: evaluación",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OTORRINOLARINGOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Inicio, lateralidad, audiometría y factores de riesgo."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "inicio",
        "name": "Inicio",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: hipoacusia",
        "options": [
          "Súbito (urgencia)",
          "Progresivo"
        ],
        "multiple": false
      },
      {
        "code": "lado",
        "name": "Lado",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hipoacusia",
        "options": [
          "Derecho",
          "Izquierdo",
          "Bilateral"
        ],
        "multiple": false
      },
      {
        "code": "tipo",
        "name": "Tipo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hipoacusia",
        "options": [
          "Conductiva",
          "Neurosensorial",
          "Mixta",
          "No establecida"
        ],
        "multiple": false
      },
      {
        "code": "audiometria",
        "name": "Audiometría — umbrales",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hipoacusia"
      },
      {
        "code": "factores",
        "name": "Factores",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: hipoacusia",
        "options": [
          "Ruido laboral",
          "Ototóxicos",
          "Edad",
          "Antecedente familiar"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ORL_CTRL_OTITIS",
    "name": "Otitis media: evaluación y control",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "OTORRINOLARINGOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Otoscopía, otorrea y audición."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "oido",
        "name": "Oído",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: otitis media",
        "options": [
          "Derecho",
          "Izquierdo",
          "Ambos"
        ],
        "multiple": false
      },
      {
        "code": "membrana",
        "name": "Membrana timpánica",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: otitis media",
        "options": [
          "Normal",
          "Abombada",
          "Retraída",
          "Perforada"
        ],
        "multiple": false
      },
      {
        "code": "otorrea",
        "name": "Otorrea",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: otitis media"
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: otitis media"
      },
      {
        "code": "audicion",
        "name": "Audición",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: otitis media",
        "options": [
          "Conservada",
          "Disminuida"
        ],
        "multiple": false
      },
      {
        "code": "episodios_anio",
        "name": "Episodios en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: otitis media"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "ORL_EVALUACION_BASE",
    "name": "Otorrinolaringología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "OTORRINOLARINGOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen de cabeza y cuello",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen dirigido, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis otológica (hipoacusia, lado afectado, otalgia, otorrea, acúfenos, vértigo), la nasal y faringolaríngea (obstrucción nasal, epistaxis, odinofagia, disfonía) y la otoscopia y la rinoscopia anterior descritas en prosa. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "name": "Patología Clínica — informe general de anatomía patológica (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "PATOL_INFORME_CITOLOGIA_CERVICAL",
    "name": "Informe de citología cervical",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PATOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Directriz de la OMS para el tamizaje y tratamiento de lesiones precancerosas del cuello uterino (2021)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789240030824",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Calidad de la muestra y categorías del sistema Bethesda."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "calidad_muestra",
        "name": "Calidad de la muestra",
        "dataType": "string",
        "required": true,
        "section": "Resultado: citología cervical",
        "options": [
          "Satisfactoria",
          "Insatisfactoria"
        ],
        "multiple": false
      },
      {
        "code": "bethesda",
        "name": "Resultado (Bethesda)",
        "dataType": "string",
        "required": true,
        "section": "Resultado: citología cervical",
        "options": [
          "Negativo para lesión intraepitelial o malignidad",
          "ASC-US",
          "ASC-H",
          "LSIL",
          "HSIL",
          "Carcinoma escamoso",
          "AGC",
          "Adenocarcinoma"
        ],
        "multiple": false
      },
      {
        "code": "microorganismos",
        "name": "Microorganismos",
        "dataType": "json",
        "required": false,
        "section": "Resultado: citología cervical",
        "options": [
          "Trichomonas",
          "Cándida",
          "Vaginosis bacteriana",
          "Cambios por herpes",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "PEDIA_CONTROL_NINO_SANO",
    "name": "Pediatría — control de niño sano (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "name": "Diagnóstico presuntivo (lo que se sospecha)",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "PEDIA_CTRL_ASMA",
    "name": "Control de asma en niños",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Global Strategy for Asthma Management and Prevention",
      "organization": "Global Initiative for Asthma (GINA)",
      "url": "https://ginasthma.org/reports/",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Control de síntomas de las últimas 4 semanas según las categorías de GINA y técnica con espaciador."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de asma",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "asma_control_4_semanas",
        "name": "En las últimas 4 semanas (GINA)",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: asma",
        "options": [
          "Síntomas diurnos más de 2 veces por semana",
          "Despertares nocturnos por asma",
          "Uso de rescate más de 2 veces por semana",
          "Limitación de la actividad",
          "Ninguno"
        ],
        "multiple": true,
        "description": "Ninguno: controlada · 1–2: parcialmente controlada · 3–4: no controlada."
      },
      {
        "code": "asma_crisis_anio",
        "name": "Crisis que requirieron urgencias en el último año",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "asma_tratamiento_actual",
        "name": "Inhaladores que usa",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "espaciador",
        "name": "Usa espaciador",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: asma",
        "options": [
          "Sí, correctamente",
          "Sí, con errores",
          "No"
        ],
        "multiple": false
      },
      {
        "code": "dias_escuela_perdidos",
        "name": "Días de escuela perdidos en el mes",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: asma"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Asma controlada",
          "Sin crisis",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Técnica con espaciador",
          "Plan de acción",
          "Evitar humo de tabaco y leña"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "PEDIA_CTRL_DESNUTRICION",
    "name": "Control de desnutrición aguda",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Malnutrición",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/health-topics/malnutrition",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Puntaje Z peso/talla, perímetro braquial, edema y prueba del apetito."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de desnutrición aguda",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "z_peso_talla",
        "name": "Z peso/talla",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "perimetro_braquial",
        "name": "Perímetro braquial (mm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "edema_bilateral",
        "name": "Edema bilateral",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: desnutrición aguda"
      },
      {
        "code": "prueba_apetito",
        "name": "Prueba del apetito",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: desnutrición aguda",
        "options": [
          "Pasa",
          "No pasa",
          "No realizada"
        ],
        "multiple": false
      },
      {
        "code": "desnutricion_clasificacion",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: desnutrición aguda",
        "options": [
          "Aguda moderada",
          "Aguda grave sin complicaciones",
          "Aguda grave complicada"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Ganancia de peso ≥ 5 g/kg/día",
          "Z peso/talla ≥ −2",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Alimento terapéutico",
          "Lactancia",
          "Higiene"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "PEDIA_CTRL_EDA",
    "name": "Niño con diarrea (AIEPI)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Atención Integrada a las Enfermedades Prevalentes de la Infancia (AIEPI)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Estado de hidratación y planes A/B/C, disentería y diarrea persistente."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "signos_de_peligro",
        "name": "Signos generales de peligro",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: diarrea",
        "options": [
          "No puede beber ni tomar el pecho",
          "Vomita todo",
          "Convulsiones",
          "Letárgico o inconsciente",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "eda_deposiciones_24h",
        "name": "Deposiciones líquidas en las últimas 24 horas",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "eda_sangre_en_heces",
        "name": "Sangre en las heces (disentería)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "eda_vomitos",
        "name": "Vómitos",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "eda_hidratacion",
        "name": "Estado de hidratación (OMS)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: diarrea",
        "options": [
          "Sin deshidratación — Plan A",
          "Algún grado de deshidratación — Plan B",
          "Deshidratación grave — Plan C"
        ],
        "multiple": false
      },
      {
        "code": "eda_fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "dias_de_diarrea",
        "name": "Días de diarrea",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: diarrea",
        "description": "14 o más: diarrea persistente."
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: diarrea"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Sales de rehidratación oral",
          "Zinc por 10 a 14 días",
          "Seguir alimentando",
          "Signos para volver"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "PEDIA_CTRL_IRA",
    "name": "Niño con tos o dificultad para respirar (AIEPI)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Atención Integrada a las Enfermedades Prevalentes de la Infancia (AIEPI)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/child-health/integrated-management-of-childhood-illness",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Signos generales de peligro, respiración rápida para la edad y tiraje, con la clasificación AIEPI."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: tos o dificultad respiratoria"
      },
      {
        "code": "signos_de_peligro",
        "name": "Signos generales de peligro",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: tos o dificultad respiratoria",
        "options": [
          "No puede beber ni tomar el pecho",
          "Vomita todo",
          "Convulsiones",
          "Letárgico o inconsciente",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: tos o dificultad respiratoria",
        "description": "Rápida: ≥ 50 de 2 a 11 meses; ≥ 40 de 1 a 4 años."
      },
      {
        "code": "tiraje",
        "name": "Tiraje subcostal",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: tos o dificultad respiratoria"
      },
      {
        "code": "estridor",
        "name": "Estridor en reposo",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: tos o dificultad respiratoria"
      },
      {
        "code": "sibilancias",
        "name": "Sibilancias",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: tos o dificultad respiratoria"
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: tos o dificultad respiratoria"
      },
      {
        "code": "clasificacion_aiepi",
        "name": "Clasificación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: tos o dificultad respiratoria",
        "options": [
          "Neumonía grave o enfermedad muy grave",
          "Neumonía",
          "Tos o resfriado"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Signos para volver de inmediato",
          "Alimentación y líquidos",
          "Antibiótico completo si corresponde"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "PEDIA_CURVAS_CRECIMIENTO_OMS",
    "name": "Curvas de crecimiento (patrones OMS)",
    "version": 2,
    "kind": "SPECIFIC",
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
    "code": "PEDIA_RECIEN_NACIDO",
    "name": "Atención del recién nacido",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Recomendaciones de la OMS sobre la atención materna y neonatal para una experiencia posnatal positiva (2022)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789240045989",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Apgar, antropometría, tamizajes y signos de peligro del recién nacido."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "apgar_1",
        "name": "Apgar al minuto",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "apgar_5",
        "name": "Apgar a los 5 minutos",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "edad_gestacional",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "peso_g",
        "name": "Peso al nacer (g)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "perimetro_cefalico_cm",
        "name": "Perímetro cefálico (cm)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "lactancia_primera_hora",
        "name": "Lactancia en la primera hora",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "tamizajes_rn",
        "name": "Tamizajes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: recién nacido",
        "options": [
          "Metabólico",
          "Auditivo",
          "Cardiopatía (oximetría)",
          "Reflejo rojo"
        ],
        "multiple": true
      },
      {
        "code": "signos_peligro_rn",
        "name": "Signos de peligro",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: recién nacido",
        "options": [
          "No se alimenta bien",
          "Convulsiones",
          "Respiración rápida (≥ 60)",
          "Tiraje",
          "Fiebre o hipotermia",
          "Ictericia en las primeras 24 h",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "vacunas_rn",
        "name": "BCG y hepatitis B aplicadas",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: recién nacido"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "PSICO_CTRL_ANSIEDAD_DEPRESION",
    "name": "Seguimiento psicológico de ansiedad y depresión",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PSICOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Tamizaje SRQ-20 de la OMS, funcionamiento y riesgo según mhGAP; intervención psicológica breve."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de ansiedad o depresión",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): marque las preguntas que respondió «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: ansiedad o depresión",
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
        "description": "8 o más respuestas positivas: probable trastorno mental común. La pregunta 17 positiva exige evaluar riesgo suicida."
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total de respuestas «sí» (0–20)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: ansiedad o depresión"
      },
      {
        "code": "ideacion_suicida",
        "name": "Ideación suicida actual",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: ansiedad o depresión"
      },
      {
        "code": "predominio",
        "name": "Predominio",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: ansiedad o depresión",
        "options": [
          "Depresivo",
          "Ansioso",
          "Mixto"
        ],
        "multiple": false
      },
      {
        "code": "sesion_numero",
        "name": "Sesión número",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: ansiedad o depresión"
      },
      {
        "code": "intervencion",
        "name": "Intervención",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: ansiedad o depresión",
        "options": [
          "Activación conductual",
          "Manejo del estrés",
          "Resolución de problemas",
          "Terapia cognitivo-conductual",
          "Psicoeducación"
        ],
        "multiple": false
      },
      {
        "code": "funcionamiento",
        "name": "Funcionamiento",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: ansiedad o depresión",
        "options": [
          "Conservado",
          "Algo afectado",
          "Muy afectado"
        ],
        "multiple": false
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Mejora del SRQ-20",
          "Sin ideación suicida",
          "Retomó sus actividades",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Higiene del sueño",
          "Respiración y relajación",
          "Red de apoyo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "PSICO_CTRL_VIOLENCIA",
    "name": "Atención a personas en situación de violencia",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PSICOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Respuesta a la violencia de pareja y a la violencia sexual contra las mujeres: directrices clínicas (2013)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548595",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Primera ayuda (escuchar, preguntar, validar, mejorar la seguridad, apoyo) de las directrices clínicas de la OMS."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "violencia_tipo",
        "name": "Tipo de violencia",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: violencia",
        "options": [
          "Física",
          "Psicológica",
          "Sexual",
          "Económica"
        ],
        "multiple": true
      },
      {
        "code": "riesgo_inminente",
        "name": "Riesgo inminente para su vida",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: violencia"
      },
      {
        "code": "plan_de_seguridad",
        "name": "Plan de seguridad acordado",
        "dataType": "text",
        "required": true,
        "section": "Evaluación: violencia",
        "showWhen": {
          "field": "riesgo_inminente",
          "equals": true
        }
      },
      {
        "code": "violencia_sexual_72h",
        "name": "Violencia sexual en las últimas 72 horas",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: violencia"
      },
      {
        "code": "atencion_urgente",
        "name": "Atención urgente",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: violencia",
        "options": [
          "Profilaxis VIH",
          "Anticoncepción de emergencia",
          "Profilaxis de ITS"
        ],
        "multiple": true,
        "showWhen": {
          "field": "violencia_sexual_72h",
          "equals": true
        }
      },
      {
        "code": "orientacion_denuncia",
        "name": "Orientada sobre la denuncia (Ley 348)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: violencia"
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20 (OMS): marque las preguntas que respondió «sí» en el último mes",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: violencia",
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
        "description": "8 o más respuestas positivas: probable trastorno mental común. La pregunta 17 positiva exige evaluar riesgo suicida."
      },
      {
        "code": "srq20_puntaje",
        "name": "SRQ-20 — total de respuestas «sí» (0–20)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: violencia"
      },
      {
        "code": "ideacion_suicida",
        "name": "Ideación suicida actual",
        "dataType": "boolean",
        "required": true,
        "section": "Evaluación: violencia"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "PSICO_EVALUACION_BASE",
    "name": "Psicología Clínica — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "PSIQ_CTRL_ALCOHOL",
    "name": "Consumo de alcohol: AUDIT completo (OMS)",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PSIQUIATRIA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Las 10 preguntas del AUDIT de la OMS con su puntaje, y abstinencia."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Consulta",
        "options": [
          "Primera vez",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "audit_1",
        "name": "1. ¿Con qué frecuencia consume alguna bebida alcohólica?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Una o menos veces al mes (1)",
          "De 2 a 4 veces al mes (2)",
          "De 2 a 3 veces a la semana (3)",
          "4 o más veces a la semana (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_2",
        "name": "2. ¿Cuántas consumiciones toma en un día de consumo normal?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "1 o 2 (0)",
          "3 o 4 (1)",
          "5 o 6 (2)",
          "7 a 9 (3)",
          "10 o más (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_3",
        "name": "3. ¿Con qué frecuencia toma 6 o más bebidas en una sola ocasión?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_4",
        "name": "4. En el último año, ¿con qué frecuencia no pudo parar de beber una vez que empezó?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_5",
        "name": "5. ¿Con qué frecuencia no pudo hacer lo que se esperaba de usted porque había bebido?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_6",
        "name": "6. ¿Con qué frecuencia necesitó beber en ayunas para recuperarse después de beber mucho?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_7",
        "name": "7. ¿Con qué frecuencia tuvo remordimientos o sentimientos de culpa después de beber?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_8",
        "name": "8. ¿Con qué frecuencia no pudo recordar lo que sucedió la noche anterior porque había bebido?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "Nunca (0)",
          "Menos de una vez al mes (1)",
          "Mensualmente (2)",
          "Semanalmente (3)",
          "A diario o casi (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_9",
        "name": "9. ¿Usted u otra persona resultó herida porque usted había bebido?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "No (0)",
          "Sí, pero no en el último año (2)",
          "Sí, en el último año (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_10",
        "name": "10. ¿Algún familiar, amigo o profesional se preocupó por su consumo o le sugirió dejar de beber?",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "options": [
          "No (0)",
          "Sí, pero no en el último año (2)",
          "Sí, en el último año (4)"
        ],
        "multiple": false
      },
      {
        "code": "audit_total",
        "name": "AUDIT — total (0–40)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: consumo de alcohol",
        "description": "8–15: consumo de riesgo · 16–19: perjudicial · ≥ 20: probable dependencia."
      },
      {
        "code": "abstinencia",
        "name": "Signos de abstinencia",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: consumo de alcohol"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "Intervención breve",
          "Límites de consumo",
          "Grupos de apoyo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "PSIQ_CTRL_DEPRESION",
    "name": "Control de depresión",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PSIQUIATRIA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Módulo de depresión de mhGAP: síntomas, funcionamiento, riesgo suicida y respuesta al tratamiento."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de depresión",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "depresion_sintomas",
        "name": "Síntomas en las últimas 2 semanas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: depresión",
        "options": [
          "Ánimo deprimido",
          "Anhedonia",
          "Sueño alterado",
          "Apetito alterado",
          "Fatiga",
          "Culpa o inutilidad",
          "Concentración",
          "Enlentecimiento o agitación",
          "Ideas de muerte"
        ],
        "multiple": true
      },
      {
        "code": "srq20_respuestas_si",
        "name": "SRQ-20: preguntas respondidas «sí»",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: depresión",
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
        "name": "SRQ-20 — total",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: depresión"
      },
      {
        "code": "riesgo_suicida",
        "name": "Riesgo suicida",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: depresión",
        "options": [
          "Sin ideación",
          "Ideación sin plan",
          "Ideación con plan",
          "Intento reciente"
        ],
        "multiple": false
      },
      {
        "code": "plan_de_seguridad",
        "name": "Plan de seguridad y derivación",
        "dataType": "text",
        "required": true,
        "section": "Evaluación: depresión",
        "showWhen": {
          "field": "riesgo_suicida",
          "equals": [
            "Ideación con plan",
            "Intento reciente"
          ]
        }
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Remisión de síntomas",
          "Sin ideación suicida",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "El antidepresivo tarda 2 a 4 semanas",
          "No suspender de golpe",
          "Activación conductual"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "PSIQ_CTRL_PSICOSIS",
    "name": "Control de psicosis",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "PSIQUIATRIA",
    "provenance": {
      "sourceTitle": "Guía de intervención mhGAP para los trastornos mentales, neurológicos y por consumo de sustancias, versión 2.0",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549790",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Módulo de psicosis de mhGAP: síntomas, adherencia al antipsicótico, efectos adversos y riesgo."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de psicosis",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "psicosis_sintomas",
        "name": "Síntomas presentes",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: psicosis",
        "options": [
          "Delirios",
          "Alucinaciones",
          "Discurso desorganizado",
          "Conducta desorganizada",
          "Síntomas negativos",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "efectos_antipsicotico",
        "name": "Efectos del antipsicótico",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: psicosis",
        "options": [
          "Rigidez o temblor",
          "Acatisia",
          "Aumento de peso",
          "Sedación",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: psicosis"
      },
      {
        "code": "glucemia",
        "name": "Glucemia (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: psicosis"
      },
      {
        "code": "riesgo_heteroagresion",
        "name": "Riesgo de violencia",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: psicosis",
        "options": [
          "Bajo",
          "Moderado",
          "Alto"
        ],
        "multiple": false
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Adherencia",
          "Signos de recaída",
          "Apoyo a la familia"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "PSIQ_EVALUACION_BASE",
    "name": "Psiquiatría y salud mental — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "name": "Radiología e Imagenología — informe general de estudio por imágenes (ficha base)",
    "version": 2,
    "kind": "BASE",
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
    "code": "RADIO_INFORME_ECO_OBSTETRICA",
    "name": "Informe de ecografía obstétrica",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "RADIOLOGIA",
    "provenance": {
      "sourceTitle": "Recomendaciones de la OMS sobre atención prenatal para una experiencia positiva del embarazo (2016)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241549912",
      "license": "CC BY-NC-SA 3.0 IGO",
      "retrievedAt": "2026-10-02",
      "note": "Biometría, edad gestacional, líquido, placenta y vitalidad (recomendada antes de las 24 semanas por la OMS)."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "numero_fetos",
        "name": "Número de fetos",
        "dataType": "integer",
        "required": true,
        "section": "Resultado: ecografía obstétrica"
      },
      {
        "code": "actividad_cardiaca",
        "name": "Actividad cardíaca presente",
        "dataType": "boolean",
        "required": true,
        "section": "Resultado: ecografía obstétrica"
      },
      {
        "code": "biometria",
        "name": "Biometría (DBP, CC, CA, LF)",
        "dataType": "string",
        "required": false,
        "section": "Resultado: ecografía obstétrica"
      },
      {
        "code": "edad_gestacional_eco",
        "name": "Edad gestacional por ecografía",
        "dataType": "string",
        "required": false,
        "section": "Resultado: ecografía obstétrica"
      },
      {
        "code": "presentacion",
        "name": "Presentación",
        "dataType": "string",
        "required": false,
        "section": "Resultado: ecografía obstétrica",
        "options": [
          "Cefálica",
          "Podálica",
          "Transversa"
        ],
        "multiple": false
      },
      {
        "code": "placenta",
        "name": "Placenta",
        "dataType": "string",
        "required": false,
        "section": "Resultado: ecografía obstétrica",
        "options": [
          "Normoinserta",
          "Previa",
          "Baja"
        ],
        "multiple": false
      },
      {
        "code": "liquido",
        "name": "Líquido amniótico",
        "dataType": "string",
        "required": false,
        "section": "Resultado: ecografía obstétrica",
        "options": [
          "Normal",
          "Oligoamnios",
          "Polihidramnios"
        ],
        "multiple": false
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "RADIO_INFORME_MAMOGRAFIA",
    "name": "Informe de mamografía",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "RADIOLOGIA",
    "provenance": {
      "sourceTitle": "Breast Imaging Reporting and Data System (BI-RADS)",
      "organization": "American College of Radiology (ACR)",
      "url": "https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Reporting-and-Data-Systems/BI-RADS",
      "license": "Sólo las categorías 0 a 6, que son de uso clínico universal; no se reproduce el atlas",
      "retrievedAt": "2026-10-02",
      "note": "Composición mamaria, hallazgos y categoría BI-RADS (0 a 6) con su conducta."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "tipo_de_mamografia",
        "name": "Tipo",
        "dataType": "string",
        "required": true,
        "section": "Resultado: mamografía",
        "options": [
          "Tamizaje",
          "Diagnóstica",
          "Control"
        ],
        "multiple": false
      },
      {
        "code": "composicion",
        "name": "Composición mamaria",
        "dataType": "string",
        "required": false,
        "section": "Resultado: mamografía",
        "options": [
          "a — grasa",
          "b — densidades fibroglandulares dispersas",
          "c — heterogéneamente densa",
          "d — extremadamente densa"
        ],
        "multiple": false
      },
      {
        "code": "hallazgos_mama",
        "name": "Hallazgos",
        "dataType": "json",
        "required": true,
        "section": "Resultado: mamografía",
        "options": [
          "Nódulo",
          "Calcificaciones",
          "Distorsión de la arquitectura",
          "Asimetría",
          "Adenopatía axilar",
          "Ninguno"
        ],
        "multiple": true
      },
      {
        "code": "birads",
        "name": "Categoría BI-RADS",
        "dataType": "string",
        "required": true,
        "section": "Resultado: mamografía",
        "options": [
          "0 — incompleto",
          "1 — negativo",
          "2 — benigno",
          "3 — probablemente benigno",
          "4 — sospechoso",
          "5 — altamente sugestivo de malignidad",
          "6 — malignidad confirmada"
        ],
        "multiple": false
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "RADIO_INFORME_RX_TORAX",
    "name": "Informe de radiografía de tórax",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "RADIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Lectura sistemática: técnica, partes blandas, huesos, mediastino, corazón, pulmones y pleura."
    },
    "fields": [
      {
        "code": "indicacion_del_estudio",
        "name": "Indicación del estudio",
        "dataType": "text",
        "required": true,
        "section": "Solicitud"
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "string",
        "required": false,
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
        "code": "proyeccion",
        "name": "Proyección",
        "dataType": "string",
        "required": true,
        "section": "Resultado: radiografía de tórax",
        "options": [
          "PA",
          "AP",
          "Lateral"
        ],
        "multiple": false
      },
      {
        "code": "tecnica_adecuada",
        "name": "Técnica",
        "dataType": "string",
        "required": false,
        "section": "Resultado: radiografía de tórax",
        "options": [
          "Adecuada",
          "Rotada",
          "Subpenetrada",
          "Inspiración insuficiente"
        ],
        "multiple": false
      },
      {
        "code": "hallazgos_torax",
        "name": "Hallazgos",
        "dataType": "json",
        "required": true,
        "section": "Resultado: radiografía de tórax",
        "options": [
          "Consolidación",
          "Infiltrado intersticial",
          "Derrame pleural",
          "Neumotórax",
          "Cardiomegalia",
          "Nódulo o masa",
          "Cavitación",
          "Sin hallazgos"
        ],
        "multiple": true
      },
      {
        "code": "indice_cardiotoracico",
        "name": "Índice cardiotorácico",
        "dataType": "decimal",
        "required": false,
        "section": "Resultado: radiografía de tórax"
      },
      {
        "code": "conclusion",
        "name": "Conclusión",
        "dataType": "text",
        "required": true,
        "section": "Conclusión"
      },
      {
        "code": "recomendacion",
        "name": "Recomendación",
        "dataType": "text",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico",
        "name": "Hay un hallazgo crítico",
        "dataType": "boolean",
        "required": false,
        "section": "Conclusión"
      },
      {
        "code": "hallazgo_critico_comunicado",
        "name": "¿A quién se comunicó y a qué hora?",
        "dataType": "string",
        "required": true,
        "section": "Conclusión",
        "showWhen": {
          "field": "hallazgo_critico",
          "equals": true
        }
      }
    ]
  },
  {
    "code": "REUMA_CTRL_AR",
    "name": "Control de artritis reumatoide",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Recomendaciones EULAR",
      "organization": "European Alliance of Associations for Rheumatology (EULAR)",
      "url": "https://www.eular.org/recommendations",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Actividad por DAS28 (índice publicado) con recuento de 28 articulaciones; seguimiento de fármacos modificadores."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de artritis reumatoide",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "articulaciones_dolorosas_28",
        "name": "Articulaciones dolorosas (de 28)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "articulaciones_tumefactas_28",
        "name": "Articulaciones tumefactas (de 28)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "vsg",
        "name": "VSG (mm/h)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "pcr",
        "name": "PCR (mg/L)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "evaluacion_global_paciente",
        "name": "Evaluación global del paciente (0 a 100)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "das28",
        "name": "DAS28",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "actividad_das28",
        "name": "Actividad",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: artritis reumatoide",
        "options": [
          "Remisión (< 2,6)",
          "Baja (2,6–3,2)",
          "Moderada (3,2–5,1)",
          "Alta (> 5,1)"
        ],
        "multiple": false
      },
      {
        "code": "rigidez_matinal_minutos",
        "name": "Rigidez matinal (minutos)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: artritis reumatoide"
      },
      {
        "code": "ar_controles_farmacos",
        "name": "Controles de seguridad al día",
        "dataType": "json",
        "required": false,
        "section": "Complicaciones y daño de órgano",
        "options": [
          "Hemograma",
          "Transaminasas",
          "Creatinina",
          "Tamizaje de tuberculosis antes de biológico"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Remisión o baja actividad",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Adherencia al metotrexato y ácido fólico",
          "Ejercicio",
          "Protección articular"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "REUMA_CTRL_ARTROSIS",
    "name": "Control de artrosis",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Articulaciones afectadas, dolor y función."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de artrosis",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "artrosis_sitio",
        "name": "Articulaciones",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: artrosis",
        "options": [
          "Rodilla",
          "Cadera",
          "Manos",
          "Columna"
        ],
        "multiple": true
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: artrosis"
      },
      {
        "code": "limitacion",
        "name": "Limitación funcional",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: artrosis",
        "options": [
          "Ninguna",
          "Leve",
          "Moderada",
          "Grave"
        ],
        "multiple": false
      },
      {
        "code": "imc",
        "name": "IMC (kg/m²)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: artrosis"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Dolor ≤ 3",
          "Hace ejercicio terapéutico",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Ejercicio de fortalecimiento",
          "Bajar de peso",
          "Uso de bastón"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "REUMA_CTRL_GOTA",
    "name": "Control de gota",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Recomendaciones EULAR",
      "organization": "European Alliance of Associations for Rheumatology (EULAR)",
      "url": "https://www.eular.org/recommendations",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Crisis, tofos y meta de uricemia < 6 mg/dL."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de gota",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "crisis_gota_anio",
        "name": "Crisis en el último año",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: gota"
      },
      {
        "code": "acido_urico",
        "name": "Ácido úrico (mg/dL)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: gota"
      },
      {
        "code": "tofos",
        "name": "Tofos",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: gota"
      },
      {
        "code": "gota_comorbilidades",
        "name": "Comorbilidades",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: gota",
        "options": [
          "Hipertensión",
          "Enfermedad renal",
          "Diabetes",
          "Obesidad",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Ácido úrico < 6 mg/dL",
          "Sin crisis",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Reducir alcohol y bebidas azucaradas",
          "No suspender el alopurinol en una crisis"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "REUMA_CTRL_LES",
    "name": "Control de lupus eritematoso sistémico",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Recomendaciones EULAR",
      "organization": "European Alliance of Associations for Rheumatology (EULAR)",
      "url": "https://www.eular.org/recommendations",
      "license": "Guía de acceso público; se usan sus categorías clínicas, no su texto",
      "retrievedAt": "2026-10-02",
      "note": "Órganos comprometidos, actividad y vigilancia renal."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de lupus eritematoso sistémico",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "les_actividad",
        "name": "Manifestaciones activas",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: lupus eritematoso sistémico",
        "options": [
          "Artritis",
          "Lesiones cutáneas",
          "Úlceras orales",
          "Serositis",
          "Nefritis",
          "Citopenias",
          "Neurológico",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "proteinuria_24h",
        "name": "Proteinuria de 24 h (g)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico"
      },
      {
        "code": "creatinina",
        "name": "Creatinina (mg/dL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico"
      },
      {
        "code": "complemento",
        "name": "Complemento C3/C4",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico"
      },
      {
        "code": "anti_dna",
        "name": "Anti-ADN",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico"
      },
      {
        "code": "hidroxicloroquina",
        "name": "Recibe hidroxicloroquina",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico"
      },
      {
        "code": "control_oftalmologico",
        "name": "Control oftalmológico anual",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: lupus eritematoso sistémico",
        "options": [
          "Al día",
          "Pendiente"
        ],
        "multiple": false,
        "showWhen": {
          "field": "hidroxicloroquina",
          "equals": true
        }
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Sin actividad",
          "Corticoide ≤ 5 mg/día de prednisona",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Fotoprotección",
          "Anticoncepción y planificación del embarazo"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "REUMA_EVALUACION_BASE",
    "name": "Reumatología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "kind": "GENERAL",
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
    "kind": "GENERAL",
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
    "kind": "GENERAL",
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
    "kind": "GENERAL",
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
    "code": "TRAUMA_CTRL_FRACTURA",
    "name": "Control de fractura",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "TRAUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Inmovilización, estado neurovascular, consolidación radiológica y rehabilitación."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "fractura_hueso",
        "name": "Hueso y segmento",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: fractura"
      },
      {
        "code": "fecha_fractura",
        "name": "Fecha de la fractura",
        "dataType": "date",
        "required": false,
        "section": "Evaluación: fractura"
      },
      {
        "code": "tratamiento_fractura",
        "name": "Tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: fractura",
        "options": [
          "Yeso o férula",
          "Cirugía con osteosíntesis",
          "Funcional"
        ],
        "multiple": false
      },
      {
        "code": "neurovascular",
        "name": "Estado neurovascular distal",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: fractura",
        "options": [
          "Conservado",
          "Alterado"
        ],
        "multiple": false
      },
      {
        "code": "compartimental",
        "name": "Dolor desproporcionado (descartar síndrome compartimental)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: fractura"
      },
      {
        "code": "consolidacion",
        "name": "Consolidación radiológica",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: fractura",
        "options": [
          "Sin callo",
          "Callo en formación",
          "Consolidada",
          "Retardo"
        ],
        "multiple": false
      },
      {
        "code": "carga",
        "name": "Carga permitida",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: fractura",
        "options": [
          "Sin carga",
          "Parcial",
          "Total"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "TRAUMA_CTRL_RODILLA",
    "name": "Rodilla dolorosa: evaluación",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "TRAUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Mecanismo, derrame, maniobras meniscales y ligamentarias y reglas de Ottawa."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "lado",
        "name": "Lado",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: rodilla dolorosa",
        "options": [
          "Derecha",
          "Izquierda"
        ],
        "multiple": false
      },
      {
        "code": "mecanismo",
        "name": "Mecanismo",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: rodilla dolorosa",
        "options": [
          "Torsión",
          "Golpe directo",
          "Sin traumatismo"
        ],
        "multiple": false
      },
      {
        "code": "derrame",
        "name": "Derrame",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: rodilla dolorosa"
      },
      {
        "code": "maniobras",
        "name": "Maniobras positivas",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: rodilla dolorosa",
        "options": [
          "Lachman",
          "Cajón anterior",
          "McMurray",
          "Bostezo varo",
          "Bostezo valgo",
          "Ninguna"
        ],
        "multiple": true
      },
      {
        "code": "ottawa",
        "name": "Reglas de Ottawa positivas (pedir radiografía)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: rodilla dolorosa"
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "TRAUMA_EVALUACION_BASE",
    "name": "Traumatología y ortopedia — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
    "specialty": "TRAUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen del aparato locomotor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen locomotor del formato oficial. Las escalas funcionales de sociedades científicas quedaron fuera por licencia — ver README. v2 (2026-10-02): reorganizada en secciones (motivo, antecedentes, examen, diagnóstico presuntivo, plan); las clasificaciones con categorías finitas pasan a lista cerrada; cada sí/no que tiene detalle pregunta «¿cuál?»; el diagnóstico presuntivo abre las observaciones que ese cuadro exige registrar. Instrumentos de uso libre incorporados: clasificación de Gustilo, escala de fuerza MRC."
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
    "code": "UCI_CTRL_SEPSIS",
    "name": "Sepsis y shock séptico en cuidados intensivos",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_INTENSIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Disfunción orgánica por SOFA (publicado, de uso libre), lactato y metas de la primera hora."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "foco_sepsis",
        "name": "Foco",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: sepsis"
      },
      {
        "code": "sofa",
        "name": "Puntaje SOFA",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: sepsis"
      },
      {
        "code": "lactato",
        "name": "Lactato (mmol/L)",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: sepsis"
      },
      {
        "code": "presion_arterial_media",
        "name": "Presión arterial media (mmHg)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: sepsis"
      },
      {
        "code": "primera_hora",
        "name": "Medidas de la primera hora",
        "dataType": "json",
        "required": false,
        "section": "Evaluación: sepsis",
        "options": [
          "Hemocultivos antes del antibiótico",
          "Antibiótico en la primera hora",
          "Cristaloides 30 mL/kg",
          "Vasopresor si PAM < 65"
        ],
        "multiple": true
      },
      {
        "code": "diuresis",
        "name": "Diuresis (mL/kg/h)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: sepsis"
      },
      {
        "code": "metas_cumplidas",
        "name": "Metas de control que cumple hoy",
        "dataType": "json",
        "required": false,
        "section": "Conclusión y plan",
        "options": [
          "PAM ≥ 65 mmHg",
          "Lactato en descenso",
          "Diuresis ≥ 0,5 mL/kg/h",
          "Ninguna todavía"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "UCI_CTRL_VENTILACION",
    "name": "Ventilación mecánica y destete",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "MEDICINA_INTENSIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Parámetros, oxigenación y prueba de respiración espontánea."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "modo_ventilatorio",
        "name": "Modo",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: ventilación mecánica",
        "options": [
          "Volumen control",
          "Presión control",
          "Presión soporte",
          "CPAP"
        ],
        "multiple": false
      },
      {
        "code": "fio2",
        "name": "FiO₂ (%)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: ventilación mecánica"
      },
      {
        "code": "peep",
        "name": "PEEP (cmH₂O)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: ventilación mecánica"
      },
      {
        "code": "pafi",
        "name": "PaO₂/FiO₂",
        "dataType": "decimal",
        "required": true,
        "section": "Evaluación: ventilación mecánica"
      },
      {
        "code": "rass",
        "name": "RASS",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: ventilación mecánica",
        "options": [
          "+2",
          "+1",
          "0",
          "−1",
          "−2",
          "−3",
          "−4",
          "−5"
        ],
        "multiple": false
      },
      {
        "code": "prueba_respiracion_espontanea",
        "name": "Prueba de respiración espontánea",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: ventilación mecánica",
        "options": [
          "Superada",
          "Fallida",
          "No corresponde todavía"
        ],
        "multiple": false
      },
      {
        "code": "glasgow_ocular",
        "name": "Glasgow — apertura ocular",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: ventilación mecánica",
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
        "section": "Evaluación: ventilación mecánica",
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
        "section": "Evaluación: ventilación mecánica",
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
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "URO_CTRL_HPB",
    "name": "Control de hiperplasia prostática",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "UROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Síntomas del tracto urinario inferior, residuo, PSA y tacto rectal."
    },
    "fields": [
      {
        "code": "tipo_de_control",
        "name": "Tipo de consulta",
        "dataType": "string",
        "required": true,
        "section": "Seguimiento",
        "options": [
          "Primera evaluación de la condición",
          "Control programado",
          "Descompensación o consulta no programada",
          "Control posterior a internación"
        ],
        "multiple": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico de hiperplasia prostática",
        "dataType": "date",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "tratamiento_actual",
        "name": "Tratamiento actual (fármaco, dosis y frecuencia)",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "adherencia",
        "name": "Adherencia al tratamiento",
        "dataType": "string",
        "required": false,
        "section": "Seguimiento",
        "options": [
          "Toma el tratamiento como está indicado",
          "Olvida dosis algunas veces",
          "Abandonó el tratamiento",
          "Todavía sin tratamiento"
        ],
        "multiple": false
      },
      {
        "code": "efectos_adversos",
        "name": "¿Tuvo efectos adversos del tratamiento?",
        "dataType": "boolean",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "efectos_adversos_cuales",
        "name": "¿Cuáles y con qué fármaco?",
        "dataType": "text",
        "required": true,
        "section": "Seguimiento",
        "showWhen": {
          "field": "efectos_adversos",
          "equals": true
        }
      },
      {
        "code": "evolucion_desde_ultimo_control",
        "name": "Evolución desde el último control",
        "dataType": "text",
        "required": false,
        "section": "Seguimiento"
      },
      {
        "code": "stui",
        "name": "Síntomas urinarios",
        "dataType": "json",
        "required": true,
        "section": "Evaluación: hiperplasia prostática",
        "options": [
          "Chorro débil",
          "Esfuerzo",
          "Goteo terminal",
          "Vaciado incompleto",
          "Polaquiuria",
          "Urgencia"
        ],
        "multiple": true
      },
      {
        "code": "nicturia",
        "name": "Nicturia (veces por noche)",
        "dataType": "integer",
        "required": false,
        "section": "Evaluación: hiperplasia prostática"
      },
      {
        "code": "molestia_global",
        "name": "Si tuviera que vivir así el resto de su vida, se sentiría",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hiperplasia prostática",
        "options": [
          "Bien",
          "Más o menos",
          "Mal"
        ],
        "multiple": false
      },
      {
        "code": "psa",
        "name": "PSA total (ng/mL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hiperplasia prostática"
      },
      {
        "code": "residuo",
        "name": "Residuo posmiccional (mL)",
        "dataType": "decimal",
        "required": false,
        "section": "Evaluación: hiperplasia prostática"
      },
      {
        "code": "volumen_prostatico",
        "name": "Volumen prostático (mL)",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: hiperplasia prostática"
      },
      {
        "code": "retencion",
        "name": "Retención urinaria desde el último control",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: hiperplasia prostática"
      },
      {
        "code": "educacion_brindada",
        "name": "Educación brindada en esta consulta",
        "dataType": "json",
        "required": false,
        "section": "Metas y plan",
        "options": [
          "Reducir líquidos de noche",
          "Evitar descongestionantes"
        ],
        "multiple": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Metas y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Metas y plan"
      },
      {
        "code": "proximo_control",
        "name": "Próximo control",
        "dataType": "date",
        "required": false,
        "section": "Metas y plan"
      }
    ]
  },
  {
    "code": "URO_CTRL_LITIASIS",
    "name": "Cólico renal y litiasis urinaria",
    "version": 1,
    "kind": "SPECIFIC",
    "specialty": "UROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "retrievedAt": "2026-10-02",
      "note": "Dolor, signos de obstrucción infectada y tamaño del lito para la decisión."
    },
    "fields": [
      {
        "code": "tipo_de_evaluacion",
        "name": "Tipo de evaluación",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial",
        "options": [
          "Evaluación inicial",
          "Reevaluación"
        ],
        "multiple": false
      },
      {
        "code": "inicio_de_sintomas",
        "name": "Inicio de los síntomas (fecha u hora)",
        "dataType": "string",
        "required": true,
        "section": "Evaluación inicial"
      },
      {
        "code": "tratamiento_previo",
        "name": "Tratamiento recibido antes de esta consulta",
        "dataType": "text",
        "required": false,
        "section": "Evaluación inicial"
      },
      {
        "code": "dolor_intensidad",
        "name": "Dolor (0 a 10)",
        "dataType": "integer",
        "required": true,
        "section": "Evaluación: litiasis urinaria"
      },
      {
        "code": "fiebre",
        "name": "Fiebre (urgencia: obstrucción infectada)",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: litiasis urinaria"
      },
      {
        "code": "lito_tamano",
        "name": "Tamaño y ubicación del lito",
        "dataType": "string",
        "required": true,
        "section": "Evaluación: litiasis urinaria"
      },
      {
        "code": "hidronefrosis",
        "name": "Hidronefrosis",
        "dataType": "boolean",
        "required": false,
        "section": "Evaluación: litiasis urinaria"
      },
      {
        "code": "conducta_lito",
        "name": "Conducta",
        "dataType": "string",
        "required": false,
        "section": "Evaluación: litiasis urinaria",
        "options": [
          "Expulsión espontánea",
          "Litotricia",
          "Ureteroscopía",
          "Derivación urgente"
        ],
        "multiple": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico (con código CIE-10 si se conoce)",
        "dataType": "text",
        "required": true,
        "section": "Conclusión y plan"
      },
      {
        "code": "plan",
        "name": "Plan: tratamiento, estudios, interconsultas y destino",
        "dataType": "text",
        "required": false,
        "section": "Conclusión y plan"
      }
    ]
  },
  {
    "code": "URO_EVALUACION_BASE",
    "name": "Urología — consulta inicial (ficha base)",
    "version": 2,
    "kind": "BASE",
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
        "description": "Si el cuadro ya está diagnosticado, el seguimiento se hace con su ficha específica de la especialidad."
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
