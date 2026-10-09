import type { fakerES } from '@faker-js/faker';

import { DIAGNOSIS, MEDICAMENTO, OBSERVATION, SEVERITY, UNIDAD, VIA } from '../fixtures/concepts';

/* ============================================================================
    Datos clínicos plausibles.

    La regla de este archivo es una sola, y es la misma que documenta
    `demo-presets.ts`: **todo código sale del catálogo**. Un CIE-10 o un ATC
    inventado no es un dato «casi bueno», es un dato que la pantalla no puede
    resolver: los selectores de terminología buscan el concepto por id y, si no
    está, muestran el hueco o revientan. Por eso acá no se escribe ningún
    código a mano; se eligen de `fixtures/concepts.ts`.

    Lo segundo es la verosimilitud numérica. Una presión de 400/12 o un peso de
    900 kg pasan cualquier validación de tipo y sin embargo delatan la
    maqueta en la primera captura de pantalla. Los rangos de acá son los
    fisiológicos, con la variación que corresponde a la edad.
    ========================================================================== */

type Faker = typeof fakerES;

/** Los códigos del catálogo, en el orden en que se declararon. */
export const DX_CODES = Object.keys(DIAGNOSIS);
export const MED_CODES = Object.keys(MEDICAMENTO);

export function diagnosisId(f: Faker): string {
  return DIAGNOSIS[f.helpers.arrayElement(DX_CODES)]!;
}

export function medicationId(f: Faker): string {
  return MEDICAMENTO[f.helpers.arrayElement(MED_CODES)]!;
}

export function viaId(f: Faker): string {
  return VIA[f.helpers.arrayElement(Object.keys(VIA))]!;
}

export function unitId(f: Faker): string {
  return UNIDAD[f.helpers.arrayElement(Object.keys(UNIDAD))]!;
}

export function severityId(f: Faker): string {
  return SEVERITY[f.helpers.arrayElement(Object.keys(SEVERITY))]!;
}

/** Edad en años a partir de una fecha de nacimiento `YYYY-MM-DD`. */
export function ageOf(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento);
  const ahora = new Date();
  let edad = ahora.getFullYear() - nacimiento.getFullYear();
  const mes = ahora.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && ahora.getDate() < nacimiento.getDate())) edad -= 1;
  return Math.max(0, edad);
}

export interface SignVital {
  readonly observationConceptId: string;
  readonly value: string;
  readonly unitConceptId: string;
}

/**
 * Los signos vitales de una consulta, coherentes con la edad.
 *
 * Un lactante no pesa 70 kg ni tiene 60 pulsaciones. Que los números salgan
 * del tramo de edad es lo que separa una demostración de una tabla de relleno:
 * las pantallas de expediente pintan curvas y percentiles con esto.
 */
export function vitalSigns(f: Faker, edad: number): readonly SignVital[] {
  const bebe = edad < 2;
  const nino = edad < 12;
  const mayor = edad >= 65;

  const sistolica = bebe
    ? f.number.int({ min: 72, max: 100 })
    : nino
      ? f.number.int({ min: 90, max: 112 })
      : mayor
        ? f.number.int({ min: 118, max: 165 })
        : f.number.int({ min: 100, max: 142 });
  const diastolica = Math.round(sistolica * f.number.float({ min: 0.6, max: 0.68, fractionDigits: 2 }));
  const pulso = bebe
    ? f.number.int({ min: 100, max: 150 })
    : nino
      ? f.number.int({ min: 80, max: 115 })
      : f.number.int({ min: 58, max: 96 });
  const peso = bebe
    ? f.number.float({ min: 3.2, max: 12, fractionDigits: 1 })
    : nino
      ? f.number.float({ min: 12, max: 45, fractionDigits: 1 })
      : f.number.float({ min: 48, max: 108, fractionDigits: 1 });
  const talla = bebe
    ? f.number.int({ min: 49, max: 88 })
    : nino
      ? f.number.int({ min: 88, max: 152 })
      : f.number.int({ min: 150, max: 190 });
  const imc = peso / (talla / 100) ** 2;

  return [
    { observationConceptId: OBSERVATION['OBS-BP-SYS']!, value: String(sistolica), unitConceptId: UNIDAD['UNIT-MG']! },
    { observationConceptId: OBSERVATION['OBS-BP-DIA']!, value: String(diastolica), unitConceptId: UNIDAD['UNIT-MG']! },
    { observationConceptId: OBSERVATION['OBS-HR']!, value: String(pulso), unitConceptId: UNIDAD['UNIT-MG']! },
    {
      observationConceptId: OBSERVATION['OBS-TEMP']!,
      value: f.number.float({ min: 36, max: 37.8, fractionDigits: 1 }).toFixed(1),
      unitConceptId: UNIDAD['UNIT-MG']!,
    },
    { observationConceptId: OBSERVATION['OBS-WEIGHT']!, value: peso.toFixed(1), unitConceptId: UNIDAD['UNIT-MG']! },
    { observationConceptId: OBSERVATION['OBS-HEIGHT']!, value: String(talla), unitConceptId: UNIDAD['UNIT-MG']! },
    { observationConceptId: OBSERVATION['OBS-BMI']!, value: imc.toFixed(1), unitConceptId: UNIDAD['UNIT-MG']! },
    {
      observationConceptId: OBSERVATION['OBS-SPO2']!,
      value: String(f.number.int({ min: 93, max: 99 })),
      unitConceptId: UNIDAD['UNIT-MG']!,
    },
  ];
}

