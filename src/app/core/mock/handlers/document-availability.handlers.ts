import { conflict, isMockReply, type MockRouter } from '../mock-router';
import { cuerpo } from '../mock-store';

/**
 * C-10 / MD-01 · un CI por tipo de usuario, en el simulador.
 *
 * La misma regla que la API: número + departamento de emisión + tipo de
 * usuario. Dos médicos no comparten CI; un médico y un paciente, sí. Guarda
 * los CI de las altas de esta sesión del simulador y contesta la consulta del
 * formulario. Las altas siguen en `auth.handlers.ts`: acá sólo se las envuelve.
 *
 * Se registra **después** de `registrarAuth`.
 */
export function registrarDisponibilidadDeDocumento(router: MockRouter): void {
  const registrados = new Set<string>();
  const clave = (kind: string, numero?: string | null, departamento?: string | null) =>
    `${kind}|${(numero ?? '').trim()}|${departamento ?? ''}`;

  router.get('/iam/auth/document-availability', ({ query }) => ({
    available: !registrados.has(
      clave(query.get('userType') ?? '', query.get('number'), query.get('issuer')),
    ),
  }));

  const altas = [
    ['/iam/auth/register-patient', 'PATIENT'],
    ['/iam/auth/register-practitioner', 'PRACTITIONER'],
  ] as const;
  for (const [ruta, kind] of altas) {
    router.envolver('POST', ruta, (original) => (request) => {
      const datos = cuerpo<{ nationalId: string; issuerAdministrativeAreaConceptId: string }>(
        request,
      );
      const documento = clave(kind, datos.nationalId, datos.issuerAdministrativeAreaConceptId);
      if (datos.nationalId !== undefined && registrados.has(documento)) {
        return conflict(
          'Ese documento de identidad ya está registrado para otra cuenta de este tipo',
          {
            reason: 'DOCUMENT_ALREADY_REGISTERED',
            field: 'nationalId',
          },
        );
      }
      const respuesta = original(request);
      // Sólo un alta que salió queda registrada: un 409 por correo no toma el CI.
      const salio = !isMockReply(respuesta) || respuesta.status < 300;
      if (salio && datos.nationalId !== undefined) registrados.add(documento);
      return respuesta;
    });
  }
}
