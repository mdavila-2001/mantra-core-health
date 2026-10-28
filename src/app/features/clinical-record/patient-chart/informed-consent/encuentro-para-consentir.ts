import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';

/**
 * La atención a la que se ata un consentimiento abierto desde un ítem.
 *
 * La API exige `encounterId` (UUID). Orden de preferencia: el encuentro del
 * propio ítem (la receta, la orden, el tratamiento se registraron en una
 * consulta), el del contexto (la consulta en curso que pasa el anfitrión) y la
 * cita **abierta** de la persona. Una cita ya cerrada no se elige sola: atar
 * una decisión nueva a una consulta terminada es inventar cuándo se informó.
 * Sin ninguno, `null`: el panel muestra el S3 con su próxima acción en vez de
 * un formulario que siempre fallaría.
 */
export function encuentroParaConsentir(
  ...candidatos: readonly (string | null | undefined | readonly CitaDelPaciente[])[]
): string | null {
  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      const abierta = (candidato as readonly CitaDelPaciente[]).find((c) => c.enCurso);
      if (abierta !== undefined) return abierta.id;
    } else if (typeof candidato === 'string' && candidato !== '') {
      return candidato;
    }
  }
  return null;
}
