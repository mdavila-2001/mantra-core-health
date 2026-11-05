import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';

/**
 * La atención a la que se ata un consentimiento abierto desde un ítem.
 *
 * La API exige `encounterId` (UUID). Orden de preferencia: el encuentro del
 * propio ítem (la receta, la orden, el tratamiento se registraron en una
 * consulta), el del contexto (la consulta en curso que pasa el anfitrión) y la
 * cita **abierta** de la persona. Una cita ya cerrada no se elige sola: atar
 * una decisión nueva a una consulta terminada es inventar cuándo se informó.
 * Sin ninguno, `null`: el panel muestra el S3 «Falta la atención» con su
 * próxima acción en vez de un formulario que siempre fallaría.
 */
export function consentEncounter(
  ...candidates: readonly (string | null | undefined | readonly CitaDelPaciente[])[]
): string | null {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const open = (candidate as readonly CitaDelPaciente[]).find((c) => c.enCurso);
      if (open !== undefined) return open.id;
    } else if (typeof candidate === 'string' && candidate !== '') {
      return candidate;
    }
  }
  return null;
}
