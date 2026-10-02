import type { PractitionerSpecialty } from './profiles.types';

/**
 * La especialidad con la que un profesional se presenta.
 *
 * La primaria vigente si la hay; si no, la primera vigente.
 *
 * **Vigente es una ventana, no una bandera** —mismo criterio que la matrícula
 * que firma el papel en el expediente—: sin `validTo` no caduca, y con
 * `validTo` en el futuro sigue ejerciendo. Tratar toda especialidad con fecha
 * de vencimiento como abandonada le escondería su propia ficha justo a quien
 * tiene la certificación en regla —una recertificación real declara hasta
 * cuándo vale—, y lo dejaría completando la anamnesis general. Vencida sí se
 * descarta: no debería decidir qué ficha se le ofrece hoy.
 */
export function especialidadVigente(especialidades: readonly PractitionerSpecialty[]): string | null {
  const ahora = Date.now();
  const vigentes = especialidades.filter((especialidad) =>
    dentroDeLaVentana(especialidad.validFrom, especialidad.validTo, ahora),
  );
  const principal = vigentes.find((especialidad) => especialidad.isPrimary);
  return (principal ?? vigentes[0])?.specialtyConceptId ?? null;
}

/**
 * Si una vigencia declarada cubre el instante dado.
 *
 * Los dos extremos son opcionales y la ausencia de cada uno significa «no
 * empieza» y «no termina», que es cómo el contrato declara sus ventanas.
 */
function dentroDeLaVentana(
  desde: Date | undefined,
  hasta: Date | undefined,
  instante: number,
): boolean {
  if (desde !== undefined && desde.getTime() > instante) {
    return false;
  }
  return hasta === undefined || hasta.getTime() > instante;
}
