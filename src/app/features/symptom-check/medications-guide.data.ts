/* ============================================================================
    Guía clínica y catálogo de medicamentos orientativos según síntomas.

    ## Propósito y respaldo clínico
    Provee recomendaciones de fármacos de primera línea y de venta libre (OTC),
    junto con advertencias y posología de referencia para alivio sintomático,
    integrado con el conocimiento del vademécum y la vitrina de farmacias.

    ## Reglas éticas y de seguridad
    - Nunca diagnostica ni reemplaza la prescripción médica formal.
    - Discrimina claramente productos de venta libre (OTC) de los que
      requieren prescripción médica obligatoria.
    - Exige posología explícita (dosis, intervalo, vía y duración máxima).
    - Frente a síntomas de alarma o emergencias, el triaje deriva a guardia
      y suspende la sugerencia de automedicación.
    ========================================================================== */

import type { Symptom } from './symptoms.data';

export interface DetailedDosage {
  readonly dosisHabitual: string;
  readonly frecuencia: string;
  readonly via: string;
  readonly duracionMaxima: string;
  readonly instrucciones: string;
}

export type PosologiaDetallada = DetailedDosage;

export interface SuggestedMedication {
  readonly id: string;
  readonly nombre: string;
  readonly generico: string;
  readonly concentracion: string;
  readonly formaFarmaceutica: string;
  readonly grupoTerapeutico: string;
  readonly atcCode: string;
  readonly requiereReceta: boolean;
  readonly sintomasClave: readonly string[];
  readonly indicacionClinica: string;
  readonly posologia: DetailedDosage;
  readonly advertencias: readonly string[];
  readonly precioReferencial: string;
}

export type MedicamentoSugerido = SuggestedMedication;

