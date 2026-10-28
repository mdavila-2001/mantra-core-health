import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { registrarAuth } from './auth.handlers';

/**
 * El alta pública de una organización médica contra el simulador (contrato del
 * 28/10/2026): `POST /iam/auth/register-organization` con un `tenantType`
 * médico y el bloque `organization.medicalFacility` (NIT, número de registro
 * del SEDES, director médico, casa central y sucursales). Se ejercita el router
 * directo, como los specs de farmacia y laboratorio.
 */
describe('alta pública de organización médica en el simulador', () => {
  const router = new MockRouter();
  registrarAuth(router);

  function call(method: MockMethod, path: string, body: unknown = null) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: null,
    });
    return isMockReply(result) ? result : { status: 200, body: result };
  }

  const MEDICAL_FACILITY = {
    taxIdentifierNumber: '1023456789',
    healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
    medicalDirector: {
      name: 'Ana',
      middleName: 'Lucía',
      lastName: 'Rojas',
      motherLastName: 'Paz',
      professionalLicenseNumber: 'MAT-12345',
      email: 'dir@clinica.bo',
      phone: '+591 70012345',
    },
    headquarters: {
      name: 'Casa central',
      addressLines: ['Av. San Martín 123'],
      latitude: -17.78,
      longitude: -63.18,
    },
    branches: [
      { name: 'Sucursal Equipetrol', addressLines: ['Av. Equipetrol 1'], latitude: -17.7, longitude: -63.1 },
    ],
  };

  const DOCUMENTOS = {
    constitutionFileId: 'f-constitucion',
    taxIdentifierFileId: 'f-nit',
    commerceRegistryFileId: 'f-matricula',
    operatingLicenseFileId: 'f-licencia',
    healthAuthorityCertificateFileId: 'f-sedes',
  };

  const EJECUTIVOS = {
    generalManager: { fullName: 'Gabriel Gómez', phone: '+591 70011111', email: 'general@clinica.bo' },
    commercialManager: { fullName: 'Carla Cruz', phone: '+591 70022222', email: 'comercial@clinica.bo' },
    marketingManager: { fullName: 'Mario Mena', phone: '+591 70033333', email: 'marketing@clinica.bo' },
  };

  function cuerpo(organization: Record<string, unknown> = {}) {
    return {
      organization: {
        code: 'CM-CLINICA-NORTE',
        legalName: 'Clínica Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'CLINIC',
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
        legalDocuments: DOCUMENTOS,
        legalRepresentative: {
          fullName: 'Marta Rojas',
          idNumber: '4872190',
          email: 'marta@clinica.bo',
          powerOfAttorneyFileId: 'f-poder',
        },
        executives: EJECUTIVOS,
        medicalFacility: MEDICAL_FACILITY,
        ...organization,
      },
      owner: {
        email: 'marta@clinica.bo',
        password: 'secreto12',
        name: 'Marta',
        lastName: 'Rojas',
      },
    };
  }

  function mensajes(body: unknown): string[] {
    return (body as { details: { messages: string[] } }).details.messages;
  }

  function conFacility(cambio: Record<string, unknown>) {
    return cuerpo({ medicalFacility: { ...MEDICAL_FACILITY, ...cambio } });
  }

  it.each(['HOSPITAL', 'CLINIC', 'MEDICAL_OFFICE', 'NURSING', 'HEALTH_OTHER'])(
    'correcto — acepta medicalFacility con %s y avisa que quedó registrada',
    (tenantType) => {
      const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo({ tenantType }));

      expect(status).toBe(200);
      expect(body).toMatchObject({
        status: 'PENDING_VERIFICATION',
        emailVerificationSent: true,
        medicalFacilityRegistered: true,
        legalDocumentsRegistered: 5,
        representativesRegistered: 4,
      });
    },
  );

  it('el alta sin medicalFacility sigue siendo válida y no declara el bloque en la respuesta', () => {
    const sinBloque = cuerpo();
    delete (sinBloque.organization as Record<string, unknown>)['medicalFacility'];
    const { status, body } = call('POST', '/iam/auth/register-organization', sinBloque);

    expect(status).toBe(200);
    expect('medicalFacilityRegistered' in (body as object)).toBe(false);
  });

  it('422 — medicalFacility con un tenantType que no es médico', () => {
    for (const tenantType of ['PHARMACY', 'PAYER', 'DIAGNOSTIC_CENTER']) {
      const { status, body } = call('POST', '/iam/auth/register-organization', cuerpo({ tenantType }));

      expect(status).toBe(422);
      expect((body as { code: string }).code).toBe('PRECONDITION_FAILED');
    }
  });

  it('400 — NIT inválido', () => {
    for (const taxIdentifierNumber of ['abc', '12', '', '-1234567']) {
      const { status, body } = call(
        'POST',
        '/iam/auth/register-organization',
        conFacility({ taxIdentifierNumber }),
      );

      expect(status).toBe(400);
      expect(mensajes(body).join()).toContain('taxIdentifierNumber');
    }
  });

  it('400 — número de registro vacío, corto, largo o con caracteres no admitidos', () => {
    for (const healthFacilityRegistrationNumber of ['', 'ab', 'A'.repeat(51), 'SEDES SC', 'SEDES_SC']) {
      const { status, body } = call(
        'POST',
        '/iam/auth/register-organization',
        conFacility({ healthFacilityRegistrationNumber }),
      );

      expect(status).toBe(400);
      expect(mensajes(body).join()).toContain('healthFacilityRegistrationNumber');
    }
  });

  it('400 — director médico sin matrícula, sin nombre o con correo inválido', () => {
    const director = MEDICAL_FACILITY.medicalDirector;
    const casos: [Record<string, unknown>, string][] = [
      [{ professionalLicenseNumber: 'ab' }, 'professionalLicenseNumber'],
      [{ professionalLicenseNumber: 'M'.repeat(51) }, 'professionalLicenseNumber'],
      [{ name: '' }, 'medicalDirector.name'],
      [{ lastName: '' }, 'medicalDirector.lastName'],
      [{ email: 'sin-arroba' }, 'medicalDirector.email'],
    ];
    for (const [cambio, esperado] of casos) {
      const { status, body } = call(
        'POST',
        '/iam/auth/register-organization',
        conFacility({ medicalDirector: { ...director, ...cambio } }),
      );

      expect(status).toBe(400);
      expect(mensajes(body).join()).toContain(esperado);
    }
  });

  it('400 — falta el director médico o la casa central', () => {
    const sinDirector: Record<string, unknown> = { ...MEDICAL_FACILITY };
    delete sinDirector['medicalDirector'];
    const a = call('POST', '/iam/auth/register-organization', cuerpo({ medicalFacility: sinDirector }));
    expect(a.status).toBe(400);
    expect(mensajes(a.body).join()).toContain('medicalDirector must be an object');

    const sinCasa: Record<string, unknown> = { ...MEDICAL_FACILITY };
    delete sinCasa['headquarters'];
    const b = call('POST', '/iam/auth/register-organization', cuerpo({ medicalFacility: sinCasa }));
    expect(b.status).toBe(400);
    expect(mensajes(b.body).join()).toContain('headquarters must be an object');
  });

  it('400 — coordenadas de la casa central: ambas o ninguna, y en rango', () => {
    const hq = MEDICAL_FACILITY.headquarters;
    const soloLatitud = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({ headquarters: { name: hq.name, addressLines: hq.addressLines, latitude: -17.7 } }),
    );
    expect(soloLatitud.status).toBe(400);
    expect(mensajes(soloLatitud.body)).toContain('organization.medicalFacility.headquarters.longitude must be a number');

    const fueraDeRango = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({ headquarters: { ...hq, latitude: 91 } }),
    );
    expect(fueraDeRango.status).toBe(400);

    const sinCoordenadas = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({ headquarters: { name: hq.name, addressLines: hq.addressLines } }),
    );
    expect(sinCoordenadas.status).toBe(200);
  });

  it('400 — una sucursal sin nombre o sin dirección, y más de 50', () => {
    const sinNombre = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({ branches: [{ name: '', addressLines: ['x'] }] }),
    );
    expect(sinNombre.status).toBe(400);
    expect(mensajes(sinNombre.body).join()).toContain('branches.0.name');

    const sinDireccion = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({ branches: [{ name: 'S1', addressLines: [] }] }),
    );
    expect(sinDireccion.status).toBe(400);
    expect(mensajes(sinDireccion.body).join()).toContain('branches.0.addressLines');

    const demasiadas = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({
        branches: Array.from({ length: 51 }, (_, i) => ({ name: `S${i}`, addressLines: ['x'] })),
      }),
    );
    expect(demasiadas.status).toBe(400);
    expect(mensajes(demasiadas.body).join()).toContain('no more than 50');

    const cincuenta = call(
      'POST',
      '/iam/auth/register-organization',
      conFacility({
        branches: Array.from({ length: 50 }, (_, i) => ({ name: `S${i}`, addressLines: ['x'] })),
      }),
    );
    expect(cincuenta.status).toBe(200);
  });

  it('400 — las gerencias son todo o nada: con una sola, la API las rechaza', () => {
    const { status, body } = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({ executives: { generalManager: EJECUTIVOS.generalManager } }),
    );

    expect(status).toBe(400);
    expect(mensajes(body).join()).toContain('commercialManager');
  });

  it('422 — una S.R.L. sin el poder del representante o sin la constitución', () => {
    const sinPoder = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({
        legalRepresentative: { fullName: 'Marta Rojas', idNumber: '4872190', email: 'marta@clinica.bo' },
      }),
    );
    expect(sinPoder.status).toBe(422);
    expect(JSON.stringify(sinPoder.body)).toContain('powerOfAttorneyFileId');

    const { constitutionFileId: _omitida, ...sinConstitucion } = DOCUMENTOS;
    const sinEscritura = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({ legalDocuments: sinConstitucion }),
    );
    expect(sinEscritura.status).toBe(422);
    expect(JSON.stringify(sinEscritura.body)).toContain('constitutionFileId');
  });

  it('una UNIPERSONAL se registra sin constitución ni poder', () => {
    const { constitutionFileId: _omitida, ...sinConstitucion } = DOCUMENTOS;
    const { status } = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({
        legalEntityType: 'UNIPERSONAL',
        legalDocuments: sinConstitucion,
        legalRepresentative: { fullName: 'Marta Rojas', idNumber: '4872190', email: 'marta@clinica.bo' },
      }),
    );

    expect(status).toBe(200);
  });

  it('un profesional independiente omite constitución y matrícula, pero no el poder', () => {
    const { constitutionFileId: _c, commerceRegistryFileId: _m, ...resto } = DOCUMENTOS;
    const conPoder = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({ legalEntityType: 'PROFESIONAL_INDEPENDIENTE', legalDocuments: resto }),
    );
    expect(conPoder.status).toBe(200);

    const sinPoder = call(
      'POST',
      '/iam/auth/register-organization',
      cuerpo({
        legalEntityType: 'PROFESIONAL_INDEPENDIENTE',
        legalDocuments: resto,
        legalRepresentative: { fullName: 'Marta Rojas', idNumber: '4872190', email: 'marta@clinica.bo' },
      }),
    );
    expect(sinPoder.status).toBe(422);
  });

  it('409 — el correo del owner ya tiene cuenta', () => {
    const { status } = call('POST', '/iam/auth/register-organization', {
      ...cuerpo(),
      owner: { email: 'superadmin@alovida.mock', password: 'secreto12', name: 'Marta', lastName: 'Rojas' },
    });

    expect(status).toBe(409);
  });
});
