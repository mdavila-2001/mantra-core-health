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

/** Un campo de la ficha. `options` sólo viene en los de lista cerrada. */
export interface CampoDeFicha {
  readonly code: string;
  readonly name: string;
  readonly dataType: string;
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly multiple?: boolean;
}

/** Una ficha clínica estándar. */
export interface FichaEstandar {
  readonly code: string;
  readonly name: string;
  /** Código de `VS_MEDICAL_SPECIALTY`, o `TRANSVERSAL`. */
  readonly specialty: string;
  readonly provenance?: ProcedenciaDeFicha;
  readonly fields: readonly CampoDeFicha[];
}

export const FICHAS_ESTANDAR: readonly FichaEstandar[] = [
  {
    "code": "ANEST_VALORACION_PREANESTESICA",
    "name": "Valoración preanestésica",
    "specialty": "ANESTESIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico preoperatorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, antecedentes patológicos, alergias, medicación habitual, examen físico dirigido, diagnóstico y conducta. Son agregados propios de la especialidad el procedimiento previsto, el ayuno en horas, la evaluación de la vía aérea (Mallampati, apertura bucal, movilidad cervical), las piezas dentarias en riesgo, las experiencias anestésicas previas y sus complicaciones, la clasificación ASA registrada como texto libre y el plan anestésico propuesto."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "procedimiento_previsto",
        "name": "Procedimiento previsto",
        "dataType": "string",
        "required": true
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos",
        "dataType": "text",
        "required": true
      },
      {
        "code": "alergias",
        "name": "Alergias",
        "dataType": "text",
        "required": true
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habitos_toxicos",
        "name": "Hábitos tóxicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "experiencias_anestesicas_previas",
        "name": "Experiencias anestésicas previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "complicaciones_anestesicas_previas",
        "name": "Complicaciones anestésicas previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ayuno_en_horas",
        "name": "Ayuno en horas",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "via_aerea_mallampati",
        "name": "Vía aérea — Mallampati",
        "dataType": "string",
        "required": false
      },
      {
        "code": "apertura_bucal",
        "name": "Apertura bucal",
        "dataType": "string",
        "required": false
      },
      {
        "code": "movilidad_cervical",
        "name": "Movilidad cervical",
        "dataType": "string",
        "required": false
      },
      {
        "code": "piezas_dentarias_en_riesgo",
        "name": "Piezas dentarias en riesgo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_cardiorrespiratorio",
        "name": "Examen cardiorrespiratorio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "laboratorio_relevante",
        "name": "Laboratorio relevante",
        "dataType": "text",
        "required": false
      },
      {
        "code": "clasificacion_asa",
        "name": "Clasificación ASA",
        "dataType": "string",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan anestésico propuesto",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "BIOQ_INFORME_BASE",
    "name": "Informe de laboratorio bioquímico",
    "specialty": "BIOQUIMICA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro e informe de exámenes auxiliares de laboratorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale el molde común del documento clínico: motivo o indicación del estudio, resultado de lo observado, conclusión y conducta o recomendación. Son agregados propios de la especialidad los ítems de la fase preanalítica (tipo de muestra, condiciones de la toma, ayuno, fecha y hora de toma, medicación en curso) y la distinción entre determinaciones solicitadas, resultados en prosa, valores fuera del rango de referencia y observaciones preanalíticas."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo del estudio o indicación clínica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_presuntivo_solicitante",
        "name": "Diagnóstico presuntivo del solicitante",
        "dataType": "text",
        "required": false
      },
      {
        "code": "determinaciones_solicitadas",
        "name": "Determinaciones solicitadas",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tipo_de_muestra",
        "name": "Tipo de muestra",
        "dataType": "string",
        "required": true
      },
      {
        "code": "condiciones_de_la_toma",
        "name": "Condiciones de la toma",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ayuno",
        "name": "Paciente en ayuno",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "horas_de_ayuno",
        "name": "Horas de ayuno referidas",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "fecha_de_toma",
        "name": "Fecha de toma de la muestra",
        "dataType": "date",
        "required": false
      },
      {
        "code": "hora_de_toma",
        "name": "Hora de toma de la muestra",
        "dataType": "string",
        "required": false
      },
      {
        "code": "medicacion_en_curso",
        "name": "Medicación en curso referida por el paciente",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_de_la_muestra",
        "name": "Estado de la muestra al recibirla",
        "dataType": "text",
        "required": false
      },
      {
        "code": "metodo_analitico",
        "name": "Método analítico utilizado",
        "dataType": "text",
        "required": false
      },
      {
        "code": "resultados",
        "name": "Resultados",
        "dataType": "text",
        "required": true
      },
      {
        "code": "valores_fuera_de_rango",
        "name": "Valores fuera del rango de referencia",
        "dataType": "text",
        "required": false
      },
      {
        "code": "observaciones_preanaliticas",
        "name": "Observaciones preanalíticas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "comparacion_con_estudios_previos",
        "name": "Comparación con estudios previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Conclusión o interpretación del informe",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Recomendaciones y estudios complementarios sugeridos",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "CARDIO_FICHA_BASE",
    "name": "Ficha cardiológica — versión general base",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, evaluación cardiovascular",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen cardiovascular del formato oficial. No incluye ninguna escala de sociedad científica."
    },
    "fields": [
      {
        "code": "dolor_toracico",
        "name": "Dolor torácico",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Características del dolor torácico",
        "dataType": "text",
        "required": false
      },
      {
        "code": "disnea",
        "name": "Disnea",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "clase_funcional_nyha",
        "name": "Clase funcional (I–IV)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "palpitaciones",
        "name": "Palpitaciones",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "sincope",
        "name": "Síncope o presíncope",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "edema_de_miembros_inferiores",
        "name": "Edema de miembros inferiores",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hipertension_arterial",
        "name": "Antecedente de hipertensión arterial",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "diabetes",
        "name": "Antecedente de diabetes",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "dislipidemia",
        "name": "Antecedente de dislipidemia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "tabaquismo",
        "name": "Tabaquismo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "antecedente_familiar_coronario",
        "name": "Antecedente familiar de enfermedad coronaria precoz",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "ruidos_cardiacos",
        "name": "Ruidos cardíacos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "soplos",
        "name": "Soplos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "pulsos_perifericos",
        "name": "Pulsos periféricos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ecg_hallazgos",
        "name": "Electrocardiograma — hallazgos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "CARDIO_RIESGO_CV_OMS",
    "name": "Evaluación del riesgo cardiovascular (OMS/OPS)",
    "specialty": "CARDIOLOGIA",
    "provenance": {
      "sourceTitle": "Prevención de las enfermedades cardiovasculares: directrices para la evaluación y el manejo del riesgo cardiovascular",
      "organization": "Organización Panamericana de la Salud / Organización Mundial de la Salud (OPS/OMS)",
      "url": "https://www.paho.org/sites/default/files/2023-10/directrices-evaluacion-manejo-riesgo-cv-oms.pdf",
      "license": "CC BY-NC-SA 3.0 IGO (publicación OPS/OMS)",
      "sourceVersion": "Tablas OMS 2019 · HEARTS en las Américas",
      "retrievedAt": "2026-08-14",
      "note": "Captura las variables de entrada de las tablas de predicción. El cálculo del riesgo lo hace la calculadora OPS: https://www.paho.org/en/paho-cardiovascular-risk-calculator"
    },
    "fields": [
      {
        "code": "edad",
        "name": "Edad (años)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "sexo",
        "name": "Sexo",
        "dataType": "string",
        "required": true
      },
      {
        "code": "fumador_actual",
        "name": "Fumador actual",
        "dataType": "boolean",
        "required": true
      },
      {
        "code": "diabetes",
        "name": "Diabetes",
        "dataType": "boolean",
        "required": true
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "colesterol_total",
        "name": "Colesterol total (mmol/L)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "indice_masa_corporal",
        "name": "Índice de masa corporal (kg/m²)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "riesgo_a_10_anios",
        "name": "Riesgo cardiovascular a 10 años (%)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "categoria_de_riesgo",
        "name": "Categoría de riesgo",
        "dataType": "string",
        "required": false
      },
      {
        "code": "recomendaciones",
        "name": "Recomendaciones",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "CIRGEN_EVALUACION_BASE",
    "name": "Evaluación de cirugía general",
    "specialty": "CIRUGIA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos del abdomen",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico dirigido, diagnóstico y conducta. Son agregados propios de la especialidad los ítems quirúrgicos: características del dolor abdominal, tránsito intestinal, hernias, cirugías previas, riesgo quirúrgico descrito en prosa e indicación quirúrgica propuesta."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "dolor_abdominal",
        "name": "Dolor abdominal",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Características del dolor (localización, irradiación, atenuantes)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "nauseas_o_vomitos",
        "name": "Náuseas o vómitos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "transito_intestinal",
        "name": "Tránsito intestinal",
        "dataType": "string",
        "required": false
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "cirugias_previas",
        "name": "Cirugías previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alergias",
        "name": "Alergias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_del_abdomen",
        "name": "Examen del abdomen (inspección, palpación, percusión, auscultación)",
        "dataType": "text",
        "required": true
      },
      {
        "code": "hernias",
        "name": "Hernias de la pared abdominal (ubicación y hallazgos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examenes_complementarios",
        "name": "Exámenes complementarios disponibles",
        "dataType": "text",
        "required": false
      },
      {
        "code": "riesgo_quirurgico",
        "name": "Riesgo quirúrgico descrito",
        "dataType": "text",
        "required": false
      },
      {
        "code": "indicacion_quirurgica_propuesta",
        "name": "Indicación quirúrgica propuesta",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "DERMA_EXAMEN_BASE",
    "name": "Examen dermatológico — versión general base",
    "specialty": "DERMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen de piel y faneras",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la descripción semiológica de la lesión elemental, su distribución y su evolución."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "prurito",
        "name": "Prurito",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "dolor_local",
        "name": "Dolor local",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "lesion_elemental",
        "name": "Lesión elemental predominante",
        "dataType": "string",
        "required": true
      },
      {
        "code": "descripcion_de_la_lesion",
        "name": "Descripción de la lesión",
        "dataType": "text",
        "required": true
      },
      {
        "code": "localizacion",
        "name": "Localización",
        "dataType": "text",
        "required": true
      },
      {
        "code": "distribucion",
        "name": "Distribución",
        "dataType": "string",
        "required": false
      },
      {
        "code": "numero_de_lesiones",
        "name": "Número de lesiones",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "tamano_mayor_mm",
        "name": "Tamaño de la lesión mayor (mm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "compromiso_de_mucosas",
        "name": "Compromiso de mucosas",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "compromiso_de_faneras",
        "name": "Compromiso de uñas o cabello",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "factores_desencadenantes",
        "name": "Factores desencadenantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estudios_solicitados",
        "name": "Estudios solicitados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "EMERG_ATENCION_BASE",
    "name": "Atención en emergencia",
    "specialty": "MEDICINA_EMERGENCIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro de la atención de urgencias y emergencias",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, tiempo de evolución, antecedentes, alergias, medicación, signos vitales, diagnóstico y conducta. Son agregados propios de la especialidad la hora de llegada, la forma de llegada, la evaluación inicial y el nivel de prioridad asignado, que se registra como texto libre tal como lo escriba el profesional."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "hora_de_llegada",
        "name": "Hora de llegada",
        "dataType": "string",
        "required": true
      },
      {
        "code": "forma_de_llegada",
        "name": "Forma de llegada",
        "dataType": "string",
        "required": false
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false
      },
      {
        "code": "nivel_de_prioridad_asignado",
        "name": "Nivel de prioridad asignado",
        "dataType": "string",
        "required": false
      },
      {
        "code": "evaluacion_inicial",
        "name": "Evaluación inicial",
        "dataType": "text",
        "required": true
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia",
        "dataType": "string",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial",
        "dataType": "string",
        "required": false
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "dolor_presente",
        "name": "Dolor presente",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alergias",
        "name": "Alergias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "ENDO_EVALUACION_BASE",
    "name": "Evaluación endocrinológica",
    "specialty": "ENDOCRINOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico con registro antropométrico",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, examen físico con peso y talla, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis dirigida de síntomas tiroideos y de alteración de la glucemia (poliuria, polidipsia, polifagia), el registro del cambio de peso y del perímetro abdominal, y el examen de tiroides, piel y anexos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_metabolicos_familiares",
        "name": "Antecedentes familiares metabólicos (diabetes, tiroides, obesidad)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales y medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sintomas_tiroideos",
        "name": "Síntomas tiroideos (intolerancia al frío o calor, temblor, palpitaciones)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "poliuria",
        "name": "Poliuria",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "polidipsia",
        "name": "Polidipsia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "polifagia",
        "name": "Polifagia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "cambio_de_peso",
        "name": "Cambio de peso referido (kg y tiempo)",
        "dataType": "string",
        "required": false
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "talla",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "perimetro_abdominal",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": false
      },
      {
        "code": "examen_de_tiroides",
        "name": "Examen de tiroides (tamaño, consistencia, nódulos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "piel_y_anexos",
        "name": "Piel y anexos (sequedad, acantosis, distribución del vello)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
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
    "code": "ENFER_VALORACION_BASE",
    "name": "Valoración de enfermería",
    "specialty": "ENFERMERIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, registro de funciones vitales y notas de enfermería",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se toman la estructura común (motivo de la valoración, antecedentes, examen, diagnóstico y conducta) y el registro de funciones vitales de la nota de enfermería. Son agregados propios de la especialidad el dolor referido en escala de 0 a 10, el estado de la piel, la presencia de accesos vasculares, la descripción en prosa del riesgo de caídas, el grado de autonomía, las necesidades identificadas y las intervenciones realizadas."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de la valoración",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alergias_referidas",
        "name": "Alergias referidas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": true
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "temperatura_c",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "dolor_intensidad_referida",
        "name": "Intensidad del dolor referida (0 a 10)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_de_la_piel",
        "name": "Estado de la piel",
        "dataType": "text",
        "required": false
      },
      {
        "code": "accesos_vasculares",
        "name": "Accesos vasculares",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "riesgo_de_caidas",
        "name": "Riesgo de caídas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "autonomia",
        "name": "Autonomía para las actividades básicas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "necesidades_identificadas",
        "name": "Necesidades identificadas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico de enfermería",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Intervenciones de enfermería",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "FISIO_EVALUACION_BASE",
    "name": "Evaluación kinesiológica",
    "specialty": "FISIOTERAPIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico regional y plan de trabajo",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común: motivo de consulta, tiempo de evolución, antecedentes, examen físico dirigido a la región afectada, diagnóstico y conducta. Son agregados propios de la especialidad la intensidad de dolor referida por el paciente en escala de 0 a 10, la zona afectada, la descripción en prosa del rango de movimiento, la fuerza muscular, la marcha, la limitación funcional y los objetivos de rehabilitación."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "zona_afectada",
        "name": "Zona afectada",
        "dataType": "string",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "mecanismo_de_lesion",
        "name": "Mecanismo de lesión referido",
        "dataType": "text",
        "required": false
      },
      {
        "code": "dolor_intensidad_referida",
        "name": "Intensidad del dolor referida (0 a 10)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Características del dolor",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "inspeccion_y_palpacion",
        "name": "Inspección y palpación",
        "dataType": "text",
        "required": false
      },
      {
        "code": "rango_de_movimiento",
        "name": "Rango de movimiento",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular",
        "dataType": "text",
        "required": false
      },
      {
        "code": "marcha",
        "name": "Marcha",
        "dataType": "text",
        "required": false
      },
      {
        "code": "postura_y_equilibrio",
        "name": "Postura y equilibrio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "limitacion_funcional",
        "name": "Limitación funcional",
        "dataType": "text",
        "required": false
      },
      {
        "code": "objetivos_de_rehabilitacion",
        "name": "Objetivos de rehabilitación",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico kinesiológico",
        "dataType": "text",
        "required": true
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
    "code": "GASTRO_EVALUACION_BASE",
    "name": "Evaluación gastroenterológica",
    "specialty": "GASTROENTEROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, funciones biológicas y examen del abdomen",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta y el apartado de funciones biológicas y examen del abdomen: motivo, tiempo de evolución, antecedentes, examen, diagnóstico y conducta. Son agregados propios de la especialidad el desglose de las características del dolor abdominal, el hábito intestinal, los signos de hemorragia digestiva y el examen del abdomen separado en inspección, auscultación, palpación y tacto rectal."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_digestivos",
        "name": "Antecedentes digestivos personales y quirúrgicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual (antiinflamatorios, antiácidos, otros)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "dolor_abdominal",
        "name": "Dolor abdominal (presencia)",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "caracteristicas_del_dolor",
        "name": "Características del dolor (localización, tipo, irradiación, relación con las comidas)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habito_intestinal",
        "name": "Hábito intestinal (frecuencia y consistencia de las deposiciones)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "nauseas_o_vomitos",
        "name": "Náuseas o vómitos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "pirosis_o_reflujo",
        "name": "Pirosis o reflujo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hemorragia_digestiva",
        "name": "Signos de hemorragia digestiva (hematemesis, melena, rectorragia)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ictericia",
        "name": "Ictericia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "inspeccion_del_abdomen",
        "name": "Inspección del abdomen",
        "dataType": "text",
        "required": false
      },
      {
        "code": "auscultacion_del_abdomen",
        "name": "Auscultación (ruidos hidroaéreos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "palpacion_del_abdomen",
        "name": "Palpación (dolor, defensa, visceromegalias)",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tacto_rectal",
        "name": "Tacto rectal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "GERIA_VALORACION_BASE",
    "name": "Valoración geriátrica",
    "specialty": "GERIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen del adulto mayor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la autonomía en actividades de la vida diaria, el antecedente de caídas, el recuento de fármacos en uso, la descripción en prosa del estado cognitivo y del ánimo, la continencia y el soporte social."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "autonomia_actividades_basicas",
        "name": "Autonomía en actividades básicas de la vida diaria",
        "dataType": "text",
        "required": true
      },
      {
        "code": "autonomia_actividades_instrumentales",
        "name": "Autonomía en actividades instrumentales de la vida diaria",
        "dataType": "text",
        "required": false
      },
      {
        "code": "marcha_y_equilibrio",
        "name": "Marcha y equilibrio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "caidas_en_el_ultimo_ano",
        "name": "Caídas en el último año (número)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "numero_de_farmacos_en_uso",
        "name": "Número de fármacos en uso",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "farmacos_en_uso",
        "name": "Fármacos en uso",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_cognitivo",
        "name": "Estado cognitivo (descripción)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_de_animo",
        "name": "Estado de ánimo (descripción)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "continencia",
        "name": "Continencia urinaria y fecal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alimentacion_y_peso",
        "name": "Alimentación y cambios de peso",
        "dataType": "text",
        "required": false
      },
      {
        "code": "vision_y_audicion",
        "name": "Visión y audición",
        "dataType": "text",
        "required": false
      },
      {
        "code": "soporte_social",
        "name": "Soporte social y convivencia",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
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
    "code": "GINOBS_CONTROL_PRENATAL",
    "name": "Control prenatal — Historia Clínica Perinatal (CLAP/SMR)",
    "specialty": "GINECOLOGIA_OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Historia Clínica Perinatal — Sistema Informático Perinatal (SIP)",
      "organization": "Centro Latinoamericano de Perinatología, Salud de la Mujer y Reproductiva (CLAP/SMR) — OPS/OMS",
      "url": "https://iris.paho.org/handle/10665.2/17048",
      "license": "Publicación OPS/OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "Historia clínica perinatal simplificada",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la sección de control prenatal. El formulario completo cubre además parto, puerperio y recién nacido."
    },
    "fields": [
      {
        "code": "fecha_ultima_menstruacion",
        "name": "Fecha de la última menstruación",
        "dataType": "date",
        "required": true
      },
      {
        "code": "fecha_probable_de_parto",
        "name": "Fecha probable de parto",
        "dataType": "date",
        "required": false
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "gestas_previas",
        "name": "Gestas previas",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "partos_previos",
        "name": "Partos previos",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "cesareas_previas",
        "name": "Cesáreas previas",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "abortos_previos",
        "name": "Abortos previos",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "altura_uterina_cm",
        "name": "Altura uterina (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "presentacion_fetal",
        "name": "Presentación fetal",
        "dataType": "string",
        "required": false
      },
      {
        "code": "frecuencia_cardiaca_fetal",
        "name": "Frecuencia cardíaca fetal (lpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "movimientos_fetales",
        "name": "Movimientos fetales presentes",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "edema",
        "name": "Edema",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "proteinuria",
        "name": "Proteinuria",
        "dataType": "string",
        "required": false
      },
      {
        "code": "hemoglobina",
        "name": "Hemoglobina (g/dL)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "vacuna_antitetanica",
        "name": "Vacuna antitetánica al día",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "suplemento_hierro_folatos",
        "name": "Recibe hierro y ácido fólico",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "riesgo_detectado",
        "name": "Riesgo detectado",
        "dataType": "text",
        "required": false
      },
      {
        "code": "proximo_control",
        "name": "Fecha del próximo control",
        "dataType": "date",
        "required": false
      }
    ]
  },
  {
    "code": "HEMATO_EVALUACION_BASE",
    "name": "Evaluación hematológica",
    "specialty": "HEMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, medicación, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad los ítems del síndrome anémico, los sangrados, las adenopatías con su localización, la esplenomegalia y las transfusiones previas."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false
      },
      {
        "code": "astenia",
        "name": "Astenia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "palidez",
        "name": "Palidez",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "sangrados",
        "name": "Sangrados (descripción y localización)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "transfusiones_previas",
        "name": "Transfusiones previas",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "detalle_de_transfusiones_previas",
        "name": "Detalle de las transfusiones previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares_hematologicos",
        "name": "Antecedentes familiares hematológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "adenopatias",
        "name": "Adenopatías",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "localizacion_de_las_adenopatias",
        "name": "Localización de las adenopatías",
        "dataType": "string",
        "required": false
      },
      {
        "code": "esplenomegalia",
        "name": "Esplenomegalia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hepatomegalia",
        "name": "Hepatomegalia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "estudios_de_laboratorio_recientes",
        "name": "Estudios de laboratorio recientes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "INFECTO_EVALUACION_BASE",
    "name": "Evaluación infectológica",
    "specialty": "INFECTOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes epidemiológicos y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes epidemiológicos, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la descripción del patrón febril, el foco clínico probable, los antecedentes de viajes y exposiciones, el estado de vacunación y los tratamientos antimicrobianos previos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": true
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "patron_febril",
        "name": "Patrón febril descrito",
        "dataType": "text",
        "required": false
      },
      {
        "code": "temperatura",
        "name": "Temperatura registrada (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "sintomas_acompanantes",
        "name": "Síntomas acompañantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "foco_clinico_probable",
        "name": "Foco clínico probable",
        "dataType": "text",
        "required": false
      },
      {
        "code": "viajes_recientes",
        "name": "Viajes recientes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "exposiciones_de_riesgo",
        "name": "Exposiciones de riesgo (animales, agua, contactos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "contacto_con_caso_similar",
        "name": "Contacto con caso similar",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "estado_de_vacunacion",
        "name": "Estado de vacunación referido",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antimicrobianos_previos",
        "name": "Tratamientos antimicrobianos previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "condiciones_de_inmunosupresion",
        "name": "Condiciones de inmunosupresión conocidas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes y cultivos previos revisados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "MEDEP_EVALUACION_BASE",
    "name": "Evaluación de medicina deportiva",
    "specialty": "MEDICINA_DEPORTIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen por aparatos y sistemas",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes personales y familiares, examen físico por aparatos, diagnóstico y conducta. Son agregados propios de la especialidad el deporte practicado y su nivel, la carga de entrenamiento semanal, las lesiones deportivas previas, el examen dirigido del aparato locomotor, los antecedentes cardiovasculares con el antecedente familiar de muerte súbita, y la aptitud propuesta redactada en prosa."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "deporte_practicado",
        "name": "Deporte practicado",
        "dataType": "string",
        "required": true
      },
      {
        "code": "nivel_de_practica",
        "name": "Nivel de práctica",
        "dataType": "string",
        "required": false
      },
      {
        "code": "carga_entrenamiento_semanal_horas",
        "name": "Carga de entrenamiento semanal (horas)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "lesiones_previas",
        "name": "Lesiones deportivas previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "dolor_actual",
        "name": "Dolor actual: localización y características",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false
      },
      {
        "code": "antecedentes_cardiovasculares",
        "name": "Antecedentes cardiovasculares personales",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedente_familiar_muerte_subita",
        "name": "Antecedente familiar de muerte súbita",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "sintomas_de_esfuerzo",
        "name": "Síntomas referidos durante el esfuerzo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "suplementos_y_medicacion",
        "name": "Suplementos y medicación en uso",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_general",
        "name": "Examen físico general y signos vitales",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_cardiorrespiratorio",
        "name": "Examen cardiorrespiratorio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_aparato_locomotor",
        "name": "Examen del aparato locomotor",
        "dataType": "text",
        "required": true
      },
      {
        "code": "exploraciones_complementarias",
        "name": "Exploraciones complementarias disponibles",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "aptitud_propuesta",
        "name": "Aptitud deportiva propuesta",
        "dataType": "text",
        "required": false
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento y recomendaciones",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "MEDFAM_CONSULTA_BASE",
    "name": "Consulta de medicina familiar",
    "specialty": "MEDICINA_FAMILIAR",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y examen físico de la atención ambulatoria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta: motivo, tiempo de evolución, enfermedad actual, antecedentes personales y familiares, examen físico, diagnóstico y conducta. Son agregados propios de medicina familiar los campos de composición del grupo familiar, condiciones de la vivienda y convivencia, red de apoyo, ocupación y hábitos, y el seguimiento de controles preventivos e inmunizaciones."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales patológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "composicion_grupo_familiar",
        "name": "Composición del grupo familiar",
        "dataType": "text",
        "required": false
      },
      {
        "code": "numero_convivientes",
        "name": "Número de convivientes en el hogar",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "condiciones_de_vivienda",
        "name": "Condiciones de la vivienda y saneamiento",
        "dataType": "text",
        "required": false
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo y cuidador principal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ocupacion",
        "name": "Ocupación actual",
        "dataType": "string",
        "required": false
      },
      {
        "code": "habitos",
        "name": "Hábitos (alimentación, actividad física, tabaco, alcohol)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "controles_preventivos",
        "name": "Controles preventivos e inmunizaciones",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_fisico_general",
        "name": "Examen físico general",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_por_aparatos",
        "name": "Examen por aparatos y sistemas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan de tratamiento y seguimiento familiar",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "MEDGEN_CONSULTA_BASE",
    "name": "Consulta de medicina general",
    "specialty": "MEDICINA_GENERAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen por aparatos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta ambulatoria: motivo, tiempo de evolución, relato de la enfermedad actual, antecedentes personales y familiares, funciones biológicas, examen físico general y por aparatos, diagnóstico y conducta. Son agregados propios de la ficha el desglose de los signos vitales en campos separados (presión, frecuencia cardíaca, temperatura, peso y talla) para poder registrarlos como valores numéricos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_personales",
        "name": "Antecedentes personales patológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alergias",
        "name": "Alergias conocidas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "funciones_biologicas",
        "name": "Funciones biológicas (apetito, sed, sueño, orina, deposiciones)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": false
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "talla",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "examen_fisico_general",
        "name": "Examen físico general",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_por_aparatos",
        "name": "Examen por aparatos y sistemas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examenes_auxiliares",
        "name": "Exámenes auxiliares solicitados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "MEDINT_EVALUACION_BASE",
    "name": "Evaluación de medicina interna — versión general base",
    "specialty": "MEDICINA_INTERNA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, historia clínica de consulta externa",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de la evaluación integral del adulto: comorbilidades, polifarmacia y revisión por sistemas."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "comorbilidades",
        "name": "Comorbilidades activas",
        "dataType": "text",
        "required": true
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "cantidad_de_farmacos",
        "name": "Cantidad de fármacos habituales",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "alergias",
        "name": "Alergias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habitos_toxicos",
        "name": "Hábitos tóxicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_funcional",
        "name": "Estado funcional / autonomía",
        "dataType": "string",
        "required": false
      },
      {
        "code": "perdida_de_peso_reciente",
        "name": "Pérdida de peso reciente",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "fiebre",
        "name": "Fiebre",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "revision_por_sistemas",
        "name": "Revisión por sistemas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_fisico_dirigido",
        "name": "Examen físico dirigido",
        "dataType": "text",
        "required": true
      },
      {
        "code": "laboratorio_relevante",
        "name": "Laboratorio relevante",
        "dataType": "text",
        "required": false
      },
      {
        "code": "problemas_activos",
        "name": "Lista de problemas activos",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_por_problema",
        "name": "Plan por problema",
        "dataType": "text",
        "required": true
      }
    ]
  },
  {
    "code": "MEDINT_UCI_EVALUACION",
    "name": "Evaluación en medicina intensiva",
    "specialty": "MEDICINA_INTENSIVA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, notas de evolución y registro de la atención hospitalaria",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común del registro: motivo, fecha de ingreso, signos vitales, evolución, diagnóstico y conducta. Son agregados propios de la especialidad el motivo de ingreso a la unidad, los días de estancia, el soporte ventilatorio, el soporte vasoactivo, la sedación, el balance hídrico y la evolución del turno."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "motivo_de_ingreso_a_la_unidad",
        "name": "Motivo de ingreso a la unidad",
        "dataType": "text",
        "required": true
      },
      {
        "code": "fecha_de_ingreso_a_la_unidad",
        "name": "Fecha de ingreso a la unidad",
        "dataType": "date",
        "required": false
      },
      {
        "code": "dias_de_estancia_en_la_unidad",
        "name": "Días de estancia en la unidad",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia",
        "dataType": "string",
        "required": false
      },
      {
        "code": "soporte_ventilatorio",
        "name": "Soporte ventilatorio",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "descripcion_del_soporte_ventilatorio",
        "name": "Descripción del soporte ventilatorio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "soporte_vasoactivo",
        "name": "Soporte vasoactivo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "descripcion_del_soporte_vasoactivo",
        "name": "Descripción del soporte vasoactivo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sedacion",
        "name": "Sedación",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial",
        "dataType": "string",
        "required": false
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "balance_hidrico_del_turno",
        "name": "Balance hídrico del turno",
        "dataType": "string",
        "required": false
      },
      {
        "code": "evolucion_del_turno",
        "name": "Evolución del turno",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "NEFRO_EVALUACION_BASE",
    "name": "Evaluación nefrológica",
    "specialty": "NEFROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato genitourinario",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el interrogatorio dirigido de diuresis, edemas y hematuria, el antecedente de litiasis, la presión arterial registrada en consulta y la referencia a estudios de función renal previos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": true
      },
      {
        "code": "edemas",
        "name": "Edemas (localización y evolución)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diuresis",
        "name": "Diuresis referida",
        "dataType": "text",
        "required": false
      },
      {
        "code": "nicturia",
        "name": "Nicturia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hematuria",
        "name": "Hematuria",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "espuma_en_la_orina",
        "name": "Espuma en la orina",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "dolor_lumbar",
        "name": "Dolor lumbar",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedente_de_litiasis",
        "name": "Antecedente de litiasis renal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_de_hipertension_o_diabetes",
        "name": "Antecedentes de hipertensión o diabetes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_nefrotoxica",
        "name": "Medicación potencialmente nefrotóxica en uso",
        "dataType": "text",
        "required": false
      },
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "peso",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": false
      },
      {
        "code": "funcion_renal_previa",
        "name": "Función renal previa registrada",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "NEUMO_EVALUACION_BASE",
    "name": "Evaluación neumológica",
    "specialty": "NEUMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato respiratorio",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen por aparatos, diagnóstico y conducta. Son agregados propios de la especialidad la descripción dirigida de disnea, tos, expectoración y hemoptisis, el antecedente de tabaquismo, la auscultación pulmonar y la saturación de oxígeno."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": true
      },
      {
        "code": "disnea",
        "name": "Disnea",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tos",
        "name": "Tos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "expectoracion",
        "name": "Expectoración (aspecto y cantidad)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "hemoptisis",
        "name": "Hemoptisis",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "dolor_toracico",
        "name": "Dolor torácico",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sibilancias",
        "name": "Sibilancias referidas",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "tabaquismo",
        "name": "Antecedente de tabaquismo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "exposicion_ocupacional_o_ambiental",
        "name": "Exposición ocupacional o ambiental",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_respiratorios",
        "name": "Antecedentes respiratorios previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (por minuto)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "saturacion_de_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "auscultacion_pulmonar",
        "name": "Auscultación pulmonar",
        "dataType": "text",
        "required": true
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes previos revisados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "NEURO_EVALUACION_BASE",
    "name": "Evaluación neurológica",
    "specialty": "NEUROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del sistema nervioso",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común de la consulta y el apartado de examen del sistema nervioso: motivo, tiempo de evolución, antecedentes, examen, diagnóstico y conducta. Son agregados propios de la especialidad el desglose del examen neurológico en campos separados (estado de conciencia, pares craneales, fuerza muscular, sensibilidad, reflejos, coordinación y marcha) y la anamnesis dirigida de cefalea y episodios convulsivos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Relato de la enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_neurologicos",
        "name": "Antecedentes neurológicos personales y familiares",
        "dataType": "text",
        "required": false
      },
      {
        "code": "cefalea",
        "name": "Cefalea (presencia)",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "caracteristicas_cefalea",
        "name": "Características de la cefalea (localización, tipo, irradiación, factores)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "convulsiones",
        "name": "Episodios convulsivos (presencia)",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "descripcion_convulsiones",
        "name": "Descripción de los episodios convulsivos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "mareo_o_vertigo",
        "name": "Mareo o vértigo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "estado_de_conciencia",
        "name": "Estado de conciencia y orientación",
        "dataType": "text",
        "required": true
      },
      {
        "code": "lenguaje",
        "name": "Lenguaje y habla",
        "dataType": "text",
        "required": false
      },
      {
        "code": "pares_craneales",
        "name": "Examen de pares craneales",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular por segmentos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sensibilidad",
        "name": "Sensibilidad superficial y profunda",
        "dataType": "text",
        "required": false
      },
      {
        "code": "reflejos_osteotendinosos",
        "name": "Reflejos osteotendinosos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "coordinacion_y_marcha",
        "name": "Coordinación, equilibrio y marcha",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "NUTRI_EVALUACION_BASE",
    "name": "Evaluación nutricional",
    "specialty": "NUTRICION",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes y registro de medidas antropométricas",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común (motivo, tiempo de evolución, antecedentes, examen con medidas antropométricas, diagnóstico y conducta) y el registro de peso y talla. Son agregados propios de la especialidad los hábitos alimentarios, el número de comidas al día, las intolerancias y alergias alimentarias, el consumo de líquidos, la actividad física y el objetivo nutricional acordado en consulta. Los valores se registran tal como se miden: la ficha no calcula ni interpreta índices."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": false
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes patológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_y_suplementos",
        "name": "Medicación y suplementos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "talla_m",
        "name": "Talla (m)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "perimetro_abdominal_cm",
        "name": "Perímetro abdominal (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "cambio_de_peso_referido",
        "name": "Cambio de peso referido",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habitos_alimentarios",
        "name": "Hábitos alimentarios",
        "dataType": "text",
        "required": false
      },
      {
        "code": "numero_de_comidas_al_dia",
        "name": "Número de comidas al día",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "intolerancias_alimentarias",
        "name": "Intolerancias alimentarias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "alergias_alimentarias",
        "name": "Alergias alimentarias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "consumo_de_liquidos",
        "name": "Consumo de líquidos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habito_intestinal",
        "name": "Hábito intestinal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "actividad_fisica",
        "name": "Actividad física",
        "dataType": "text",
        "required": false
      },
      {
        "code": "objetivo_nutricional",
        "name": "Objetivo nutricional",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico nutricional",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_de_tratamiento",
        "name": "Plan nutricional",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "OBST_CONTROL_BASE",
    "name": "Control obstétrico",
    "specialty": "OBSTETRICIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, historia clínica materno perinatal y registro de la atención prenatal",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcriben la estructura común (motivo, antecedentes, examen, diagnóstico y conducta) y los campos del registro prenatal: fecha de última menstruación, edad gestacional, fórmula obstétrica, altura uterina, latidos fetales y presión arterial. Son agregados propios de la especialidad los movimientos fetales referidos, la presencia de edemas, las molestias referidas y el registro de controles previos. Los valores se anotan tal como se miden: la ficha no calcula fechas probables ni interpreta resultados."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "fecha_ultima_menstruacion",
        "name": "Fecha de última menstruación",
        "dataType": "date",
        "required": false
      },
      {
        "code": "edad_gestacional_semanas",
        "name": "Edad gestacional (semanas)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "gestas",
        "name": "Gestas",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "partos",
        "name": "Partos",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "cesareas",
        "name": "Cesáreas",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "abortos",
        "name": "Abortos",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "controles_previos",
        "name": "Controles prenatales previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "presion_arterial",
        "name": "Presión arterial (mmHg)",
        "dataType": "string",
        "required": true
      },
      {
        "code": "altura_uterina_cm",
        "name": "Altura uterina (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "latidos_fetales",
        "name": "Latidos fetales (lpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "movimientos_fetales",
        "name": "Movimientos fetales referidos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "edemas",
        "name": "Edemas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "molestias_referidas",
        "name": "Molestias referidas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "ODONTO_ANAMNESIS",
    "name": "Anamnesis y antecedentes odontológicos",
    "specialty": "ODONTOLOGIA",
    "provenance": {
      "sourceTitle": "Oral health surveys: basic methods — 5th edition (cuestionario de salud bucodental)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548649",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "5.ª edición, 2013",
      "retrievedAt": "2026-08-14",
      "note": "La estructura del cuestionario de antecedentes médicos y de las molestias bucales viene del cuestionario de salud bucodental de la OMS. Son agregados propios, tomados de la práctica de consultorio, los ítems de problemas con la anestesia, el bruxismo y la última visita dental. Los antecedentes que no tienen ítem propio —asma, enfermedades infecciosas, tratamientos previos y hábitos de higiene— se anotan en prosa en «Detalle de antecedentes»: la ficha es de admisión y se mantiene corta a propósito. No repite el odontograma, que vive en otra plantilla."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "alergia_a_medicamentos",
        "name": "Alergia a medicamentos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "consume_medicamentos",
        "name": "Consume medicamentos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "problemas_con_anestesia",
        "name": "Problemas con la anestesia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "problemas_de_sangrado",
        "name": "Problemas de sangrado",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "enfermedad_cardiovascular",
        "name": "Enfermedad cardiovascular",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hipertension_arterial",
        "name": "Hipertensión arterial",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "diabetes",
        "name": "Diabetes",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "embarazo",
        "name": "Embarazo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "fuma",
        "name": "Fuma",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "detalle_de_antecedentes",
        "name": "Detalle de antecedentes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "molestia_o_dolor_bucal",
        "name": "Molestia o dolor bucal",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "sangrado_de_encias",
        "name": "Sangrado de encías",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "movilidad_dentaria",
        "name": "Movilidad dentaria",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "bruxismo",
        "name": "Bruxismo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "ultima_visita_dental",
        "name": "Última visita dental",
        "dataType": "date",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
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
    "code": "ODONTO_ODONTOGRAMA_OMS",
    "name": "Odontograma y evaluación bucodental (OMS)",
    "specialty": "ODONTOLOGIA",
    "provenance": {
      "sourceTitle": "Oral health surveys: basic methods — 5th edition (formularios de evaluación bucodental)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/publications/i/item/9789241548649",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "5.ª edición, 2013",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de los ítems del formulario de evaluación. Desde la v2 el estado por pieza se registra en `odontograma_fdi`, un mapa de pieza FDI a código de estado de la OMS (0-9, T) que dibuja el control de odontograma; `estado_por_pieza` queda como observaciones en prosa y dejó de ser obligatorio. Las respuestas capturadas con la v1 se siguen leyendo tal cual."
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
        "required": false
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
        "code": "urgencia_de_intervencion",
        "name": "Urgencia de intervención",
        "dataType": "string",
        "required": true
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
    "specialty": "OFTALMOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, formatos especiales por especialidad",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del examen oftalmológico básico (agudeza visual, presión intraocular, segmento anterior y posterior)."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "usa_correccion_optica",
        "name": "Usa corrección óptica",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "agudeza_visual_od",
        "name": "Agudeza visual sin corrección — ojo derecho",
        "dataType": "string",
        "required": true
      },
      {
        "code": "agudeza_visual_oi",
        "name": "Agudeza visual sin corrección — ojo izquierdo",
        "dataType": "string",
        "required": true
      },
      {
        "code": "agudeza_visual_corregida_od",
        "name": "Agudeza visual con corrección — ojo derecho",
        "dataType": "string",
        "required": false
      },
      {
        "code": "agudeza_visual_corregida_oi",
        "name": "Agudeza visual con corrección — ojo izquierdo",
        "dataType": "string",
        "required": false
      },
      {
        "code": "presion_intraocular_od",
        "name": "Presión intraocular — ojo derecho (mmHg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "presion_intraocular_oi",
        "name": "Presión intraocular — ojo izquierdo (mmHg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "reflejos_pupilares",
        "name": "Reflejos pupilares",
        "dataType": "text",
        "required": false
      },
      {
        "code": "motilidad_ocular",
        "name": "Motilidad ocular",
        "dataType": "text",
        "required": false
      },
      {
        "code": "segmento_anterior_od",
        "name": "Segmento anterior — ojo derecho",
        "dataType": "text",
        "required": false
      },
      {
        "code": "segmento_anterior_oi",
        "name": "Segmento anterior — ojo izquierdo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fondo_de_ojo_od",
        "name": "Fondo de ojo — ojo derecho",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fondo_de_ojo_oi",
        "name": "Fondo de ojo — ojo izquierdo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "ONCO_EVALUACION_BASE",
    "name": "Evaluación oncológica",
    "specialty": "ONCOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, examen físico y notas de evolución",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se transcribe la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad el diagnóstico oncológico y su fecha, el estadio registrado como texto libre, los tratamientos oncológicos recibidos, el estado funcional ECOG como número y la pérdida de peso."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_oncologico_conocido",
        "name": "Diagnóstico oncológico conocido",
        "dataType": "string",
        "required": false
      },
      {
        "code": "fecha_del_diagnostico",
        "name": "Fecha del diagnóstico",
        "dataType": "date",
        "required": false
      },
      {
        "code": "estadio_clinico",
        "name": "Estadio clínico",
        "dataType": "string",
        "required": false
      },
      {
        "code": "tratamientos_oncologicos_recibidos",
        "name": "Tratamientos oncológicos recibidos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fecha_del_ultimo_tratamiento",
        "name": "Fecha del último tratamiento",
        "dataType": "date",
        "required": false
      },
      {
        "code": "estado_funcional_ecog",
        "name": "Estado funcional ECOG (0 a 4)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "sintomas_actuales",
        "name": "Síntomas actuales",
        "dataType": "text",
        "required": true
      },
      {
        "code": "dolor",
        "name": "Dolor",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "perdida_de_peso",
        "name": "Pérdida de peso",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "peso_actual_kg",
        "name": "Peso actual (kg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares_oncologicos",
        "name": "Antecedentes familiares oncológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_fisico",
        "name": "Examen físico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "estudios_complementarios",
        "name": "Estudios complementarios",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "ORL_EVALUACION_BASE",
    "name": "Evaluación otorrinolaringológica",
    "specialty": "OTORRINOLARINGOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen de cabeza y cuello",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen dirigido, diagnóstico y conducta. Son agregados propios de la especialidad la anamnesis otológica (hipoacusia, lado afectado, otalgia, otorrea, acúfenos, vértigo), la nasal y faringolaríngea (obstrucción nasal, epistaxis, odinofagia, disfonía) y la otoscopia y la rinoscopia anterior descritas en prosa."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "hipoacusia",
        "name": "Hipoacusia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "lado_afectado",
        "name": "Lado afectado",
        "dataType": "string",
        "required": false
      },
      {
        "code": "otalgia",
        "name": "Otalgia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "otorrea",
        "name": "Otorrea",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "acufenos",
        "name": "Acúfenos",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "vertigo",
        "name": "Vértigo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "obstruccion_nasal",
        "name": "Obstrucción nasal",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "epistaxis",
        "name": "Epistaxis",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "odinofagia",
        "name": "Odinofagia",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "disfonia",
        "name": "Disfonía",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "antecedentes_otorrinolaringologicos",
        "name": "Antecedentes otorrinolaringológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "otoscopia",
        "name": "Otoscopia (hallazgos descritos)",
        "dataType": "text",
        "required": true
      },
      {
        "code": "rinoscopia_anterior",
        "name": "Rinoscopia anterior (hallazgos descritos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_de_cuello",
        "name": "Examen de cuello",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "PATOL_INFORME_BASE",
    "name": "Informe de anatomía patológica",
    "specialty": "PATOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, informe de exámenes auxiliares y estudios anatomopatológicos",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común del documento clínico: motivo o indicación del estudio, descripción de lo observado, conclusión diagnóstica y conducta o recomendación. Son agregados propios de la especialidad la trazabilidad de la muestra (tipo, procedencia anatómica, fecha de toma, tipo de fijación, estado de la muestra) y la separación entre descripción macroscópica, descripción microscópica y técnicas especiales."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo del estudio o indicación clínica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_clinico_presuntivo",
        "name": "Diagnóstico clínico presuntivo del solicitante",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tipo_de_muestra",
        "name": "Tipo de muestra",
        "dataType": "string",
        "required": true
      },
      {
        "code": "procedencia_anatomica",
        "name": "Procedencia anatómica de la muestra",
        "dataType": "string",
        "required": false
      },
      {
        "code": "procedimiento_de_obtencion",
        "name": "Procedimiento de obtención",
        "dataType": "string",
        "required": false
      },
      {
        "code": "fecha_de_toma",
        "name": "Fecha de toma de la muestra",
        "dataType": "date",
        "required": false
      },
      {
        "code": "fecha_de_recepcion",
        "name": "Fecha de recepción en el laboratorio",
        "dataType": "date",
        "required": false
      },
      {
        "code": "numero_de_frascos",
        "name": "Número de frascos o contenedores recibidos",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "tipo_de_fijacion",
        "name": "Tipo de fijación y conservación",
        "dataType": "string",
        "required": false
      },
      {
        "code": "estado_de_la_muestra",
        "name": "Estado de la muestra al recibirla",
        "dataType": "text",
        "required": false
      },
      {
        "code": "descripcion_macroscopica",
        "name": "Descripción macroscópica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "descripcion_microscopica",
        "name": "Descripción microscópica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tecnicas_especiales",
        "name": "Técnicas especiales realizadas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estudio_comparativo_previo",
        "name": "Comparación con estudios anatomopatológicos previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "observaciones",
        "name": "Observaciones y limitaciones del estudio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico anatomopatológico o conclusión",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Recomendaciones y estudios complementarios sugeridos",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "PEDIA_CONTROL_NINO_SANO",
    "name": "Control de niño sano",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, atención integral del niño",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del control periódico. Las curvas de crecimiento van en su propio formulario (PEDIA_CURVAS_CRECIMIENTO_OMS)."
    },
    "fields": [
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "talla_cm",
        "name": "Talla / longitud (cm)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "perimetro_cefalico_cm",
        "name": "Perímetro cefálico (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "alimentacion",
        "name": "Alimentación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "lactancia_materna_exclusiva",
        "name": "Lactancia materna exclusiva",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "vacunas_al_dia",
        "name": "Esquema de vacunación al día",
        "dataType": "boolean",
        "required": true
      },
      {
        "code": "desarrollo_motor",
        "name": "Desarrollo motor",
        "dataType": "text",
        "required": false
      },
      {
        "code": "desarrollo_del_lenguaje",
        "name": "Desarrollo del lenguaje",
        "dataType": "text",
        "required": false
      },
      {
        "code": "desarrollo_social",
        "name": "Desarrollo social",
        "dataType": "text",
        "required": false
      },
      {
        "code": "agudeza_visual",
        "name": "Tamizaje visual",
        "dataType": "string",
        "required": false
      },
      {
        "code": "tamizaje_auditivo",
        "name": "Tamizaje auditivo",
        "dataType": "string",
        "required": false
      },
      {
        "code": "salud_bucal",
        "name": "Salud bucal",
        "dataType": "text",
        "required": false
      },
      {
        "code": "signos_de_alarma",
        "name": "Signos de alarma detectados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "proximo_control",
        "name": "Fecha del próximo control",
        "dataType": "date",
        "required": false
      }
    ]
  },
  {
    "code": "PEDIA_CURVAS_CRECIMIENTO_OMS",
    "name": "Curvas de crecimiento (patrones OMS)",
    "specialty": "PEDIATRIA",
    "provenance": {
      "sourceTitle": "Patrones de crecimiento infantil de la OMS (WHO Child Growth Standards)",
      "organization": "Organización Mundial de la Salud (OMS)",
      "url": "https://www.who.int/es/news-room/questions-and-answers/item/child-growth-standards",
      "license": "Publicación OMS de acceso abierto (CC BY-NC-SA 3.0 IGO)",
      "sourceVersion": "OMS 2006 (0–5 años) y OMS 2007 (5–19 años)",
      "retrievedAt": "2026-08-14",
      "note": "Registra las mediciones y sus puntuaciones Z. Las tablas de referencia no se transcriben: se consultan en la fuente."
    },
    "fields": [
      {
        "code": "fecha_de_medicion",
        "name": "Fecha de la medición",
        "dataType": "date",
        "required": true
      },
      {
        "code": "edad_en_meses",
        "name": "Edad (meses)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "talla_cm",
        "name": "Talla / longitud (cm)",
        "dataType": "decimal",
        "required": true
      },
      {
        "code": "perimetro_cefalico_cm",
        "name": "Perímetro cefálico (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "imc",
        "name": "Índice de masa corporal (kg/m²)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "z_peso_para_la_edad",
        "name": "Puntuación Z — peso para la edad",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "z_talla_para_la_edad",
        "name": "Puntuación Z — talla para la edad",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "z_peso_para_la_talla",
        "name": "Puntuación Z — peso para la talla",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "z_imc_para_la_edad",
        "name": "Puntuación Z — IMC para la edad",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "clasificacion_nutricional",
        "name": "Clasificación del estado nutricional",
        "dataType": "string",
        "required": false
      }
    ]
  },
  {
    "code": "PSICO_EVALUACION_BASE",
    "name": "Evaluación psicológica",
    "specialty": "PSICOLOGIA_CLINICA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis, antecedentes personales y familiares y examen mental",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma se toma la estructura común de la historia clínica: motivo de consulta, tiempo de evolución, antecedentes personales y familiares, examen, diagnóstico y conducta. Son agregados propios de la especialidad la descripción en prosa del estado de ánimo y la ansiedad, el sueño, el apetito, la situación vital actual, la red de apoyo y el riesgo referido, tomados de la entrevista psicológica de consultorio."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "antecedentes_tratamiento_psicologico",
        "name": "Antecedentes de tratamiento psicológico",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_tratamiento_psiquiatrico",
        "name": "Antecedentes de tratamiento psiquiátrico",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_actual",
        "name": "Medicación actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares_salud_mental",
        "name": "Antecedentes familiares de salud mental",
        "dataType": "text",
        "required": false
      },
      {
        "code": "situacion_vital_actual",
        "name": "Situación vital actual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_de_animo",
        "name": "Estado de ánimo referido",
        "dataType": "text",
        "required": true
      },
      {
        "code": "ansiedad",
        "name": "Ansiedad referida",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sueno",
        "name": "Sueño",
        "dataType": "text",
        "required": false
      },
      {
        "code": "apetito",
        "name": "Apetito",
        "dataType": "text",
        "required": false
      },
      {
        "code": "consumo_de_sustancias",
        "name": "Consumo de sustancias referido",
        "dataType": "text",
        "required": false
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "riesgo_referido",
        "name": "Riesgo referido en la entrevista",
        "dataType": "text",
        "required": false
      },
      {
        "code": "observaciones_de_la_entrevista",
        "name": "Observaciones de la entrevista",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Impresión diagnóstica",
        "dataType": "text",
        "required": true
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
    "code": "PSIQ_EVALUACION_BASE",
    "name": "Evaluación de salud mental — versión general base",
    "specialty": "PSIQUIATRIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, evaluación de salud mental",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura del examen mental y la anamnesis psiquiátrica. Los instrumentos con puntaje (PHQ-9, GAD-7, Beck, MMSE) NO se cargaron: ver los pendientes de licencia en el README."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "enfermedad_actual",
        "name": "Enfermedad actual",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_psiquiatricos",
        "name": "Antecedentes psiquiátricos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "consumo_de_sustancias",
        "name": "Consumo de sustancias",
        "dataType": "text",
        "required": false
      },
      {
        "code": "red_de_apoyo",
        "name": "Red de apoyo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "aspecto_y_actitud",
        "name": "Aspecto general y actitud",
        "dataType": "text",
        "required": false
      },
      {
        "code": "conciencia_y_orientacion",
        "name": "Conciencia y orientación",
        "dataType": "text",
        "required": false
      },
      {
        "code": "atencion_y_memoria",
        "name": "Atención y memoria",
        "dataType": "text",
        "required": false
      },
      {
        "code": "lenguaje",
        "name": "Lenguaje",
        "dataType": "text",
        "required": false
      },
      {
        "code": "pensamiento_curso_y_contenido",
        "name": "Pensamiento: curso y contenido",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sensopercepcion",
        "name": "Sensopercepción",
        "dataType": "text",
        "required": false
      },
      {
        "code": "afecto_y_estado_de_animo",
        "name": "Afecto y estado de ánimo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "juicio_e_insight",
        "name": "Juicio de realidad e insight",
        "dataType": "text",
        "required": false
      },
      {
        "code": "riesgo_suicida",
        "name": "Riesgo suicida",
        "dataType": "string",
        "required": true
      },
      {
        "code": "riesgo_de_heteroagresion",
        "name": "Riesgo de heteroagresión",
        "dataType": "string",
        "required": false
      },
      {
        "code": "impresion_diagnostica",
        "name": "Impresión diagnóstica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_terapeutico",
        "name": "Plan terapéutico",
        "dataType": "text",
        "required": true
      }
    ]
  },
  {
    "code": "RADIO_INFORME_BASE",
    "name": "Informe de estudio por imágenes",
    "specialty": "RADIOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, informe de exámenes auxiliares por imágenes",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale el molde común del documento clínico: motivo o indicación del estudio, descripción de lo observado, conclusión diagnóstica y conducta o recomendación. Son agregados propios de la especialidad los ítems de identificación técnica del estudio (estudio realizado, región anatómica, técnica y proyecciones, uso de medio de contraste, calidad del estudio) y la comparación con estudios previos."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo del estudio o indicación clínica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_relevantes",
        "name": "Antecedentes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estudio_realizado",
        "name": "Estudio realizado",
        "dataType": "string",
        "required": true
      },
      {
        "code": "region_anatomica",
        "name": "Región anatómica explorada",
        "dataType": "string",
        "required": true
      },
      {
        "code": "fecha_del_estudio",
        "name": "Fecha del estudio",
        "dataType": "date",
        "required": false
      },
      {
        "code": "tecnica_y_proyecciones",
        "name": "Técnica y proyecciones realizadas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "uso_de_contraste",
        "name": "Uso de medio de contraste",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "medio_de_contraste_utilizado",
        "name": "Medio de contraste utilizado y vía de administración",
        "dataType": "string",
        "required": false
      },
      {
        "code": "calidad_del_estudio",
        "name": "Calidad del estudio y limitaciones técnicas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "comparacion_estudios_previos",
        "name": "Comparación con estudios previos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "hallazgos",
        "name": "Hallazgos",
        "dataType": "text",
        "required": true
      },
      {
        "code": "hallazgos_incidentales",
        "name": "Hallazgos incidentales",
        "dataType": "text",
        "required": false
      },
      {
        "code": "incidentes_durante_el_estudio",
        "name": "Incidentes durante el estudio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Impresión diagnóstica o conclusión",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Recomendaciones y estudios complementarios sugeridos",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "REUMA_EVALUACION_BASE",
    "name": "Evaluación reumatológica",
    "specialty": "REUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato locomotor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma salen la estructura común del registro: motivo de consulta, tiempo de enfermedad, antecedentes, examen físico, diagnóstico y conducta. Son agregados propios de la especialidad la caracterización del dolor articular y su ritmo, la rigidez matinal en minutos, el detalle de las articulaciones comprometidas y la tumefacción, y el compromiso cutáneo asociado."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": true
      },
      {
        "code": "dolor_articular",
        "name": "Dolor articular (descripción)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "ritmo_del_dolor",
        "name": "Ritmo del dolor (inflamatorio o mecánico)",
        "dataType": "string",
        "required": false
      },
      {
        "code": "rigidez_matinal_minutos",
        "name": "Rigidez matinal (minutos)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "articulaciones_comprometidas",
        "name": "Articulaciones comprometidas",
        "dataType": "text",
        "required": true
      },
      {
        "code": "patron_de_compromiso",
        "name": "Patrón de compromiso (simétrico, asimétrico, axial)",
        "dataType": "string",
        "required": false
      },
      {
        "code": "tumefaccion_articular",
        "name": "Tumefacción articular",
        "dataType": "text",
        "required": false
      },
      {
        "code": "limitacion_funcional",
        "name": "Limitación funcional referida",
        "dataType": "text",
        "required": false
      },
      {
        "code": "compromiso_cutaneo",
        "name": "Compromiso cutáneo",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sintomas_sistemicos",
        "name": "Síntomas sistémicos asociados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares_reumatologicos",
        "name": "Antecedentes familiares reumatológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tratamientos_previos",
        "name": "Tratamientos previos recibidos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_osteoarticular",
        "name": "Examen osteoarticular",
        "dataType": "text",
        "required": true
      },
      {
        "code": "examenes_previos",
        "name": "Exámenes previos revisados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
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
    "code": "TRANSV_ANAMNESIS_GENERAL",
    "name": "Anamnesis / Historia clínica general",
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, formatos de historia clínica",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la estructura de anamnesis del formato oficial. No reproduce ningún instrumento con puntaje propietario."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_enfermedad",
        "name": "Tiempo de enfermedad",
        "dataType": "string",
        "required": false
      },
      {
        "code": "enfermedad_actual",
        "name": "Enfermedad actual (relato cronológico)",
        "dataType": "text",
        "required": true
      },
      {
        "code": "antecedentes_patologicos",
        "name": "Antecedentes personales patológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_quirurgicos",
        "name": "Antecedentes quirúrgicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_alergicos",
        "name": "Alergias conocidas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "antecedentes_familiares",
        "name": "Antecedentes familiares",
        "dataType": "text",
        "required": false
      },
      {
        "code": "habito_tabaco",
        "name": "Consume tabaco",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "habito_alcohol",
        "name": "Consume alcohol",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "habito_actividad_fisica",
        "name": "Actividad física habitual",
        "dataType": "string",
        "required": false
      },
      {
        "code": "revision_por_sistemas",
        "name": "Revisión por aparatos y sistemas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "impresion_diagnostica",
        "name": "Impresión diagnóstica",
        "dataType": "text",
        "required": true
      },
      {
        "code": "plan_de_trabajo",
        "name": "Plan de trabajo",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "TRANSV_CONSENTIMIENTO_INFORMADO",
    "name": "Consentimiento informado",
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Modelo de consentimiento informado — Resolución 1738",
      "organization": "Ministerio de Salud y Protección Social de Colombia",
      "url": "https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/VS/ED/VSP/modelo-consentimiento-informado-resolucion-1738.pdf",
      "license": "Documento oficial de acceso público",
      "sourceVersion": "Resolución 1738",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de los campos del modelo oficial. El texto legal de cada procedimiento lo aporta la organización."
    },
    "fields": [
      {
        "code": "procedimiento_propuesto",
        "name": "Procedimiento o tratamiento propuesto",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_que_lo_motiva",
        "name": "Diagnóstico que lo motiva",
        "dataType": "text",
        "required": true
      },
      {
        "code": "beneficios_esperados",
        "name": "Beneficios esperados",
        "dataType": "text",
        "required": true
      },
      {
        "code": "riesgos_y_complicaciones",
        "name": "Riesgos y complicaciones posibles",
        "dataType": "text",
        "required": true
      },
      {
        "code": "alternativas_disponibles",
        "name": "Alternativas disponibles",
        "dataType": "text",
        "required": false
      },
      {
        "code": "consecuencias_de_no_aceptar",
        "name": "Consecuencias de no aceptar",
        "dataType": "text",
        "required": false
      },
      {
        "code": "preguntas_del_paciente",
        "name": "Preguntas formuladas por el paciente",
        "dataType": "text",
        "required": false
      },
      {
        "code": "acepta_el_procedimiento",
        "name": "El paciente acepta el procedimiento",
        "dataType": "boolean",
        "required": true
      },
      {
        "code": "otorgado_por_representante",
        "name": "Lo otorga un representante legal",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "nombre_del_representante",
        "name": "Nombre del representante legal",
        "dataType": "string",
        "required": false
      },
      {
        "code": "fecha_de_otorgamiento",
        "name": "Fecha de otorgamiento",
        "dataType": "date",
        "required": true
      }
    ]
  },
  {
    "code": "TRANSV_EPICRISIS",
    "name": "Epicrisis / Resumen de egreso",
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Resolución 1995 de 1999 — normas para el manejo de la historia clínica: epicrisis y resumen de egreso",
      "organization": "Ministerio de Salud de Colombia",
      "url": "https://www.minsalud.gov.co/normatividad_nuevo/resoluci%C3%93n%201995%20de%201999.pdf",
      "license": "Norma estatal de acceso público",
      "sourceVersion": "1995 de 1999",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción del contenido mínimo que la norma exige en el resumen de egreso."
    },
    "fields": [
      {
        "code": "fecha_de_ingreso",
        "name": "Fecha de ingreso",
        "dataType": "date",
        "required": true
      },
      {
        "code": "fecha_de_egreso",
        "name": "Fecha de egreso",
        "dataType": "date",
        "required": true
      },
      {
        "code": "motivo_de_ingreso",
        "name": "Motivo de ingreso",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_de_ingreso",
        "name": "Diagnóstico de ingreso",
        "dataType": "text",
        "required": true
      },
      {
        "code": "diagnostico_de_egreso",
        "name": "Diagnóstico de egreso",
        "dataType": "text",
        "required": true
      },
      {
        "code": "resumen_de_la_evolucion",
        "name": "Resumen de la evolución",
        "dataType": "text",
        "required": true
      },
      {
        "code": "procedimientos_realizados",
        "name": "Procedimientos realizados",
        "dataType": "text",
        "required": false
      },
      {
        "code": "hallazgos_relevantes",
        "name": "Hallazgos de laboratorio e imágenes relevantes",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tratamiento_al_egreso",
        "name": "Tratamiento indicado al egreso",
        "dataType": "text",
        "required": true
      },
      {
        "code": "recomendaciones",
        "name": "Recomendaciones al paciente",
        "dataType": "text",
        "required": false
      },
      {
        "code": "control_ambulatorio",
        "name": "Fecha de control ambulatorio",
        "dataType": "date",
        "required": false
      },
      {
        "code": "condicion_al_egreso",
        "name": "Condición al egreso",
        "dataType": "string",
        "required": true
      }
    ]
  },
  {
    "code": "TRANSV_EXAMEN_FISICO",
    "name": "Examen físico general",
    "specialty": "TRANSVERSAL",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen físico y funciones vitales",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Transcripción de la sección de funciones vitales y examen por aparatos del formato oficial."
    },
    "fields": [
      {
        "code": "presion_arterial_sistolica",
        "name": "Presión arterial sistólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "presion_arterial_diastolica",
        "name": "Presión arterial diastólica (mmHg)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "frecuencia_cardiaca",
        "name": "Frecuencia cardíaca (lpm)",
        "dataType": "integer",
        "required": true
      },
      {
        "code": "frecuencia_respiratoria",
        "name": "Frecuencia respiratoria (rpm)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "temperatura",
        "name": "Temperatura (°C)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "saturacion_oxigeno",
        "name": "Saturación de oxígeno (%)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "peso_kg",
        "name": "Peso (kg)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "talla_cm",
        "name": "Talla (cm)",
        "dataType": "decimal",
        "required": false
      },
      {
        "code": "estado_general",
        "name": "Estado general",
        "dataType": "string",
        "required": false
      },
      {
        "code": "piel_y_faneras",
        "name": "Piel y faneras",
        "dataType": "text",
        "required": false
      },
      {
        "code": "cabeza_y_cuello",
        "name": "Cabeza y cuello",
        "dataType": "text",
        "required": false
      },
      {
        "code": "aparato_respiratorio",
        "name": "Aparato respiratorio",
        "dataType": "text",
        "required": false
      },
      {
        "code": "aparato_cardiovascular",
        "name": "Aparato cardiovascular",
        "dataType": "text",
        "required": false
      },
      {
        "code": "abdomen",
        "name": "Abdomen",
        "dataType": "text",
        "required": false
      },
      {
        "code": "sistema_nervioso",
        "name": "Sistema nervioso",
        "dataType": "text",
        "required": false
      },
      {
        "code": "aparato_locomotor",
        "name": "Aparato locomotor",
        "dataType": "text",
        "required": false
      }
    ]
  },
  {
    "code": "TRAUMA_EVALUACION_BASE",
    "name": "Evaluación musculoesquelética — versión general base",
    "specialty": "TRAUMATOLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, examen del aparato locomotor",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "Estructura de anamnesis y examen locomotor del formato oficial. Las escalas funcionales de sociedades científicas quedaron fuera por licencia — ver README."
    },
    "fields": [
      {
        "code": "mecanismo_de_lesion",
        "name": "Mecanismo de lesión",
        "dataType": "text",
        "required": true
      },
      {
        "code": "fecha_de_la_lesion",
        "name": "Fecha de la lesión",
        "dataType": "date",
        "required": false
      },
      {
        "code": "segmento_afectado",
        "name": "Segmento afectado",
        "dataType": "string",
        "required": true
      },
      {
        "code": "lateralidad",
        "name": "Lateralidad",
        "dataType": "string",
        "required": false
      },
      {
        "code": "dolor_en_reposo",
        "name": "Dolor en reposo",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "intensidad_del_dolor",
        "name": "Intensidad del dolor (0–10)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "impotencia_funcional",
        "name": "Impotencia funcional",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "deformidad",
        "name": "Deformidad visible",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "edema_local",
        "name": "Edema local",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "equimosis",
        "name": "Equimosis",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "rango_de_movilidad",
        "name": "Rango de movilidad",
        "dataType": "text",
        "required": false
      },
      {
        "code": "fuerza_muscular",
        "name": "Fuerza muscular (0–5)",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "estabilidad_articular",
        "name": "Estabilidad articular",
        "dataType": "text",
        "required": false
      },
      {
        "code": "estado_neurovascular_distal",
        "name": "Estado neurovascular distal",
        "dataType": "text",
        "required": true
      },
      {
        "code": "imagenes_solicitadas",
        "name": "Imágenes solicitadas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "hallazgos_imagenologicos",
        "name": "Hallazgos imagenológicos",
        "dataType": "text",
        "required": false
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": true
      }
    ]
  },
  {
    "code": "URO_EVALUACION_BASE",
    "name": "Evaluación urológica",
    "specialty": "UROLOGIA",
    "provenance": {
      "sourceTitle": "Norma Técnica de Salud para la Gestión de la Historia Clínica — NT N.º 022-MINSA/DGSP-V.02, anamnesis y examen del aparato genitourinario",
      "organization": "Ministerio de Salud del Perú (MINSA)",
      "url": "https://bvs.minsa.gob.pe/local/dgsp/NT022hist.pdf",
      "license": "Norma técnica estatal de acceso público",
      "sourceVersion": "V.02",
      "retrievedAt": "2026-08-14",
      "note": "De la norma sale la estructura común de la consulta: motivo, tiempo de evolución, antecedentes, examen dirigido, diagnóstico y conducta. Son agregados propios de la especialidad los síntomas del tracto urinario inferior (disuria, hematuria, nicturia, urgencia, características del chorro), los antecedentes de litiasis e infecciones urinarias, y el examen genital y el tacto rectal descritos en prosa."
    },
    "fields": [
      {
        "code": "motivo_consulta",
        "name": "Motivo de consulta",
        "dataType": "text",
        "required": true
      },
      {
        "code": "tiempo_de_evolucion",
        "name": "Tiempo de evolución",
        "dataType": "string",
        "required": true
      },
      {
        "code": "sintomas_del_tracto_urinario_inferior",
        "name": "Síntomas del tracto urinario inferior",
        "dataType": "text",
        "required": false
      },
      {
        "code": "disuria",
        "name": "Disuria",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "hematuria",
        "name": "Hematuria",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "nicturia",
        "name": "Episodios de nicturia por noche",
        "dataType": "integer",
        "required": false
      },
      {
        "code": "urgencia_miccional",
        "name": "Urgencia miccional",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "caracteristicas_del_chorro_miccional",
        "name": "Características del chorro miccional",
        "dataType": "string",
        "required": false
      },
      {
        "code": "dolor_lumbar",
        "name": "Dolor lumbar",
        "dataType": "boolean",
        "required": false
      },
      {
        "code": "antecedentes_de_litiasis",
        "name": "Antecedentes de litiasis",
        "dataType": "text",
        "required": false
      },
      {
        "code": "infecciones_urinarias_previas",
        "name": "Infecciones urinarias previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "cirugias_urologicas_previas",
        "name": "Cirugías urológicas previas",
        "dataType": "text",
        "required": false
      },
      {
        "code": "medicacion_habitual",
        "name": "Medicación habitual",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examen_genital",
        "name": "Examen genital",
        "dataType": "text",
        "required": false
      },
      {
        "code": "tacto_rectal",
        "name": "Tacto rectal (hallazgos descritos)",
        "dataType": "text",
        "required": false
      },
      {
        "code": "examenes_complementarios",
        "name": "Exámenes complementarios disponibles",
        "dataType": "text",
        "required": false
      },
      {
        "code": "diagnostico",
        "name": "Diagnóstico",
        "dataType": "text",
        "required": true
      },
      {
        "code": "conducta",
        "name": "Conducta",
        "dataType": "text",
        "required": false
      }
    ]
  }
];
