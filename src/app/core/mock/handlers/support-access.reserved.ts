import { patientById, patientList } from '../fixtures/people';
import { banderasDePacientes } from '../fixtures/support-hospital-governance';

/* ============================================================================
    Pacientes **reservados**: los que tienen una bandera de restricción vigente (VIP, confidencial, familiar del personal,
    protegido; CONTRATO-GOBIERNO §3.4 `patients.flags`). Sin imports de `support-access.core` para que lo usen la agenda, la bandeja y la
    búsqueda sin armar un ciclo.

    La API no dice **por qué** un bloque es «Reservado» (un VIP, un menor, una cita fuera de ventana): manda `denialReason: 'RESERVED'`
    y el detalle solo se explica a quien llama a «¿Por qué no puedo?».
   ========================================================================== */

/** ¿Tiene el paciente alguna bandera de restricción vigente? */
export function esPacienteReservado(patientProfileId: string | undefined): boolean {
  if (patientProfileId === undefined) return false;
  const ahoraMs = Date.now();
  return (
    banderasDePacientes.filtrar(
      (b) =>
        b.patientProfileId === patientProfileId &&
        (b.validTo === undefined || new Date(b.validTo).getTime() >= ahoraMs),
    ).length > 0
  );
}

/** La etiqueta con que una cita nombra al paciente (`etiquetaDePaciente`: nombre y documento tapado). */
function etiquetaDe(id: string): string | undefined {
  const paciente = patientById(id);
  return paciente === undefined
    ? undefined
    : `${paciente.displayName} · CI ***${paciente.nationalId.slice(-3)}`;
}

/** ¿La etiqueta de una cita es la de un paciente reservado? */
export function esEtiquetaReservada(etiqueta: string): boolean {
  const reservados = new Set(banderasDePacientes.todos().map((b) => b.patientProfileId));
  if (reservados.size === 0) return false;
  return patientList
    .todos()
    .some(
      (p) => reservados.has(p.id) && esPacienteReservado(p.id) && etiquetaDe(p.id) === etiqueta,
    );
}