export const PHARMACOLOGICAL_CATALOG: readonly SuggestedMedication[] = [
  {
    id: 'paracetamol-500',
    nombre: 'Paracetamol 500 mg',
    generico: 'Paracetamol',
    concentracion: '500 mg',
    formaFarmaceutica: 'Comprimidos',
    grupoTerapeutico: 'Analgésico y antipirético',
    atcCode: 'N02BE01',
    requiereReceta: false,
    sintomasClave: [
      'cabeza',
      'cefalea',
      'migraña',
      'fiebre',
      'malestar',
      'cuerpo',
      'gripe',
      'resfrio',
      'garganta',
      'dental',
      'muela',
      'vacuna',
    ],
    indicacionClinica:
      'Alivio sintomático del dolor de cabeza, dolor corporal, molestias de resfrío y control de fiebre.',
    posologia: {
      dosisHabitual: '500 mg a 1000 mg (1 o 2 comprimidos)',
      frecuencia: 'Cada 6 a 8 horas según necesidad (máximo 4 g/día en adultos)',
      via: 'Oral con abundante agua',
      duracionMaxima: 'No prolongar más de 3 días para fiebre ni 5 días para dolor',
      instrucciones: 'Se puede tomar con o sin alimentos. Evitar consumo de alcohol.',
    },
    advertencias: [
      'No combinar con otros preparados que contengan paracetamol para evitar toxicidad hepática.',
      'En caso de enfermedad hepática o renal previa, consulte a su médico.',
    ],
    precioReferencial: 'Desde 5.00 BOB en farmacias de la red',
  },
  {
    id: 'ibuprofeno-400',
    nombre: 'Ibuprofeno 400 mg',
    generico: 'Ibuprofeno',
    concentracion: '400 mg',
    formaFarmaceutica: 'Comprimidos recubiertos',
    grupoTerapeutico: 'Antiinflamatorio no esteroideo (AINE)',
    atcCode: 'M01AE01',
    requiereReceta: false,
    sintomasClave: [
      'cabeza',
      'migraña',
      'espalda',
      'lumbar',
      'muscular',
      'articular',
      'rodilla',
      'cuello',
      'garganta',
      'inflamacion',
      'menstruacion',
      'muela',
      'golpe',
    ],
    indicacionClinica:
      'Antiinflamatorio y analgésico de acción rápida para inflamación muscular, dolores articulares, lumbalgia y cólicos.',
    posologia: {
      dosisHabitual: '400 mg (1 comprimido)',
      frecuencia: 'Cada 8 horas (máximo 1200 mg/día en automedicación)',
      via: 'Oral, preferentemente después de las comidas',
      duracionMaxima: 'Máximo 4 a 5 días consecutivos',
      instrucciones: 'Tomar siempre con alimentos o leche para proteger la mucosa gástrica.',
    },
    advertencias: [
      'Evitar en personas con antecedentes de úlcera gástrica o hemorragia digestiva.',
      'Usar con precaución en personas con hipertensión o insuficiencia renal.',
    ],
    precioReferencial: 'Desde 7.50 BOB en farmacias de la red',
  },
  {
    id: 'loratadina-10',
    nombre: 'Loratadina 10 mg',
    generico: 'Loratadina',
    concentracion: '10 mg',
    formaFarmaceutica: 'Comprimidos',
    grupoTerapeutico: 'Antihistamínico H1 no sedante',
    atcCode: 'R06AX13',
    requiereReceta: false,
    sintomasClave: [
      'alergia',
      'rinitis',
      'congestion',
      'estornudos',
      'picazon',
      'ojos',
      'ronchas',
      'urticaria',
      'piel',
    ],
    indicacionClinica:
      'Alivio de síntomas de rinitis alérgica estacional (estornudos, goteo nasal, prurito) y urticaria.',
    posologia: {
      dosisHabitual: '10 mg (1 comprimido)',
      frecuencia: '1 vez al día (cada 24 horas)',
      via: 'Oral, independiente de las comidas',
      duracionMaxima: '5 a 7 días consecutivos para episodios agudos',
      instrucciones: 'Tomar preferentemente por la mañana con un vaso de agua.',
    },
    advertencias: [
      'No combinar con alcohol ni sedantes centrales.',
      'Si hay dificultad respiratoria, hinchazón de labios o lengua, acudir inmediatamente a urgencias.',
    ],
    precioReferencial: 'Desde 6.00 BOB en farmacias de la red',
  },
  {
    id: 'omeprazol-20',
    nombre: 'Omeprazol 20 mg',
    generico: 'Omeprazol',
    concentracion: '20 mg',
    formaFarmaceutica: 'Cápsulas gastrorresistentes',
    grupoTerapeutico: 'Inhibidor de la bomba de protones (IBP)',
    atcCode: 'A02BC01',
    requiereReceta: false,
    sintomasClave: [
      'acidez',
      'ardor',
      'reflujo',
      'estomago',
      'panza',
      'gastritis',
      'agruras',
      'pesadez',
      'digestion',
    ],
    indicacionClinica:
      'Alivio de los síntomas de reflujo gastroesofágico, ardor estomacal frecuente y pesadez ácida.',
    posologia: {
      dosisHabitual: '20 mg (1 cápsula)',
      frecuencia: '1 vez al día (cada 24 horas), por la mañana',
      via: 'Oral en ayunas, 30 minutos antes del desayuno',
      duracionMaxima: 'Hasta 14 días consecutivos',
      instrucciones: 'Tragar la cápsula entera con agua; no abrir ni masticar los gránulos.',
    },
    advertencias: [
      'Si el ardor persiste tras 1 semana o se acompaña de dificultad para tragar, consulte a un gastroenterólogo.',
      'No está indicado para alivio instantáneo de un dolor estomacal puntual.',
    ],
    precioReferencial: 'Desde 8.50 BOB en farmacias de la red',
  },
  {
    id: 'sales-rehidratacion-oms',
    nombre: 'Sales de Rehidratación Oral (SRO)',
    generico: 'Sales de rehidratación oral glucosiladas',
    concentracion: 'Sobre para 1 litro de agua',
    formaFarmaceutica: 'Polvo para solución oral',
    grupoTerapeutico: 'Electrolitos para rehidratación (OMS)',
    atcCode: 'A07CA',
    requiereReceta: false,
    sintomasClave: [
      'diarrea',
      'vomito',
      'deshidratacion',
      'gastroenteritis',
      'nauseas',
      'liquidos',
      'sed',
    ],
    indicacionClinica:
      'Prevención y tratamiento de la deshidratación por pérdida de líquidos en cuadros diarreicos y vómitos.',
    posologia: {
      dosisHabitual: '200 a 400 ml tras cada deposición líquida en adultos',
      frecuencia: 'A demanda, bebiendo en pequeños sorbos espaciados',
      via: 'Oral en solución',
      duracionMaxima: 'Durante el cuadro diarreico activo',
      instrucciones: 'Disolver el sobre entero en 1 litro de agua potable hervida fría. Descartar tras 24 horas.',
    },
    advertencias: [
      'No agregar azúcar ni jugos a la solución preparada.',
      'Acudir de urgencia si hay sangre en las deposiciones, vómitos incoercibles o mareo severo.',
    ],
    precioReferencial: 'Desde 3.50 BOB en farmacias de la red',
  },
  {
    id: 'ambroxol-jarabe-30',
    nombre: 'Ambroxol 30 mg / 5 ml Jarabe',
    generico: 'Ambroxol hidrocloruro',
    concentracion: '30 mg por cada 5 ml',
    formaFarmaceutica: 'Jarabe oral',
    grupoTerapeutico: 'Mucolítico y expectorante',
    atcCode: 'R05CB06',
    requiereReceta: false,
    sintomasClave: [
      'tos',
      'flema',
      'catarro',
      'congestion-pecho',
      'mucosidad',
      'bronquios',
    ],
    indicacionClinica:
      'Fluidifica las secreciones bronquiales y facilita la expectoración en procesos catarrales y gripales.',
    posologia: {
      dosisHabitual: '10 ml (60 mg) por toma en adultos',
      frecuencia: 'Cada 8 a 12 horas después de comer',
      via: 'Oral con vaso dosificador',
      duracionMaxima: 'Máximo 5 días sin indicación médica',
      instrucciones: 'Acompañar con abundante consumo de agua a lo largo del día.',
    },
    advertencias: [
      'No combinar con medicamentos que inhiban el reflejo de la tos (antitusígenos centrales).',
      'Consulte a un médico si la tos dura más de una semana o se acompaña de fiebre alta.',
    ],
    precioReferencial: 'Desde 14.00 BOB en farmacias de la red',
  },
  {
    id: 'salbutamol-100',
    nombre: 'Salbutamol 100 mcg Aerosol',
    generico: 'Salbutamol (Albuterol)',
    concentracion: '100 mcg / dosis',
    formaFarmaceutica: 'Inhalador presurizado',
    grupoTerapeutico: 'Broncodilatador de acción corta',
    atcCode: 'R03AC02',
    requiereReceta: true,
    sintomasClave: [
      'falta-de-aire',
      'silbido',
      'pecho-apretado',
      'asma',
      'broncoespasmo',
      'dificultad-respirar',
    ],
    indicacionClinica:
      'Alivio rápido del broncoespasmo en asma y afecciones obstructivas reversibles de vías respiratorias.',
    posologia: {
      dosisHabitual: '1 o 2 inhalaciones (100 a 200 mcg) según pauta médica',
      frecuencia: 'Cada 6 a 8 horas ante crisis de disnea (máximo 8 inhalaciones en 24 h)',
      via: 'Inhalatoria bucal, preferentemente con aerocámara',
      duracionMaxima: 'Uso de rescate según prescripción médica',
      instrucciones: 'Agitar enérgicamente antes de cada aplicación. Enjuagar la boca con agua tras usar.',
    },
    advertencias: [
      'Medicamento sujeto a prescripción y control médico.',
      'Si la dificultad para respirar no cede de inmediato, acuda a un centro de urgencias.',
    ],
    precioReferencial: 'Desde 28.00 BOB en farmacias de la red',
  },
  {
    id: 'amoxicilina-500',
    nombre: 'Amoxicilina 500 mg Cápsulas',
    generico: 'Amoxicilina',
    concentracion: '500 mg',
    formaFarmaceutica: 'Cápsulas',
    grupoTerapeutico: 'Antibiótico betalactámico',
    atcCode: 'J01CA04',
    requiereReceta: true,
    sintomasClave: [
      'infeccion',
      'amigdalitis',
      'placas',
      'otitis',
      'oido',
      'sinusitis',
    ],
    indicacionClinica:
      'Tratamiento de infecciones bacterianas agudas respiratorias, otorrinolaringológicas y dentales confirmadas.',
    posologia: {
      dosisHabitual: '500 mg (1 cápsula)',
      frecuencia: 'Cada 8 horas en horarios exactos',
      via: 'Oral con un vaso entero de agua',
      duracionMaxima: '7 a 10 días según prescripción médica completa',
      instrucciones: 'Completar todo el tratamiento antibiótico aunque los síntomas hayan remitido.',
    },
    advertencias: [
      'Venta bajo receta médica archivada. El mal uso genera resistencia bacteriana.',
      'Estrictamente contraindicado en personas alérgicas a penicilinas o betalactámicos.',
    ],
    precioReferencial: 'Desde 12.00 BOB en farmacias de la red',
  },
];

