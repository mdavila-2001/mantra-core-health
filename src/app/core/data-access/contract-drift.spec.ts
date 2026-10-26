import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { forcedRealApi } from '../mock/api-mode';
import { contractViolations } from '../mock/contract/contract-validator';
import { ChartNotesClient } from './chart-notes/chart-notes.client';
import { DiagnosticsClient } from './diagnostics/diagnostics.client';
import { DirectoryClient } from './directory/directory.client';
import { FormsClient } from './forms/forms.client';
import { IamClient } from './iam/iam.client';
import { PharmacyClient } from './pharmacy/pharmacy.client';
import { ProfilesClient } from './profiles/profiles.client';
import { unavailableMessageOf } from './simulator-only';

/* ============================================================================
    Las roturas del informe B de deriva de contratos (2026-10-08), una por una,
    contra el cliente: qué cuerpo sale hacia la API real y qué no sale.

    La API real se simula con `forcedRealApi` (el interruptor del stock de
    componentes) y `HttpTestingController`: ninguna petición va a la red. El
    cuerpo que sale se compara además contra el catálogo generado del
    `openapi.json` de `origin/dev`, que es lo que la API valida con
    `forbidNonWhitelisted`.
    ========================================================================== */

const UUID = '00000000-0000-4000-8000-0000000000aa';

