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
  sinMedico: 'Todavía no eligió un médico de cabecera.',
  buscar: 'Buscar en la guía de médicos',
  verFicha: 'Ver su ficha',
  errorAlLeer: 'No pudimos consultar su médico de cabecera.',
  errorAlGuardar: 'No pudimos guardar su médico de cabecera.',
  reintentar: 'Reintentar',
} as const;

/** El nombre a mostrar, con un genérico si la API no lo trae. */
export function nombreDe(medico: { readonly displayName?: string | null }): string {
  const nombre = medico.displayName?.trim();
  return nombre === undefined || nombre === '' ? 'Su médico' : nombre;
}

/**
 * Si el fallo dice que la cuenta **no es de paciente** (404 sin perfil de
 * paciente, 422 sin persona vinculada). Ahí no hay nada que ofrecer: el bloque
 * no se dibuja, en vez de mostrar un error que la persona no puede resolver.
 */
export function noEsPaciente(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 404 || error.status === 422);
}
