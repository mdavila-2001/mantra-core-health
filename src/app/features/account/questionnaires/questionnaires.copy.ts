/** The patient's «no surveys yet» S3: one source for the view state and the template. */
export const NO_SURVEYS = {
  title: 'Todavía no tiene encuestas',
  description:
    'Las encuestas llegan después de una cita médica o de un servicio que ya se completó: cuando el profesional cierra la atención, aquí le aparece una para que nos cuente cómo le fue. Responderla es voluntario y toma unos minutos.',
  action: 'Ver mis citas',
} as const;
