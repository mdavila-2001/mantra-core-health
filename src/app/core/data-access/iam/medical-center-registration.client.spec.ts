import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MEDICAL_ORGANIZATION_TYPES } from '../directory/directory.types';
import {
  MedicalCenterRegistrationClient,
  type MedicalCenterRegistration,
} from './medical-center-registration.client';

const REGISTRATION: MedicalCenterRegistration = {
  code: 'CENTRO-NORTE',
  tenantType: 'HOSPITAL',
  legalName: 'Centro Médico Norte S.R.L.',
  legalEntityType: 'SRL',
  legalDocuments: {
    constitutionFileId: 'f-constitucion',
    taxIdentifierFileId: 'f-nit',
    commerceRegistryFileId: 'f-matricula',
    operatingLicenseFileId: 'f-licencia',
    healthAuthorityCertificateFileId: 'f-sedes',
  },
  countryConceptId: 'c-bo',
  jurisdictionConceptId: 'j-nac',
  owner: {
    email: 'marta@centro.test',
    password: 'S3cret-passw0rd',
    name: 'Marta',
    lastName: 'Rojas',
  },
};

/** Una alta completa, con todo lo que suma la paridad con imagenología. */
const COMPLETA: MedicalCenterRegistration = {
  ...REGISTRATION,
  timeZone: 'America/La_Paz',
  owner: {
    email: 'marta@centro.test',
    password: 'S3cret-passw0rd',
    name: 'Marta',
    middleName: 'Elena',
    lastName: 'Rojas',
    motherLastName: 'Peña',
  },
  legalRepresentative: {
    fullName: 'Marta Elena Rojas Peña',
    idNumber: '4872190',
    email: 'marta@centro.test',
    phone: '+591 70055555',
    powerOfAttorneyFileId: 'f-poder',
  },
  executives: {
    generalManager: { fullName: 'Gabriel Gómez', phone: '+591 70011111', email: 'general@centro.test' },
    commercialManager: { fullName: 'Carla Cruz', phone: '+591 70022222', email: 'comercial@centro.test' },
    marketingManager: { fullName: 'Mario Mena', phone: '+591 70033333', email: 'marketing@centro.test' },
  },
  medicalFacility: {
    taxIdentifierNumber: '1023456789',
    healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
    medicalDirector: {
      name: 'Ana',
      middleName: 'Lucía',
      lastName: 'Rojas',
      motherLastName: 'Paz',
      professionalLicenseNumber: 'MAT-12345',
      email: 'dir@centro.test',
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
  },
};

describe('MedicalCenterRegistrationClient', () => {
  let client: MedicalCenterRegistrationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(MedicalCenterRegistrationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each(MEDICAL_ORGANIZATION_TYPES)('manda el tipo elegido tal cual: %s', (tipo) => {
    client.register({ ...REGISTRATION, tenantType: tipo }).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.organization.tenantType).toBe(tipo);
    req.flush({});
  });

  it('envía el tipo, los documentos, el país y la jurisdicción a register-organization', () => {
    client.register(REGISTRATION).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      organization: {
        code: 'CENTRO-NORTE',
        legalName: 'Centro Médico Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'HOSPITAL',
        legalDocuments: REGISTRATION.legalDocuments,
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
      },
      owner: { email: 'marta@centro.test', password: 'S3cret-passw0rd', name: 'Marta', lastName: 'Rojas' },
    });
    req.flush({ tenantId: 't-1', code: 'CENTRO-NORTE', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
  });

  it('no manda la escritura ni la matrícula si no las hay', () => {
    const { constitutionFileId: _c, commerceRegistryFileId: _m, ...resto } = REGISTRATION.legalDocuments;
    client.register({ ...REGISTRATION, legalDocuments: resto }).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.organization.legalDocuments).toEqual({
      taxIdentifierFileId: 'f-nit',
      operatingLicenseFileId: 'f-licencia',
      healthAuthorityCertificateFileId: 'f-sedes',
    });
    req.flush({});
  });

  it('manda el nombre comercial sólo si lo hay', () => {
    client.register({ ...REGISTRATION, tradeName: 'Norte' }).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.organization.tradeName).toBe('Norte');
    req.flush({});
  });

  it('manda el owner en partes, sin displayName', () => {
    client.register(COMPLETA).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.owner).toEqual({
      email: 'marta@centro.test',
      password: 'S3cret-passw0rd',
      name: 'Marta',
      middleName: 'Elena',
      lastName: 'Rojas',
      motherLastName: 'Peña',
    });
    expect('displayName' in req.request.body.owner).toBe(false);
    req.flush({});
  });

  it('el cuerpo completo: representante, gerencias y medicalFacility dentro de organization', () => {
    client.register(COMPLETA).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body).toEqual({
      organization: {
        code: 'CENTRO-NORTE',
        legalName: 'Centro Médico Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'HOSPITAL',
        legalDocuments: REGISTRATION.legalDocuments,
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
        timeZone: 'America/La_Paz',
        legalRepresentative: COMPLETA.legalRepresentative,
        executives: COMPLETA.executives,
        medicalFacility: COMPLETA.medicalFacility,
      },
      owner: {
        email: 'marta@centro.test',
        password: 'S3cret-passw0rd',
        name: 'Marta',
        middleName: 'Elena',
        lastName: 'Rojas',
        motherLastName: 'Peña',
      },
    });
    req.flush({ tenantId: 't-1', code: 'CENTRO-NORTE', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true, medicalFacilityRegistered: true });
  });

  it('sin los bloques nuevos el cuerpo es el de siempre: son aditivos', () => {
    client.register(REGISTRATION).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    const { organization } = req.request.body;
    for (const clave of ['medicalFacility', 'legalRepresentative', 'executives', 'timeZone']) {
      expect(clave in organization).toBe(false);
    }
    req.flush({});
  });

  it('las coordenadas viajan ambas o ninguna, y sin sucursales no hay clave branches', () => {
    client
      .register({
        ...COMPLETA,
        medicalFacility: {
          ...COMPLETA.medicalFacility!,
          headquarters: { name: 'Casa central', addressLines: ['Av. San Martín 123'], latitude: -17.78 },
          branches: [],
        },
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    const facility = req.request.body.organization.medicalFacility;
    expect(facility.headquarters).toEqual({ name: 'Casa central', addressLines: ['Av. San Martín 123'] });
    expect('branches' in facility).toBe(false);
    req.flush({});
  });

  it('no copia claves que el DTO no declara (forbidNonWhitelisted)', () => {
    const conDeMas = {
      ...COMPLETA,
      medicalFacility: {
        ...COMPLETA.medicalFacility!,
        extra: 'no',
        medicalDirector: { ...COMPLETA.medicalFacility!.medicalDirector, otro: 'no' },
      },
    } as MedicalCenterRegistration;
    client.register(conDeMas).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect('extra' in req.request.body.organization.medicalFacility).toBe(false);
    expect('otro' in req.request.body.organization.medicalFacility.medicalDirector).toBe(false);
    req.flush({});
  });

  it('un 422 de la API llega al que llamó, sin tragarse el error', () => {
    let error: unknown;
    client.register(COMPLETA).subscribe({ error: (e: unknown) => (error = e) });

    http
      .expectOne((r) => r.url === '/iam/auth/register-organization')
      .flush({ message: 'El bloque medicalFacility sólo corresponde a una organización médica' }, { status: 422, statusText: 'Unprocessable Entity' });

    expect((error as { status: number }).status).toBe(422);
  });
});