export const CATALOGO_FARMACOLOGICO = PHARMACOLOGICAL_CATALOG;

/**
 * Cruza los síntomas reconocidos con el catálogo farmacológico y devuelve
 * los medicamentos más pertinentes ordenados por relevancia clínica.
 */
export function recommendMedications(
  sintomas: readonly Symptom[],
): readonly SuggestedMedication[] {
  if (sintomas.length === 0) {
    // Si no hay síntomas específicos detectados, se ofrece Paracetamol e Ibuprofeno como analgesia/soporte base.
    return [PHARMACOLOGICAL_CATALOG[0]!, PHARMACOLOGICAL_CATALOG[1]!];
  }

  // Prepara los tokens/lemas de los síntomas del usuario
  const palabrasUsuario = new Set<string>();
  for (const s of sintomas) {
    palabrasUsuario.add(s.id.toLowerCase());
    for (const token of s.nombre.toLowerCase().split(/[\s-]+/)) {
      if (token.length >= 3) {
        palabrasUsuario.add(token);
      }
    }
  }

  const puntuados: { med: SuggestedMedication; score: number }[] = [];

  for (const med of PHARMACOLOGICAL_CATALOG) {
    let score = 0;
    for (const clave of med.sintomasClave) {
      for (const palabra of palabrasUsuario) {
        if (palabra.includes(clave) || clave.includes(palabra)) {
          score += 2;
        }
      }
    }

    if (score > 0) {
      // Priorizar venta libre sobre medicamentos bajo receta para orientación sintomática
      if (!med.requiereReceta) {
        score += 1;
      }
      puntuados.push({ med, score });
    }
  }

  if (puntuados.length === 0) {
    // Si no coincidió con nada específico, devolver los analgésicos/antipiréticos de primera línea
    return [PHARMACOLOGICAL_CATALOG[0]!, PHARMACOLOGICAL_CATALOG[1]!];
  }

  puntuados.sort((a, b) => b.score - a.score);

  // Retorna hasta 4 medicamentos relevantes sin duplicados
  return puntuados.slice(0, 4).map((item) => item.med);
}

export const recomendarMedicamentos = recommendMedications;
