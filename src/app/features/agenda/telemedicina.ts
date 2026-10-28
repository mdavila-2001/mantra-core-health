import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, signal, untracked, type Signal } from '@angular/core';

import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';

import type {
  PublishedRule,
  PublishedTemplate,
} from '@core/data-access/scheduling/scheduling.types';
import { readApiError, type ApiErrorBody } from '@core/http/api-error';
import { supportCodeOf } from '@core/http/api-failure';

/**
 * Telemedicina por franja del horario de atención.
 *
 * Cada franja (`schedule_rules`) declara si admite teleconsulta con
 * `telemedicineEnabled`; **ausente ≡ no**. La API rechaza con 422
 * `TELEMEDICINE_NOT_ENABLED` la cita directa por `TELECONSULTA` cuyo inicio no
 * cae en una franja vigente con telemedicina.
 *
 * ## Lo que esto es y lo que no
 *
 * Es el **aviso temprano**: con las franjas que la pantalla ya tiene cargadas,
 * dice antes de guardar que la teleconsulta no va a pasar. No es la regla —la
 * regla es la del servidor—, por eso las pantallas que no tienen las franjas a
 * mano pasan `null` y no avisan nada en vez de adivinar.
 *
 * Vive suelto y no dentro de una pantalla porque lo usan dos: la cita nueva y
 * la tarjeta del día. Dos copias del mismo cálculo terminan dando dos
 * respuestas para la misma hora.
 */

/** El `reason` con el que la API rechaza la teleconsulta fuera de franja. */
export const TELEMEDICINE_NOT_ENABLED = 'TELEMEDICINE_NOT_ENABLED';

/** Lo que se le dice a la persona cuando la teleconsulta no cae en una franja habilitada. */
export const MENSAJE_SIN_TELEMEDICINA =
  'Esa hora no está en una franja de su horario habilitada para telemedicina. ' +
  'Elija otra modalidad u otra hora, o active «Atiende por telemedicina» en esa franja desde «Cambiar mi horario».';

/**
 * Una franja con la vigencia de su plantilla, en días `YYYY-MM-DD` (inclusive).
 * Es lo que mira la API: una franja de un horario que todavía no empezó o que
 * ya venció no admite nada.
 */
export interface FranjaVigente extends PublishedRule {
  readonly desdeDia?: string;
  readonly hastaDia?: string;
}

/** Si la franja admite teleconsulta. Ausente ≡ no. */
export function franjaConTelemedicina(regla: PublishedRule): boolean {
  return regla.telemedicineEnabled === true;
}

/**
 * Las franjas de los horarios **vigentes** del recurso: las de toda plantilla
 * no retirada, que es el mismo recorte que hace la API.
 */
export function franjasVigentes(
  plantillas: readonly PublishedTemplate[],
): readonly FranjaVigente[] {
  return plantillas
    .filter((plantilla) => !plantilla.retired)
    .flatMap((p) =>
      p.rules.map((regla) => ({
        ...regla,
        ...(p.validFrom === undefined ? {} : { desdeDia: p.validFrom.slice(0, 10) }),
        ...(p.validTo === undefined ? {} : { hastaDia: p.validTo.slice(0, 10) }),
      })),
    );
}

/**
 * Si el instante cae dentro de alguna franja con telemedicina.
 *
 * La franja es de pared —«los lunes de 9 a 13»— y el instante se lee en la
 * hora local del navegador, que es la de la sede. El fin es exclusivo: una
 * franja que termina 13:00 no admite una cita que empieza 13:00.
 */
export function teleconsultaPermitidaEn(
  franjas: readonly FranjaVigente[],
  instante: Date,
): boolean {
  const dia = instante.getDay();
  const fecha = diaIso(instante);
  const minuto = instante.getHours() * 60 + instante.getMinutes();
  return franjas.some(
    (regla) =>
      franjaConTelemedicina(regla) &&
      regla.dayOfWeek === dia &&
      (regla.desdeDia === undefined || regla.desdeDia <= fecha) &&
      (regla.hastaDia === undefined || fecha <= regla.hastaDia) &&
      minutosDe(regla.startTime) <= minuto &&
      minuto < minutosDe(regla.endTime),
  );
}

/**
 * El texto para el rechazo `TELEMEDICINE_NOT_ENABLED`, con el código de
 * soporte cuando lo hay; `null` si el error es otro.
 *
 * El motivo viene en el primer nivel del cuerpo (`reason`, donde lo pone el
 * filtro de excepciones de la API); por tolerancia se mira también
 * `details.reason`, que es donde lo ponían los rechazos más viejos.
 */
export function rechazoPorTelemedicina(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) return null;
  const body: ApiErrorBody | null = readApiError(error);
  const crudo: unknown = error.error;
  const enPrimerNivel =
    typeof crudo === 'object' && crudo !== null && 'reason' in crudo ? crudo.reason : undefined;
  const motivo = enPrimerNivel ?? body?.details?.['reason'];
  if (motivo !== TELEMEDICINE_NOT_ENABLED) return null;
  const soporte = supportCodeOf(error, body);
  return soporte === null
    ? MENSAJE_SIN_TELEMEDICINA
    : `${MENSAJE_SIN_TELEMEDICINA} (Código de soporte: ${soporte})`;
}

/** El día local del instante en `YYYY-MM-DD`. */
function diaIso(instante: Date): string {
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${instante.getFullYear()}-${mes}-${dia}`;
}

/**
 * El aviso temprano de una pantalla que elige agenda, hora y modalidad: el
 * texto de {@link MENSAJE_SIN_TELEMEDICINA} cuando la teleconsulta pedida cae
 * fuera de toda franja vigente con telemedicina, o `null`.
 *
 * Las franjas se leen **sólo cuando se pide teleconsulta** —es la única
 * modalidad que las necesita— y se recuerdan por agenda. Si la lectura falla no
 * se avisa nada: el servidor sigue rechazando con su 422, y ése sí se muestra.
 * Un aviso adivinado sería peor que ninguno.
 *
 * Crea un `effect`: se llama en un contexto de inyección (inicializador de campo).
 *
 * @param pideTeleconsulta - Si la cita que se arma es una teleconsulta que la API valida.
 */
export function avisoDeTeleconsulta(
  scheduling: SchedulingClient,
  agenda: () => string | null,
  comienza: () => Date | null,
  pideTeleconsulta: () => boolean,
): Signal<string | null> {
  const leidas = signal<{ agenda: string; franjas: readonly FranjaVigente[] } | null>(null);
  effect((onCleanup) => {
    const id = agenda();
    if (id === null || !pideTeleconsulta() || untracked(leidas)?.agenda === id) return;
    const lectura = scheduling.listTemplates(id).subscribe({
      next: (pagina) => leidas.set({ agenda: id, franjas: franjasVigentes(pagina.items) }),
      error: () => leidas.set(null),
    });
    onCleanup(() => lectura.unsubscribe());
  });
  return computed(() => {
    const conocidas = leidas();
    const cuando = comienza();
    const fuera =
      pideTeleconsulta() &&
      cuando !== null &&
      conocidas !== null &&
      conocidas.agenda === agenda() &&
      !teleconsultaPermitidaEn(conocidas.franjas, cuando);
    return fuera ? MENSAJE_SIN_TELEMEDICINA : null;
  });
}

/** `09:30` o `09:30:00` → 570. */
function minutosDe(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}
