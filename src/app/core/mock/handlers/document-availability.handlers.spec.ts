import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { registrarAuth } from './auth.handlers';
import { registrarDisponibilidadDeDocumento } from './document-availability.handlers';

/**
 * C-10 / MD-01 en el simulador: la misma regla que la API — número +
 * departamento + tipo de usuario —, ejercitada contra el router directo.
 */
describe('CI único por tipo de usuario en el simulador', () => {
  let router: MockRouter;

  beforeEach(() => {
    router = new MockRouter();
    registrarAuth(router);
    registrarDisponibilidadDeDocumento(router);
  });

  function call(method: MockMethod, path: string, body: unknown = null, query = '') {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: null,
    });
    return isMockReply(result) ? result : { status: 200, body: result };
  }

  const LP = 'dep-lp';
  const medico = (email: string, nationalId: string, departamento = LP) =>
    call('POST', '/iam/auth/register-practitioner', {
      email,
      nationalId,
      issuerAdministrativeAreaConceptId: departamento,
    });
  const paciente = (email: string, nationalId: string) =>
    call('POST', '/iam/auth/register-patient', {
      email,
      nationalId,
      issuerAdministrativeAreaConceptId: LP,
    });
  const libre = (nationalId: string, holderKind: string, departamento = LP) =>
    call(
      'GET',
      '/iam/auth/document-availability',
      null,
      `type=NATIONAL_ID&number=${nationalId}&issuer=${departamento}&userType=${holderKind}`,
    ).body as { available: boolean };

  it('correcto — el primer médico pasa y su CI deja de estar libre para médicos', () => {
    expect(libre('7654321', 'PRACTITIONER')).toEqual({ available: true });
    expect(medico('a@ci.test', '7654321').status).toBe(200);
    expect(libre('7654321', 'PRACTITIONER')).toEqual({ available: false });
  });

  it('inválido — un segundo médico con el mismo CI y departamento: 409 con motivo estable', () => {
    medico('a@ci.test', '7654321');
    const repetido = medico('b@ci.test', '7654321');
    expect(repetido.status).toBe(409);
    expect(repetido.body).toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'DOCUMENT_ALREADY_REGISTERED', field: 'nationalId' },
    });
  });

  it('límite — otro departamento es otro carnet, y un paciente puede tener el CI de un médico', () => {
    medico('a@ci.test', '7654321');
    expect(medico('c@ci.test', '7654321', 'dep-sc').status).toBe(200);
    expect(libre('7654321', 'PATIENT')).toEqual({ available: true });
    expect(paciente('p@ci.test', '7654321').status).toBe(200);
    expect(paciente('q@ci.test', '7654321').status).toBe(409);
  });

  it('un alta rechazada por otro motivo no toma el CI', () => {
    // El correo de una cuenta de prueba ya existe: el alta sale 409 por el correo.
    const correoTomado = medico('medica@alovida.mock', '1111111');
    expect(correoTomado.status).toBe(409);
    expect(correoTomado.body).toMatchObject({ details: { email: 'medica@alovida.mock' } });
    expect(libre('1111111', 'PRACTITIONER')).toEqual({ available: true });
  });

  it('envolver una ruta que no existe es un error de orden, no se traga', () => {
    expect(() => new MockRouter().envolver('POST', '/no/existe', (h) => h)).toThrow(/no hay POST/);
  });
});