describe('deriva de contratos — lo que el cliente manda a la API real', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    forcedRealApi.set(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    forcedRealApi.set(false);
  });

  /** El cuerpo de la única petición a `url`, y que la API lo aceptaría. */
  function cuerpoAceptado(method: string, url: string): unknown {
    const req = http.expectOne((r) => r.method === method && r.url === url);
    expect(contractViolations(method, url, req.request.body)).toEqual([]);
    return req.request.body;
  }

  it('C4 · compartir un resultado va por perfil profesional y sin motivo', () => {
    TestBed.inject(DiagnosticsClient)
      .shareResult(UUID, {
        practitionerProfileId: UUID,
        validUntil: new Date('2026-12-31T23:59:59Z'),
      })
      .subscribe();
    expect(cuerpoAceptado('POST', `/diagnostic-results/me/${UUID}/shares`)).toEqual({
      practitionerProfileId: UUID,
      validUntil: '2026-12-31T23:59:59.000Z',
    });
  });

  it('C5 · firmar una nota lleva el perfil de quien firma', () => {
    TestBed.inject(ChartNotesClient).signVersion(UUID, UUID, UUID).subscribe();
    expect(cuerpoAceptado('POST', `/charts/notes/${UUID}/versions/${UUID}/sign`)).toEqual({
      signerProfileId: UUID,
    });
  });

  it('C6 · las filas de la nota no viajan a la API real', () => {
    TestBed.inject(ChartNotesClient)
      .createNote({
        patientProfileId: UUID,
        authorProfileId: UUID,
        entries: [{ label: 'Presión', value: '120/80' }],
        subjectiveText: 'Control',
      })
      .subscribe();
    expect(cuerpoAceptado('POST', '/charts/notes')).not.toHaveProperty('entries');
  });

  it('C1 · publicar un producto manda sólo lo que el DTO declara', () => {
    TestBed.inject(PharmacyClient)
      .publishProduct(UUID, {
        productCode: 'SKU-1',
        unitPrice: 12,
        status: 'PUBLISHED',
        imageFileIds: [UUID],
      })
      .subscribe();
    expect(cuerpoAceptado('POST', `/pharmacies/${UUID}/products`)).toEqual({
      productCode: 'SKU-1',
    });
  });

  it('C2 · cambiar sólo el precio no sale: dice qué no está disponible', async () => {
    const error = await firstValueFrom(
      TestBed.inject(PharmacyClient).updateProduct(UUID, UUID, { unitPrice: 15 }),
    ).catch((e: unknown) => e);
    http.expectNone(`/pharmacies/${UUID}/products/${UUID}`);
    expect(unavailableMessageOf(error)).toBe(
      'Cambiar el precio de un producto: todavía no está disponible. El servidor aún no ofrece esta función.',
    );
  });

  it('C8 · una pregunta de opción viaja con sus opciones', () => {
    TestBed.inject(FormsClient)
      .createFieldDefinition({
        code: 'fuma',
        name: '¿Fuma?',
        dataType: 'code',
        options: ['Sí', 'No'],
        multiple: false,
        allowOther: true,
      })
      .subscribe();
    expect(cuerpoAceptado('POST', '/forms/field-definitions')).toEqual({
      code: 'fuma',
      name: '¿Fuma?',
      dataType: 'code',
      options: ['Sí', 'No'],
      multiple: false,
      allowOther: true,
    });
  });

  it('C8 · una cuadrícula no se declara a medias', async () => {
    const error = await firstValueFrom(
      TestBed.inject(FormsClient).createFieldDefinition({
        code: 'sintomas',
        name: 'Síntomas',
        dataType: 'code',
        options: ['Nunca', 'A veces'],
        rows: ['Disnea', 'Edema'],
      }),
    ).catch((e: unknown) => e);
    http.expectNone('/forms/field-definitions');
    expect(unavailableMessageOf(error)).toContain('Guardar las filas de la cuadrícula de una pregunta');
  });

  it('C8 · una pregunta de texto sí se declara', () => {
    TestBed.inject(FormsClient)
      .createFieldDefinition({ code: 'nota', name: 'Nota', dataType: 'string' })
      .subscribe();
    cuerpoAceptado('POST', '/forms/field-definitions');
  });

  it('C13 · quitar todos los idiomas manda la lista vacía', () => {
    TestBed.inject(ProfilesClient).updateOwnPractitionerProfile({ languages: [] }).subscribe();
    expect(cuerpoAceptado('PATCH', '/profiles/practitioners/me')).toEqual({ languages: [] });
  });

  it('C13 · sólo la frecuencia de facturación no manda un PATCH vacío', async () => {
    const error = await firstValueFrom(
      TestBed.inject(ProfilesClient).updateOwnPractitionerProfile({
        insuranceBillingFrequency: 'MONTHLY',
      } as never),
    ).catch((e: unknown) => e);
    http.expectNone('/profiles/practitioners/me');
    expect(unavailableMessageOf(error)).toContain('La frecuencia de facturación a seguros');
  });

  it('C13 · con otros cambios, la frecuencia de facturación se queda afuera y el resto viaja', () => {
    TestBed.inject(ProfilesClient)
      .updateOwnPractitionerProfile({
        professionalTitle: 'Cardióloga',
        insuranceBillingFrequency: 'MONTHLY',
      } as never)
      .subscribe();
    expect(cuerpoAceptado('PATCH', '/profiles/practitioners/me')).toEqual({
      professionalTitle: 'Cardióloga',
    });
  });

  it('C13 · los idiomas con dato viajan enteros', () => {
    const languages = [
      { languageConceptId: UUID, proficiencyConceptId: UUID, clinicalInterpretationAllowed: true },
    ];
    TestBed.inject(ProfilesClient).updateOwnPractitionerProfile({ languages } as never).subscribe();
    expect(cuerpoAceptado('PATCH', '/profiles/practitioners/me')).toEqual({ languages });
  });

  it('C14 · la búsqueda filtrada por sangre o idioma no sale sin filtrar', async () => {
    const error = await firstValueFrom(
      TestBed.inject(ProfilesClient).searchPatients({ aboGroupConceptId: UUID }),
    ).catch((e: unknown) => e);
    http.expectNone('/profiles/patients/search');
    expect(unavailableMessageOf(error)).toContain('grupo sanguíneo');
  });

  it('C15 · la sucursal conserva la descripción y el enlace de mapa admitidos por la API', () => {
    TestBed.inject(DirectoryClient)
      .createBranch(UUID, {
        code: 'S1',
        name: 'Centro',
        description: 'Planta baja',
        locationUrl: 'https://x',
      })
      .subscribe();
    expect(cuerpoAceptado('POST', `/tenants/${UUID}/branches`)).toEqual({
      code: 'S1',
      name: 'Centro',
      description: 'Planta baja',
      locationUrl: 'https://x',
    });
  });

  it('P50 · el alta de farmacia sale con claves que el DTO real declara', () => {
    TestBed.inject(IamClient)
      .registerPharmacyOrganization({
        code: 'FARM-1023456029',
        legalName: 'Farmacia Central S.R.L.',
        legalEntityType: 'SRL',
        countryConceptId: UUID,
        jurisdictionConceptId: UUID,
        taxIdentifier: '1023456029',
        legalAddress: 'Av. Cristo Redentor 1234',
        headquarters: { latitude: -17.78, longitude: -63.18 },
        branches: [
          {
            name: 'Sucursal Equipetrol',
            latitude: -17.76,
            longitude: -63.19,
            description: 'Frente a la plaza',
            locationUrl: 'https://maps.example/x',
          },
        ],
        owner: { email: 'legal@farmacia.test', password: 'secreto12', displayName: 'Mariana Siles' },
        legalRepresentative: {
          fullName: 'Mariana Siles',
          email: 'legal@farmacia.test',
          idNumber: '4872190 SC',
        },
      })
      .subscribe();
    const cuerpo = cuerpoAceptado('POST', '/iam/auth/register-organization') as {
      organization: { pharmacy: unknown };
    };
    expect(cuerpo.organization.pharmacy).toEqual(
      expect.objectContaining({ address: 'Av. Cristo Redentor 1234' }),
    );
  });

  it('§2 · buscar personas no sale a una ruta que la API no publica', async () => {
    const error = await firstValueFrom(
      TestBed.inject(IamClient).searchUsers({ query: 'ana' }),
    ).catch((e: unknown) => e);
    http.expectNone('/iam/users/search');
    expect(unavailableMessageOf(error)).toContain('Buscar personas registradas');
  });
});
