import { patientById, professionalById } from '../fixtures/people';
import { notFound, preconditionFailed, validation, type MockRouter } from '../mock-router';
import { Coleccion, ahora, cuerpo, nuevoId } from '../mock-store';
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

const elecciones = new Coleccion<EleccionSimulada>([], 'medico-de-cabecera');

const vigenteDe = (pacienteId: string) =>
  elecciones.todos().find((e) => e.pacienteId === pacienteId && e.hasta === undefined);

function respuesta(pacienteId: string) {
  const e = vigenteDe(pacienteId);
  if (e === undefined) return { current: null };
  const medico = professionalById(e.profesionalId);
  return {
    current: {
      practitionerProfileId: e.profesionalId,
      ...(medico ? { displayName: medico.displayName, professionalTitle: medico.professionalTitle } : {}),
      since: e.desde,
    },
  };
}

function cerrar(e: EleccionSimulada): void {
  elecciones.actualizar(e.id, { hasta: ahora() });
}

export function registrarMedicoDeCabecera(router: MockRouter): void {
  router.get('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    return p === undefined ? notFound('Paciente no encontrado') : respuesta(p.id);
  });

  router.put('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('Paciente no encontrado');
    const id = cuerpo<{ practitionerProfileId: unknown }>(request).practitionerProfileId;
    if (typeof id !== 'string' || id === '') {
      return validation('Error de validación', [
        { field: 'practitionerProfileId', message: 'must be a UUID' },
      ]);
    }
    const actual = vigenteDe(p.id);
    if (actual?.profesionalId === id) return respuesta(p.id);
    const medico = professionalById(id);
    if (medico === undefined) return notFound('Profesional no encontrado');
    if (!medico.acceptsNewPatients) {
      return preconditionFailed('Este profesional no está aceptando pacientes nuevos.');
    }
    if (actual) cerrar(actual);
    elecciones.agregar({ id: nuevoId('cabecera'), pacienteId: p.id, profesionalId: id, desde: ahora() });
    return respuesta(p.id);
  });

  router.delete('/profiles/patients/me/primary-practitioner', (request) => {
    const p = pacienteDeSesion(request);
    if (p === undefined) return notFound('Paciente no encontrado');
    const actual = vigenteDe(p.id);
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
        const paciente = patientById(e.pacienteId);
        return {
          patientProfileId: e.pacienteId,
          ...(paciente ? { displayName: paciente.displayName, patientCode: paciente.patientCode } : {}),
          since: e.desde,
        };
      }),
      total: mias.length,
      limit,
      offset,
    };
  });
}
