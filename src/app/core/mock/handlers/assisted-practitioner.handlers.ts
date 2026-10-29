import { conflict, forbidden, reply, validation, type MockRouter, type ValidationIssue } from '../mock-router';
import { cuerpo, iso, nuevoId } from '../mock-store';

/* ============================================================================
    Backend simulado del alta administrativa de un médico
    (`POST /iam/users/assisted-practitioner-registration`).

    Reproduce las reglas de la API real: sólo `SECURITY_ADMIN` (o el comodín
    `SUPERADMIN`); no lleva contraseña —responde un código de activación de un
    solo uso—; exige correo, nombre y apellido, matrícula, cédula con su
    departamento emisor y el motivo (máximo 500); un rol desconocido o un correo
    ya dado de alta rechaza el alta entera.
    ========================================================================== */

/** Los roles asistenciales que el simulador conoce (`GET /authz/roles` en la API real). */
const ROLES_CONOCIDOS: ReadonlySet<string> = new Set(['CLINICIAN', 'SURGEON']);

interface Cuerpo {
  email: string;
  name: string;
  lastName: string;
  licenseNumber: string;
  nationalId: string;
  issuerAdministrativeAreaConceptId: string;
  specialtyConceptIds: string[];
  clinicalRoles: string[];
  reason: string;
  password: unknown;
}

const OBLIGATORIOS = ['email', 'name', 'lastName', 'licenseNumber', 'nationalId', 'issuerAdministrativeAreaConceptId', 'reason'] as const;

/** Correos ya dados de alta en esta sesión: el alta repetida es un 409, como en la API. */
const correosDados = new Set<string>();

export function registrarAltaDeMedicoAsistida(router: MockRouter): void {
  router.post('/iam/users/assisted-practitioner-registration', (request) => {
    const roles = request.user?.roles ?? [];
    if (!roles.includes('SECURITY_ADMIN') && !roles.includes('SUPERADMIN')) return forbidden();

    const datos = cuerpo<Cuerpo>(request);
    const problemas: ValidationIssue[] = [];
    // La contraseña no existe en este contrato: el titular la elige al activar.
    if (datos.password !== undefined) problemas.push({ field: 'password', message: 'property password should not exist' });
    for (const campo of OBLIGATORIOS) {
      const valor = datos[campo];
      if (typeof valor !== 'string' || valor.trim() === '') problemas.push({ field: campo, message: 'should not be empty' });
    }
    if (typeof datos.email === 'string' && datos.email.trim() !== '' && !datos.email.includes('@')) {
      problemas.push({ field: 'email', message: 'must be an email' });
    }
    if (typeof datos.reason === 'string' && datos.reason.length > 500) {
      problemas.push({ field: 'reason', message: 'must be shorter than or equal to 500 characters' });
    }
    if (problemas.length > 0) return validation('Error de validación', problemas);

    const desconocidos = (datos.clinicalRoles ?? []).filter((rol) => !ROLES_CONOCIDOS.has(rol));
    if (desconocidos.length > 0) {
      return reply(422, {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: `Rol asistencial inexistente: ${desconocidos.join(', ')}`,
        error: 'Unprocessable Entity',
      });
    }

    const correo = (datos.email ?? '').trim().toLowerCase();
    if (correosDados.has(correo)) return conflict('Ya existe una cuenta con ese correo');
    correosDados.add(correo);

    const id = nuevoId('medico-asistido');
    return reply(201, {
      userId: id,
      personId: nuevoId('persona'),
      practitionerProfileId: nuevoId('perfil'),
      practitionerCode: `DOC-${String(correosDados.size).padStart(4, '0')}`,
      licenseId: nuevoId('licencia'),
      // La matrícula nace PENDIENTE: registrarse no equivale a estar habilitado para ejercer.
      verificationStatus: 'PENDING',
      emailVerificationSent: false,
      activationToken: `act-${id.slice(0, 8)}`,
      activationExpiresAt: iso(7, 23, 59),
      clinicalRoles: [...(datos.clinicalRoles ?? [])],
    });
  });
}

/** Para las pruebas: olvida los correos dados de alta. */
export function olvidarAltasDeMedicos(): void {
  correosDados.clear();
}
