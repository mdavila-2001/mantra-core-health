import { HttpHeaders } from '@angular/common/http';

import { PACIENTES } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registerInsurancePortability } from './insurance-portability.handlers';
import { registrarSeguros } from './insurance.handlers';
import { registrarPerfiles } from './profiles.handlers';

const PACIENTE = PACIENTES[0]!;
/**
 * `p-mamani` (índice fijo — `personas.ts` preserva el orden de los pacientes
 * escritos «para no mover los índices»): no declara `aseguradora`, es la
 * persona sin coberturas del fixture.
 */
const PACIENTE_SIN_COBERTURAS = PACIENTES[1]!;

interface ExportWire {
  readonly certificateId: string;
  readonly manifestHash: string;
  readonly recordCount: number;
  readonly policiesCount: number;
  readonly summary: { readonly allTime: { readonly billedAmount: string; readonly coveredAmount: string } };
}

interface VerifyWire {
  readonly status: string;
  readonly manifestHash: string;
}

describe('handlers de portabilidad de póliza y siniestralidad (subtarea 3.3)', () => {
  const router = new MockRouter();
  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;
  const superadmin = buscarUsuario('superadmin')!;
  /** Mismo molde que `paciente`, pero apuntando a la persona sin coberturas. */
  const pacienteSinCoberturas: MockUser = {
    ...paciente,
    key: 'paciente-sin-coberturas',
    id: PACIENTE_SIN_COBERTURAS.userId,
    displayName: PACIENTE_SIN_COBERTURAS.displayName,
    patientProfileId: PACIENTE_SIN_COBERTURAS.id,
    personId: PACIENTE_SIN_COBERTURAS.personId,
  };

  registrarPerfiles(router);
  registrarSeguros(router);
  registerInsurancePortability(router);

  function call<T>(
    method: MockMethod,
    path: string,
    body: unknown,
    user: MockUser | null,
  ): T | MockReply {
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
    }) as T | MockReply;
  }

  function esRespuestaDeError(valor: unknown): valor is MockReply {
    return typeof valor === 'object' && valor !== null && 'status' in valor && 'body' in valor;
  }

  it('el titular exporta su propio historial: 14 reclamos por Bs 12 450 cubiertos', () => {
    const respuesta = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id, format: 'BUNDLE' },
      paciente,
    );
    expect(esRespuestaDeError(respuesta)).toBe(false);
    const wire = respuesta as ExportWire;

    expect(wire.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(wire.recordCount).toBe(14);
    expect(wire.summary.allTime.coveredAmount).toBe('12450.00');
  });

  it('otro usuario no puede exportar el historial de PACIENTE: 403', () => {
    const respuesta = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      medica,
    );
    expect(esRespuestaDeError(respuesta)).toBe(true);
    expect((respuesta as MockReply).status).toBe(403);
  });

  it('la plataforma (SUPERADMIN) puede exportar el historial de cualquiera', () => {
    const respuesta = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      superadmin,
    );
    expect(esRespuestaDeError(respuesta)).toBe(false);
  });

  it('sin sesión, exportar responde 403', () => {
    const respuesta = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      null,
    );
    expect(esRespuestaDeError(respuesta)).toBe(true);
    expect((respuesta as MockReply).status).toBe(403);
  });

  it('dos exportaciones seguidas producen certificados y sellos distintos', () => {
    const primero = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;
    const segundo = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    expect(segundo.certificateId).not.toBe(primero.certificateId);
  });

  it('el JSON descargado hashea exactamente al manifestHash informado', async () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    const descarga = call<MockReply>(
      'GET',
      `/insurance/portability/certificates/${exportado.certificateId}/json`,
      null,
      paciente,
    ) as MockReply;
    const bytes = await (descarga.body as Blob).text();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bytes));
    const hashReal = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(hashReal).toBe(exportado.manifestHash);
  });

  it('otro usuario no puede descargar el certificado de PACIENTE: 403', () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    const respuesta = call<MockReply>(
      'GET',
      `/insurance/portability/certificates/${exportado.certificateId}/pdf`,
      null,
      medica,
    ) as MockReply;
    expect(respuesta.status).toBe(403);
  });

  it('verify público responde VALID sin sesión para un hash existente', () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    const verificacion = call<VerifyWire>(
      'GET',
      `/public/portability/verify/${exportado.manifestHash}`,
      null,
      null,
    ) as VerifyWire;

    expect(verificacion.status).toBe('VALID');
    expect(verificacion.manifestHash).toBe(exportado.manifestHash);
  });

  it('verify público de un hash inexistente responde 404', () => {
    const respuesta = call<MockReply>(
      'GET',
      `/public/portability/verify/${'0'.repeat(64)}`,
      null,
      null,
    ) as MockReply;
    expect(respuesta.status).toBe(404);
  });

  it('verify público acepta el mismo sello en MAYÚSCULAS', () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    const verificacion = call<VerifyWire>(
      'GET',
      `/public/portability/verify/${exportado.manifestHash.toUpperCase()}`,
      null,
      null,
    ) as VerifyWire;

    expect(verificacion.status).toBe('VALID');
  });

  it('un titular sin coberturas exporta igual, dejando constancia sin arrastrar el historial de PACIENTE (CA-02)', () => {
    const respuesta = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE_SIN_COBERTURAS.id, format: 'BUNDLE' },
      pacienteSinCoberturas,
    );
    expect(esRespuestaDeError(respuesta)).toBe(false);
    const wire = respuesta as ExportWire;

    expect(wire.policiesCount).toBe(0);
    expect(wire.recordCount).toBe(0);
    expect(wire.summary.allTime.billedAmount).toBe('0.00');
  });

  it('el certificado del titular trae sus atenciones', async () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE.id },
      paciente,
    ) as ExportWire;

    const descarga = call<MockReply>(
      'GET',
      `/insurance/portability/certificates/${exportado.certificateId}/json`,
      null,
      paciente,
    ) as MockReply;
    const certificado = JSON.parse(await (descarga.body as Blob).text()) as {
      readonly schemaVersion: string;
      readonly encounters: readonly unknown[];
    };

    expect(certificado.schemaVersion).toBe('alovida.insurance-portability/2');
    expect(certificado.encounters.length).toBeGreaterThan(0);
  });

  it('un titular sin coberturas no trae atenciones ni diagnósticos inventados', async () => {
    const exportado = call<ExportWire>(
      'POST',
      '/insurance/portability/export',
      { patientProfileId: PACIENTE_SIN_COBERTURAS.id },
      pacienteSinCoberturas,
    ) as ExportWire;

    const descarga = call<MockReply>(
      'GET',
      `/insurance/portability/certificates/${exportado.certificateId}/json`,
      null,
      pacienteSinCoberturas,
    ) as MockReply;
    const certificado = JSON.parse(await (descarga.body as Blob).text()) as {
      readonly encounters: readonly unknown[];
      readonly conditions: readonly unknown[];
      readonly policies: readonly unknown[];
    };

    expect(certificado.policies).toEqual([]);
    expect(certificado.encounters).toEqual([]);
    expect(certificado.conditions).toEqual([]);
  });
});
