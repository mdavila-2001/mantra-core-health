import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
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

  it('inválido — un destino que no es del alta no trae los códigos de diagnóstico', () => {
    const codes = [...catalog('diagnostic_units.diagnostic_units.otra_columna_concept_id').keys()];

    expect(codes.some((code) => code.startsWith('DU_'))).toBe(false);
  });

  // En `mockup` las pantallas del alta todavía no llaman a
  // `register-organization` (BR-09, cbfce9ee, sólo está en `test`), y el
  // manejador del alta no admite `DIAGNOSTIC_CENTER`: las dos pruebas del alta
  // viven sólo en `test`. Los catálogos sí van, para que el día que llegue BR-09
  // el alta no frene en «No pudimos cargar los catálogos del alta».
});
