import { HttpHeaders } from '@angular/common/http';

import { registrarPerfiles } from './profiles.handlers';
import { registrarAuth } from './auth.handlers';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El simulador de las especialidades y las matrículas propias tiene que fallar
 * donde falla la API (BR-07): `404` a lo ajeno o inexistente, `400` a una clave
 * que el DTO no declara —`isPrimary` incluido—, `422` a lo que ya no está
 * pendiente y `204` cuando aplicó. Un recorrido en la maqueta que pasa donde la
 * API rechaza es un recorrido que no prueba nada.
 *
 * También la unión del alta de organización (CL-43): una unipersonal no manda
 * constitución ni poder, el resto responde `422` nombrando lo que falta.
 */
describe('handlers del perfil propio y del alta de organización', () => {
  const router = new MockRouter();
  registrarPerfiles(router);
  registrarAuth(router);
  const medica = buscarUsuario('medica')!;

  function llamar(method: MockMethod, path: string, body: unknown = null, user = medica) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    });
  }

  function estado(respuesta: unknown): number {
    return isMockReply(respuesta) ? respuesta.status : 200;
  }

  const perfil = () =>
    llamar('GET', '/profiles/practitioners/me/summary') as {
      specialties: { id: string; verificationStatusConceptId: string }[];
      licenses: { id: string; stateConceptId: string }[];
      activity: { monthlyEncounters?: unknown; quality?: unknown };
    };

  it('sin métricas inventadas: el simulador no fabrica la serie ni la calidad (ID-14)', () => {
    expect(perfil().activity.monthlyEncounters).toBeUndefined();
    expect(perfil().activity.quality).toBeUndefined();
  });

  it('PATCH de una especialidad con `isPrimary` responde 400: tiene su propia ruta', () => {
    const { id } = perfil().specialties[0]!;

    expect(estado(llamar('PATCH', `/profiles/practitioners/me/specialties/${id}`, { isPrimary: true }))).toBe(400);
  });

  it('PATCH de una especialidad ajena o inexistente responde 404', () => {
    expect(estado(llamar('PATCH', '/profiles/practitioners/me/specialties/no-existe', { boardCertified: true }))).toBe(404);
    expect(estado(llamar('DELETE', '/profiles/practitioners/me/specialties/no-existe'))).toBe(404);
  });

  it('una especialidad verificada no se corrige ni se retira: 422; una pendiente sí: 204', () => {
    const sembrada = perfil().specialties[0]!;
    expect(estado(llamar('PATCH', `/profiles/practitioners/me/specialties/${sembrada.id}`, { boardCertified: true }))).toBe(422);
    expect(estado(llamar('DELETE', `/profiles/practitioners/me/specialties/${sembrada.id}`))).toBe(422);

    // La que se agrega nace pendiente de verificación.
    const { practitionerProfileId } = medica;
    const nueva = llamar('POST', `/profiles/practitioners/${practitionerProfileId}/specialties`, {
      specialtyConceptId: 'esp-nueva',
    }) as { body: { id: string } };
    const id = nueva.body.id;
    expect(estado(llamar('PATCH', `/profiles/practitioners/me/specialties/${id}`, { boardCertified: true }))).toBe(204);
    expect(estado(llamar('DELETE', `/profiles/practitioners/me/specialties/${id}`))).toBe(204);
    expect(estado(llamar('DELETE', `/profiles/practitioners/me/specialties/${id}`))).toBe(404);
  });

  it('PATCH de una matrícula con una clave que el DTO no declara responde 400', () => {
    const { id } = perfil().licenses[0]!;

    expect(estado(llamar('PATCH', `/profiles/practitioners/me/jurisdiction-authorizations/${id}`, { stateConceptId: 'x' }))).toBe(400);
  });

  it('una matrícula activa no se corrige ni se retira: 422', () => {
    const activa = perfil().licenses[0]!;

    expect(estado(llamar('PATCH', `/profiles/practitioners/me/jurisdiction-authorizations/${activa.id}`, { licenseNumber: 'X' }))).toBe(422);
    expect(estado(llamar('DELETE', `/profiles/practitioners/me/jurisdiction-authorizations/${activa.id}`))).toBe(422);
  });

  /* --- alta de organización ---------------------------------------------- */

  const documentos = {
    taxIdentifierFileId: 'a',
    commerceRegistryFileId: 'b',
    operatingLicenseFileId: 'c',
    healthAuthorityCertificateFileId: 'd',
  };
  const centro = (legalEntityType: string, extra: object = {}) => ({
    organization: {
      code: 'LAB_SIM',
      legalName: 'Lab Sim',
      legalEntityType,
      tenantType: 'DIAGNOSTIC_CENTER',
      countryConceptId: 'pais',
      jurisdictionConceptId: 'jur',
      diagnosticUnit: { diagnosticUnitTypeConceptId: 'u', modalityConceptIds: ['m'] },
      legalDocuments: documentos,
      ...extra,
    },
    owner: { email: 'x@y.test', password: 'secreto12', displayName: 'Ana' },
  });

  it('una UNIPERSONAL sin constitución ni poder da 201 con diagnosticUnitId', () => {
    const respuesta = llamar('POST', '/iam/auth/register-organization', centro('UNIPERSONAL')) as {
      diagnosticUnitId?: string;
      legalDocumentsRegistered?: number;
    };

    expect(estado(respuesta)).toBe(200);
    expect(respuesta.diagnosticUnitId).toEqual(expect.any(String));
    expect(respuesta.legalDocumentsRegistered).toBe(4);
  });

  it('una SRL sin constitución responde 422 nombrando el documento', () => {
    const respuesta = llamar('POST', '/iam/auth/register-organization', centro('SRL'));

    expect(estado(respuesta)).toBe(422);
    expect(JSON.stringify(respuesta)).toContain('constitutionFileId');
  });

  it('un centro diagnóstico sin país ni jurisdicción responde 422 «missing»', () => {
    const cuerpo = centro('UNIPERSONAL');
    delete (cuerpo.organization as { countryConceptId?: string }).countryConceptId;

    expect(estado(llamar('POST', '/iam/auth/register-organization', cuerpo))).toBe(422);
  });

  it('la aseguradora con sus cinco documentos sigue dando 201', () => {
    const respuesta = llamar('POST', '/iam/auth/register-organization', {
      organization: {
        code: 'ASEG',
        legalName: 'Aseg',
        legalEntityType: 'SA',
        tenantType: 'PAYER',
        payer: { carrierCode: 'ASEG', regulatorIdentifier: '1', sigla: 'ASEG', address: 'x' },
        legalDocuments: { ...documentos, constitutionFileId: 'e' },
      },
      owner: { email: 'a@b.test', password: 'secreto12', name: 'A', lastName: 'B' },
    });

    expect(estado(respuesta)).toBe(200);
  });
});
