import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { olvidarAltasDeMedicos, registrarAltaDeMedicoAsistida } from './assisted-practitioner.handlers';

const VALIDO = {
  email: 'dra.rojas@mantra.test',
  name: 'Ana',
  lastName: 'Rojas',
  licenseNumber: 'SEDES-1234',
  nationalId: '1234567',
  issuerAdministrativeAreaConceptId: 'dep-sc',
  reason: 'Alta cargada por operaciones',
};

describe('alta administrativa de un médico demo: mismas reglas que la API', () => {
  const router = new MockRouter();
  registrarAltaDeMedicoAsistida(router);
  const admin = buscarUsuario('superadmin')!;
  const paciente = buscarUsuario('paciente')!;

  function pedir(body: unknown, user = admin) {
    const match = router.match('POST', '/iam/users/assisted-practitioner-registration');
    if (match === null) throw new Error('No existe la ruta');
    return match.handler({
      method: 'POST',
      path: '/iam/users/assisted-practitioner-registration',
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  beforeEach(() => olvidarAltasDeMedicos());

  it('crea el alta y devuelve el código de activación, nunca una contraseña', () => {
    const r = pedir({ ...VALIDO, clinicalRoles: ['CLINICIAN'] });

    expect(estado(r)).toBe(201);
    const body = cuerpo<Record<string, unknown>>(r);
    expect(body['activationToken']).toEqual(expect.stringMatching(/^act-/));
    expect(body['verificationStatus']).toBe('PENDING');
    expect(body['clinicalRoles']).toEqual(['CLINICIAN']);
    expect('password' in body).toBe(false);
  });

  it('un rol sin permiso recibe 403 y no se crea nada', () => {
    expect(estado(pedir(VALIDO, paciente))).toBe(403);
    // No quedó registrado: el mismo correo se puede dar de alta después.
    expect(estado(pedir(VALIDO))).toBe(201);
  });

  it('cada campo obligatorio ausente es un 400 que nombra el campo', () => {
    for (const campo of Object.keys(VALIDO)) {
      const { [campo]: _quitado, ...resto } = VALIDO as Record<string, string>;
      const r = pedir(resto);
      expect(estado(r)).toBe(400);
      expect(JSON.stringify(cuerpo(r))).toContain(campo);
    }
  });

  it('una contraseña en el cuerpo se rechaza: el contrato no la admite', () => {
    const r = pedir({ ...VALIDO, password: 'S3cret-passw0rd' });
    expect(estado(r)).toBe(400);
    expect(JSON.stringify(cuerpo(r))).toContain('password');
  });

  it('un motivo de más de 500 caracteres es un 400', () => {
    expect(estado(pedir({ ...VALIDO, reason: 'x'.repeat(501) }))).toBe(400);
    expect(estado(pedir({ ...VALIDO, reason: 'x'.repeat(500) }))).toBe(201);
  });

  it('un rol asistencial inexistente rechaza el alta entera (422)', () => {
    expect(estado(pedir({ ...VALIDO, clinicalRoles: ['CLINICIAN', 'INVENTADO'] }))).toBe(422);
    // Falló entera: el correo no quedó tomado.
    expect(estado(pedir({ ...VALIDO, clinicalRoles: ['CLINICIAN'] }))).toBe(201);
  });

  it('el mismo correo dos veces es un 409', () => {
    expect(estado(pedir(VALIDO))).toBe(201);
    expect(estado(pedir({ ...VALIDO, email: 'DRA.ROJAS@mantra.test' }))).toBe(409);
  });
});
