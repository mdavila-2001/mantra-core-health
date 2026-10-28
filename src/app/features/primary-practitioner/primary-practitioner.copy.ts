import { HttpErrorResponse } from '@angular/common/http';

/**
 * Los textos del médico de cabecera, en un solo lugar.
 *
 * Están escritos para quien no conoce el término: la explicación dice qué es
 * en una frase, sin jerga, y recuerda que se puede cambiar. El trato es de
 * usted, como el resto de las pantallas del paciente.
 */
export const COPY = {
  titulo: 'Médico de cabecera',
  queEs:
    'Su médico de cabecera es el profesional de confianza que sigue su salud de cerca. ' +
    'Puede cambiarlo o quitarlo cuando quiera.',
  elegir: 'Elegir como mi médico de cabecera',
  quitar: 'Dejar de tenerlo como médico de cabecera',
  noAcepta: 'Este profesional no está recibiendo pacientes nuevos por ahora.',
  noDisponible: 'Este profesional ya no está disponible para elegirlo.',
  sinMedico: 'Todavía no eligió un médico de cabecera.',
  buscar: 'Buscar en la guía de médicos',
  verFicha: 'Ver su ficha',
  errorAlGuardar: 'No pudimos guardar su médico de cabecera.',
} as const;

/** El nombre a mostrar, con un genérico si la API no lo trae. */
export function displayNameOf(practitioner: { readonly displayName?: string | null }): string {
  const name = practitioner.displayName?.trim();
  return name === undefined || name === '' ? 'Su médico' : name;
}

/**
 * Los `reason` de la API que dicen que la cuenta **no es de paciente**: sin
 * perfil de paciente o sin persona vinculada. Ahí no hay nada que ofrecer.
 */
const NOT_A_PATIENT_REASONS: ReadonlySet<string> = new Set([
  'PATIENT_PROFILE_NOT_FOUND',
  'ACCOUNT_WITHOUT_LINKED_PERSON',
]);

/**
 * Si el fallo dice que la cuenta no es de paciente, y entonces el bloque no se
 * dibuja en vez de mostrar un error que la persona no puede resolver.
 *
 * Decide por el `reason` del cuerpo y **no por el estado HTTP**: un 404 de un
 * proxy, o de una API que todavía no tiene la ruta, tiene que verse como el
 * error que es, no esconder la función en silencio.
 */
export function isNotPatient(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  const cuerpo: unknown = error.error;
  if (typeof cuerpo !== 'object' || cuerpo === null) return false;
  const reason = (cuerpo as Record<string, unknown>)['reason'];
  return typeof reason === 'string' && NOT_A_PATIENT_REASONS.has(reason);
}

/** El estado HTTP de un fallo, o `null` si no fue una respuesta HTTP. */
export function httpStatusOf(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}
