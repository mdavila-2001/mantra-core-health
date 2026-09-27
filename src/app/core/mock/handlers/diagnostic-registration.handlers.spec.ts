import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { registrarAuth } from './auth.handlers';
import { registrarVarios } from './misc.handlers';

/**
 * El alta pública de laboratorio y de centro de imagenología (BR-09) contra el
 * simulador: los cuatro catálogos que lee por `dynamic-enums` y el alta
 * institucional por `register-organization` con `DIAGNOSTIC_CENTER`.
 *
 * Antes de estos catálogos el tipo de unidad y la modalidad caían en las
 * unidades de dosis y el país en el conjunto por omisión, así que el alta de la
 * maqueta frenaba con «No pudimos cargar los catálogos del alta» antes de subir
 * un solo PDF.
 */
describe('alta de laboratorio y centro de imagenología en el simulador', () => {
  const router = new MockRouter();
  registrarAuth(router);
  registrarVarios(router);

  function call(method: MockMethod, path: string, options: { body?: unknown; query?: string } = {}) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(options.query ?? ''),
      body: options.body ?? null,
      headers: new HttpHeaders(),
      // El alta es anónima: nadie inició sesión todavía.
      user: null,
    });
    return isMockReply(result) ? result : { status: 200, body: result };
  }

  /** Código → id del catálogo de un destino, como lo arma `AltaDeCentroDiagnostico`. */
  function catalog(target: string): Map<string, string> {
    const { options } = call('GET', '/system-context/dynamic-enums', { query: `target=${target}` }).body as {
      options: readonly { code: string; conceptId: string }[];
    };
    return new Map(options.map((option) => [option.code, option.conceptId]));
  }

  const TARGETS = {
    unitType: 'diagnostic_units.diagnostic_units.diagnostic_unit_type_concept_id',
    modality: 'diagnostic_units.diagnostic_study_offerings.modality_concept_id',
    country: 'directory.tenants.country_concept_id',
    jurisdiction: 'profiles.jurisdiction_authorizations.jurisdiction_concept_id',
  } as const;

  it('correcto — cada catálogo trae los códigos que el alta resuelve', () => {
    // Los de `CODIGOS_DE_DIAGNOSTICO` (`features/auth/registro-compartido/
    // alta-de-centro-diagnostico.ts`), repetidos acá porque `core/` no importa
    // de `features/`, ni siquiera en una prueba.
    expect([...catalog(TARGETS.unitType).keys()]).toEqual(['DU_TYPE_LAB', 'DU_TYPE_IMAGING']);
    expect([...catalog(TARGETS.modality).keys()]).toEqual([
      'DU_MODALITY_LAB',
      'DU_MODALITY_XRAY',
      'DU_MODALITY_ULTRASOUND',
      'DU_MODALITY_CT',
      'DU_MODALITY_MRI',
      'DU_MODALITY_MAMMOGRAPHY',
      'DU_MODALITY_BONE_DENSITOMETRY',
    ]);
    expect(catalog(TARGETS.country).has('BO')).toBe(true);
    expect(catalog(TARGETS.jurisdiction).has('JURISDICTION_NATIONAL')).toBe(true);
  });

  it('límite — el país es sólo Bolivia, como en la API, y la jurisdicción no mezcla los códigos JUR-*', () => {
    expect([...catalog(TARGETS.country).keys()]).toEqual(['BO']);
    expect([...catalog(TARGETS.jurisdiction).keys()].some((code) => code.startsWith('JUR-'))).toBe(false);
  });

  it('correcto — el alta del centro de imagenología con esos conceptos da 201 pendiente de verificación', () => {
    const unitType = catalog(TARGETS.unitType);
    const modality = catalog(TARGETS.modality);

    const result = call('POST', '/iam/auth/register-organization', {
      body: {
        organization: {
          code: 'IMG_PRUEBA',
          legalName: 'Imágenes de Prueba S.R.L.',
          legalEntityType: 'SRL',
          tenantType: 'DIAGNOSTIC_CENTER',
          timeZone: 'America/La_Paz',
          countryConceptId: catalog(TARGETS.country).get('BO'),
          jurisdictionConceptId: catalog(TARGETS.jurisdiction).get('JURISDICTION_NATIONAL'),
          diagnosticUnit: {
            diagnosticUnitTypeConceptId: unitType.get('DU_TYPE_IMAGING'),
            modalityConceptIds: [modality.get('DU_MODALITY_XRAY'), modality.get('DU_MODALITY_MRI')],
          },
          legalDocuments: {
            constitutionFileId: 'f1',
            taxIdentifierFileId: 'f2',
            commerceRegistryFileId: 'f3',
            operatingLicenseFileId: 'f4',
            healthAuthorityCertificateFileId: 'f5',
          },
          legalRepresentative: { fullName: 'Ana Rojas', idNumber: '4455667', email: 'ana@imagenes.test', powerOfAttorneyFileId: 'f6' },
        },
        owner: { email: 'ana@imagenes.test', password: 'secreto12', displayName: 'Ana Rojas' },
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        status: 'PENDING_VERIFICATION',
        diagnosticUnitId: expect.any(String),
        legalDocumentsRegistered: 5,
        representativesRegistered: 1,
      }),
    );
  });

  it('inválido — sin jurisdicción el centro responde 422 nombrando lo que falta', () => {
    const result = call('POST', '/iam/auth/register-organization', {
      body: {
        organization: {
          code: 'LAB_PRUEBA',
          legalName: 'Lab de Prueba',
          legalEntityType: 'UNIPERSONAL',
          tenantType: 'DIAGNOSTIC_CENTER',
          countryConceptId: catalog(TARGETS.country).get('BO'),
        },
        owner: { email: 'x@lab.test', password: 'secreto12', displayName: 'X' },
      },
    });

    expect(result.status).toBe(422);
    expect(JSON.stringify(result.body)).toContain('jurisdictionConceptId');
  });
});
