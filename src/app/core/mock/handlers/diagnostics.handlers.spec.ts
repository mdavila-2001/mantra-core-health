import { HttpHeaders } from '@angular/common/http';

import { ESTUDIO } from '../fixtures/conceptos';
import { PACIENTE } from '../fixtures/personas';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarDiagnostico } from './diagnostics.handlers';

/**
 * `POST /clinical/service-requests/duplicate-check` (antiduplicación de
 * estudios, v4.2.17, T-26, subtarea 3.2). Lo que estas pruebas fijan:
 *
 * 1. Un estudio con informe liberado reciente del mismo paciente es
 *    duplicado; uno sin informe previo no lo es.
 * 2. La conclusión sólo viaja cuando quien pide comparte organización con el
 *    informe — el resto de los datos (fecha, prestador, días) siempre va.
 * 3. La ventana es configurable y el default es 30 días.
 *
 * `PACIENTE` ya trae, por construcción de la bóveda de fixtures, un Hemograma
 * liberado por `TENANT_LABORATORIO` (otra organización que la de `medica`) y
 * un Perfil lipídico liberado por `TENANT_CLINICA` (la organización de
 * `medica`) — el caso cruzado y el intra-organización, sin sembrar nada
 * nuevo. Ver `patient-coverage-copays.spec.ts`, que exige exactamente 4
 * órdenes para este mismo paciente.
 */
describe('POST /clinical/service-requests/duplicate-check', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registrarDiagnostico(router);

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser | null = medica): T {
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
    }) as T;
  }

  interface ResultadoWire {
    readonly isDuplicate: boolean;
    readonly previousStudy: {
      readonly reportId: string;
      readonly studyName: string;
      readonly providerName: string;
      readonly daysAgo: number;
      readonly resultsAvailable: boolean;
      readonly conclusionText: string | null;
      readonly sameOrganization: boolean;
    } | null;
    readonly requiresJustification: boolean;
    readonly pendingReport: boolean;
    readonly windowDays: number;
  }

  it('un estudio ya liberado hace poco es duplicado', () => {
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
    });

    expect(resultado.isDuplicate).toBe(true);
    expect(resultado.previousStudy).not.toBeNull();
    expect(resultado.previousStudy?.studyName).toBe('Hemograma completo');
    expect(resultado.previousStudy?.resultsAvailable).toBe(true);
    expect(resultado.previousStudy?.daysAgo).toBeGreaterThanOrEqual(0);
    expect(resultado.previousStudy?.daysAgo).toBeLessThanOrEqual(5);
    expect(resultado.requiresJustification).toBe(true);
    expect(resultado.windowDays).toBe(30);
  });

  it('cruzando organizaciones, no manda la conclusión', () => {
    // El Hemograma de PACIENTE lo liberó TENANT_LABORATORIO; los tenants de
    // `medica` son TENANT_CLINICA y TENANT_HOSPITAL — organizaciones
    // distintas.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
    });

    expect(resultado.previousStudy?.sameOrganization).toBe(false);
    expect(resultado.previousStudy?.conclusionText).toBeNull();
  });

  it('en la misma organización, sí manda la conclusión', () => {
    // El Perfil lipídico de PACIENTE lo liberó TENANT_CLINICA — la misma
    // organización que `medica`.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-PERFIL-LIPIDICO'],
      encounterId: 'enc-1',
    });

    expect(resultado.previousStudy?.sameOrganization).toBe(true);
    expect(resultado.previousStudy?.conclusionText).not.toBeNull();
  });

  it('sin informe previo del mismo estudio, no hay duplicado', () => {
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-TAC-CRANEO'],
      encounterId: 'enc-1',
    });

    expect(resultado.isDuplicate).toBe(false);
    expect(resultado.previousStudy).toBeNull();
    expect(resultado.requiresJustification).toBe(false);
  });

  it('una ventana más angosta que el estudio previo lo deja pasar', () => {
    // El informe está a `iso(-2, 9)`: siempre más de un día atrás, así que
    // una ventana de 0 días nunca lo alcanza — sin depender del momento
    // exacto de la corrida.
    const resultado = call<ResultadoWire>('POST', '/clinical/service-requests/duplicate-check', {
      patientProfileId: PACIENTE.id,
      codeConceptId: ESTUDIO['STUDY-HEMOGRAMA'],
      encounterId: 'enc-1',
      windowDays: 0,
    });

    expect(resultado.isDuplicate).toBe(false);
    expect(resultado.windowDays).toBe(0);
  });
});