/** Posología escrita como la escribe quien receta. */
export function dosage(f: Faker): string {
  const cada = f.helpers.arrayElement([6, 8, 12, 24]);
  const dias = f.helpers.arrayElement([3, 5, 7, 10, 14, 30]);
  const cantidad = f.helpers.arrayElement(['1 comprimido', '2 comprimidos', '5 ml', '10 ml', '1 aplicación']);
  return `${cantidad} cada ${cada} horas por ${dias} días`;
}

const REASONS = [
  'Control de rutina',
  'Dolor abdominal de tres días',
  'Cefalea persistente',
  'Control de presión arterial',
  'Seguimiento de diabetes',
  'Cuadro respiratorio con tos',
  'Dolor lumbar tras esfuerzo',
  'Control prenatal',
  'Erupción en la piel',
  'Chequeo anual',
  'Renovación de receta',
  'Resultados de laboratorio',
  'Mareos al levantarse',
  'Dificultad para dormir',
] as const;

export function consultationReason(f: Faker): string {
  return f.helpers.arrayElement(REASONS);
}

const NOTE_TEXTS = [
  'Paciente refiere mejoría desde la última consulta. Se mantiene el tratamiento.',
  'Persisten los síntomas. Se ajusta la dosis y se solicita control en dos semanas.',
  'Buena adherencia al tratamiento. Signos vitales dentro de parámetros.',
  'Se explica el plan de alimentación y actividad física. Se entrega material impreso.',
  'Sin cambios respecto al control anterior. Se refuerzan las indicaciones.',
  'Se solicitan estudios complementarios para descartar causa secundaria.',
  'Cuadro en resolución. Se indica reposo relativo y control si empeora.',
] as const;

export function medicalNoteText(f: Faker): string {
  return f.helpers.arrayElement(NOTE_TEXTS);
}

const TRAINING = [
  'la Universidad Mayor de San Andrés',
  'la Universidad Autónoma Gabriel René Moreno',
  'la Universidad Mayor de San Simón',
  'la Universidad San Francisco Xavier',
  'el Hospital de Clínicas de La Paz',
] as const;

const EXTENSION = [
  'con formación complementaria en el Instituto Nacional de Cardiología de México',
  'con estancia en el Hospital Italiano de Buenos Aires',
  'con posgrado en la Universidad de Chile',
  'con formación en el Hospital Clínic de Barcelona',
  'y actualización permanente en congresos de la especialidad',
] as const;

const INTERESTS = [
  'la prevención y la educación del paciente',
  'el seguimiento de enfermedades crónicas',
  'la atención de pacientes adultos mayores',
  'la salud de la mujer',
  'la atención pediátrica integral',
  'el trabajo conjunto con nutrición y salud mental',
] as const;

/**
 * La biografía de un profesional.
 *
 * No sale de `faker.lorem`: el locale sigue devolviendo latín macarrónico, que
 * en una ficha pública se ve como lo que es. Se compone de piezas escritas en
 * castellano —años, formación, interés clínico— porque estas fichas se leen.
 */
export function biography(f: Faker, titulo: string, anios: number): string {
  return (
    `${titulo} con ${anios} años de experiencia. Formación en ${f.helpers.arrayElement(TRAINING)}, ` +
    `${f.helpers.arrayElement(EXTENSION)}. Especial interés en ${f.helpers.arrayElement(INTERESTS)}.`
  );
}
