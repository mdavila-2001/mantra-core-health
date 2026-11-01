import type { ViewStateIssue } from '../view-state/view-state.types';
import { readFieldViolations, type ApiErrorBody } from './api-error';

/**
 * Deduce a qué campo se refiere un mensaje del `ValidationPipe`.
 *
 * `class-validator` compone sus mensajes empezando por el nombre de la
 * propiedad: `"nationalId must be longer than or equal to 4 characters"`.
 */
export function fieldOf(message: string): { field?: string } {
  const match = /^([a-z][A-Za-z0-9]*)\s+\S/.exec(message);
  if (match === null) {
    return {};
  }

  const candidato = match[1];

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

  const field = typeof body.details?.['field'] === 'string' ? body.details['field'] : undefined;

  return [
    {
      ...(field === undefined ? {} : { field }),
      message: body.message,
      code: body.code,
    },
  ];
}
