import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { forcedRealApi } from '../../mock/api-mode';
import { contractViolations } from '../../mock/contract/contract-validator';
import { AssistedPractitionerClient } from './assisted-practitioner.client';
import { IamClient } from './iam.client';

/* ============================================================================
    El alta de cada tipo de usuario, con **todos** los datos que la pantalla
    puede mandar, contra el contrato que la API valida (`forbidNonWhitelisted`).

    Nació de un 400 en `dev`: «ownSite.property contactPhone should not exist».
    El cliente mandaba un dato que el DTO del servidor desplegado todavía no
    declaraba, y nada en las pruebas lo detectó porque cada una armaba un cuerpo
    mínimo. Acá el cuerpo es el máximo, con la maqueta apagada (lo que viaja a
    la API real), y se compara con el catálogo generado del `openapi.json` de
    `origin/dev` (`yarn mock-contract:check` avisa cuando queda viejo).

    Si una de estas pruebas falla: o el cliente manda un dato que la API no
    conoce (se corrige el cliente, o se espera al despliegue de la API), o el
    catálogo quedó viejo (se regenera).
    ========================================================================== */

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const maqueta = environment.mockBackend;

describe('alta de cada tipo de usuario — el cuerpo máximo que sale hacia la API real', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    Object.assign(environment, { mockBackend: false });
    forcedRealApi.set(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    forcedRealApi.set(false);
    Object.assign(environment, { mockBackend: maqueta });
  });

  /** El cuerpo de la única petición a `url`; falla si la API lo rechazaría. */
  function cuerpoAceptado(url: string): Record<string, unknown> {
    const req = http.expectOne((r) => r.method === 'POST' && r.url === url);
    expect(contractViolations('POST', url, req.request.body)).toEqual([]);
    return req.request.body as Record<string, unknown>;
  }

  it('paciente', () => {
    TestBed.inject(IamClient)
      .registerPatient({
        nationalId: '1234567',
        password: 'secreto12',
        name: 'Ana',
        middleName: 'María',
        lastName: 'Paz',
        motherLastName: 'Rojas',
        email: 'ana@ejemplo.test',
        birthDate: '1990-05-17',
        issuerAdministrativeAreaConceptId: UUID_A,
        residenceMunicipalityConceptId: UUID_B,
        phone: '+591 70012345',
        sexAtBirth: 'FEMALE',
      })
      .subscribe();
    cuerpoAceptado('/iam/auth/register-patient');
  });

  it('profesional, con consultorio propio, teléfonos, domicilio y puntos de mapa', () => {
    TestBed.inject(IamClient)
      .registerPractitioner({
        email: 'ana@ejemplo.test',
        password: 'secreto12',
        name: 'Ana',
        lastName: 'Rojas',
        nationalId: '4821993',
        issuerAdministrativeAreaConceptId: UUID_A,
        residenceMunicipalityConceptId: UUID_B,
        homeAddressLines: 'Calle 1',
        homeLatitude: -17.78,
        homeLongitude: -63.18,
        workAddressLines: 'Calle 2',
        workLatitude: -17.79,
        workLongitude: -63.19,
        mobilePhone: '+591 70012345',
        workMobilePhone: '+591 70012346',
        workLandline: '+591 3 3123456',
        licenseNumber: 'MP-1234',
        sedesLicenseNumber: 'SEDES-55',
        ownSite: {
          name: 'Consultorio Ana',
          contactPhone: '+591 70012345',
          address: {
            lines: ['Calle 3'],
            municipalityConceptId: UUID_B,
            latitude: -17.8,
            longitude: -63.2,
          },
        },
      })
      .subscribe();
    cuerpoAceptado('/iam/auth/register-practitioner');
  });

  it('profesional asistido', () => {
    TestBed.inject(AssistedPractitionerClient)
      .register({
        email: 'ana@ejemplo.test',
        name: 'Ana',
        middleName: 'María',
        lastName: 'Rojas',
        motherLastName: 'Paz',
        licenseNumber: 'MP-1234',
        nationalId: '4821993',
        issuerAdministrativeAreaConceptId: UUID_A,
        specialtyConceptIds: [UUID_B],
        clinicalRoles: ['PHYSICIAN'],
        reason: 'Alta de plantel',
      })
      .subscribe();
    cuerpoAceptado('/iam/users/assisted-practitioner-registration');
  });

  it('paciente asistido', () => {
    TestBed.inject(IamClient)
      .assistedRegistration({
        name: 'Lucía',
        lastName: 'Mamani',
        email: 'lucia@ejemplo.test',
        reason: 'Alta en mostrador',
      })
      .subscribe();
    cuerpoAceptado('/iam/users/assisted-registration');
  });

  it('farmacia, con NIT, casa central y sucursales', () => {
    TestBed.inject(IamClient)
      .registerPharmacyOrganization({
        code: 'FARMA_SUR',
        legalName: 'Farmacia Sur S.R.L.',
        legalEntityType: 'SRL',
        countryConceptId: UUID_A,
        jurisdictionConceptId: UUID_B,
        taxIdentifier: '1023456028',
        legalAddress: 'Av. Cañoto 234',
        headquarters: { latitude: -17.78, longitude: -63.18 },
        branches: [{ name: 'Norte', latitude: -17.76, longitude: -63.19 }],
        owner: { email: 'dueno@ejemplo.test', password: 'secreto12', displayName: 'Ana Paz' },
        legalRepresentative: {
          fullName: 'Ana Paz',
          email: 'ana@ejemplo.test',
          idNumber: '4872190',
          powerOfAttorneyFileId: UUID_A,
        },
      })
      .subscribe();
    cuerpoAceptado('/iam/auth/register-organization');
  });

  it('laboratorio o centro de imagenología, con sucursales', () => {
    TestBed.inject(IamClient)
      .registerLaboratoryOrganization({
        code: 'LAB_SUR',
        legalName: 'Laboratorio Sur S.R.L.',
        legalEntityType: 'SRL',
        countryConceptId: UUID_A,
        jurisdictionConceptId: UUID_B,
        diagnosticUnit: {
          name: 'Laboratorio Sur',
          diagnosticUnitTypeConceptId: UUID_A,
          modalityConceptIds: [UUID_B],
          primarySite: {
            name: 'Casa central',
            address: { lines: ['Av. Cañoto 234'], latitude: -17.78, longitude: -63.18 },
          },
          branches: [
            {
              name: 'Norte',
              addressLines: ['Av. Banzer 100'],
              location: { latitude: -17.76, longitude: -63.19 },
              description: 'Planta baja',
              locationUrl: 'https://maps.app.goo.gl/abc',
            },
            { name: 'Sur', addressLines: [] },
          ],
        },
        owner: { email: 'dueno@ejemplo.test', password: 'secreto12', displayName: 'Ana Paz' },
        legalRepresentative: {
          fullName: 'Ana Paz',
          email: 'ana@ejemplo.test',
          idNumber: '4872190',
        },
      })
      .subscribe();
    const cuerpo = cuerpoAceptado('/iam/auth/register-organization');
    // Lo que la API no guarda todavía (P54) no sale contra la API real.
    expect(JSON.stringify(cuerpo)).not.toMatch(/locationUrl|description|addressLines/);
  });
});
