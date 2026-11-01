import type { ViewStateIssue } from '../view-state/view-state.types';
import { readFieldViolations, type ApiErrorBody } from './api-error';

/**
 * Deduce a qué campo se refiere un mensaje del `ValidationPipe`.
 *
 * `class-validator` compone sus mensajes empezando por el nombre de la
 * propiedad: `"nationalId must be longer than or equal to 4 characters"`,
 * `"email must be an email"`. Es una convención del backend, no un contrato, y
 * por eso el reconocimiento es **conservador**: solo se acepta si la primera
 * palabra es un identificador en `camelCase` y va seguida de otra.
 */
export function fieldOf(message: string): { field?: string } {
  const match = /^([a-z][A-Za-z0-9]*)\s+\S/.exec(message);
  if (match === null) {
    return {};
  }

  const candidato = match[1];

  // Palabras corrientes que abren una frase en inglés y no son un campo. Sin
  // esto, «each value must be…» anclaría al campo «each».
  const PALABRAS_COMUNES = new Set([
    'each', 'all', 'the', 'this', 'that', 'value', 'property', 'nested',
    'must', 'should', 'cannot', 'unexpected', 'invalid',
  ]);

  return PALABRAS_COMUNES.has(candidato.toLowerCase()) ? {} : { field: candidato };
}

/**
 * Convierte los detalles de validación en problemas por campo.
 */
export function issuesOf(body: ApiErrorBody): readonly ViewStateIssue[] {
  // Primero la forma estructurada (`details.fields`, desde el 2026-10-08): trae
  // la ruta exacta del campo, incluidos los anidados, y no hay que adivinarla.
  const fields = readFieldViolations(body);
  if (fields.length > 0) {
    return fields.flatMap(({ field, messages }) =>
      (messages.length > 0 ? messages : [body.message]).map((message) => ({ field, message, code: body.code })),
    );
  }

  const messages = body.details?.['violations'] ?? body.details?.['messages'];

  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .filter((item): item is string => typeof item === 'string')
      .map((message) => ({ ...fieldOf(message), message, code: body.code }));
  }

  // El `ValidationPipe` no fue: `details` puede traer el campo por su cuenta.
  const field = typeof body.details?.['field'] === 'string' ? body.details['field'] : undefined;

  return [
    {
      ...(field === undefined ? {} : { field }),
      message: body.message,
      code: body.code,
    },
  ];
}
