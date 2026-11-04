import { patientById, professionalById } from '../fixtures/people';
import { notFound, preconditionFailed, reply, validation, type MockRouter } from '../mock-router';
import { Coleccion, ahora, cuerpo, nuevoId, uuid } from '../mock-store';
import { IDS } from '../mock-session';
import { pacienteDeSesion } from './profiles.handlers';

/* ============================================================================
    El médico de cabecera (28/10/2026), para la maqueta y el sitio demo.

    Es un DOBLE del contrato de la API (`/profiles/patients/me/primary-practitioner`
    y `/profiles/practitioners/me/primary-patients`): mismas formas y mismas
    reglas visibles —una sola elección vigente por paciente, elegir al vigente
    no cambia nada, quien no recibe pacientes nuevos no se puede elegir—. No
    prueba la API: la prueba de la API está en su repo.
    ========================================================================== */

interface EleccionSimulada {
  readonly id: string;
  readonly pacienteId: string;
  readonly profesionalId: string;
  readonly desde: string;
  readonly hasta?: string;
}

const elecciones = new Coleccion<EleccionSimulada>([
  { id: uuid('eleccion-ana'), pacienteId: IDS.paciente.patientProfileId, profesionalId: IDS.medica.practitionerProfileId, desde: '2026-01-15T08:00:00Z' },
  { id: uuid('eleccion-mamani'), pacienteId: uuid('pid-p-mamani'), profesionalId: IDS.medica.practitionerProfileId, desde: '2026-03-10T14:30:00Z' },
], 'primary-practitioner');

const currentOf = (pacienteId: string) =>
  elecciones.todos().find((e) => e.pacienteId === pacienteId && e.hasta === undefined);

function respuesta(pacienteId: string) {
  const e = currentOf(pacienteId);
  if (e === undefined) return { current: null };
  const doctor = professionalById(e.profesionalId);
  return {
    current: {
      practitionerProfileId: e.profesionalId,
      ...(doctor ? { displayName: doctor.displayName, professionalTitle: doctor.professionalTitle } : {}),
      since: e.desde,
    },
  };
}

/** El 404 de la API para una cuenta sin perfil de paciente, con su `reason`. */
const noPatientProfile = () =>
  reply(404, {
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Paciente no encontrado',
    reason: 'PATIENT_PROFILE_NOT_FOUND',
  });

function cerrar(e: EleccionSimulada): void {
  elecciones.actualizar(e.id, { hasta: ahora() });
}

export function registerPrimaryPractitioner(router: MockRouter): void {
  router.get('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    return p === undefined ? noPatientProfile() : respuesta(p.id);
  });

  router.put('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return noPatientProfile();
    const id = cuerpo<{ practitionerProfileId: unknown }>(request).practitionerProfileId;
    if (typeof id !== 'string' || id === '') {
      return validation('Error de validación', [
        { field: 'practitionerProfileId', message: 'must be a UUID' },
      ]);
    }
    const actual = currentOf(p.id);
    if (actual?.profesionalId === id) return respuesta(p.id);
    const doctor = professionalById(id);
    if (doctor === undefined) return notFound('Profesional no encontrado');
    if (!doctor.acceptsNewPatients) {
      return preconditionFailed('Este profesional no está aceptando pacientes nuevos.');
    }
    if (actual) cerrar(actual);
    elecciones.agregar({ id: nuevoId('cabecera'), pacienteId: p.id, profesionalId: id, desde: ahora() });
    return respuesta(p.id);
  });

  router.delete('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return noPatientProfile();
    const actual = currentOf(p.id);
    if (actual) cerrar(actual);
    return respuesta(p.id);
  });

  router.get('/profiles/practitioners/me/primary-patients', (request) => {
    const yo = request.user?.practitionerProfileId;
    if (yo === undefined || professionalById(yo) === undefined) {
      return preconditionFailed('La cuenta no tiene perfil profesional');
    }
    const limit = Number(request.query.get('limit') ?? 50);
    const offset = Number(request.query.get('offset') ?? 0);
    const mias = elecciones
      .todos()
      .filter((e) => e.profesionalId === yo && e.hasta === undefined)
      .sort((a, b) => b.desde.localeCompare(a.desde));
    return {
      items: mias.slice(offset, offset + limit).map((e) => {
        const patient = patientById(e.pacienteId);
        return {
          patientProfileId: e.pacienteId,
          ...(patient ? { displayName: patient.displayName, patientCode: patient.patientCode } : {}),
          since: e.desde,
        };
      }),
      total: mias.length,
      limit,
      offset,
    };
  });
}
