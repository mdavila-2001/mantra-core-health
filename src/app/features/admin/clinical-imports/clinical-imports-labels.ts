import type { ClinicalImportEngineStatus } from '../../../core/data-access/admin-portal/clinical-imports.types';
import { motivoLegible } from '../bulk-imports/bulk-imports-labels';

/* ============================================================================
    Rótulos y avisos de «Historias clínicas masivas».

    Reutiliza de «Cargas masivas» lo que es idéntico —estados del lote, resultado
    de cada fila, tamaños y traducción de los fallos de la API— y agrega sólo lo
    propio de la historia clínica. Traducen códigos del servidor a texto; no
    deciden nada, y un código que no está acá se muestra tal cual.

    Regla de honestidad: «procesado» no es «agregado». Lo que se agregó de verdad
    lo dice el informe, fila por fila.
    ========================================================================== */

export {
  FILAS_DE_VISTA_PREVIA,
  estadoDeLote,
  estaEnCurso,
  falloDeCarga,
  frasePorLimites,
  nombreDeLote,
  resultadoDeFila,
  tamano,
  type FalloDeCarga,
  type Rotulo,
  RESULTADOS_DE_FILA,
} from '../bulk-imports/bulk-imports-labels';

const MOTIVOS_PROPIOS: Readonly<Record<string, string>> = {
  PRACTITIONER_NOT_FOUND: 'No hay un profesional con esa matrícula',
  PRACTITIONER_AMBIGUOUS: 'Más de un profesional con esa matrícula',
  DUPLICATE_COLUMN: 'Columna repetida',
  AUDIT_UNAVAILABLE: 'No se pudo dejar el rastro de auditoría',
  RUNNER_ERROR: 'El procesamiento se interrumpió',
};

/** El motivo dicho en pocas palabras; los de la carga de usuarios se reutilizan. */
export function motivoClinico(codigo: string | null | undefined): string {
  if (!codigo) return '—';
  return MOTIVOS_PROPIOS[codigo] ?? motivoLegible(codigo);
}

/** Qué sabe hacer la API con cada tipo, dicho para quien carga (no para quien programa). */
export const REGLAS_DE_LA_CARGA: readonly string[] = [
  'Cada fila se enlaza a un paciente que ya existe, por documento y fecha de nacimiento. Si no hay una única coincidencia, se rechaza: nunca se adivina.',
  'Cada código clínico se resuelve contra la terminología de la plataforma; un código que no existe se rechaza.',
  'Sólo se agrega. Un registro idéntico del mismo origen se omite y uno distinto se informa como conflicto, pero nunca se sobrescribe.',
  'El archivo no se conserva: queda el informe, sin datos clínicos.',
];

/**
 * Lo que esta instalación todavía no hace, tal como lo declara `engine`. Una
 * lista vacía quiere decir que todo está conectado, no que no se sepa.
 */
export function avisosDelMotorClinico(motor: ClinicalImportEngineStatus): readonly string[] {
  const avisos: string[] = [];
  if (!motor.resolvers.patients.connected) {
    avisos.push(
      `No se puede enlazar a los pacientes por documento y fecha de nacimiento (${motor.resolvers.patients.adapter}): toda fila queda rechazada ya en la vista previa.`,
    );
  }
  if (!motor.resolvers.codes.connected) {
    avisos.push(
      `Los códigos clínicos no se resuelven contra la terminología (${motor.resolvers.codes.adapter}): una fila con código no se puede aceptar.`,
    );
  }
  if (!motor.resolvers.practitioners.connected) {
    avisos.push(
      `Las matrículas de las notas no se resuelven (${motor.resolvers.practitioners.adapter}): una nota no se puede aceptar.`,
    );
  }
  if (!motor.writer.connected) {
    avisos.push(
      `La escritura en la historia clínica no está conectada (${motor.writer.adapter}): ningún registro se agrega todavía.`,
    );
  }
  if (!motor.audit.connected) {
    avisos.push(
      `La auditoría de escritura no está conectada (${motor.audit.adapter}): sin rastro no se escribe, así que el lote se detiene.`,
    );
  }
  return avisos;
}

/** Notas que el motor declara aunque todo esté «conectado» (por ejemplo, que es simulado o que no es durable). */
export function notasDelMotor(motor: ClinicalImportEngineStatus): readonly string[] {
  return [
    motor.persistence,
    motor.writer,
    motor.audit,
    motor.resolvers.patients,
    motor.resolvers.codes,
    motor.resolvers.practitioners,
  ].flatMap((c) => (c.note === undefined ? [] : [c.note]));
}

/** El resumen de un lote ya procesado, sin decir más de lo que dice el informe. */
export function resumenDelInformeClinico(totales: Readonly<Record<string, number>>): string {
  const total = totales['total'] ?? 0;
  const creadas = totales['CREADA'] ?? 0;
  const plural = total === 1 ? '' : 's';
  if (total === 0) return 'El informe no trae filas.';
  if (creadas === 0) return `De ${total} fila${plural}, ninguna se agregó a una historia clínica.`;
  return `De ${total} fila${plural}, ${creadas} se agregaron a historias clínicas.`;
}
